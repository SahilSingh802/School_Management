import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import request from "supertest";

const findById = jest.fn();
const findUserByEmail = jest.fn();
const findStudent = jest.fn();
const findStudentById = jest.fn();
const findStudents = jest.fn();
const createStudent = jest.fn();
const findUsers = jest.fn();
const findTeacher = jest.fn();
const createAttendance = jest.fn();
const findAttendance = jest.fn();
const classExists = jest.fn();
const startFeeSession = jest.fn();
const findFeeById = jest.fn();
const findFees = jest.fn();
const findPayments = jest.fn();
const aggregatePayments = jest.fn();
const findExamById = jest.fn();
const findExams = jest.fn();
const createResult = jest.fn();
const findResults = jest.fn();
const createUser = jest.fn();

jest.unstable_mockModule("../src/models/User.js", () => ({
  default: { findById, find: findUsers, findOne: findUserByEmail, create: createUser },
}));
jest.unstable_mockModule("../src/models/Student.js", () => ({
  default: { findOne: findStudent, findById: findStudentById, find: findStudents, create: createStudent },
}));
jest.unstable_mockModule("../src/models/Teacher.js", () => ({
  default: { findOne: findTeacher },
}));
jest.unstable_mockModule("../src/models/Attendance.js", () => ({
  default: { create: createAttendance, find: findAttendance },
}));
jest.unstable_mockModule("../src/models/Class.js", () => ({
  default: { exists: classExists },
}));
jest.unstable_mockModule("../src/models/Fee.js", () => ({
  default: { startSession: startFeeSession, findById: findFeeById, find: findFees },
}));
jest.unstable_mockModule("../src/models/Exam.js", () => ({
  default: { findById: findExamById, find: findExams },
}));
jest.unstable_mockModule("../src/models/Result.js", () => ({
  default: { create: createResult, find: findResults },
}));
jest.unstable_mockModule("../src/models/Payment.js", () => ({
  default: { find: findPayments, aggregate: aggregatePayments },
}));

const { default: app } = await import("../src/server.js");

