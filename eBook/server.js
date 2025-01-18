import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import cors from 'cors'; 
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import xss from 'xss-clean';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import {mountRoutes} from './routes/routesIndex.js';
import logger from './utils/logger.js';

dotenv.config();


const port = process.env.PORT || 5000;

connectDB();

const app = express();

// Enable CORS for all routes
app.use(cors());

// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Prevent XSS attacks
app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 20 * 60 * 1000, // 20 mins
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later',
});
app.use(limiter);

// Prevent HTTP param pollution
app.use(hpp());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Get the current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use((req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationMs = (duration[0] * 1000) + (duration[1] / 1e6); // Convert time to milliseconds
    logger.debug(`Request ${req.method} ${req.originalUrl} ${res.statusCode} - processed in ${durationMs.toFixed(3)} ms`);
  });
  
  next();
});


// Mount all routes
mountRoutes(app);

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => {
  res.send('API is running....');
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);


// Start the server
app.listen(port, () => logger.info(`Server started on port ${port}`));

export default app;