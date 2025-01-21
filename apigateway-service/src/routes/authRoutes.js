const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const router = express.Router();

// Configure auth proxy
const authProxy = createProxyMiddleware({
  target: (process.env.USER_SERVICE_URL || "http://localhost:8080").startsWith(
    "http"
  )
    ? process.env.USER_SERVICE_URL || "http://localhost:8080"
    : `http://${process.env.USER_SERVICE_URL || "localhost:8080"}`,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/auth/signup": "/auth/signup",
    "^/api/v1/auth/login": "/auth/login",
    "^/api/v1/auth/forgot-password": "/auth/forgot-password",
    "^/api/v1/auth/reset-password": "/auth/reset-password",
    "^/api/v1/auth/validate": "/auth/validate",
  },
  onProxyReq: function (proxyReq, req, res) {
    // Log the URL being proxied to
    console.log("Proxying auth request to:", proxyReq.path);
    console.log("Request body:", req.body);

    // If the request has a body, we need to rewrite the body
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      // Remove content-length header to prevent conflicts
      proxyReq.removeHeader("content-length");
      proxyReq.setHeader("Content-Type", "application/json");
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: function (proxyRes, req, res) {
    console.log("Auth Proxy Response Status:", proxyRes.statusCode);
    let responseBody = "";
    proxyRes.on("data", function (chunk) {
      responseBody += chunk;
    });
    proxyRes.on("end", function () {
      console.log("Auth Response Body:", responseBody);

      // If it's a 401 with missing token, it might be a path issue
      if (
        proxyRes.statusCode === 401 &&
        responseBody.includes("Token is missing")
      ) {
        console.error("Authentication failed - possible path mapping issue");
      }
    });
  },
  onError: function (err, req, res) {
    console.error("Auth Proxy Error:", err);
    res.status(500).json({
      status: "error",
      message: "Unable to connect to authentication service",
      error: err.message,
    });
  },
});

// Public auth routes (no auth required)
router.post(
  "/signup",
  (req, res, next) => {
    console.log("Signup request received:", {
      path: req.path,
      body: req.body,
      headers: req.headers,
    });
    next();
  },
  authProxy
);

router.post(
  "/login",
  (req, res, next) => {
    console.log("Login request received:", {
      path: req.path,
      body: req.body,
      headers: req.headers,
    });
    next();
  },
  authProxy
);

router.post("/forgot-password", authProxy);
router.post("/reset-password", authProxy);
router.get("/validate", authProxy);

module.exports = router;
