const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');

const swaggerSetup = require('./swagger.cjs');
const logger = require('./logger');

const authRouter = require('./account.js');
const userRouter = require('./user.js');
const loginRouter = require('./login.js');
const locationRouter = require('./location.js');
const roleRouter = require('./role.cjs');
const eventRouter = require('./event.js');
const zipcodeRouter = require('./zipcode.js');
const scheduleRouter = require('./schedule.js');
const accountRouter = require('./account.js');
const skillRouter = require('./skill.js');
const htmlGenRouter = require('./html-generator.js');
const memPlanRouter = require('./membership-plan.js');
const membRouter = require('./membership.js');
const memAttRouter = require('./membership-attendance.js');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const env = process.env.NODE_ENV || 'development';
const port = process.env.PORT || 3000;
const isLocal = env === 'development';

const allowedOrigins = [
  'http://localhost:4200', // Local Angular frontend
  'https://www.kickconnect.net'
];

const corsOptions = {
  origin: (origin, callback) => {
      if (allowedOrigins.includes(origin) || !origin) {
          callback(null, true);
      } else {
          callback(new Error('Not allowed by CORS'));
      }
  },
};

app.use(cors(corsOptions));

app.use(bodyParser.json());

if (typeof swaggerSetup === 'function') {
  swaggerSetup(app);
} else {
  console.error('swaggerSetup is not a function. Ensure it exports correctly.');
}

// Centralized error handling
app.use((err, req, res, next) => {
  logger.error(`Error occurred: ${err.message}`);
  console.error(`Error occurred: ${err.message}`);
  res.status(500).json({ error: 'An error occurred, please try again later.' });
});

// API routes
const routers = [
  { path: '/auth', router: authRouter },
  { path: '/user', router: userRouter },
  { path: '/membership', router: membRouter },
  { path: '/membershipAttendance', router: memAttRouter },
  { path: '/membershipPlan', router: memPlanRouter },
  { path: '/login', router: loginRouter },
  { path: '/location', router: locationRouter },
  { path: '/role', router: roleRouter },
  { path: '/event', router: eventRouter },
  { path: '/common', router: zipcodeRouter },
  { path: '/schedule', router: scheduleRouter },
  { path: '/account', router: accountRouter },
  { path: '/skill', router: skillRouter },
  { path: '/htmlGen', router: htmlGenRouter },
];

routers.forEach(({ path, router }) => {
  if (typeof router === 'function') {
    app.use(path, router);
  } else {
    console.error(`Router at path ${path} is not a function. Ensure it exports correctly.`);
  }
});

// Serve Angular files in local development only
if (isLocal) {
  const distPath = path.join(__dirname, 'dist', 'kickConnect', 'browser'); // Local Angular build path
  app.use(express.static(distPath));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Redirect HTTP to HTTPS (Production Only)
if (!isLocal) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
  });
}
// Determine the path based on the environment
const distPath = isLocal
  ? path.join(__dirname, 'dist', 'kickConnect', 'browser') // Local path
  : path.join(__dirname, 'browser'); // Production path

app.use(express.static(distPath)); // Serve static files

// app.get('/*', (req, res) => {
//   res.sendFile(path.join(distPath, 'index.html'));
// });

app.get('/current-datetime', (req, res) => {
  res.send(`Current Date and Time: ${new Date()}`);
});

app.post('/api/logger', (req, res) => {
  const { message, level, error } = req.body;
  if (!['info', 'warn', 'error', 'debug'].includes(level)) {
    return res.status(400).json({ error: 'Invalid log level' });
  }
  logger[level](`${message}: ${JSON.stringify(error)}`);
  res.status(200).json({ message: 'Log received' });
});

app.listen(port, () => {
  console.log(`Server running at ${isLocal ? 'http://localhost' : 'https://your-api-domain'}:${port} in ${env} mode`);
});