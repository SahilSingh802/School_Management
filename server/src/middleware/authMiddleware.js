import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Authentication token required.",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured",
    });
  }

  let decoded;
  try {
    const token = authHeader.slice("Bearer ".length).trim();
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }

  const user = await User.findById(decoded.userId);

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: "Invalid or inactive user.",
    });
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return next();
};
