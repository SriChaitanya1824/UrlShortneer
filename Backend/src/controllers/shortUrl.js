import express from "express";
import { body, validationResult } from "express-validator";
import { urlModel } from "../model/shortUrl.js";
import { nanoid } from "nanoid";

// Validation middleware
export const validateUrl = [
  body('fullUrl')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Please provide a valid URL with http or https protocol')
    .isLength({ max: 2048 })
    .withMessage('URL is too long (maximum 2048 characters)')
];

export const createUrl = async (req, res) => {
  try {
    console.log("🔗 Creating new short URL...");
    console.log("📝 Request body:", req.body);
    
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Validation failed:", errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { fullUrl } = req.body;
    console.log("🎯 Processing URL:", fullUrl);
    
    // Check if URL already exists
    console.log("🔍 Checking if URL already exists...");
    const existingUrl = await urlModel.findOne({ fullUrl }).lean();
    if (existingUrl) {
      console.log("⚠️ URL already exists:", existingUrl.shortUrl);
      return res.status(409).json({
        message: 'URL already exists',
        data: existingUrl
      });
    }

    // Create new short URL
    console.log("✨ Creating new short URL...");
    console.log("📝 Full URL to shorten:", fullUrl);
    
    // Generate unique shortUrl with retry mechanism
    let shortUrl;
    let attempts = 0;
    let isUnique = false;
    
    while (!isUnique && attempts < 5) {
      shortUrl = nanoid(8);
      console.log(`🎲 Generated short URL (attempt ${attempts + 1}):`, shortUrl);
      
      const existing = await urlModel.findOne({ shortUrl });
      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
        console.log(`⚠️ Short URL already exists, retrying... (${attempts}/5)`);
      }
    }
    
    if (!isUnique) {
      throw new Error('Failed to generate unique short URL after 5 attempts');
    }
    
    const newUrl = await urlModel.create({ fullUrl, shortUrl });
    console.log("✅ Short URL created successfully!");
    console.log("🔗 Short URL:", newUrl.shortUrl);
    console.log("📊 Full URL:", newUrl.fullUrl);
    console.log("🆔 Document ID:", newUrl._id);

    res.status(201).json({
      message: 'URL shortened successfully',
      data: newUrl
    });
  } catch (error) {
    console.error('💥 Create URL error:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.message
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'Short URL already exists'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to create short URL'
    });
  }
};

export const getAllUrl = async (req, res) => {
  try {
    console.log("📋 Fetching all URLs...");
    
    // Check database connection
    const dbState = urlModel.db.readyState;
    console.log("🔍 Database connection state:", dbState === 1 ? 'Connected' : 'Disconnected');
    
    if (dbState !== 1) {
      console.error("❌ Database is not connected!");
      return res.status(503).json({ 
        error: 'Database not connected',
        message: 'Database connection is not available. Please check your MongoDB connection string.',
        data: []
      });
    }
    
    const shortUrls = await urlModel
      .find()
      .select('fullUrl shortUrl clicks createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()
      .limit(100); // Limit to prevent large responses

    console.log(`📊 Found ${shortUrls.length} URLs in database`);

    // Return empty array instead of 404 if no URLs found
    res.status(200).json({
      message: 'URLs retrieved successfully',
      data: shortUrls
    });
  } catch (error) {
    console.error('💥 Get all URLs error:', error);
    console.error('🔍 Error stack:', error.stack);
    console.error('🔍 Error name:', error.name);
    console.error('🔍 Error message:', error.message);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Failed to retrieve URLs',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getUrl = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔗 Redirecting short URL: ${id}`);
    
    const url = await urlModel.findOne({ shortUrl: id }).lean();
    
    if (!url) {
      console.log(`❌ Short URL not found: ${id}`);
      return res.status(404).json({ 
        error: 'URL not found',
        message: 'The requested short URL does not exist'
      });
    }

    console.log(`🎯 Found URL: ${url.fullUrl} (${url.clicks} clicks)`);
    
    // Update click count (use atomic operation for better performance)
    await urlModel.updateOne(
      { shortUrl: id },
      { $inc: { clicks: 1 } }
    );
    
    console.log(`📈 Updated click count for ${id}`);
    console.log(`🚀 Redirecting to: ${url.fullUrl}`);

    // Redirect to the original URL
    res.redirect(301, url.fullUrl);
  } catch (error) {
    console.error('💥 Get URL error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process URL redirect'
    });
  }
};

export const deleteUrl = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting URL with ID: ${id}`);
    
    // Check if URL exists
    const url = await urlModel.findById(id);
    if (!url) {
      console.log(`❌ URL not found for deletion: ${id}`);
      return res.status(404).json({
        error: 'URL not found',
        message: 'The requested URL does not exist'
      });
    }

    console.log(`🎯 Found URL to delete: ${url.shortUrl} -> ${url.fullUrl}`);
    
    // Delete from database
    await urlModel.findByIdAndDelete(id);
    console.log(`✅ URL deleted successfully: ${url.shortUrl}`);

    res.status(200).json({
      message: 'URL deleted successfully',
      data: { id: url._id, shortUrl: url.shortUrl }
    });
  } catch (error) {
    console.error('💥 Delete URL error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to delete URL'
    });
  }
};

