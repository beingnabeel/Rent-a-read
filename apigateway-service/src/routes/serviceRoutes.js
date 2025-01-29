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

const profileUpload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile images
  },
}).single("file"); // Changed to 'file' to match the form data

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

// Debug logging
console.log("Service URLs:", {
  BOOK_SERVICE_URL,
  ORDER_SERVICE_URL,
  SCHOOL_SERVICE_URL,
  SUBSCRIPTION_SERVICE_URL,
  USER_SERVICE_URL,
  EBOOK_SERVICE_URL,
});

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
    // For multipart/form-data, preserve the original headers and body
    if (req.is("multipart/form-data")) {
      console.log("Handling multipart form data");
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
  onError: (err, req, res) => {
    console.error("User Service Proxy Error:", err);
    res.status(500).json({ message: "User service unavailable" });
  },
});

// // Book Service Routes
// const bookServiceProxy = createProxyMiddleware({
//   target: BOOK_SERVICE_URL,
//   changeOrigin: true,
//   pathRewrite: {
//     "^/api/v1/books-service": "/api/v1/books-service",
//   },
//   onProxyReq: function (proxyReq, req, res) {
//     console.log("Book service proxy request path:", proxyReq.path);
//     console.log("Request content type:", req.headers["content-type"]);
//     console.log("Request body:", req.body);
//     console.log("Request files:", req.files);

//     // Handle multipart/form-data
//     if (req.headers["content-type"] && req.headers["content-type"].includes("multipart/form-data")) {
//       try {
//         // Create a new boundary
//         const boundary = `---------------------------${Date.now().toString(16)}`;
        
//         // Start building the multipart form data
//         const lines = [];
        
//         // Add all fields from the body
//         for (const [key, value] of Object.entries(req.body)) {
//           if (value !== undefined && value !== null) {
//             lines.push(`--${boundary}`);
//             lines.push(`Content-Disposition: form-data; name="${key}"`);
//             lines.push('');
//             lines.push(value.toString());
//           }
//         }

//         // Add the image file if present
//         if (req.files && req.files.image && req.files.image[0]) {
//           const file = req.files.image[0];
//           lines.push(`--${boundary}`);
//           lines.push(`Content-Disposition: form-data; name="file"; filename="${file.originalname}"`);
//           lines.push(`Content-Type: ${file.mimetype}`);
//           lines.push('');
          
//           // Convert buffer to base64 to avoid binary data issues
//           const base64Data = file.buffer.toString('base64');
//           lines.push(base64Data);
          
//           // Add file metadata
//           lines.push(`--${boundary}`);
//           lines.push(`Content-Disposition: form-data; name="originalname"`);
//           lines.push('');
//           lines.push(file.originalname);
          
//           lines.push(`--${boundary}`);
//           lines.push(`Content-Disposition: form-data; name="mimetype"`);
//           lines.push('');
//           lines.push(file.mimetype);
//         }

//         // Add the final boundary
//         lines.push(`--${boundary}--`);

//         // Join all lines with CRLF
//         const body = lines.join('\r\n');
        
//         // Set headers
//         proxyReq.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);
//         proxyReq.setHeader('Content-Length', Buffer.byteLength(body));

//         // Write the body
//         proxyReq.write(body);
        
//         console.log("Successfully forwarded multipart form data");
//       } catch (error) {
//         console.error("Error processing multipart form data:", error);
//         res.status(500).json({
//           message: "Error processing form data",
//           error: error.message
//         });
//       }
//       return;
//     }

