# Rent-a-Read Application

## Overview
Rent-a-Read is a microservices-based application for renting and managing books. The application consists of multiple services that work together to provide a complete book rental solution.

## Services Architecture
1. API Gateway Service
2. Book Service
3. eBook Service
4. School Service
5. Subscription Service
6. Order Service
7. User Management Service

## Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn
- Redis (for caching)

## Service Setup Instructions

### 1. API Gateway Service
```bash
cd apigateway-service
npm install
```

Configuration (`config.env`):
```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
```

### 2. Book Service
```bash
cd book-service
npm install
```

Configuration (`config.env`):
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/book-service
```

### 3. eBook Service
```bash
cd eBook
npm install
```

Configuration (`config.env`):
```env
NODE_ENV=development
PORT=3002
MONGODB_URI=mongodb://localhost:27017/ebook-service
```

### 4. School Service
```bash
cd school-service
npm install
```

Configuration (`config.env`):
```env
NODE_ENV=development
PORT=3003
MONGODB_URI=mongodb://localhost:27017/school-service
```

### 5. Subscription Service
```bash
cd subscription-service
npm install
```

Configuration (`config.env`):
```env
NODE_ENV=development
PORT=3004
MONGODB_URI=mongodb://localhost:27017/subscription-service
```

### 6. Order Service
```bash
cd order-service
npm install
```

Configuration (`config.env`):
```env
NODE_ENV=development
PORT=3005
MONGODB_URI=mongodb://localhost:27017/order-service
```

### 7. User Management Service
```bash
# Extract the zip file first
unzip user-management.zip
cd user-management
npm install
```

Configuration (`config.env`):
```env
NODE_ENV=development
PORT=3006
MONGODB_URI=mongodb://localhost:27017/user-service
```

## Service Communication Flow

1. **API Gateway Service (Port 3000)**
   - Acts as the entry point for all client requests
   - Handles authentication and request routing
   - Communicates with all other services

2. **User Management Service (Port 3006)**
   - Handles user authentication and authorization
   - Manages user profiles and roles
   - Communicates with School Service and Subscription Service

3. **School Service (Port 3003)**
   - Manages school-related operations
   - Handles school admin functionalities
   - Communicates with User Management and Book Service

4. **Book Service (Port 3001)**
   - Manages physical book inventory
   - Handles book metadata and availability
   - Communicates with Order Service and eBook Service

5. **eBook Service (Port 3002)**
   - Manages digital book content
   - Handles eBook delivery and access
   - Communicates with Book Service and Subscription Service

6. **Subscription Service (Port 3004)**
   - Manages subscription plans and billing
   - Handles subscription lifecycle
   - Communicates with User Management and Order Service

7. **Order Service (Port 3005)**
   - Manages book borrowing and returns
   - Handles inventory management
   - Communicates with Book Service and Subscription Service

## Starting the Application

1. Start MongoDB
```bash
mongod
```

2. Start all services (run in separate terminals)
```bash
# For each service directory
npm run start:dev
```

## Environment Variables
Each service requires its own `config.env` file with the following base structure:
```env
NODE_ENV=development
PORT=service_specific_port
MONGODB_URI=mongodb://localhost:27017/service_specific_db
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
```

## API Documentation
The API documentation can be accessed through the API Gateway at:
```
http://localhost:3000/api-docs
```

## Service Dependencies
- All services use Express.js as the web framework
- JWT for authentication
- MongoDB for data storage
- Axios for inter-service communication

## Development Notes
1. Always start the API Gateway Service first
2. Ensure MongoDB is running before starting any service
3. Check the logs of each service for any connection issues
4. Use the development environment for local testing

## Troubleshooting
1. If services fail to start, check if the ports are available
2. Verify MongoDB connection strings
3. Ensure all environment variables are properly set
4. Check service logs for detailed error messages

## Security Notes
1. Never commit `config.env` files to version control
2. Keep JWT secrets secure and unique for each environment
3. Use appropriate CORS settings in production
4. Implement rate limiting for API endpoints
