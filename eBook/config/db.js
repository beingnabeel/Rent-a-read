import mongoose from 'mongoose';
import logger from '../utils/logger.js'; 

const dbConnect = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        logger.info(`MongoDB Connected: ${conn.connection.host}`); 
    } catch (error) {
        logger.error(`Error connecting to MongoDB: ${error.message}`); 
        process.exit(1); // Exit the process on failure
    }   
};

export default dbConnect;