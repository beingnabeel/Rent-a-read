import winston from 'winston';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

// Create a custom format for Winston logs
const customFormat = winston.format.printf(({ timestamp, level, message }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Determine the logging level based on the environment (debug for development, info for production)
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Create a logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
      level: logLevel,
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'warn.log',
      level: 'warn',
    }),
    new winston.transports.File({
      filename: 'debug.log',
      level: 'debug',
    })
  ],
});

// Function to delete old log files older than one month
const deleteOldLogs = () => {
  const logFiles = ['error.log', 'warn.log', 'debug.log'];
  const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000; // One month in milliseconds

  logFiles.forEach((file) => {
    const filePath = path.join(__dirname, file);
    fs.stat(filePath, (err, stats) => {
      if (!err && stats.mtime < oneMonthAgo) {
        fs.unlink(filePath, (err) => {
          if (err) {
            logger.error(`Failed to delete log file: ${file} - ${err.message}`);
          } else {
            logger.info(`Deleted old log file: ${file}`);
          }
        });
      }
    });
  });
};

// Schedule the log deletion job to run daily at midnight
cron.schedule('0 0 * * *', deleteOldLogs);

// Export the logger
export default logger;