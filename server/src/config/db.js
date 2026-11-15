
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(
      process.env.MONGODB_URI,
      { serverSelectionTimeoutMS: 15000 }
    );

    console.log(`MongoDB Connected: ${connection.connection.host}`);
    console.log(`Database: ${connection.connection.name}`);

    return connection;
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    throw error;
  }
};

export default connectDB;
