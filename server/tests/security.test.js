import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import request from "supertest";

const findById = jest.fn();
const findUserByEmail = jest.fn();
const findStudent = jest.fn();
const findStudents = jest.fn();
const createStudent = jest.fn();
const findUsers = jest.fn();
const findTeacher = jest.fn();
const createAttendance = jest.fn();
const classExists = jest.fn();
const startFeeSession = jest.fn();
const findFeeById = jest.fn();
const findExamById = jest.fn();
const createResult = jest.fn();

jest.unstable_mockModule("../src/models/User.js", () => ({
  default: { findById, find: findUsers, findOne: findUserByEmail },
}));
jest.unstable_mockModule("../src/models/Student.js", () => ({
  default: { findOne: findStudent, find: findStudents, create: createStudent },
}));
jest.unstable_mockModule("../src/models/Teacher.js", () => ({
  default: { findOne: findTeacher },
}));
jest.unstable_mockModule("../src/models/Attendance.js", () => ({
  default: { create: createAttendance },
}));
jest.unstable_mockModule("../src/models/Class.js", () => ({
  default: { exists: classExists },
}));
jest.unstable_mockModule("../src/models/Fee.js", () => ({
  default: { startSession: startFeeSession, findById: findFeeById },
}));
jest.unstable_mockModule("../src/models/Exam.js", () => ({
  default: { findById: findExamById },
}));
jest.unstable_mockModule("../src/models/Result.js", () => ({
  default: { create: createResult },
}));

const { default: app } = await import("../src/server.js");

describe("API authentication and authorization", () => {
  beforeEach(() => {
    findById.mockReset();
    findUserByEmail.mockReset();
    findStudent.mockReset();
    findStudents.mockReset();
    createStudent.mockReset();
    findUsers.mockReset();
    findTeacher.mockReset();
    createAttendance.mockReset();
    classExists.mockReset();
    startFeeSession.mockReset();
    findFeeById.mockReset();
    findExamById.mockReset();
    createResult.mockReset();
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
});
