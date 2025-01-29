const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");
const serviceRoutes = require("./routes/serviceRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

// Middleware
app.use(cors());
app.use(morgan("dev"));

// Body parsing middleware with increased limits
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Add multer middleware for multipart/form-data
app.use((req, res, next) => {
  if (req.headers["content-type"] && req.headers["content-type"].includes("multipart/form-data")) {
    console.log("Processing multipart form data");
    
    upload(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ 
          error: "File upload error", 
          details: err.message 
        });
      }

      // Log raw form data
      console.log("Raw form data:", {
        body: req.body,
        files: req.files
      });

      try {
        // Convert field values from arrays to single values if they're not meant to be arrays
        if (req.body) {
          Object.keys(req.body).forEach(key => {
            // Don't convert categoryIds if it's an array
            if (key !== 'categoryIds' && Array.isArray(req.body[key]) && req.body[key].length === 1) {
              req.body[key] = req.body[key][0];
            }
          });
        }

        // Special handling for categoryIds
        if (req.body.categoryIds) {
          // If it's a single value, convert to array
          if (!Array.isArray(req.body.categoryIds)) {
            req.body.categoryIds = [req.body.categoryIds];
          }
        }

        // Convert numeric fields
        const numericFields = ['totalQuantity', 'availableQuantity', 'noOfLostBook', 'reserved', 'inTransit', 'minAge', 'maxAge'];
        numericFields.forEach(field => {
          if (req.body[field]) {
            req.body[field] = parseInt(req.body[field], 10);
          }
        });

        // Clean up any whitespace in status field
        if (req.body.status) {
          req.body.status = req.body.status.trim();
        }

        // Clean up any undefined or null values
        Object.keys(req.body).forEach(key => {
          if (req.body[key] === undefined || req.body[key] === null) {
            delete req.body[key];
          }
        });

        // Log processed form data
        console.log("Processed form data:", {
          body: req.body,
          files: req.files
        });

        next();
      } catch (error) {
        console.error("Error processing form data:", error);
        return res.status(400).json({
          error: "Error processing form data",
          details: error.message
        });
      }
    });
  } else {
    next();
  }
});

// Debug logging middleware
app.use((req, res, next) => {
  const debugInfo = {
    path: req.path,
    method: req.method,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
    body: req.body,
    files: req.files
  };

  console.log("Request debug info:", JSON.stringify(debugInfo, null, 2));

  // Log when the response is finished
  res.on("finish", () => {
    console.log("Response finished with status:", res.statusCode);
  });

  next();
});

// Routes
app.use("/api/v1/auth", require("./routes/authRoutes"));
app.use("/", serviceRoutes);

// Error handling
app.use(errorHandler);

module.exports = app;
