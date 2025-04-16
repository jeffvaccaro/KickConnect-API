const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const upload = require('./upload.js');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticateToken = require('./middleware/authenticateToken.cjs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

router.post('/upload-bgImage', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const photoURL = `/uploads/${req.file.filename}`;
    res.status(200).json({ message: 'Upload complete', url: photoURL });
  } catch (error) {
    console.error('Error during image upload:', error);
    res.status(500).json({ error: 'Error during image upload: ' + error.message });
  }
});

module.exports = router;
