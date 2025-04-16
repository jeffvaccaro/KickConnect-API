const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const upload = require('./upload.js');
const mysql = require('mysql2/promise');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { sendEmail } = require('./middleware/emailService.js');
const { connectToDatabase } = require('./db');
const authenticateToken = require('./middleware/authenticateToken.cjs');
const RoleEnum = require('./enum/roleEnum.js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

router.get('/get-all-users', authenticateToken, async (req, res) => {
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        const query = `
            SELECT a.accountName, a.accountCode, u.*, GROUP_CONCAT(r.roleName SEPARATOR ', ') AS roleNames, p.description, p.skills, p.url
            FROM admin.account a
            INNER JOIN admin.user u ON a.accountId = u.accountId
            INNER JOIN admin.userroles ur ON u.userId = ur.userId
            INNER JOIN admin.role r ON ur.roleId = r.roleId
            LEFT JOIN admin.profile p ON u.userId = p.userId
            GROUP BY a.accountName, a.accountCode, u.userId, p.description, p.skills, p.url`;
        
        const [results] = await connection.query(query);
        res.json(results);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-all-users: Connection not established.');
        }
    }
});

router.get('/get-users-by-account-code', authenticateToken, async (req, res) => {
    const accountCode = req.query.accountcode;
    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        const query = `
            SELECT a.accountName, u.*, r.roleName AS roleNames
            FROM admin.account a
            INNER JOIN admin.user u ON a.accountId = u.accountId
            INNER JOIN admin.userroles ur ON u.userId = ur.userId
            INNER JOIN admin.role r ON ur.roleId = r.roleId
            WHERE a.accountcode = ?
            AND ur.roleId != 1
        `;
        const [results] = await connection.query(query, [accountCode]);
        res.json(results);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-users-by-account-code: Connection not established.');
        }
    }
});

router.get('/get-users', authenticateToken, async (req, res) => {
    let connection;
    try {
        let { accountCode } = req.query;

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        const [accountResults] = await connection.query('SELECT accountId FROM account WHERE accountCode = ?', [accountCode]);
        if (accountResults.length === 0) {
            return res.status(404).send('Account not found');
        }
        const accountId = accountResults[0].accountId;

        const query = `
            SELECT a.accountName, a.accountCode, u.*, GROUP_CONCAT(r.roleName SEPARATOR ', ') AS roleNames, p.description, p.skills, p.url
            FROM admin.account a
            INNER JOIN admin.user u ON a.accountId = u.accountId
            INNER JOIN admin.userroles ur ON u.userId = ur.userId
            INNER JOIN admin.role r ON ur.roleId = r.roleId
            LEFT JOIN admin.profile p ON u.userId = p.userId
            WHERE u.accountId = ?
            AND ur.roleId != 1
            GROUP BY a.accountName, a.accountCode, u.userId, p.description, p.skills, p.url
        `;

        const [userResults] = await connection.query(query, [accountId]);

        res.json(userResults.length ? userResults : []);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-users: Connection not established.');
        }
    }
});

router.get('/get-user-by-id', authenticateToken, async (req, res) => {
  let connection;
  try {
      const { userId } = req.query;

      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
      connection = await Promise.race([connectToDatabase(), timeout]);

      const query = `
          SELECT 
              u.*, 
              GROUP_CONCAT(DISTINCT r.roleName SEPARATOR ', ') AS roleNames, 
              GROUP_CONCAT(DISTINCT r.roleId SEPARATOR ',') as roleId,
              MAX(p.profileId) AS profileId, 
              MAX(p.description) AS profileDescription, 
              MAX(p.skills) as profileSkills, 
              MAX(p.url) as profileURL,
              MAX(primaryLoc.locationId) as primaryLocation,
              GROUP_CONCAT(DISTINCT altLoc.locationId SEPARATOR ',') as altLocations
          FROM admin.user u
          JOIN admin.userroles ur ON u.userId = ur.userId
          JOIN admin.role r ON ur.roleId = r.roleId
          LEFT JOIN admin.profile p on u.userId = p.userId
          LEFT JOIN admin.profilelocation primaryLoc ON p.profileId = primaryLoc.profileId AND primaryLoc.isHome = 1
          LEFT JOIN admin.profilelocation altLoc ON p.profileId = altLoc.profileId AND altLoc.isHome = 0
          WHERE u.userId = ?
          AND ur.roleId != 1 
          GROUP BY u.userId
      `;    
      const [userResults] = await connection.query(query, [userId]);

      res.json(userResults[0] || {});
  } catch (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Error executing query' });
  } finally {
      if (connection) {
          connection.release();
      } else {
          console.warn('get-user-by-id: Connection not established.');
      }
  }
});

