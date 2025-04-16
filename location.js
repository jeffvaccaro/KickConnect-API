const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const mysql = require('mysql2/promise');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('./db');
const authenticateToken = require('./middleware/authenticateToken.cjs');

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// GET Routes
router.get('/get-locations', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000)); // 10 seconds timeout
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM location');
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).send('Error fetching locations');
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-locations: Connection not established.');
        }
    }
});

router.get('/get-locations-by-id/:locationId', authenticateToken, async (req, res) => {
    const { locationId } = req.params;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000)); // 10 seconds timeout
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM admin.location WHERE locationId = ?', [locationId]);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).send('Error fetching locations');
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-locations: Connection not established.');
        }
    }
});

router.get('/get-locations-by-acct-id/:acctId', authenticateToken, async (req, res) => {
    const { acctId } = req.params;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000)); // 10 seconds timeout
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM location WHERE isActive = TRUE AND accountId = ?', [acctId]);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).send('Error fetching locations');
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-locations-by-acct-id/:acctId: Connection not established.');
        }
    }
});

router.get('/get-active-locations', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000)); // 10 seconds timeout
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM location WHERE isActive = TRUE');
        res.status(200).json(results);
    } catch (error) {
        next(error);
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-active-locations: Connection not established.');
        }
    }
});

router.get('/get-inactive-locations', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000)); // 10 seconds timeout
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [results] = await connection.query('SELECT * FROM location WHERE isActive = FALSE');
        res.status(200).json(results);
    } catch (error) {
        next(error);
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-inactive-locations: Connection not established.');
        }
    }
});

// PUT Route
router.put('/update-location/:locationId', authenticateToken, async (req, res) => {
    const { locationId } = req.params;

    if (!req.body.locationData) {
        return res.status(400).json({ error: 'locationData is required' });
    }

    try {
        const locationData = JSON.parse(req.body.locationData);
        const { locationName, locationAddress, locationCity, locationState, locationZip, locationPhone, locationEmail, isActive } = locationData;

        let connection;
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
            connection = await Promise.race([connectToDatabase(), timeout]);
            const locationQuery = `
                UPDATE admin.location
                SET locationName = ?, locationEmail = ?, locationPhone = ?, locationAddress = ?, 
                    locationCity = ?, locationState = ?, locationZip = ?, isActive = ?, updatedBy = "API Location Update"
                WHERE locationId = ?;
            `;
            await connection.query(locationQuery, [
                locationName, locationEmail, locationPhone, locationAddress, locationCity, 
                locationState, locationZip, isActive, locationId
            ]);
            res.json({ message: 'Location updated successfully' });
        } catch (error) {
            console.error('Error updating location:', error);
            res.status(500).json({ error: 'Error updating location: ' + error.message });
        } finally {
            if (connection) {
                connection.release();
            } else {
                console.warn('Connection not established.');
            }
        }
    } catch (error) {
        console.error('Invalid JSON:', error);
        res.status(400).json({ error: 'Invalid JSON: ' + error.message });
    }
});

// POST Route
router.post('/add-location', authenticateToken, async (req, res) => {
    let { accountId, locationName, locationAddress, locationCity, locationState, locationZip, locationPhone, locationEmail } = req.body;
    locationName = locationName.trim();
    locationAddress = locationAddress.trim();
    locationCity = locationCity.trim();
    locationState = locationState.trim();
    locationZip = locationZip.trim();
    locationPhone = locationPhone.trim();
    locationEmail = locationEmail.trim();

    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000)); // 10 seconds timeout
        connection = await Promise.race([connectToDatabase(), timeout]);
        const [result] = await connection.query(
            'INSERT INTO location (accountId, locationName, locationAddress, locationCity, locationState, locationZip, locationPhone, locationEmail, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "API Location Insert")',
            [accountId, locationName, locationAddress, locationCity, locationState, locationZip, locationPhone, locationEmail]
        );
        res.status(201).json({ locationId: result.insertId });
    } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).send('Error creating location');
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('add-location: Connection not established.');
        }
    }
});

module.exports = router;