//     // Handle JSON data
//     if (req.body && Object.keys(req.body).length > 0) {
//       const bodyData = JSON.stringify(req.body);
//       proxyReq.setHeader("Content-Type", "application/json");
//       proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
//       proxyReq.write(bodyData);
//     }
//   },
//   onError: (err, req, res) => {
//     console.error("Book Service Proxy Error:", err);
//     res.status(500).json({
//       message: "Book service unavailable",
//       error: err.message,
//     });
//   },
// });
// Book Service Routes
const bookServiceProxy = createProxyMiddleware({
  target: BOOK_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/books-service": "/api/v1/books-service",
  },
  onProxyReq: function (proxyReq, req, res) {
    console.log("Book service proxy request path:", proxyReq.path);

    // Handle multipart/form-data
    if (req.is("multipart/form-data")) {
      proxyReq.setHeader("content-type", req.headers["content-type"]);
      proxyReq.setHeader("content-length", req.headers["content-length"]);
      return;
    }

    // Handle JSON data
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader("Content-Type", "application/json");
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res) => {
    console.error("Book Service Proxy Error:", err);
    res.status(500).json({
      message: "Book service unavailable",
      error: err.message,
    });
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
    "^/api/v1/order-service/student-stock-management-profiles":
      "/api/v1/order-service/student-stock-management-profiles",
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
    "^/api/v1/schools-service": "/api/v1/schools-service",
  },
  onProxyReq: function (proxyReq, req, res) {
    console.log("School service proxy request path:", proxyReq.path);

    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader("Content-Type", "application/json");
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
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
    "^/api/v1/subscription-service": "/api/v1/subscription-service",
  },
  onProxyReq: function (proxyReq, req, res) {
    console.log("Subscription service proxy request path:", proxyReq.path);

    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader("Content-Type", "application/json");
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res) => {
    console.error("Subscription Service Proxy Error:", err);
    res.status(500).json({
      message: "Subscription service unavailable",
      error: err.message,
    });
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
  "/api/v1/users",
  verifyToken,
  (req, res, next) => {
    // Skip JSON body parsing for multipart requests
    if (req.is("multipart/form-data")) {
      return next();
    }
    next();
  },
  userServiceProxy
);

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

// User Management Routes - Admin Only
router.use(
  [
    "/api/v1/users$", // Get All Users
    "/api/v1/users/export/excel",
    "/api/v1/users/create-user",
    "/api/v1/users/and/profiles",
    "/api/v1/users/status/:status",
  ],
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data"]),
  userServiceProxy
);

// User Management Routes - Multiple Roles (ADMIN, SCHOOL_ADMIN, STUDENT)
router.use(
  "/api/v1/users",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const path = req.path;

    // Profile picture routes - accessible to all authenticated users
    if (path.includes("/upload") || path.includes("/delete/profileImage")) {
      return authorizeRoles(["ADMIN", "SCHOOL_ADMIN", "STUDENT"])(
        req,
        res,
        next
      );
    }

    // OTP and token routes - accessible to all authenticated users
    if (
      path.includes("/email/verify-otp") ||
      path.includes("/mobile/send-otp") ||
      path.includes("/logout") ||
      path.includes("/refresh-token")
    ) {
      return authorizeRoles(["ADMIN", "SCHOOL_ADMIN", "STUDENT"])(
        req,
        res,
        next
      );
    }

    // Routes requiring specific permissions
    const permissions = [];
    if (method === "GET") permissions.push("Read_Data");
    if (method === "POST" || method === "PUT") permissions.push("Write_Data");
    if (method === "DELETE" || method === "PATCH")
      permissions.push("Delete_Data");

    authorizeRoles(["ADMIN", "SCHOOL_ADMIN", "STUDENT"])(req, res, () => {
      authorizePermissions(permissions)(req, res, next);
    });
  },
  userServiceProxy
);

// Role Management Routes - Admin Only
router.use(
  "/api/v1/roles",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const permissions = [];

    if (method === "GET") permissions.push("Read_Data");
    if (method === "POST" || method === "PUT") permissions.push("Write_Data");
    if (method === "DELETE") permissions.push("Delete_Data");

    authorizeRoles(["ADMIN"])(req, res, () => {
      authorizePermissions(permissions)(req, res, next);
    });
  },
  userServiceProxy
);

// User Address Routes
router.use(
  [
    "/api/v1/users/:id",
    "/api/v1/users/:id/profiles/:profileId/addresses",
    "/api/v1/users/addresses",
    "/api/v1/users/addressess/:id",
    "/api/v1/users/delete/addresses/:id",
    "/api/v1/users/pincodes/:id",
    "/api/v1/users/:userId/addresses",
  ],
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const permissions = [];

    if (method === "GET") permissions.push("Read_Data");
    if (method === "POST" || method === "PUT" || method === "PATCH")
      permissions.push("Write_Data");

    authorizeRoles(["ADMIN", "SCHOOL_ADMIN", "STUDENT"])(req, res, () => {
      authorizePermissions(permissions)(req, res, next);
    });
  },
  userServiceProxy
);