router.get('/send-user-reset-link', authenticateToken, async (req, res) => {
  let connection;
  try {
      console.log('express method called');
      const { userId, accountCode } = req.query;

      if (!userId || !accountCode) {
          return res.status(400).json({ error: 'Missing required parameters' });
      }

      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
      
      console.log('Attempting to establish database connection...');
      connection = await Promise.race([connectToDatabase(), timeout]);
      console.log('Database connection established:', connection);
      
      if (!connection) {
          return res.status(500).json({ error: 'Failed to establish a connection' });
      }

      const query = `
          SELECT u.email, u.name, u.userId, u.accountId
          FROM admin.user u
          WHERE u.userId = ?
      `;
      
      console.log('Executing query:', query, 'with parameters:', [userId]);

      const [userResults] = await connection.query(query, [userId]);

      if (userResults.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      }

      await sendEmail(userResults[0].email, userResults[0].name, userResults[0].userId, userResults[0].accountId, accountCode);
      res.status(200).json({ message: 'Reset link sent successfully' });

  } catch (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Error executing query' });
  } finally {
      if (connection) {
          connection.release();
      } else {
          console.warn('send-user-reset-link: Connection not established.');
      }
  }
});

router.get('/get-filtered-users', authenticateToken, async (req, res) => {
  let { accountId, status } = req.query;
  let isActive;
  if (status === 'InActive') {
      isActive = 0;
  } else if (status === 'Active') {
      isActive = 1;
  }
  let connection;
  try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
      connection = await Promise.race([connectToDatabase(), timeout]);

      const query = `
          SELECT 
              u.*, 
              GROUP_CONCAT(r.roleName SEPARATOR ', ') AS roleNames, 
              GROUP_CONCAT(r.roleId SEPARATOR ',') as roleId
          FROM admin.user u
          JOIN admin.userroles ur ON u.userId = ur.userId
          JOIN admin.role r ON ur.roleId = r.roleId
          WHERE u.accountId = ? AND u.isActive = ?
          AND ur.roleId != -1
          GROUP BY u.userId
      `;  

      const formattedQuery = mysql.format(query, [accountId, isActive]);
      const [results] = await connection.query(formattedQuery);
      res.json(results);
  } catch (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Error executing query' });
  } finally {
      if (connection) {
          connection.release();
      } else {
          console.warn('get-filtered-users: Connection not established.');
      }
  }
});

router.get('/get-users-by-role/:roleId', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { roleId } = req.params;

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        const query = `
            SELECT 	u.userId, u.name, u.email, u.phone, u.photoURL, u.isActive, 
                    p.skills, p.description, p.url
            FROM 	admin.user u 
            INNER JOIN 
                    admin.userroles ur 
                ON 	u.userid = ur.userid 
            LEFT JOIN 
                    admin.profile p
                ON	p.userid = u.userid
            LEFT JOIN
                    admin.profilelocations pl
                ON	p.profileId = pl.profileId
            WHERE 	ur.roleId = ?
        `;

        const [userResults] = await connection.query(query, [roleId]);
        res.json(userResults.length ? userResults : []);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-users-by-role: Connection not established.');
        }
    }
});

router.get('/get-users-by-location-role/:roleId/:locationId', authenticateToken, async (req, res) => {
    // console.log('user.js','get-users-by-location-role');
    let connection;
    try {
        const { locationId, roleId } = req.params;

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        const query = `
            SELECT 	u.userId, u.name, u.email, u.phone, u.photoURL, u.isActive, 
                    p.skills, p.description, p.url
            FROM 	admin.user u 
            INNER JOIN 
                    admin.userroles ur 
                ON 	u.userid = ur.userid 
            LEFT JOIN 
                    admin.profile p
                ON	p.userid = u.userid
            LEFT JOIN
                    admin.profilelocation pl
                ON	p.profileId = pl.profileId
            WHERE 	ur.roleId = ? 
            AND     pl.locationId = ?
        `;
        
        const formattedQuery = mysql.format(query,[roleId, locationId]);
        //console.log(formattedQuery);

        const [userResults] = await connection.query(query, [roleId, locationId]);
        
        res.json(userResults.length ? userResults : []);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Error executing query' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('get-users-by-location-role: Connection not established.');
        }
    }
});

