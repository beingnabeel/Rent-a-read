const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Write all error logs to error.log
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error'
        }),
        // Write all logs to combined.log
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log')
        })
    ]
});

// Create error logging middleware
const errorLogger = (err, req, res, next) => {
    const errorDetails = {
        timestamp: new Date().toISOString(),
        error: {
            message: err.message,
            stack: err.stack,
            code: err.code || 'UNKNOWN_ERROR',
            status: err.status || 500
        },
        request: {
            method: req.method,
            url: req.originalUrl,
            query: req.query,
            body: req.body,
            params: req.params,
            headers: {
                ...req.headers,
                authorization: req.headers.authorization ? '[REDACTED]' : undefined
            },
            ip: req.ip
        },
        user: req.user ? { id: req.user.id } : null
    };

    logger.error('Request failed', errorDetails);
    next(err);
};

// Create request logging middleware
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            user: req.user ? { id: req.user.id } : null
        };

        if (res.statusCode >= 400) {
            logger.warn('Request completed with error', logData);
        } else {
            logger.info('Request completed successfully', logData);
        }
    });

    next();
};

module.exports = {
    logger,
    errorLogger,
    requestLogger
};
