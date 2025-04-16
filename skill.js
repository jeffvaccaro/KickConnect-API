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
router.get('/get-all-skills', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM skill ORDER BY skillName ASC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-all-skills: Connection not established.');
        }
    }
});

router.get('/get-skill-by-id', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { skillId } = req.query;
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [roleResults] = await connection.query('SELECT * FROM skill WHERE skillId = ?', [skillId]);
        res.json(roleResults[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-skill-by-id: Connection not established.');
        }
    }
});

// PUT Route
router.put('/update-skill', authenticateToken, async (req, res) => {
    const { skillId } = req.query;
    const { skillName, skillDescription } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const skillUpdateQuery = `
            UPDATE skill
            SET skillName = ?, skillDescription = ?
            WHERE skillId = ?;
        `;
        await connection.query(skillUpdateQuery, [skillName, skillDescription, skillId]);
        res.status(200).json({ message: 'Skill updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing skill query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('update-skill: Connection not established.');
        }
    }
});

// POST Route
router.post('/add-skill', authenticateToken, async (req, res) => {
    const { skillName, skillDescription } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const skillInsertQuery = `
            INSERT INTO admin.skill (skillName, skillDescription)
            VALUES(?, ?);
        `;
        await connection.query(skillInsertQuery, [skillName, skillDescription]);
        res.status(200).json({ message: 'Skill added successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing skill query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('add-skill: Connection not established.');
        }
    }
});

// DELETE Route
router.delete('/delete-skill/:skillId', authenticateToken, async (req, res) => {
    const { skillId } = req.params;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const skillDeleteQuery = `
            DELETE FROM skill
            WHERE skillId = ?;
        `;
        await connection.query(skillDeleteQuery, [skillId]);
        res.status(200).json({ message: 'Skill deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing skill query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('delete-skill: Connection not established.');
        }
    }
});

module.exports = router;
