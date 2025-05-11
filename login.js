const crypto = require('crypto');
const express = require('express');
const { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand, SignUpCommand, ConfirmSignUpCommand, ResendConfirmationCodeCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, GlobalSignOutCommand, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables

const router = express.Router();

const COGNITO_REGION = 'us-east-1';
const COGNITO_CLIENT_ID = '4n6qv2oc54q300lhindcglgr33';
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET; // Read from environment variables

const cognitoClient = new CognitoIdentityProviderClient({ region: COGNITO_REGION });

// Function to calculate SECRET_HASH
function calculateSecretHash(username) {
  const hmac = crypto.createHmac('sha256', COGNITO_CLIENT_SECRET);
  hmac.update(username + COGNITO_CLIENT_ID);
  return hmac.digest('base64');
}

/**
 * @swagger
 * /login/user-login:
 *   post:
 *     summary: User login
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/user-login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const secretHash = calculateSecretHash(email);

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash, // Include the SECRET_HASH
      },
    });

    const response = await cognitoClient.send(command);
    //console.log('Cognito Response:', response); // Log the full response

    // Check if a challenge is required
    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return res.status(200).json({
        message: 'New password required',
        challengeName: response.ChallengeName,
        challengeParameters: response.ChallengeParameters,
        session: response.Session, // Include the session for the next step
      });
    }

    // If no challenge, proceed with successful login
    const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;

    res.status(200).json({
      message: 'Login successful',
      idToken: IdToken,
      accessToken: AccessToken,
      refreshToken: RefreshToken,
    });
  } catch (error) {
    console.error('Error during login:', error); // Log the full error object

    if (error.name === 'NotAuthorizedException') {
      res.status(401).json({ error: 'Invalid credentials' });
    } else if (error.name === 'UserNotConfirmedException') {
      res.status(403).json({ error: 'User not confirmed. Please confirm your email.' });
    } else if (error.name === 'InvalidParameterException') {
      res.status(400).json({ error: 'Invalid request parameters.' });
    } else {
      res.status(500).json({ error: 'An error occurred, please try again later.' });
    }
  }
});

/**
 * @swagger
 * /login/complete-new-password:
 *   post:
 *     summary: Complete new password challenge
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               session:
 *                 type: string
 *               familyName:
 *                 type: string
 *               givenName:
 *                 type: string
 *               address:
 *                 type: string
 *               nickname:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       500:
 *         description: An error occurred
 */
router.post('/complete-new-password', async (req, res) => {
  const { email, newPassword, session, familyName, givenName, address, nickname } = req.body;

  try {
    const secretHash = calculateSecretHash(email);

    const command = new RespondToAuthChallengeCommand({
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      ClientId: COGNITO_CLIENT_ID,
      ChallengeResponses: {
        USERNAME: email,
        NEW_PASSWORD: newPassword,
        SECRET_HASH: secretHash,
        'userAttributes.family_name': familyName || '', // Provide family name
        'userAttributes.given_name': givenName || '',   // Provide given name
        'userAttributes.address': address || '',       // Provide address
        'userAttributes.nickname': nickname || '',     // Provide nickname
      },
      Session: session, // Use the session from the previous response
    });

    const response = await cognitoClient.send(command);
    console.log('Challenge Response:', response);

    const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;

    res.status(200).json({
      message: 'Password updated successfully',
      idToken: IdToken,
      accessToken: AccessToken,
      refreshToken: RefreshToken,
    });
  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(500).json({ error: 'An error occurred, please try again later.' });
  }
});

/**
 * @swagger
 * /login/sign-up:
 *   post:
 *     summary: User sign-up
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               givenName:
 *                 type: string
 *               familyName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sign-up successful
 *       500:
 *         description: An error occurred during sign-up
 */
router.post('/sign-up', async (req, res) => {
  const { email, password, givenName, familyName } = req.body;

  try {
    const secretHash = calculateSecretHash(email);

    const command = new SignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      SecretHash: secretHash,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: givenName },
        { Name: 'family_name', Value: familyName },
      ],
    });

    const response = await cognitoClient.send(command);
    res.status(200).json({ message: 'Sign-up successful', response });
  } catch (error) {
    console.error('Error during sign-up:', error);
    res.status(500).json({ error: 'An error occurred during sign-up.' });
  }
});

