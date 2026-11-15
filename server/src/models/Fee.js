
import mongoose from "mongoose";

const feeSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    feeType: {
      type: String,
      required: true,
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator(value) {
          return value <= this.totalAmount;
        },
        message: "Paid amount cannot exceed total amount",
      },
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

feeSchema.index({ studentId: 1, academicYear: 1, feeType: 1 }, {
  unique: true,
});

const Fee = mongoose.model("Fee", feeSchema);

export default Fee;

