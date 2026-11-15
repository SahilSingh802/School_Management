
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

import {
  markAttendance,
  getAttendance,
  updateAttendance,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.use(protect);

router.post("/", authorize("ADMIN", "TEACHER"), markAttendance);
router.get("/", authorize("ADMIN", "TEACHER", "GUARDIAN"), getAttendance);
router.put("/:id", authorize("ADMIN", "TEACHER"), updateAttendance);

export default router;
