
import Fee from "../models/Fee.js";
import Payment from "../models/Payment.js";
import Student from "../models/Student.js";

// Create Fee Invoice
export const createFee = async (req, res) => {
  try {
    const {
      studentId,
      academicYear,
      feeType,
      totalAmount,
      dueDate,
    } = req.body;

    if (
      !studentId ||
      !academicYear ||
      !feeType ||
      totalAmount === undefined ||
      !dueDate
    ) {
      return res.status(400).json({
        success: false,
        message: "All fee details are required",
      });
    }

    if (
      typeof totalAmount !== "number" ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0 ||
      Math.round(totalAmount * 100) !== totalAmount * 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Total amount must be positive and have at most two decimal places",
      });
    }

    if (Number.isNaN(new Date(dueDate).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid due date" });
    }

    const student = await Student.findOne({ _id: studentId, isActive: { $ne: false } });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const fee = await Fee.create({
      studentId,
      academicYear,
      feeType,
      totalAmount,
      dueDate,
    });

    return res.status(201).json({
      success: true,
      message: "Fee invoice created successfully",
      data: fee,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This fee invoice already exists",
      });
    }

    const status = ["ValidationError", "CastError"].includes(error.name) ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: status === 400 ? error.message : "Failed to create fee invoice",
    });
  }
};

// Record Fee Payment
export const recordPayment = async (req, res) => {
  const session = await Fee.startSession();

  try {
    const {
      feeId,
      amount,
      paymentMethod,
      transactionId,
      paymentDate,
    } = req.body;

    if (!feeId || amount === undefined || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Fee ID, amount and payment method are required",
      });
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    const validMethods = [
      "CASH",
      "UPI",
      "CARD",
      "BANK_TRANSFER",
    ];

    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    if (transactionId !== undefined &&
        (typeof transactionId !== "string" || !transactionId.trim())) {
      return res.status(400).json({ success: false, message: "Invalid transaction ID" });
    }

    const parsedPaymentDate = paymentDate === undefined ? new Date() : new Date(paymentDate);
    if (Number.isNaN(parsedPaymentDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid payment date" });
    }

    session.startTransaction();

    const fee = await Fee.findById(feeId).session(session);

    if (!fee) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Fee invoice not found",
      });
    }

    const balance = fee.totalAmount - fee.paidAmount;

    if (amount > balance) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed outstanding balance of ${balance}`,
      });
    }

    const nextPaidAmount = Number((fee.paidAmount + amount).toFixed(2));
    const updatedFee = await Fee.findOneAndUpdate(
      {
        _id: fee._id,
        paidAmount: fee.paidAmount,
        totalAmount: { $gte: nextPaidAmount },
      },
      {
        $set: {
          paidAmount: nextPaidAmount,
          status: nextPaidAmount >= fee.totalAmount ? "PAID" : "PARTIAL",
        },
      },
      { new: true, session }
    );

    if (!updatedFee) {
      const error = new Error("Fee balance changed; refresh and try again");
      error.statusCode = 409;
      throw error;
    }

    const [payment] = await Payment.create(
      [{
        feeId,
        studentId: fee.studentId,
        amount,
        paymentMethod,
        transactionId: transactionId?.trim(),
        receivedBy: req.user.id,
        paymentDate: parsedPaymentDate,
      }],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        payment,
        totalAmount: updatedFee.totalAmount,
        paidAmount: updatedFee.paidAmount,
        outstandingBalance: Number((updatedFee.totalAmount - updatedFee.paidAmount).toFixed(2)),
        status: updatedFee.status,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({
      success: false,
      message: error.statusCode ? error.message
        : error.code === 11000 ? "Transaction ID has already been processed"
          : "Failed to record payment",
    });
  } finally {
    await session.endSession();
  }
};

// Get Fee Records
export const getFees = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "GUARDIAN") {
      const students = await Student.find({
        guardianIds: req.user.id,
      }).select("_id");

      filter.studentId = {
        $in: students.map((student) => student._id),
      };
    } else if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }

    const fees = await Fee.find(filter)
      .populate("studentId", "name admissionNo classId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: fees.length,
      data: fees,
    });
  } catch (error) {
    console.error("Get Fees Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch fee records",
    });
  }
};

// Get Payment History
export const getPayments = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "GUARDIAN") {
      const students = await Student.find({
        guardianIds: req.user.id,
      }).select("_id");

      filter.studentId = {
        $in: students.map((student) => student._id),
      };
    } else {
      if (req.query.studentId) {
        filter.studentId = req.query.studentId;
      }

      if (req.query.feeId) {
        filter.feeId = req.query.feeId;
      }
    }

    const payments = await Payment.find(filter)
      .populate("studentId", "name admissionNo classId")
      .populate("feeId")
      .sort({ paymentDate: -1 });

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error("Get Payments Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};
