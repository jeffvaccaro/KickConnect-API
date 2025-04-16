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

// GET Routes
router.get('/get-all-attendance', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM membershipattendance ORDER BY locationId ASC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-all-attendance: Connection not established.');
        }
    }
});

router.get('/get-attendance-by-id', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { memberId } = req.query;
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [attendanceResults] = await connection.query('SELECT * FROM membershipattendance WHERE memberId = ?', [memberId]);
        res.json(attendanceResults[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-attendance-by-id: Connection not established.');
        }
    }
});


// POST Route
router.post('/add-attendance', authenticateToken, async (req, res) => {
    const { memberId,locationId, eventId, attendanceDate } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const attendanceInsertQuery = `
            INSERT INTO admin.membershipattendance (memberId,locationId,eventId,attendanceDate)
            VALUES(?, ?, ?, ?);
        `;
        await connection.query(attendanceInsertQuery, [memberId,locationId, eventId, attendanceDate]);
        res.status(200).json({ message: 'Attendance added successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('add-attendance: Connection not established.');
        }
    }
});

module.exports = router;
