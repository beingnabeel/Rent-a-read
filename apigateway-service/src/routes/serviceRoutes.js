const express = require("express");
const router = express.Router();
const multer = require("multer");
const FormData = require("form-data");
const {
  verifyToken,
  authorizeRoles,
  authorizePermissions,
} = require("../middleware/authMiddleware");
const { createProxyMiddleware } = require("http-proxy-middleware");

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for files
  },
});

// Separate multer configurations for different routes
const categoryUpload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for category images
  },
}).single("imageUrl"); // Configure for single file upload with field name 'imageUrl'

const pdfUpload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for PDF files
  },
}).fields([
  { name: "pdfUrl", maxCount: 1 },
  { name: "thumbnailUrl", maxCount: 1 },
]);

// Get service URLs from environment variables with fallbacks
const BOOK_SERVICE_URL =
  process.env.BOOKS_SERVICE_URL || "http://localhost:4001";
const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://localhost:4005";
const SCHOOL_SERVICE_URL =
  process.env.SCHOOL_SERVICE_URL || "http://localhost:4002";
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL || "http://localhost:4004";
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:8080";
const EBOOK_SERVICE_URL =
  process.env.EBOOK_SERVICE_URL || "http://localhost:3000";

// User Management Service Routes
const userServiceProxy = createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/users": "/users",
    "^/api/v1/auth": "/auth",
    "^/api/v1/roles": "/roles",
    "^/api/v1/permissions": "/permissions",
  },
  onProxyReq: function (proxyReq, req, res) {
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader("Content-Type", "application/json");
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res) => {
    console.error("User Service Proxy Error:", err);
    res.status(500).json({ message: "User service unavailable" });
  },
});

// Book Service Routes
const bookServiceProxy = createProxyMiddleware({
  target: BOOK_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/books": "/api/v1/books-service",
  },
  onError: (err, req, res) => {
    console.error("Book Service Proxy Error:", err);
    res.status(500).json({ message: "Book service unavailable" });
  },
});

// Order Service Routes
const orderServiceProxy = createProxyMiddleware({
  target: ORDER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/order-service/orders": "/api/v1/order-service/orders",
    "^/api/v1/order-service/carts": "/api/v1/order-service/carts",
    "^/api/v1/order-service/delivery-plans":
      "/api/v1/order-service/delivery-plans",
  },
  onProxyReq: function (proxyReq, req, res) {
    console.log("Proxying to:", proxyReq.path);

    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader("Content-Type", "application/json");
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res) => {
    console.error("Order Service Proxy Error:", err);
    res.status(500).json({ message: "Order service unavailable" });
  },
});

// School Service Routes
const schoolServiceProxy = createProxyMiddleware({
  target: SCHOOL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/schools": "/api/v1/schools-service",
  },
  onError: (err, req, res) => {
    console.error("School Service Proxy Error:", err);
    res.status(500).json({ message: "School service unavailable" });
  },
});

// Subscription Service Routes
const subscriptionServiceProxy = createProxyMiddleware({
  target: SUBSCRIPTION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/subscriptions": "/api/v1/subscription-service",
  },
  onError: (err, req, res) => {
    console.error("Subscription Service Proxy Error:", err);
    res.status(500).json({ message: "Subscription service unavailable" });
  },
});