// Permission Management Routes - Admin Only
router.use(
  "/api/v1/permissions",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const permissions = [];

    if (method === "GET") permissions.push("Read_Data");
    if (method === "POST") permissions.push("Write_Data");

    authorizeRoles(["ADMIN"])(req, res, () => {
      authorizePermissions(permissions)(req, res, next);
    });
  },
  userServiceProxy
);

// User Profile Routes
router.use(
  [
    "/api/v1/users/profiles/:id",
    "/api/v1/users/profiles",
    "/api/v1/users/:userId/profiles",
    "/api/v1/users/switch/profiles/:id",
    "/api/v1/users/delete/profileImage",
    "/api/v1/users/email/generate-otp",
    "/api/v1/users/email/verify-otp",
    "/api/v1/users/update-password",
    "/api/v1/users/timeframe",
  ],
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const permissions = [];

    if (method === "GET") permissions.push("Read_Data");
    if (method === "POST" || method === "PUT") permissions.push("Write_Data");
    if (method === "DELETE") permissions.push("Delete_Data");

    authorizeRoles(["ADMIN", "SCHOOL_ADMIN", "STUDENT"])(req, res, () => {
      authorizePermissions(permissions)(req, res, next);
    });
  },
  userServiceProxy
);

// File upload route
router.post(
  "/api/v1/users/upload",
  verifyToken,
  authorizePermissions(["Write_Data"]),
  profileUpload,
  (req, res, next) => {
    console.log("Processing file upload request");
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    next();
  },
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
        Object.keys(req.body).forEach((key) => {
          formData.append(key, req.body[key]);
        });

        // Set the correct headers
        proxyReq.setHeader(
          "Content-Type",
          `multipart/form-data; boundary=${formData._boundary}`
        );
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
        error: err.message,
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
            formData.append(
              key,
              req.files[key][0].buffer,
              req.files[key][0].originalname
            );
          });
        }
        proxyReq.setHeader(
          "Content-Type",
          `multipart/form-data; boundary=${formData._boundary}`
        );
        formData.pipe(proxyReq);
      }
    },
    onError: (err, req, res) => {
      console.error("PDF Proxy Error:", err);
      res.status(500).json({
        message: "PDF service error",
        error: err.message,
      });
    },
    proxyTimeout: 120000,
    timeout: 120000,
  })
);

// Book Service Routes with Role-Based Access Control
router.use(
  "/api/v1/books-service/books",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const path = req.path;

    // Create book - ADMIN only with all permissions
    if (method === "POST") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get all books or get book by ID
    if (method === "GET") {
      if (path === "/latest") {
        // Latest books - ADMIN, STUDENT, SCHOOL_ADMIN with read permission
        return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
          req,
          res,
          () => {
            authorizePermissions(["Read_Data"])(req, res, next);
          }
        );
      }
      // All books or single book - ADMIN with read/write, others with read
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }

    // Update book - ADMIN only with read/write
    if (method === "PATCH" || method === "PUT") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data"])(req, res, next);
      });
    }
  },
  bookServiceProxy
);

// Category Routes
router.use(
  "/api/v1/books-service/categories",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const path = req.path;

    // Create category - ADMIN only with all permissions
    if (method === "POST") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get categories (all or by ID) - ADMIN with read/write, others with read
    if (method === "GET") {
      if (path.includes("/parent-categories/")) {
        // Categories by parent - same permissions as general get
        return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
          req,
          res,
          () => {
            const permissions =
              req.user.role === "ADMIN"
                ? ["Read_Data", "Write_Data", "Delete_Data"]
                : ["Read_Data"];
            authorizePermissions(permissions)(req, res, next);
          }
        );
      }
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }

    // Update category - ADMIN only with read/write/delete
    if (method === "PATCH" || method === "PUT") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }
  },
  bookServiceProxy
);

