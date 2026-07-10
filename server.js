const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Replaced single track with a Queue state file
const activePlaylistFile = path.join(__dirname, 'active-playlist.json');
const playlistFile = path.join(__dirname, 'playlist.json');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, 'temp-' + Date.now())
    }
});
const upload = multer({ storage: storage });

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function getPlaylistOrder() {
    const files = fs.readdirSync(uploadDir).filter(f => !f.startsWith('temp-'));
    let playlist = [];
    if (fs.existsSync(playlistFile)) {
        playlist = JSON.parse(fs.readFileSync(playlistFile));
        playlist = playlist.filter(f => files.includes(f));
        files.forEach(f => { if (!playlist.includes(f)) playlist.push(f); });
    } else {
        playlist = files;
    }
    fs.writeFileSync(playlistFile, JSON.stringify(playlist));
    return playlist;
}

// NEW: Get the current active queue
app.get('/active-playlist', (req, res) => {
    if (fs.existsSync(activePlaylistFile)) {
        res.json(JSON.parse(fs.readFileSync(activePlaylistFile)));
    } else {
        res.json({ queue: [] });
    }
});

// NEW: Save the active queue
app.post('/update-queue', express.json(), (req, res) => {
    const { queue } = req.body;
    fs.writeFileSync(activePlaylistFile, JSON.stringify({ queue: queue || [] }));
    console.log("Queue updated:", queue);
    res.json({ status: 'success' });
});

app.get('/tracks', (req, res) => {
    try {
        res.json({ tracks: getPlaylistOrder() });
    } catch (err) {
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

// Update delete to remove from queue memory
app.post('/delete-track', express.json(), (req, res) => {
    const { filename } = req.body;
    const targetPath = path.join(uploadDir, filename);
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        if (fs.existsSync(activePlaylistFile)) {
            let state = JSON.parse(fs.readFileSync(activePlaylistFile));
            state.queue = state.queue.filter(t => t !== filename);
            fs.writeFileSync(activePlaylistFile, JSON.stringify(state));
        }
        res.json({ status: 'success' });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// Update rename to alter queue memory
app.post('/rename-track', express.json(), (req, res) => {
    const { oldName, newName } = req.body;
    const ext = path.extname(oldName);
    let finalNewName = newName.endsWith(ext) ? newName : newName + ext;
    const oldPath = path.join(uploadDir, oldName);
    const newPath = path.join(uploadDir, finalNewName);

    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        
        let playlist = getPlaylistOrder();
        const index = playlist.indexOf(oldName);
        if(index !== -1) {
            playlist[index] = finalNewName;
            fs.writeFileSync(playlistFile, JSON.stringify(playlist));
        }

        if (fs.existsSync(activePlaylistFile)) {
            let state = JSON.parse(fs.readFileSync(activePlaylistFile));
            const qIndex = state.queue.indexOf(oldName);
            if (qIndex !== -1) {
                state.queue[qIndex] = finalNewName;
                fs.writeFileSync(activePlaylistFile, JSON.stringify(state));
            }
        }
        res.json({ status: 'success', newName: finalNewName });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.post('/upload', upload.single('chunk'), (req, res) => {
    const { filename, chunkIndex, totalChunks } = req.body;
    const chunkPath = req.file.path;
    const targetPath = path.join(uploadDir, filename);

    if (parseInt(chunkIndex) === 0 && fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    
    fs.appendFileSync(targetPath, fs.readFileSync(chunkPath));
    fs.unlinkSync(chunkPath);

    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
        return res.json({ status: 'complete', track: { name: filename } });
    }
    res.json({ status: 'chunk_received' });
});

app.listen(80, () => {
    console.log('Facade sync server is live on port 80 (Queue System Enabled)');
});