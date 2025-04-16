const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('./db');
const router = express.Router();
const authenticateToken = require('./middleware/authenticateToken.cjs');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { sendEmail } = require('./middleware/emailService.js');

dotenv.config({ path: path.resolve(__dirname, `../.env.${process.env.NODE_ENV || 'development'}`) });

// GET Route
router.get('/get-accounts', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM account');
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).send('Error fetching accounts');
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-accounts: Connection not established.');
        }
    }
});

// POST Route
router.post('/add-account', authenticateToken, async (req, res) => {
    const { accountName, accountPhone, accountEmail, accountAddress, accountCity, accountState, accountZip, isSuperAdmin, phone2, password, role = [] } = req.body;
    const isSuperAdminValue = isSuperAdmin || false;

    let connection;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        try {
            await connection.beginTransaction();

            const [accountResult] = await connection.query(
                'INSERT INTO admin.account (accountCode, accountName, accountPhone, accountEmail, accountAddress, accountCity, accountState, accountZip, isSuperAdmin, CreatedBy) VALUES (UUID(),?,?,?,?,?,?,?,?,"API Account Register")',
                [accountName, accountPhone, accountEmail, accountAddress, accountCity, accountState, accountZip, isSuperAdminValue]
            );
            const accountId = accountResult.insertId;

            const [account] = await connection.query(
                'SELECT accountCode FROM admin.account WHERE accountId = ?',
                [accountId]
            );
            const accountCode = account[0].accountCode;

            await connection.query(
                'INSERT INTO admin.user (accountId, name, email, phone, phone2, address, city, state, zip, password, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "API Register Insert of OWNER")',
                [accountId, accountName, accountEmail, accountPhone, phone2, accountAddress, accountCity, accountState, accountZip, hashedPassword]
            );

            const [result] = await connection.query('SELECT LAST_INSERT_ID() AS userId');
            const userId = result[0].userId;

            if (!Array.isArray(role)) {
                console.error('role is not an array:', role);
                return res.status(400).json({ error: 'role must be an array' });
            }

            const userRoleQuery = 'INSERT INTO userroles (userId, roleId) VALUES (?, ?);';
            const userRolePromises = role.map((roleId) => {
                return connection.query(userRoleQuery, [userId, roleId])
                    .then(result => {
                        console.log(`Role ${roleId} inserted successfully for user ${userId}:`, result);
                        return result;
                    })
                    .catch(error => {
                        console.error(`Error inserting role ${roleId} for user ${userId}:`, error);
                        throw error;
                    });
            });

            await Promise.all(userRolePromises);
            console.log('All roles inserted successfully.');

            console.log('Preparing to send email...');
            await sendEmail(accountEmail, accountName, userId, accountId, accountCode);
            console.log('Email sent successfully.');

            await connection.commit();
            res.status(201).json({ message: 'Account and user created successfully' });
        } catch (err) {
            await connection.rollback();
            console.error('Transaction error:', err);
            res.status(500).json({ error: 'Error processing request' });
        }
    } catch (error) {
        console.error('Error hashing password or connecting to database:', error);
        res.status(500).json({ error: 'Error processing request' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('add-account: Connection not established.');
        }
    }
});

module.exports = router;