// Parent Category Routes
router.use(
  "/api/v1/books-service/parent-categories",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const path = req.path;

    // Create parent category - ADMIN only with all permissions
    if (method === "POST") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get parent categories - ADMIN with all permissions, others with read
    if (method === "GET") {
      if (path === "/ACTIVE" || path === "/categories") {
        return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
          req,
          res,
          () => {
            const permissions =
              req.user.role === "ADMIN"
                ? ["Read_Data", "Write_Data", "Delete_Data"]
                : ["Read_Data"];
            authorizePermissions(permissions)(req, res, next);
          }
        );
      }
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }

    // Update parent category - ADMIN only with all permissions
    if (method === "PATCH" || method === "PUT") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }
  },
  bookServiceProxy
);

// Language Routes
router.use(
  "/api/v1/books-service/languages",
  verifyToken,
  (req, res, next) => {
    const method = req.method;

    // Create/Update language - ADMIN only with all permissions
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get languages - ADMIN with all permissions, others with read
    if (method === "GET") {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }
  },
  bookServiceProxy
);

// Book Stock Routes
router.use(
  "/api/v1/books-service/book-stocks",
  verifyToken,
  (req, res, next) => {
    // All book stock operations - ADMIN only with all permissions
    authorizeRoles(["ADMIN"])(req, res, () => {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    });
  },
  bookServiceProxy
);

// Plan Frequency Type Routes
router.use(
  "/api/v1/subscription-service/plan-frequency-types",
  verifyToken,
  (req, res, next) => {
    const method = req.method;

    // Create/Delete - ADMIN only with all permissions
    if (method === "POST" || method === "DELETE") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get/Update - ADMIN with all permissions, others with read
    if (method === "GET" || method === "PATCH" || method === "PUT") {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }
  },
  subscriptionServiceProxy
);

// Plan Option Type Routes
router.use(
  "/api/v1/subscription-service/plan-option-types",
  verifyToken,
  (req, res, next) => {
    const method = req.method;

    // Create/Delete/Update - ADMIN only with all permissions
    if (
      method === "POST" ||
      method === "DELETE" ||
      method === "PUT" ||
      method === "PATCH"
    ) {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get - ADMIN with all permissions, others with read
    if (method === "GET") {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }
  },
  subscriptionServiceProxy
);

// Promotion Code Routes
router.use(
  "/api/v1/subscription-service/promotion-codes",
  verifyToken,
  (req, res, next) => {
    const method = req.method;

    // Create/Update - ADMIN only with all permissions
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get - ADMIN with all permissions, others with read
    if (method === "GET") {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }
  },
  subscriptionServiceProxy
);

// Coupon Routes
router.use(
  "/api/v1/subscription-service/coupons",
  verifyToken,
  (req, res, next) => {
    const method = req.method;

    // Create/Delete - ADMIN only with all permissions
    if (method === "POST" || method === "DELETE") {
      return authorizeRoles(["ADMIN"])(req, res, () => {
        authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
          req,
          res,
          next
        );
      });
    }

    // Get - ADMIN with all permissions, others with read
    if (method === "GET") {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }
  },
  subscriptionServiceProxy
);

// Subscription Routes
router.use(
  "/api/v1/subscription-service/subscriptions",
  verifyToken,
  (req, res, next) => {
    const method = req.method;
    const path = req.path;

    // Initialize subscription
    if (path === "/initialize") {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "STUDENT"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }

    // Session details
    if (path.includes("/session/")) {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
            req,
            res,
            next
          );
        }
      );
    }

    // Get - ADMIN with all permissions, others with read
    if (method === "GET") {
      return authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"])(
        req,
        res,
        () => {
          const permissions =
            req.user.role === "ADMIN"
              ? ["Read_Data", "Write_Data", "Delete_Data"]
              : ["Read_Data"];
          authorizePermissions(permissions)(req, res, next);
        }
      );
    }
  },
  subscriptionServiceProxy
);

// School Routes with Role-Based Access Control
// Create School (ADMIN only)
router.post(
  "/api/v1/schools-service/schools",
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  schoolServiceProxy
);

