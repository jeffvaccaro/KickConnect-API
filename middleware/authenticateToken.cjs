const jwt = require('jsonwebtoken');
const axios = require('axios');

const COGNITO_REGION = 'us-east-1';
const COGNITO_USER_POOL_ID = 'us-east-1_BfqJwgbZU';

async function authenticateToken(req, res, next) {
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

  try {
    // Fetch Cognito public keys
    const jwksUrl = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
    const { data: jwks } = await axios.get(jwksUrl);

    // Decode and verify the token
    const decodedToken = jwt.decode(token, { complete: true });
    const kid = decodedToken.header.kid;
    const key = jwks.keys.find(k => k.kid === kid);

    if (!key) {
      throw new Error('Public key not found');
    }

    const publicKey = `-----BEGIN PUBLIC KEY-----\n${key.x5c[0]}\n-----END PUBLIC KEY-----`;
    jwt.verify(token, publicKey, { algorithms: ['RS256'] }, (err, user) => {
      if (err) {
        console.error('Token verification failed:', err.message);
        return res.status(403).json({ error: 'Token verification failed' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Error during token verification:', error.message);
    return res.status(500).json({ error: 'Error during token verification' });
  }
}

module.exports = authenticateToken;