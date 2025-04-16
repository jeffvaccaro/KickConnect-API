const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const mysql = require('mysql2/promise');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectToDatabase } = require('./db');
const authenticateToken = require('./middleware/authenticateToken.cjs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// GET Route
router.get('/get-address-info-by-zip/:zip', authenticateToken, async (req, res) => {
    const { zip } = req.params;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        
        const [results] = await connection.query('SELECT * FROM common.cities_extended WHERE zip = ? LIMIT 1', [zip]);
        if (results.length === 0) {
            return res.status(404).json({ message: 'City/State Info not found' });
        }
        res.status(200).json(results[0]);
    } catch (error) {
        console.error('Error fetching City/State Info:', error);
        res.status(500).send('Error fetching City/State Info');
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-address-info-by-zip/:zip: Connection not established.');
        }
    }
});

module.exports = router;