// Get All Schools (ADMIN with full permissions, STUDENT/SCHOOL_ADMIN with Read_Data)
router.get(
  "/api/v1/schools-service/schools",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  schoolServiceProxy
);

// Update School by ID (ADMIN with full permissions, STUDENT/SCHOOL_ADMIN with Read_Data)
router.patch(
  "/api/v1/schools-service/schools/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  schoolServiceProxy
);

// Get School by ID (ADMIN with full permissions, STUDENT/SCHOOL_ADMIN with Read_Data)
router.get(
  "/api/v1/schools-service/schools/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  schoolServiceProxy
);

// Create School Leave (ADMIN only)
router.post(
  "/api/v1/schools-service/schools/:schoolId/leaves",
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  schoolServiceProxy
);

// Get All School Leaves (ADMIN with full permissions, STUDENT/SCHOOL_ADMIN with Read_Data)
router.get(
  "/api/v1/schools-service/schools/:schoolId/leaves",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  schoolServiceProxy
);

// Get School Leave by ID (ADMIN with full permissions, STUDENT/SCHOOL_ADMIN with Read_Data)
router.get(
  "/api/v1/schools-service/schools/:schoolId/leaves/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  schoolServiceProxy
);

// Update School Leave (ADMIN with full permissions, STUDENT/SCHOOL_ADMIN with Read_Data)
router.patch(
  "/api/v1/schools-service/schools/:schoolId/leaves/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  schoolServiceProxy
);

// Delete School Leave (ADMIN only)
router.delete(
  "/api/v1/schools-service/schools/:schoolId/leaves/:id",
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  schoolServiceProxy
);

// School Enquiry Routes (All roles with full permissions)
router.post(
  "/api/v1/schools-service/schools/enquiry",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  schoolServiceProxy
);

router.get(
  "/api/v1/schools-service/schools/enquiry",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  schoolServiceProxy
);

router.get(
  "/api/v1/schools-service/school-admin/profiles/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  schoolServiceProxy
);

router.get(
  "/api/v1/schools-service/school-admin/documents/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  schoolServiceProxy
);
// Cart Routes with Role-Based Access Control
router.post(
  "/api/v1/order-service/carts",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/carts/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.patch(
  "/api/v1/order-service/carts/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.delete(
  "/api/v1/order-service/carts/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/carts/:id/details",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/carts/user/:id/active",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

// Delivery Plan Routes with Role-Based Access Control
router.post(
  "/api/v1/order-service/delivery-plans",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/delivery-plans",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.patch(
  "/api/v1/order-service/delivery-plans/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.delete(
  "/api/v1/order-service/delivery-plans/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/delivery-plans/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  orderServiceProxy
);

// Order Routes with Role-Based Access Control
router.post(
  "/api/v1/order-service/orders",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

// Admin-only routes with full permissions
router.patch(
  "/api/v1/order-service/orders/:id/approve",
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.patch(
  "/api/v1/order-service/orders/:id/dispatch",
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

// Routes accessible by all roles with full permissions
router.patch(
  "/api/v1/order-service/orders/:id/confirm-received",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.patch(
  "/api/v1/order-service/orders/:id/request-return",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

// Admin-only route for return confirmation
router.patch(
  "/api/v1/order-service/orders/:id/return",
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

// Routes for order cancellation
router.patch(
  "/api/v1/order-service/orders/:id/request-cancellation",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.patch(
  "/api/v1/order-service/orders/:id/cancel",
  verifyToken,
  authorizeRoles(["ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

// Routes for getting orders with different permissions based on role
router.get(
  "/api/v1/order-service/orders",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/orders/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  (req, res, next) => {
    if (req.user.role === "ADMIN") {
      authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"])(
        req,
        res,
        next
      );
    } else {
      authorizePermissions(["Read_Data"])(req, res, next);
    }
  },
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/orders/user/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/student-stock-management-profiles",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);

router.get(
  "/api/v1/order-service/student-stock-management-profiles/user/:id",
  verifyToken,
  authorizeRoles(["ADMIN", "STUDENT", "SCHOOL_ADMIN"]),
  authorizePermissions(["Read_Data", "Write_Data", "Delete_Data"]),
  orderServiceProxy
);
module.exports = router;