// PUT Route
router.put('/update-user/:userId', authenticateToken, upload.single('photo'), async (req, res) => {
  const { userId } = req.params;

  const userData = JSON.parse(req.body.userData);
  const { name, email, phone, phone2, address, city, state, zip, isActive, resetPassword } = userData;
  let { roleId } = userData;

  if (typeof roleId === 'string') {
      roleId = roleId.split(',').map(Number);
  }

  const photoURL = req.file ? `/uploads/${req.file.filename}` : req.body.photoURL;
  console.log('Photo URL:', photoURL);

  if (!Array.isArray(roleId)) {
      console.error('roleId is not an array:', roleId);
      return res.status(400).json({ error: 'roleId must be an array' });
  }

  let connection;
  try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
      connection = await Promise.race([connectToDatabase(), timeout]);
      console.log('Database connection established');

      const userQuery = `
          UPDATE admin.user
          SET name = ?, email = ?, phone = ?, phone2 = ?, address = ?, city = ?, state = ?, zip = ?, isActive = ?, resetPassword = ?, photoURL = ?, updatedBy = "API User Update"
          WHERE userId = ?;
      `;
      await connection.query(userQuery, [name, email, phone, phone2, address, city, state, zip, isActive, resetPassword, photoURL, userId]);
      console.log('User updated:', { userId, name, email, phone, phone2, address, city, state, zip, isActive, resetPassword, photoURL });

      const deleteUserRoleQuery = `DELETE FROM admin.userroles WHERE userId = ?;`;
      await connection.query(deleteUserRoleQuery, [userId]);
      console.log('Existing user roles deleted for userId:', userId);

      const insertUserRoleQuery = `INSERT INTO admin.userroles (userId, roleId) VALUES (?, ?);`;
      const userRolePromises = roleId.map((role) => {
          console.log('Inserting role:', role);
          return connection.query(insertUserRoleQuery, [userId, role]);
      });
      await Promise.all(userRolePromises);
      console.log('New user roles inserted:', { userId, roleId });

      if (roleId.includes(5)) {
          const profileQuery = `INSERT INTO admin.profile (userId, description, skills, URL) VALUES (?, ?, ?, ?);`;
          await connection.query(profileQuery, [userId, '', '', '']);
          console.log('Profile created for Instructor user:', userId);
      }

      res.json({ message: 'User updated successfully' });
  } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Error updating user: ' + error.message });
  } finally {
      if (connection) {
          connection.release();
          console.log('Database connection released');
      } else {
          console.warn('update-user/:userId: Connection not established.');
      }
  }
});

router.put('/deactivate-user', authenticateToken, async (req, res) => {
  const { userId } = req.query;
  let connection;
  try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
      connection = await Promise.race([connectToDatabase(), timeout]);

      const userQuery = `UPDATE admin.user 
          SET isActive = -1, updatedBy = "API User Delete"
          WHERE userId = ?;`;

      const [userResult] = await connection.query(userQuery, [userId]);
      res.json({ message: 'User deactivated' });
  } catch (error) {
      res.status(500).json({ error: 'Error deactivating user' });
  } finally {
      if (connection) {
          connection.release();
      } else {
          console.warn('deactivate-user: Connection not established.');
      }
  }
});

