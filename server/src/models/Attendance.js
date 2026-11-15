
import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    session: {
      type: String,
      enum: ["MORNING", "AFTERNOON"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LATE"],
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate attendance for the same student,
// date and session.
attendanceSchema.index(
  { studentId: 1, date: 1, session: 1 },
  { unique: true }
);

export default mongoose.model("Attendance", attendanceSchema);
