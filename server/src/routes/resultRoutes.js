
import express from "express";
import {
  createResult,
  getResults,
  getStudentReportCard,
  updateResult,
} from "../controllers/resultController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.post(
  "/",
  authorize("ADMIN", "TEACHER"),
  createResult
);

router.get(
  "/",
  authorize("ADMIN", "TEACHER", "GUARDIAN"),
  getResults
);

router.get(
  "/students/:studentId/report-card",
  authorize("ADMIN", "TEACHER", "GUARDIAN"),
  getStudentReportCard
);

router.put("/:id", authorize("ADMIN", "TEACHER"), updateResult);

export default router;