router.put('/update-profile/:userId', authenticateToken, upload.none(), async (req, res) => {
  const { userId } = req.params;
  let connection;
  try {
        const profileData = JSON.parse(req.body.profileData);
        //console.log("METHOD CALLED", profileData);
        console.log("profileData", profileData);

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        // Filter for new skills 
        const newSkillsToAdd = profileData.profileSkills.filter(skill => 
            typeof skill.skillId === 'string' && skill.skillId.startsWith('new-')
        );
      
        //console.log('newSkillsToAdd:', newSkillsToAdd);

        if (newSkillsToAdd.length > 0) {
            const newSkillInsertQuery = `
                INSERT INTO admin.skill(skillName,skillDescription) 
                VALUES (?,'')`;
            newSkillsToAdd.forEach(async (skill) => {
            try {
                const skillInsertQuery = connection.format(newSkillInsertQuery, [skill.skillName]);
                const [skillInsertResult] = await connection.query(skillInsertQuery);
                console.log(`Successfully added new skill: ${skill.skillName}`);
            } catch (error) {
                console.error('Error inserting new skill:', error);
            }
            });
        }      

        const profileQuery = `
            UPDATE admin.profile 
            SET description = ?, 
                skills = ?, 
                URL = ?
            WHERE userId = ?`;

        const skillsString = profileData.profileSkills.map(skill => skill.skillName).join(', ');
        //console.log('skillString:', skillsString);

        const profileUpdateQuery = connection.format(profileQuery, [profileData.profileDescription, skillsString, profileData.profileURL, userId]);
        const [profileResult] = await connection.query(profileQuery, [profileData.profileDescription, skillsString, profileData.profileURL, userId]);

        if (profileData.primaryStudio !== null) {
        // Fetch profileId
        const getProfileId = `SELECT p.profileId FROM admin.user u 
                            INNER JOIN admin.profile p 
                            ON u.userId = p.userId 
                            WHERE u.userId = ?`;
        const [rows] = await connection.query(getProfileId, [userId]);

        // Ensure profileId is correctly extracted from the result
        const profileId = rows[0]?.profileId;

        if (!profileId) {
        throw new Error('Profile ID not found for the provided user ID');
        }

        // Clear existing profile locations
        const profileLocationClear = `DELETE FROM admin.profilelocation 
                                    WHERE profileId = ?`;

        await connection.query(profileLocationClear, [profileId]);

        // Insert new profile locations
        const profileLocationQuery = `INSERT INTO admin.profilelocation (profileId, locationId, isHome) VALUES (?, ?, 1)`;
        await connection.query(profileLocationQuery, [profileId, profileData.primaryStudio]);

        const altLocationQuery = `INSERT INTO admin.profilelocation (profileId, locationId, isHome) VALUES (?, ?, 0)`;
        const altLocPromises = profileData.altStudio.map((locationId) => {
            return connection.query(altLocationQuery, [profileId, locationId]);
        });
        //console.log('Profile created for Instructor user:', userId);
    }        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error updating profile' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('update-profile: Connection not established.');
        }
    }
});

router.put('/update-user-password/:accountCode/:userId/:accountId', async (req, res) => {
  const { userId, accountCode, accountId } = req.params;
  const { userData } = req.body;

  if (!userData || !userData.password) {
      return res.status(400).json({ error: 'Invalid JSON in userData' });
  }

  const password = userData.password;

  let connection;
  try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
      connection = await Promise.race([connectToDatabase(), timeout]);
      const hashedPassword = await bcrypt.hash(password, 10);

      const [userValidation] = await connection.query(
          `SELECT * FROM admin.user WHERE userId = ? AND accountId = ? AND accountId = (SELECT accountId FROM admin.account WHERE accountCode = ?)`,
          [userId, accountId, accountCode]
      );

      if (!userValidation.length) {
          return res.status(404).json({ message: 'User not found or credentials invalid' });
      }

      const userQuery = `
          UPDATE admin.user 
          SET password = ?, updatedBy = "API Password Update" 
          WHERE userId = ? AND accountId = ? AND accountId = (SELECT accountId FROM admin.account WHERE accountCode = ?);
      `;

      const [userResult] = await connection.query(userQuery, [hashedPassword, userId, accountId, accountCode]);
      res.json({ message: 'User password updated' });

  } catch (error) {
      console.error('Error resetting user password:', error);
      res.status(500).json({ error: 'Error resetting user password' });
  } finally {
      if (connection) {
          connection.release();
      } else {
          console.warn('update-user-password: Connection not established.');
      }
  }
});

