import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import express from "express";
import {
  registerUser,
  loginUser,
} from "../controllers/authController.js";

const router = express.Router();

router.get("/profile", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    user: req.user,
  });
});

router.post("/register", protect, authorize("ADMIN"), registerUser);

// Login
router.post("/login", loginUser);

export default router;
