import express from "express";
import rateLimit from "express-rate-limit";
import {
  createUrl,
  deleteUrl,
  getAllUrl,
  getUrl,
  validateUrl,
} from "../controllers/shortUrl.js";

const router = express.Router();

// Rate limiter for URL creation
const createUrlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 URL creation requests per windowMs
  message: {
    error: 'Too many URL creation requests, please try again later.',
  },
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for preflight requests
});

// Create short URL with validation and rate limiting
router.post("/shorturl", createUrlLimiter, validateUrl, createUrl);

// Get all URLs
router.get("/shortUrl", getAllUrl);

// Get specific URL (for redirect)
router.get("/shortUrl/:id", getUrl);

// Delete URL
router.delete("/shortUrl/:id", deleteUrl);

export default router;