/**
 * @swagger
 * /login/confirm-sign-up:
 *   post:
 *     summary: Confirm user sign-up
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               confirmationCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: User confirmed successfully
 *       500:
 *         description: An error occurred during confirmation
 */
router.post('/confirm-sign-up', async (req, res) => {
  const { email, confirmationCode } = req.body;

  try {
    const secretHash = calculateSecretHash(email);

    const command = new ConfirmSignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      SecretHash: secretHash,
    });

    const response = await cognitoClient.send(command);
    res.status(200).json({ message: 'User confirmed successfully', response });
  } catch (error) {
    console.error('Error confirming sign-up:', error);
    res.status(500).json({ error: 'An error occurred during confirmation.' });
  }
});

/**
 * @swagger
 * /login/resend-confirmation-code:
 *   post:
 *     summary: Resend confirmation code
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Confirmation code resent successfully
 *       500:
 *         description: An error occurred while resending the confirmation code
 */
router.post('/resend-confirmation-code', async (req, res) => {
  const { email } = req.body;

  try {
    const secretHash = calculateSecretHash(email);

    const command = new ResendConfirmationCodeCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      SecretHash: secretHash,
    });

    const response = await cognitoClient.send(command);
    res.status(200).json({ message: 'Confirmation code resent successfully', response });
  } catch (error) {
    console.error('Error resending confirmation code:', error);
    res.status(500).json({ error: 'An error occurred while resending the confirmation code.' });
  }
});

/**
 * @swagger
 * /login/forgot-password:
 *   post:
 *     summary: Initiate forgot password process
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset initiated successfully
 *       500:
 *         description: An error occurred during password reset
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const secretHash = calculateSecretHash(email);

    const command = new ForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      SecretHash: secretHash,
    });

    const response = await cognitoClient.send(command);
    res.status(200).json({ message: 'Password reset initiated', response });
  } catch (error) {
    console.error('Error during forgot password:', error);
    res.status(500).json({ error: 'An error occurred during password reset.' });
  }
});

/**
 * @swagger
 * /login/confirm-forgot-password:
 *   post:
 *     summary: Confirm forgot password process
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               confirmationCode:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       500:
 *         description: An error occurred during password reset confirmation
 */
router.post('/confirm-forgot-password', async (req, res) => {
  const { email, confirmationCode, newPassword } = req.body;

  try {
    const secretHash = calculateSecretHash(email);

    const command = new ConfirmForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
      SecretHash: secretHash,
    });

    const response = await cognitoClient.send(command);
    res.status(200).json({ message: 'Password reset successful', response });
  } catch (error) {
    console.error('Error confirming password reset:', error);
    res.status(500).json({ error: 'An error occurred during password reset confirmation.' });
  }
});

/**
 * @swagger
 * /login/refresh-token:
 *   post:
 *     summary: Refresh authentication token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       500:
 *         description: An error occurred while refreshing the token
 */
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(command);
    const { IdToken, AccessToken } = response.AuthenticationResult;

    res.status(200).json({
      message: 'Token refreshed successfully',
      idToken: IdToken,
      accessToken: AccessToken,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'An error occurred while refreshing the token.' });
  }
});

/**
 * @swagger
 * /login/sign-out:
 *   post:
 *     summary: User sign-out
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: User signed out successfully
 *       500:
 *         description: An error occurred during sign-out
 */
router.post('/sign-out', async (req, res) => {
  const { accessToken } = req.body;

  try {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);
    res.status(200).json({ message: 'User signed out successfully', response });
  } catch (error) {
    console.error('Error during sign-out:', error);
    res.status(500).json({ error: 'An error occurred during sign-out.' });
  }
});

/**
 * @swagger
 * /login/get-user:
 *   get:
 *     summary: Retrieve user information
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: header
 *         name: accessToken
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       500:
 *         description: An error occurred while retrieving the user
 */
router.get('/get-user', async (req, res) => {
  const accessToken = req.headers.accesstoken || req.headers['accessToken']; // Normalize header name

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token is required' });
  }

  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);
    res.status(200).json({ message: 'User retrieved successfully', user: response });
  } catch (error) {
    console.error('Error retrieving user:', error);
    res.status(500).json({ error: 'An error occurred while retrieving the user.' });
  }
});

module.exports = router;