
import express from "express";
import {
  getDashboardStats,
  getGuardianDashboard,
  getTeacherDashboard,
} from "../controllers/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/stats", protect, authorize("ADMIN"), getDashboardStats);
router.get("/teacher", protect, authorize("TEACHER"), getTeacherDashboard);
router.get("/guardian", protect, authorize("GUARDIAN"), getGuardianDashboard);

export default router;
