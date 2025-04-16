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
router.get('/get-all-members', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM member ORDER BY lastName ASC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-all-members: Connection not established.');
        }
    }
});

router.get('/get-member-by-id', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { memberId } = req.query;
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [memberResults] = await connection.query('SELECT * FROM member WHERE memberId = ?', [memberId]);
        res.json(memberResults[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-plan-by-id: Connection not established.');
        }
    }
});

// PUT Route
router.put('/update-member', authenticateToken, async (req, res) => {
    const { memberId } = req.query;
    const { memberPlanId, homeLocationId, firstName, lastName, phone, email, birthday, contactName, contactPhone, signupDate, renewalDate, isActive } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const memberUpdateQuery = `
            UPDATE member
            SET memberPlanId = ?,
                homeLocationId = ?,
                firstName = ?,
                lastName = ?,
                phone = ?,
                email = ?,
                birthday = ?,
                contactName = ?,
                contactPhone = ?,
                signupDate = ?,
                renewalDate = ?,
                isActive = ?
            WHERE memberId = ?;
        `;
        await connection.query(planUpdateQuery, [memberPlanId, homeLocationId, firstName, lastName, phone, email, birthday, contactName, contactPhone, signupDate, renewalDate, isActive, memberId]);
        res.status(200).json({ message: 'Member updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('update-member: Connection not established.');
        }
    }
});

// POST Route
router.post('/add-member', async (req, res) => {
    const { accountId, memberPlanId, homeLocationId, firstName, lastName, phone, email, birthday, contactName, contactPhone, signupDate, renewalDate, isActive } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        // First insert query
        const memberInsertQuery = `
            INSERT INTO admin.member (memberPlanId, homeLocationId, firstName, lastName,
            phone, email, birthday, contactName, contactPhone, signupDate,
            renewalDate, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`;
        const [memberResult] = await connection.query(memberInsertQuery, [memberPlanId, homeLocationId, firstName, lastName, phone, email, birthday, contactName, contactPhone, signupDate, renewalDate]);

        const memberId = memberResult.insertId;
        // Additional insert query
        const additionalInsertQuery = `
            INSERT INTO admin.memberaccounts (memberId, accountId) VALUES (?, ?);`;
        await connection.query(additionalInsertQuery, [memberId, accountId]);

        res.status(200).json({ message: 'Member added and additional insert completed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('add-member: Connection not established.');
        }
    }
});

module.exports = router;