// POST Route
router.post('/add-user', authenticateToken, upload.single('photo'), async (req, res) => {
  let { accountcode, name, email, phone, phone2, address, city, state, zip, password: originalPassword, roleId } = JSON.parse(req.body.userData);

  console.log('Parsed userData:', { accountcode, name, email, phone, phone2, address, city, state, zip, originalPassword, roleId });
  console.log('RoleEnum:', RoleEnum);
  console.log('RoleEnum.Instructor:', RoleEnum.Instructor);

  let connection;
  try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
      connection = await Promise.race([connectToDatabase(), timeout]);
      // console.log('Request body:', req.body);

      let password = originalPassword || accountcode;
      const hashedPassword = await bcrypt.hash(password, 10);

      const accountQuery = 'SELECT accountId FROM admin.account WHERE accountcode = ?';
      const [accountResults] = await connection.query(accountQuery, [accountcode]);
      if (accountResults.length === 0) {
          console.error('Account not found');
          return res.status(404).json({ error: 'Account not found' });
      }

      const accountId = accountResults[0].accountId;
      const photoURL = req.file ? `/uploads/${req.file.filename}` : null;

      const duplicateQuery = `SELECT * FROM admin.user WHERE name = ? AND email = ? AND phone = ? AND address = ? AND city = ? AND state = ? AND zip = ?`;
      const [duplicateResults] = await connection.query(duplicateQuery, [name, email, phone, address, city, state, zip]);
      if (duplicateResults.length > 0) {
          if (connection) {
              connection.release();
          } else {
              console.warn('add-user: Connection not established.');
          }
          console.warn('Duplicate user found:', duplicateResults);
          return res.status(409).json({ error: 'Duplicate user found' });
      }

      const userQuery = `INSERT INTO admin.user (accountId, name, email, phone, phone2, address, city, state, zip, password, photoURL, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "API User Insert")`;
      await connection.query(userQuery, [accountId, name, email, phone, phone2, address, city, state, zip, hashedPassword, photoURL]);

      const [result] = await connection.query('SELECT LAST_INSERT_ID() AS userId');
      const userId = result[0].userId;

      if (!Array.isArray(roleId)) {
          console.error('roleId is not an array:', roleId);
          return res.status(400).json({ error: 'roleId must be an array' });
      }

      // console.log('roleId includes:', roleId.includes(RoleEnum.Instructor));

      const userRoleQuery = `INSERT INTO admin.userroles (userId, roleId) VALUES (?, ?)`;
      const userRolePromises = roleId.map((role) => {
          console.log('Inserting role:', role);
          return connection.query(userRoleQuery, [userId, role]);
      });

      await Promise.all(userRolePromises);
      
      await sendEmail(email, name, userId, accountId, accountcode);

      if (roleId.includes(RoleEnum.Instructor)) {
          const profileQuery = `INSERT INTO admin.profile (userId, description, skills, URL) VALUES (?, ?, ?, ?)`;
          await connection.query(profileQuery, [userId, '', '', '']);
          console.log('Profile created for Instructor user:', userId);
      }

      res.json({ message: 'User registered' });
  } catch (error) {
      console.error('Error during user registration:', error);
      res.status(500).json({ error: 'Error during user registration: ' + error.message });
  } finally {
      if (connection) {
          connection.release();
          console.log('Database connection released');
      } else {
          console.warn('add-user: Connection not established.');
      }
  }
});

router.post('/upsert-profile-assignment/:scheduleLocationId/:primaryProfileId/:altProfileId', authenticateToken, async (req, res) => {
    const { scheduleLocationId, primaryProfileId, altProfileId } = req.params;
    console.log('scheduleLocationId', scheduleLocationId);
    
    // Convert 'NULL' string to actual null value
    const altProfileIdValue = altProfileId === 'null' || altProfileId === 'NULL' ? null : altProfileId;

    let connection;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000));
        connection = await Promise.race([connectToDatabase(), timeout]);

        // Check if a record with the given scheduleLocationId exists
        const selectQuery = `SELECT * FROM admin.scheduleprofile WHERE scheduleLocationId = ?`;
        const [existingRecords] = await connection.query(selectQuery, [scheduleLocationId]);

        if (existingRecords.length > 0) {
            // Record exists, perform an update
            const updateQuery = `UPDATE admin.scheduleprofile SET profileId = ?, altProfileId = ? WHERE scheduleLocationId = ?`;
            await connection.query(updateQuery, [primaryProfileId, altProfileIdValue, scheduleLocationId]);
            res.json({ message: 'Profile Assignment Updated' });
        } else {
            // Record does not exist, perform an insert
            const insertQuery = `INSERT INTO admin.scheduleprofile (scheduleLocationId, profileId, altProfileId) VALUES (?, ?, ?)`;
            await connection.query(insertQuery, [scheduleLocationId, primaryProfileId, altProfileIdValue]);
            res.json({ message: 'Profile Assignment Inserted' });
        }

    } catch (error) {
        console.error('Error assigning profile to event:', error);
        res.status(500).json({ error: 'Error assigning profile to event' });
    } finally {
        if (connection) {
            connection.release();
        } else {
            console.warn('upsert-profile-assignment: Connection not established.');
        }
    }
});

module.exports = router;
