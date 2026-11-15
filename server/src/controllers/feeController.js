
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
    const filter = await buildFeeFilter(req, "dueDate");
    if (filter.error) {
      return res.status(filter.error.status).json({ success: false, message: filter.error.message });
    }

    const fees = await Fee.find(filter.value)
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
    const ownership = await getStudentOwnershipFilter(req);
    if (ownership.error) {
      return res.status(ownership.error.status).json({ success: false, message: ownership.error.message });
    }
    const filter = { ...ownership.value };

    if (req.query.feeId) {
      if (!/^[a-f\d]{24}$/i.test(req.query.feeId)) {
        return res.status(400).json({ success: false, message: "Invalid fee ID" });
      }
      filter.feeId = req.query.feeId;
    }
    if (req.query.paymentMethod) {
      if (!["CASH", "UPI", "CARD", "BANK_TRANSFER"].includes(req.query.paymentMethod)) {
        return res.status(400).json({ success: false, message: "Invalid payment method" });
      }
      filter.paymentMethod = req.query.paymentMethod;
    }
    const dateFilter = buildDateRange(
      req.query.paymentFromDate || req.query.fromDate,
      req.query.paymentToDate || req.query.toDate
    );
    if (dateFilter.error) {
      return res.status(400).json({ success: false, message: dateFilter.error });
    }
    if (dateFilter.value) filter.paymentDate = dateFilter.value;

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

export const getFeeCollectionReport = async (req, res) => {
  try {
    const feeFilter = await buildFeeFilter(req, "dueDate");
    if (feeFilter.error) {
      return res.status(feeFilter.error.status).json({ success: false, message: feeFilter.error.message });
    }
    const invoices = await Fee.find(feeFilter.value).select("_id totalAmount paidAmount status academicYear feeType");
    const feeIds = invoices.map((fee) => fee._id);
    const dateFilter = buildDateRange(req.query.paymentFromDate, req.query.paymentToDate);
    if (dateFilter.error) {
      return res.status(400).json({ success: false, message: dateFilter.error });
    }

    const paymentMatch = { feeId: { $in: feeIds } };
    if (dateFilter.value) paymentMatch.paymentDate = dateFilter.value;
    const [paymentSummary] = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          collected: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
        },
      },
    ]);

    const report = invoices.reduce((summary, invoice) => {
      summary.totalInvoiced += invoice.totalAmount;
      summary.currentlyPaid += invoice.paidAmount;
      summary.outstanding += invoice.totalAmount - invoice.paidAmount;
      summary.invoiceCount += 1;
      return summary;
    }, { totalInvoiced: 0, currentlyPaid: 0, outstanding: 0, invoiceCount: 0 });
    const breakdown = [...invoices.reduce((groups, invoice) => {
      const key = `${invoice.academicYear}\u0000${invoice.feeType}`;
      const group = groups.get(key) || {
        academicYear: invoice.academicYear,
        feeType: invoice.feeType,
        invoiceCount: 0,
        totalInvoiced: 0,
        currentlyPaid: 0,
        outstanding: 0,
      };
      group.invoiceCount += 1;
      group.totalInvoiced += invoice.totalAmount;
      group.currentlyPaid += invoice.paidAmount;
      group.outstanding += invoice.totalAmount - invoice.paidAmount;
      groups.set(key, group);
      return groups;
    }, new Map()).values()];

    return res.json({
      success: true,
      data: {
        ...report,
        breakdown,
        collectedInPeriod: paymentSummary?.collected || 0,
        paymentCountInPeriod: paymentSummary?.paymentCount || 0,
        period: { fromDate: req.query.paymentFromDate || null, toDate: req.query.paymentToDate || null },
      },
    });
  } catch (error) {
    console.error("Fee Collection Report Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to generate fee collection report" });
  }
};

export const getOutstandingFeeReport = async (req, res) => {
  try {
    const feeFilter = await buildFeeFilter(req, "dueDate");
    if (feeFilter.error) {
      return res.status(feeFilter.error.status).json({ success: false, message: feeFilter.error.message });
    }
    const invoices = await Fee.find({
      ...feeFilter.value,
      $expr: { $lt: ["$paidAmount", "$totalAmount"] },
    })
      .populate("studentId", "name admissionNo classId")
      .sort({ dueDate: 1 });
    const summary = invoices.reduce((result, invoice) => {
      result.invoiceCount += 1;
      result.outstanding += invoice.totalAmount - invoice.paidAmount;
      return result;
    }, { invoiceCount: 0, outstanding: 0 });

    return res.json({ success: true, data: { ...summary, invoices } });
  } catch (error) {
    console.error("Outstanding Fee Report Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to generate outstanding fee report" });
  }
};

const getStudentOwnershipFilter = async (req) => {
  if (req.query.studentId && !/^[a-f\d]{24}$/i.test(req.query.studentId)) {
    return { error: { status: 400, message: "Invalid student ID" } };
  }

  if (req.user.role === "GUARDIAN") {
    const students = await Student.find({ guardianIds: req.user.id }).select("_id");
    const linkedIds = students.map((student) => String(student._id));
    if (req.query.studentId && !linkedIds.includes(req.query.studentId)) {
      return { error: { status: 403, message: "You cannot access this student's fee information" } };
    }
    return { value: { studentId: req.query.studentId || { $in: students.map((student) => student._id) } } };
  }

  return { value: req.query.studentId ? { studentId: req.query.studentId } : {} };
};

const buildFeeFilter = async (req, dateField) => {
  const ownership = await getStudentOwnershipFilter(req);
  if (ownership.error) return ownership;

  const filter = { ...ownership.value };
  if (req.query.academicYear) {
    filter.academicYear = req.query.academicYear;
  }
  if (req.query.feeType) {
    filter.feeType = req.query.feeType;
  }
  if (req.query.status) {
    if (!["PENDING", "PARTIAL", "PAID"].includes(req.query.status)) {
      return { error: { status: 400, message: "Invalid fee status" } };
    }
    filter.status = req.query.status;
  }
  if (dateField) {
    const dateFilter = buildDateRange(req.query.fromDate, req.query.toDate);
    if (dateFilter.error) return { error: { status: 400, message: dateFilter.error } };
    if (dateFilter.value) filter[dateField] = dateFilter.value;
  }

  return { value: filter };
};

const buildDateRange = (fromDate, toDate) => {
  const parseDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
      ? null
      : parsed;
  };
  const start = fromDate ? parseDate(fromDate) : null;
  const end = toDate ? parseDate(toDate) : null;
  if ((fromDate && !start) || (toDate && !end)) {
    return { error: "Invalid date range" };
  }
  if (start && end && start > end) {
    return { error: "Start date must not be after end date" };
  }
  if (!start && !end) return { value: null };

  const range = {};
  if (start) range.$gte = start;
  if (end) {
    const exclusiveEnd = new Date(end);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.$lt = exclusiveEnd;
  }
  return { value: range };
};
