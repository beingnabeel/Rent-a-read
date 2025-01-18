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
    "^/api/v1/ebook/category": "/api/category",
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
    if (
      method === "POST" ||
      method === "PUT" ||
      method === "PATCH" ||
      method === "DELETE"
    ) {
      // Write operations - Admin only with Write permission
      authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Write_Data"])(req, res, next);
      });
    } else {
      // Read operations - Admin and Student with Read permission
      authorizeRoles(["ADMIN", "STUDENT"])(req, res, () => {
        authorizePermissions(["Read_Data"])(req, res, next);
      });
    }
  },
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res
          .status(400)
          .json({ message: "File upload error", error: err.message });
      }
      next();
    });
  },
  eBookServiceProxy
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
    }
    // Delete PDF - Only ADMIN with Write_Data permission
    else if (method === "DELETE") {
      if (userRole !== "ADMIN") {
        return res.status(403).json({
          message: "Access denied - Only ADMIN can delete eBook PDFs",
        });
      }
      authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Write_Data"])(req, res, next);
      });
    }
    // GET operations - Both ADMIN and STUDENT with Read_Data permission
    else if (method === "GET") {
      if (!["ADMIN", "STUDENT"].includes(userRole)) {
        return res.status(403).json({
          message: "Access denied - Only ADMIN and STUDENT can view eBook PDFs",
        });
      }
      authorizeRoles(["ADMIN", "STUDENT"])(req, res, () => {
        authorizePermissions(["Read_Data"])(req, res, next);
      });
    }
    // Any other operations - Block by default
    else {
      return res.status(403).json({
        message: "Operation not allowed",
      });
    }
  },
  upload,
  (req, res, next) => {
    if (req.method === "POST") {
      console.log("Files received:", req.files);
      console.log("Body received:", req.body);

      if (!req.files || (!req.files.pdfUrl && !req.files.thumbnailUrl)) {
        return res.status(400).json({
          message: "Required files missing. Please upload PDF and thumbnail.",
        });
      }

      // Create a new FormData instance
      const form = new FormData();

      // Append all form fields
      Object.keys(req.body).forEach((key) => {
        form.append(key, req.body[key]);
      });

      // Append files with their original names and types
      if (req.files.pdfUrl) {
        form.append("pdfUrl", req.files.pdfUrl[0].buffer, {
          filename: req.files.pdfUrl[0].originalname,
          contentType: req.files.pdfUrl[0].mimetype,
        });
      }
      if (req.files.thumbnailUrl) {
        form.append("thumbnailUrl", req.files.thumbnailUrl[0].buffer, {
          filename: req.files.thumbnailUrl[0].originalname,
          contentType: req.files.thumbnailUrl[0].mimetype,
        });
      }

      // Store the form data and headers for the proxy
      req.formData = form;
      req.formDataHeaders = form.getHeaders();
    }
    next();
  },
  createProxyMiddleware({
    target: EBOOK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/v1/ebook/pdf": "/api/pdf",
    },
    onProxyReq: function (proxyReq, req, res) {
      console.log("Proxying eBook request to:", proxyReq.path);
      console.log("User Role:", req.user.role);
      console.log("User Permissions:", req.user.permissions);

      if (req.formData) {
        // Set the headers from the form data
        Object.entries(req.formDataHeaders).forEach(([header, value]) => {
          proxyReq.setHeader(header, value);
        });

        // Write the form data to the proxy request
        req.formData.pipe(proxyReq);
      } else if (req.body && Object.keys(req.body).length > 0) {
        // For JSON requests
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onProxyRes: function (proxyRes, req, res) {
      console.log("Proxy response status:", proxyRes.statusCode);
      if (proxyRes.statusCode !== 200) {
        console.log("Proxy response headers:", proxyRes.headers);
      }
    },
    onError: (err, req, res) => {
      console.error("eBook Service Proxy Error:", err);
      res.status(500).json({
        message: "eBook service unavailable",
        error: err.message,
        code: err.code,
        details: err.stack,
      });
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
