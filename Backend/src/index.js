import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from 'url';
import connectDb from "./config/dbConfig.js";
import { performanceMonitor, logMemoryUsage } from "./utils/performance.js";
import shortUrl from "./routes/shortUrl.js";
import { getUrl } from "./controllers/shortUrl.js";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

console.log("🚀 Starting TinyLinker Server...");
console.log("📋 Environment:", process.env.NODE_ENV || 'development');
console.log("🌐 Port:", process.env.PORT || 5001);

// Initialize database connection (non-blocking)
// Server will start even if database connection fails or is delayed
connectDb().catch(err => {
  console.error("⚠️  Database connection error (non-fatal):", err.message);
});

const port = process.env.PORT || 5001;

const app = express();

console.log("🛡️ Setting up security middleware...");
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

console.log("🗜️ Setting up compression middleware...");
// Compression middleware
app.use(compression());

console.log("📊 Setting up performance monitoring...");
// Performance monitoring
app.use(performanceMonitor);

console.log("🌐 Setting up CORS configuration...");
// CORS configuration - MUST be before rate limiting to allow preflight requests
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://tinylinker-cahw.onrender.com']
      : [
          "http://localhost:3000", 
          "http://localhost:5173",
          "http://localhost:5001",
          "https://tinylinker-cahw.onrender.com"
        ],
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);
console.log("✅ CORS configured for same-origin requests");

console.log("🚦 Setting up rate limiting...");
// Rate limiting - applied after CORS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for preflight requests
});

app.use(limiter);
console.log("✅ Rate limiting configured: 100 requests/15min (URL creation has separate limit)");

console.log("📝 Setting up body parsing middleware...");
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log("🏥 Setting up health check endpoint...");
// Health check endpoint
app.get('/health-check', (req, res) => {
  console.log("💚 Health check requested");
  res.status(200).json({
    status: 'ok',
    message: 'TinyLinker Application is up and running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

console.log("🛣️ Setting up API routes...");
// API routes
app.use("/api/", shortUrl);
console.log("✅ API routes configured: /api/shorturl, /api/shortUrl");

console.log("🔗 Setting up short URL redirect route...");
// Short URL redirect route (must be before static file serving)
// This handles /shortUrl/:id redirects to the original URL
app.get("/shortUrl/:id", getUrl);
console.log("✅ Short URL redirect route configured: /shortUrl/:id");

// Serve static files from the React app build directory
if (process.env.NODE_ENV === 'production') {
  console.log("📁 Setting up static file serving for production...");
  // Serve static files from the frontend build directory
  app.use(express.static(path.join(__dirname, '../frontend')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    console.log(`🌐 Serving React app for route: ${req.path}`);
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
  console.log("✅ Static file serving configured for production");
} else {
  console.log("🔧 Development mode: Static file serving disabled");
}

console.log("🚫 Setting up error handlers...");
// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Global error handler triggered:', err);
  
  if (err.type === 'entity.parse.failed') {
    console.log('📝 Invalid JSON received');
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }
  
  console.log('🔥 Internal server error occurred');
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on our end'
  });
});

console.log("🎯 Starting server...");
app.listen(port, () => {
  console.log("🎉 ==========================================");
  console.log("🚀 TinyLinker Server Started Successfully!");
  console.log("🎉 ==========================================");
  console.log(`🌐 Server running on port: ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health-check`);
  console.log(`🔗 API endpoints: http://localhost:${port}/api/`);
  console.log(`📱 Frontend: http://localhost:${port}/ (production only)`);
  console.log("🎉 ==========================================");
  console.log("✅ All systems operational!");
});
