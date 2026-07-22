const express = require('express');
const multer = require('multer'); // took a lot of trial and error to figure this out
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// letting the frontend talk to this without CORS blocking everything
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');

// make sure the folder exists so the server doesn't crash on start
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// using JSON files as my "database" because I haven't learned MongoDB yet lol
const activePlaylistFile = path.join(__dirname, 'active-playlist.json');
const playlistFile = path.join(__dirname, 'playlist.json');

// setting up multer to handle the chunked file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // adding a temp prefix so we know it's a chunk and not a finished file
        cb(null, 'temp-' + Date.now());
    }
});
const upload = multer({ storage: storage });

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// keeping the live playback state in memory. 
// Note to self: this completely resets if the server restarts!
let installState = { 
    isPlaying: false, 
    currentTrack: null, 
    startTimestamp: 0 
};

app.get('/install-state', (req, res) => {
    res.json(installState);
});

app.post('/install-state', (req, res) => {
    // just overwriting the whole state object for now, seems to work fine
    installState = req.body;
    res.json({ success: true });
});

// this function is kind of a mess, but it syncs the actual folder files with the saved JSON order
function getPlaylistOrder() {
    // grab all real files (ignore the temporary multer chunks)
    const allFiles = fs.readdirSync(uploadDir).filter(file => !file.startsWith('temp-'));
    let playlist = [];
    
    if (fs.existsSync(playlistFile)) {
        playlist = JSON.parse(fs.readFileSync(playlistFile));
        
        // clean up any files that were deleted manually from the folder
        playlist = playlist.filter(fileName => allFiles.includes(fileName));
        
        // add any new files that were dropped in the folder manually
        allFiles.forEach(fileName => { 
            if (!playlist.includes(fileName)) {
                playlist.push(fileName); 
            }
        });
    } else {
        playlist = allFiles;
    }
    
    // save the fixed list back to the json file
    fs.writeFileSync(playlistFile, JSON.stringify(playlist));
    return playlist;
}

app.get('/active-playlist', (req, res) => {
    if (fs.existsSync(activePlaylistFile)) {
        const fileData = fs.readFileSync(activePlaylistFile);
        res.json(JSON.parse(fileData));
    } else {
        res.json({ queue: [] });
    }
});

app.post('/update-queue', express.json(), (req, res) => {
    const { queue } = req.body;
    
    // saving the queue array inside an object just in case I need to add more properties later
    const dataToSave = { queue: queue || [] };
    fs.writeFileSync(activePlaylistFile, JSON.stringify(dataToSave));
    
    console.log("Queue updated:", queue);
    res.json({ status: 'success' });
});

app.get('/tracks', (req, res) => {
    try {
        res.json({ tracks: getPlaylistOrder() });
    } catch (err) {
        console.error("Oops, track read error:", err);
        res.status(500).json({ error: 'Failed to read tracks' });
    }
});

app.post('/reorder-tracks', express.json(), (req, res) => {
    const { newOrder } = req.body;
    
    if (newOrder && Array.isArray(newOrder)) {
        fs.writeFileSync(playlistFile, JSON.stringify(newOrder));
        res.json({ status: 'success' });
    } else {
        res.status(400).json({ error: 'Invalid order data' });
    }
});

app.post('/delete-track', express.json(), (req, res) => {
    const { filename } = req.body;
    const targetPath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    // delete the actual file
    fs.unlinkSync(targetPath);
    
    // update the active queue so we don't try to play a deleted song and break the frontend
    if (fs.existsSync(activePlaylistFile)) {
        let state = JSON.parse(fs.readFileSync(activePlaylistFile));
        state.queue = state.queue.filter(track => track !== filename);
        fs.writeFileSync(activePlaylistFile, JSON.stringify(state));
    }
    
    res.json({ status: 'success' });
});

app.post('/rename-track', express.json(), (req, res) => {
    const { oldName, newName } = req.body;
    
    // making sure they didn't forget the extension when renaming
    const ext = path.extname(oldName);
    const finalNewName = newName.endsWith(ext) ? newName : newName + ext;
    
    const oldPath = path.join(uploadDir, oldName);
    const newPath = path.join(uploadDir, finalNewName);

    if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    fs.renameSync(oldPath, newPath);
    
    // update the main library memory
    let playlist = getPlaylistOrder();
    const index = playlist.indexOf(oldName);
    if (index !== -1) {
        playlist[index] = finalNewName;
        fs.writeFileSync(playlistFile, JSON.stringify(playlist));
    }

    // update the active queue memory too
    if (fs.existsSync(activePlaylistFile)) {
        let state = JSON.parse(fs.readFileSync(activePlaylistFile));
        const qIndex = state.queue.indexOf(oldName);
        
        if (qIndex !== -1) {
            state.queue[qIndex] = finalNewName;
            fs.writeFileSync(activePlaylistFile, JSON.stringify(state));
        }
    }
    
    res.json({ status: 'success', newName: finalNewName });
});

// handling the chunked uploads from the frontend
app.post('/upload', upload.single('chunk'), (req, res) => {
    const { filename, chunkIndex, totalChunks } = req.body;
    const chunkPath = req.file.path;
    const targetPath = path.join(uploadDir, filename);

    // if this is the very first piece, clear out any old file with the same name
    if (parseInt(chunkIndex) === 0 && fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }
    
    // stick this chunk onto the end of the real file. 
    // using sync methods here blocks the thread but it's fast enough for now 🤞
    const chunkData = fs.readFileSync(chunkPath);
    fs.appendFileSync(targetPath, chunkData);
    
    // delete the temporary multer file so the server doesn't fill up with garbage
    fs.unlinkSync(chunkPath);

    // check if we reached the last chunk!
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
        return res.json({ status: 'complete', track: { name: filename } });
    }
    
    res.json({ status: 'chunk_received' });
});

// gotta run with sudo if I'm using port 80 on Linux
app.listen(80, () => {
    console.log('Facade sync server is live on port 80 (Queue System Enabled)');
});