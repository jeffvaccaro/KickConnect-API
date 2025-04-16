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
router.get('/get-all-plans', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM membershipplan ORDER BY planCost ASC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-all-plans: Connection not established.');
        }
    }
});

router.get('/get-plan-by-id', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { planId } = req.query;
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [planResults] = await connection.query('SELECT * FROM membershipplan WHERE planId = ?', [planId]);
        res.json(planResults[0] || {});
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
router.put('/update-plan', authenticateToken, async (req, res) => {
    const { planId } = req.query;
    const { planDescription, planCost } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const planUpdateQuery = `
            UPDATE membershipplan
            SET planDescription = ?, planCost = ?
            WHERE planId = ?;
        `;
        await connection.query(planUpdateQuery, [planDescription, planCost, planId]);
        res.status(200).json({ message: 'Plan updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('update-plan: Connection not established.');
        }
    }
});

// POST Route
router.post('/add-plan', authenticateToken, async (req, res) => {
    const { planDescription, planCost } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const planInsertQuery = `
            INSERT INTO admin.membershipplan (planDescription, planCost)
            VALUES(?, ?);
        `;
        await connection.query(planInsertQuery, [planDescription, planCost]);
        res.status(200).json({ message: 'Plan added successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('add-skill: Connection not established.');
        }
    }
});

// DELETE Route
router.delete('/delete-plan/:planId', authenticateToken, async (req, res) => {
    const { planId } = req.params;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const planDeleteQuery = `
            DELETE FROM membershipplan
            WHERE planId = ?;
        `;
        await connection.query(planDeleteQuery, [planId]);
        res.status(200).json({ message: 'Plan deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing plan query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('delete-skill: Connection not established.');
        }
    }
});

module.exports = router;
