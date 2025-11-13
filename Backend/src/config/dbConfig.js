import mongoose from "mongoose";

const connectDb = async () => {
  try {
    // Check if connection string exists
    if (!process.env.CONNECTION_STRING) {
      console.error("❌ CONNECTION_STRING is not set in environment variables!");
      console.log("⚠️  Server will start but database operations will fail.");
      console.log("💡 Please set CONNECTION_STRING in your .env file");
      return;
    }

    console.log("🔌 Attempting to connect to MongoDB...");
    const connect = await mongoose.connect(`${process.env.CONNECTION_STRING}`);
    console.log("✅ Database connected successfully!");
    console.log(`🏠 Host: ${connect.connection.host}`);
    console.log(`📊 Database: ${connect.connection.name}`);
    console.log(`🔗 Connection State: ${connect.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    // Log connection events
    mongoose.connection.on('connected', () => {
      console.log("🟢 Mongoose connected to MongoDB");
    });
    
    mongoose.connection.on('error', (err) => {
      console.error("🔴 Mongoose connection error:", err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log("🟡 Mongoose disconnected from MongoDB");
    });
    
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error("🔍 Error details:", error.message);
    console.log("⚠️  Server will continue to run, but database operations will fail.");
    console.log("💡 Please check your CONNECTION_STRING and MongoDB connection.");
    // Don't exit - let the server start and handle errors in routes
  }
};

export default connectDb;
