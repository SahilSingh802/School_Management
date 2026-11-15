import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import resultRoutes from "./routes/resultRoutes.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import academicRoutes from "./routes/academicRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import feeRoutes from "./routes/feeRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import { pathToFileURL } from "node:url";
dotenv.config();

const app = express();
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
}));

app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "School Management API is running",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found",
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("API Error:", error.message);
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({
        success: false,
        message: status < 500 ? "Invalid request" : "Internal server error",
    });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    startServer();
}

export default app;
