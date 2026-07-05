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

const activeTrackFile = path.join(__dirname, 'current-track.json');

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

app.get('/current-track', (req, res) => {
    if (fs.existsSync(activeTrackFile)) {
        const trackData = fs.readFileSync(activeTrackFile);
        res.json(JSON.parse(trackData));
    } else {
        res.status(404).json({ error: 'No track set' });
    }
});

// NEW: Get all tracks stored in the library
app.get('/tracks', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to read tracks' });
        // Filter out temporary chunk files
        const cleanFiles = files.filter(f => !f.startsWith('temp-'));
        res.json({ tracks: cleanFiles });
    });
});

// NEW: Admin sets a specific track as active
app.post('/set-active-track', express.json(), (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'No filename provided' });

    const trackInfo = {
        name: filename,
        url: `/uploads/${filename}`
    };
    fs.writeFileSync(activeTrackFile, JSON.stringify(trackInfo));
    console.log(`Active track switched to: ${filename}`);
    res.json({ status: 'success', track: trackInfo });
});

app.post('/upload', upload.single('chunk'), (req, res) => {
    const { filename, chunkIndex, totalChunks } = req.body;
    const chunkPath = req.file.path;
    const targetPath = path.join(uploadDir, filename);

    if (parseInt(chunkIndex) === 0 && fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }

    fs.appendFileSync(targetPath, fs.readFileSync(chunkPath));
    fs.unlinkSync(chunkPath);

    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
        console.log(`Successfully assembled large track: ${filename}`);
        
        const trackInfo = {
            name: filename,
            url: `/uploads/${filename}`
        };
        fs.writeFileSync(activeTrackFile, JSON.stringify(trackInfo));
        return res.json({ status: 'complete', track: trackInfo });
    }

    res.json({ status: 'chunk_received' });
});

app.listen(80, () => {
    console.log('Facade sync server is live on port 80 (Library Enabled)');
});