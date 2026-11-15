
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fee",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER"],
      required: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ feeId: 1, paymentDate: -1 });
paymentSchema.index(
  { transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: "string" } } }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
