require('dotenv').config();

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const connectToDatabase = async () => {
  try {
    // console.log('Connecting to database with the following details:');
    // console.log('Host:', process.env.DB_HOST);
    // console.log('User:', process.env.DB_USER);
    // console.log('Password:', process.env.DB_PASSWORD ? '******' : 'NOT SET');
    // console.log('Database:', process.env.DB_NAME);
    // console.log('Port:', process.env.DB_PORT);

    if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
      throw new Error('Database credentials are not set. Please check your .env file.');
    }

    const connection = await pool.getConnection();
    if (!connection) {
      throw new Error('Connection failed.');
    }
    console.log('Database connection established.');
    return connection;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

module.exports = { connectToDatabase };
