
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error("Admin credentials missing in .env");
    }

    await connectDB();

    const existingAdmin = await User.findOne({
      email: process.env.ADMIN_EMAIL.toLowerCase(),
    });

    if (existingAdmin) {
      console.log("Admin account already exists.");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD,
      12
    );

    await User.create({
      name: process.env.ADMIN_NAME || "School Admin",
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: "ADMIN",
    });

    console.log("Admin account created successfully!");
  } catch (error) {
    console.error("Admin creation failed:", error.message);
  } finally {
    await mongoose.connection.close();
  }
};

createAdmin();
