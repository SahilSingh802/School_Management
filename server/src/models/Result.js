
import mongoose from "mongoose";

const resultSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    marksObtained: {
      type: Number,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number,
      required: true,
    },
    grade: {
      type: String,
      required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

resultSchema.index(
  { examId: 1, studentId: 1 },
  { unique: true }
);

const Result = mongoose.model("Result", resultSchema);

export default Result;
