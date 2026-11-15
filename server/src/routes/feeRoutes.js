
import express from "express";

import {
  createFee,
  recordPayment,
  getFees,
  getPayments,
} from "../controllers/feeController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

// Admin: Create fee invoice
router.post(
  "/",
  authorize("ADMIN"),
  createFee
);

// Admin: Record payment
router.post(
  "/payment",
  authorize("ADMIN"),
  recordPayment
);

// Admin and Guardian: View fee records
router.get(
  "/",
  authorize("ADMIN", "GUARDIAN"),
  getFees
);

// Admin and Guardian: View payment history
router.get(
  "/payments",
  authorize("ADMIN", "GUARDIAN"),
  getPayments
);

export default router;
