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
router.get('/get-all-roles', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM role ORDER BY roleOrderId ASC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-all-roles: Connection not established.');
        }
    }
});

router.get('/get-roles', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM role WHERE roleId != 1 ORDER BY roleOrderId ASC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-roles: Connection not established.');
        }
    }
});

router.get('/get-role-by-id', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { roleId } = req.query;
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [roleResults] = await connection.query('SELECT * FROM role WHERE roleId = ?', [roleId]);
        res.json(roleResults[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-role-by-id: Connection not established.');
        }
    }
});

// PUT Routes
router.put('/update-role', authenticateToken, async (req, res) => {
    const { roleId } = req.query;
    const { roleName, roleDescription } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const roleUpdateQuery = `
            UPDATE role
            SET roleName = ?, roleDescription = ?
            WHERE roleId = ?;
        `;
        await connection.query(roleUpdateQuery, [roleName, roleDescription, roleId]);
        res.status(200).json({ message: 'Role updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing role query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('update-role: Connection not established.');
        }
    }
});

router.put('/update-role-order', authenticateToken, async (req, res) => {
    const { roleId } = req.query;
    const { roleOrderId } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        await connection.query('SET SQL_SAFE_UPDATES = 0;');
        await connection.beginTransaction();
        const [currentRole] = await connection.query('SELECT roleOrderId FROM role WHERE roleId = ?', [roleId]);
        const currentRoleOrderId = currentRole[0].roleOrderId;
        if (currentRoleOrderId < roleOrderId) {
            await connection.query('UPDATE role SET roleOrderId = roleOrderId - 1 WHERE roleOrderId > ? AND roleOrderId <= ?', [currentRoleOrderId, roleOrderId]);
        } else if (currentRoleOrderId > roleOrderId) {
            await connection.query('UPDATE role SET roleOrderId = roleOrderId + 1 WHERE roleOrderId >= ? AND roleOrderId < ?', [roleOrderId, currentRoleOrderId]);
        }
        await connection.query('UPDATE role SET roleOrderId = ? WHERE roleId = ?', [roleOrderId, roleId]);
        await connection.commit();
        res.status(200).json({ message: 'Role order updated successfully' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ error: 'Error updating role order' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('update-role-order: Connection not established.');
        }
    }
});

// POST Routes
router.post('/add-role', authenticateToken, async (req, res) => {
    const { roleName, roleDescription } = req.body;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const roleInsertQuery = `
            INSERT INTO admin.role (roleName, roleDescription, roleOrderId)
            SELECT ?, ?, IFNULL(MAX(roleOrderId) + 1, 1)
            FROM admin.role;
        `;
        await connection.query(roleInsertQuery, [roleName, roleDescription]);
        res.status(200).json({ message: 'Role added successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error executing role query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('add-role: Connection not established.');
        }
    }
});

// DELETE Route
router.delete('/delete-role/:roleId', authenticateToken, async (req, res) => {
    const { roleId } = req.params;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const roleDeleteQuery = `
            DELETE FROM role
            WHERE roleId = ?;
        `;
        await connection.query(roleDeleteQuery, [roleId]);
        res.status(200).json({ message: 'Role deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error executing role query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('delete-role: Connection not established.');
        }
    }
});

module.exports = router;