describe("API authentication and authorization", () => {
  beforeEach(() => {
    findById.mockReset();
    findUserByEmail.mockReset();
    findStudent.mockReset();
    findStudentById.mockReset();
    findStudents.mockReset();
    createStudent.mockReset();
    findUsers.mockReset();
    findTeacher.mockReset();
    createAttendance.mockReset();
    findAttendance.mockReset();
    classExists.mockReset();
    startFeeSession.mockReset();
    findFeeById.mockReset();
    findFees.mockReset();
    findPayments.mockReset();
    aggregatePayments.mockReset();
    findExamById.mockReset();
    findExams.mockReset();
    createResult.mockReset();
    findResults.mockReset();
    createUser.mockReset();
    process.env.JWT_SECRET = "test-secret-for-api-tests";
  });

  it("reports API health without requiring authentication", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("authenticates a valid login and never returns the password hash", async () => {
    const passwordHash = await bcrypt.hash("safe-test-password", 4);
    findUserByEmail.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "School Admin",
        email: "admin@example.test",
        role: "ADMIN",
        isActive: true,
        password: passwordHash,
      }),
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "ADMIN@example.test", password: "safe-test-password" });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.password).toBeUndefined();
  });

  it("rejects invalid login credentials", async () => {
    findUserByEmail.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.test", password: "wrong-password" });

    expect(response.status).toBe(401);
  });

  it("rejects protected API requests without a token", async () => {
    const response = await request(app).get("/api/academic/teachers");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects inactive users even when their JWT is valid", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      isActive: false,
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/academic/teachers")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("forbids teachers from admin-only teacher management", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Teacher",
      email: "teacher@example.test",
      role: "TEACHER",
      isActive: true,
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "TEACHER" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/academic/teachers")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("prevents a teacher from marking attendance for an unassigned class", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Teacher",
      email: "teacher@example.test",
      role: "TEACHER",
      isActive: true,
    });
    findStudent.mockResolvedValue({
      classId: { toString: () => "507f1f77bcf86cd799439012" },
    });
    findTeacher.mockResolvedValue(null);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "TEACHER" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({
        studentId: "507f1f77bcf86cd799439013",
        classId: "507f1f77bcf86cd799439012",
        date: "2026-11-15",
        session: "MORNING",
        status: "PRESENT",
      });

    expect(response.status).toBe(403);
    expect(createAttendance).not.toHaveBeenCalled();
  });

  it("limits guardian student results to linked student records", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Guardian",
      email: "guardian@example.test",
      role: "GUARDIAN",
      isActive: true,
    });
    const records = [{ _id: "507f1f77bcf86cd799439013", name: "Linked student" }];
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(records),
    };
    findStudents.mockReturnValue(query);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "GUARDIAN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/academic/students")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(findStudents).toHaveBeenCalledWith({
      isActive: { $ne: false },
      guardianIds: "507f1f77bcf86cd799439011",
    });
    expect(response.body.data).toEqual(records);
  });

  it("returns conflict when a student admission number is duplicated", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    classExists.mockResolvedValue(true);
    findUsers.mockResolvedValue([]);
    createStudent.mockRejectedValue({ code: 11000 });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/api/academic/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "New Student",
        admissionNo: "ADM-001",
        classId: "507f1f77bcf86cd799439012",
      });

    expect(response.status).toBe(409);
  });

  it("rejects a fee payment exceeding the remaining balance", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    const session = {
      startTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      inTransaction: jest.fn().mockReturnValue(true),
      endSession: jest.fn(),
    };
    startFeeSession.mockResolvedValue(session);
    findFeeById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        totalAmount: 100,
        paidAmount: 80,
      }),
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/api/fees/payment")
      .set("Authorization", `Bearer ${token}`)
      .send({
        feeId: "507f1f77bcf86cd799439012",
        amount: 25,
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(400);
    expect(session.abortTransaction).toHaveBeenCalled();
  });

  it("rejects marks outside the examination maximum", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    findExamById.mockResolvedValue({
      classId: "507f1f77bcf86cd799439012",
      maxMarks: 100,
    });
    findStudent.mockResolvedValue({
      classId: "507f1f77bcf86cd799439012",
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/api/results")
      .set("Authorization", `Bearer ${token}`)
      .send({
        examId: "507f1f77bcf86cd799439014",
        studentId: "507f1f77bcf86cd799439013",
        marksObtained: 101,
      });

    expect(response.status).toBe(400);
    expect(createResult).not.toHaveBeenCalled();
  });

  it("denies a guardian report card for an unlinked student", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Guardian",
      email: "guardian@example.test",
      role: "GUARDIAN",
      isActive: true,
    });
    const student = {
      _id: "507f1f77bcf86cd799439013",
      guardianIds: ["507f1f77bcf86cd799439099"],
    };
    const query = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(student),
    };
    findStudentById.mockReturnValue(query);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "GUARDIAN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/results/students/507f1f77bcf86cd799439013/report-card")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(findResults).not.toHaveBeenCalled();
  });

  it("returns report-card examination marks only for the selected student", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    const student = {
      _id: "507f1f77bcf86cd799439013",
      name: "Student",
      admissionNo: "ADM-001",
      guardianIds: [],
      classId: { _id: "507f1f77bcf86cd799439012", name: "Class 1", section: "A", academicYear: "2026-27" },
    };
    findStudentById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(student),
    });
    const exam = {
      _id: "507f1f77bcf86cd799439014",
      title: "Term 1",
      date: new Date("2026-11-01"),
      maxMarks: 100,
      subjectId: { name: "Mathematics", code: "MATH" },
    };
    findResults.mockReturnValue({
      populate: jest.fn().mockResolvedValue([{
        examId: exam,
        marksObtained: 81,
        percentage: 81,
        grade: "A",
        remarks: "",
      }]),
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/results/students/507f1f77bcf86cd799439013/report-card")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.examinations).toMatchObject([{
      title: "Term 1",
      subject: { name: "Mathematics", code: "MATH" },
      marksObtained: 81,
      maxMarks: 100,
      grade: "A",
    }]);
    expect(response.body.data.summary.overallPercentage).toBe(81);
  });

  it("allows a guardian to read a report card for their own linked student", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Guardian",
      email: "guardian@example.test",
      role: "GUARDIAN",
      isActive: true,
    });
    const student = {
      _id: "507f1f77bcf86cd799439013",
      guardianIds: ["507f1f77bcf86cd799439011"],
      classId: { _id: "507f1f77bcf86cd799439012", name: "Class 1", section: "A", academicYear: "2026-27" },
    };
    findStudentById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(student),
    });
    findResults.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "GUARDIAN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/results/students/507f1f77bcf86cd799439013/report-card")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.summary.examinationCount).toBe(0);
  });

  it("does not export attendance for an unlinked guardian student", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Guardian",
      email: "guardian@example.test",
      role: "GUARDIAN",
      isActive: true,
    });
    findStudents.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: "507f1f77bcf86cd799439013" }]),
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "GUARDIAN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/attendance/export.csv?studentId=507f1f77bcf86cd799439099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(findAttendance).not.toHaveBeenCalled();
  });

  it("returns attendance exports as CSV and neutralizes spreadsheet formulas", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    findAttendance.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([{
        date: new Date("2026-11-15"),
        studentId: { name: "=1+1", admissionNo: "ADM-001" },
        classId: { name: "Class 1", section: "A" },
        session: "MORNING",
        status: "PRESENT",
        markedBy: { name: "Admin" },
      }]),
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/attendance/export.csv")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("\"'=1+1\"");
  });

  it("denies guardians fee reports for unlinked students", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Guardian",
      email: "guardian@example.test",
      role: "GUARDIAN",
      isActive: true,
    });
    findStudents.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: "507f1f77bcf86cd799439013" }]),
    });
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "GUARDIAN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/fees/reports/outstanding?studentId=507f1f77bcf86cd799439099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(findFees).not.toHaveBeenCalled();
  });

  it("applies invoice filters before returning fee records", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    };
    findFees.mockReturnValue(query);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/fees?academicYear=2026-27&status=PARTIAL&fromDate=2026-01-01&toDate=2026-12-31")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(findFees).toHaveBeenCalledWith({
      academicYear: "2026-27",
      status: "PARTIAL",
      dueDate: {
        $gte: new Date("2026-01-01T00:00:00.000Z"),
        $lt: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
  });

  it("returns outstanding and period collection totals from invoices and payments", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    const invoices = [{
      _id: "507f1f77bcf86cd799439015",
      totalAmount: 100,
      paidAmount: 40,
      status: "PARTIAL",
      academicYear: "2026-27",
      feeType: "Tuition",
    }];
    findFees.mockReturnValue({
      select: jest.fn().mockResolvedValue(invoices),
    });
    aggregatePayments.mockResolvedValue([{ collected: 20, paymentCount: 1 }]);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/fees/reports/collection?paymentFromDate=2026-11-01&paymentToDate=2026-11-30")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      totalInvoiced: 100,
      currentlyPaid: 40,
      outstanding: 60,
      collectedInPeriod: 20,
      paymentCountInPeriod: 1,
      breakdown: [{ academicYear: "2026-27", feeType: "Tuition", outstanding: 60 }],
    });
  });

  it("returns payment history with payment-method and date filters", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    };
    findPayments.mockReturnValue(query);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/fees/payments?paymentMethod=UPI&paymentFromDate=2026-11-01&paymentToDate=2026-11-30")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(findPayments).toHaveBeenCalledWith({
      paymentMethod: "UPI",
      paymentDate: {
        $gte: new Date("2026-11-01T00:00:00.000Z"),
        $lt: new Date("2026-12-01T00:00:00.000Z"),
      },
    });
  });

  it("lists only unpaid invoices in the outstanding fee report", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    const invoices = [{
      _id: "507f1f77bcf86cd799439015",
      totalAmount: 100,
      paidAmount: 25,
      studentId: { name: "Student", admissionNo: "ADM-001" },
      feeType: "Tuition",
      academicYear: "2026-27",
      dueDate: new Date("2026-12-01"),
      status: "PARTIAL",
    }];
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(invoices),
    };
    findFees.mockReturnValue(query);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/api/fees/reports/outstanding")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.invoiceCount).toBe(1);
    expect(response.body.data.outstanding).toBe(75);
    expect(findFees).toHaveBeenCalledWith({
      $expr: { $lt: ["$paidAmount", "$totalAmount"] },
    });
  });

  it("creates guardian accounts only for admins and stores a hash", async () => {
    findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      isActive: true,
    });
    findUserByEmail.mockResolvedValue(null);
    createUser.mockImplementation(async (user) => user);
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Guardian",
        email: "guardian@example.test",
        password: "safe-test-password",
        role: "GUARDIAN",
      });

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: "GUARDIAN",
      email: "guardian@example.test",
      password: expect.any(String),
    }));
    const storedUser = createUser.mock.calls[0][0];
    expect(storedUser.password).not.toBe("safe-test-password");
    expect(await bcrypt.compare("safe-test-password", storedUser.password)).toBe(true);
  });
});