// eBook Service Routes
const eBookServiceProxy = createProxyMiddleware({
  target: EBOOK_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/ebook/pdf": "/api/pdf",
  },
  onProxyReq: function (proxyReq, req, res) {
    console.log("Proxying eBook request to:", proxyReq.path);

    // For multipart/form-data, preserve the original headers and body
    if (req.is("multipart/form-data")) {
      proxyReq.setHeader("content-type", req.headers["content-type"]);
      proxyReq.setHeader("content-length", req.headers["content-length"]);
      return;
    }

    // For JSON requests
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader("Content-Type", "application/json");
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: function (proxyRes, req, res) {
    console.log("Proxy response status:", proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error("eBook Service Proxy Error:", err);
    res.status(500).json({
      message: "eBook service unavailable",
      error: err.message,
      code: err.code,
    });
  },
  // Increase timeout for large file uploads
  proxyTimeout: 120000,
  timeout: 120000,
});

// Public routes (no auth required)
router.use("/api/v1/auth", userServiceProxy);

// Protected Routes
router.use(
  "/api/v1/books",
  verifyToken,
  authorizePermissions(["Read_Data"]),
  bookServiceProxy
);

router.use(
  [
    "/api/v1/order-service/orders",
    "/api/v1/order-service/carts",
    "/api/v1/order-service/delivery-plans",
  ],
  verifyToken,
  authorizePermissions(["Write_Data"]),
  orderServiceProxy
);

router.use(
  "/api/v1/schools",
  verifyToken,
  authorizePermissions(["Read_Data"]),
  schoolServiceProxy
);

router.use(
  "/api/v1/subscriptions",
  verifyToken,
  authorizePermissions(["Write_Data"]),
  subscriptionServiceProxy
);

// User Management Protected Routes
router.use(
  ["/api/v1/users", "/api/v1/roles", "/api/v1/permissions"],
  verifyToken,
  userServiceProxy
);

// eBook Category Routes
router.use(
  "/api/v1/ebook/category",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    if (method === "POST" || method === "PUT" || method === "DELETE") {
      authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Write_Data"])(req, res, next);
      });
    } else {
      authorizeRoles(["ADMIN", "STUDENT"])(req, res, () => {
        authorizePermissions(["Read_Data"])(req, res, next);
      });
    }
  },
  categoryUpload,
  createProxyMiddleware({
    target: EBOOK_SERVICE_URL,
    pathRewrite: {
      "^/api/v1/ebook/category": "/api/category",
    },
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      if (req.file) {
        const formData = new FormData();
        // Add the file
        formData.append("imageUrl", req.file.buffer, req.file.originalname);
        
        // Add other fields from the request body
        Object.keys(req.body).forEach(key => {
          formData.append(key, req.body[key]);
        });
        
        // Set the correct headers
        proxyReq.setHeader("Content-Type", `multipart/form-data; boundary=${formData._boundary}`);
        formData.pipe(proxyReq);
      } else if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onError: (err, req, res) => {
      console.error("Category Proxy Error:", err);
      res.status(500).json({ 
        message: "Category service error", 
        error: err.message 
      });
    },
    proxyTimeout: 120000,
    timeout: 120000,
  })
);

// eBook PDF Routes
router.use(
  "/api/v1/ebook/pdf",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const userRole = req.user.role;
    console.log("User Role:", userRole);
    console.log("Request Method:", method);

    // Create PDF - Only ADMIN with Write_Data permission
    if (method === "POST") {
      if (userRole !== "ADMIN") {
        return res.status(403).json({
          message: "Access denied - Only ADMIN can create eBook PDFs",
        });
      }
      authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Write_Data"])(req, res, next);
      });
    } else {
      // For other methods, allow both ADMIN and STUDENT with Read_Data
      authorizeRoles(["ADMIN", "STUDENT"])(req, res, () => {
        authorizePermissions(["Read_Data"])(req, res, next);
      });
    }
  },
  createProxyMiddleware({
    target: EBOOK_SERVICE_URL,
    pathRewrite: {
      "^/api/v1/ebook/pdf": "/api/pdf",
    },
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      if (req.file || req.files) {
        const formData = new FormData();
        if (req.file) {
          formData.append("file", req.file.buffer, req.file.originalname);
        }
        if (req.files) {
          Object.keys(req.files).forEach((key) => {
            formData.append(key, req.files[key][0].buffer, req.files[key][0].originalname);
          });
        }
        proxyReq.setHeader("Content-Type", `multipart/form-data; boundary=${formData._boundary}`);
      }
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
    proxyTimeout: 300000, // 5 minutes
    timeout: 300000,
  })
);

// Debug logging
console.log("Service URLs:", {
  BOOK_SERVICE_URL,
  ORDER_SERVICE_URL,
  SCHOOL_SERVICE_URL,
  SUBSCRIPTION_SERVICE_URL,
  USER_SERVICE_URL,
  EBOOK_SERVICE_URL,
});

module.exports = router;
