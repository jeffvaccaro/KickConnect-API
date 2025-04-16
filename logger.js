const { CloudWatchLogsClient, PutLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

const cloudWatchClient = new CloudWatchLogsClient({ region: 'us-east-1' });

const logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        logFormat
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: combine(
                winston.format.colorize(),
                logFormat
            )
        })
    ]
});

if (process.env.NODE_ENV === 'production') {
    logger.add(new transports.Stream({
        stream: {
            write: async (message) => {
                const logEvent = {
                    logGroupName: 'KC-Logs',
                    logStreamName: 'KCLogStream',
                    logEvents: [{ message: message.trim(), timestamp: Date.now() }],
                };

                try {
                    await cloudWatchClient.send(new PutLogEventsCommand(logEvent));
                } catch (error) {
                    console.error('CloudWatch logging failed:', error);
                }
            }
        }
    }));
}

module.exports = logger;
