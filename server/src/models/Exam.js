import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    passMarks: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

examSchema.index({ classId: 1, subjectId: 1, title: 1 }, { unique: true });

const Exam = mongoose.model("Exam", examSchema);

export default Exam;