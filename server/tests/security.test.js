import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import request from "supertest";

const findById = jest.fn();
const findStudent = jest.fn();
const findTeacher = jest.fn();
const createAttendance = jest.fn();

jest.unstable_mockModule("../src/models/User.js", () => ({
  default: { findById },
}));
jest.unstable_mockModule("../src/models/Student.js", () => ({
  default: { findOne: findStudent },
}));
jest.unstable_mockModule("../src/models/Teacher.js", () => ({
  default: { findOne: findTeacher },
}));
jest.unstable_mockModule("../src/models/Attendance.js", () => ({
  default: { create: createAttendance },
}));

const { default: app } = await import("../src/server.js");

describe("API authentication and authorization", () => {
  beforeEach(() => {
    findById.mockReset();
    findStudent.mockReset();
    findTeacher.mockReset();
    createAttendance.mockReset();
    process.env.JWT_SECRET = "test-secret-for-api-tests";
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
});
