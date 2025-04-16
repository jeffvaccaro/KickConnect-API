const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!authHeader) {
    console.error('No Auth Header found');
    return res.status(401).json({ error: 'No authentication header found' });
  }
  if (!token) {
    console.error('No Token found');
    return res.status(401).json({ error: 'No token found' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Token verification failed' });
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
