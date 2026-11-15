import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import request from "supertest";

const findUserById = jest.fn();
const findStudents = jest.fn();
const findTeacher = jest.fn();
const findClasses = jest.fn();
const findSubjects = jest.fn();
const findAttendance = jest.fn();
const aggregateAttendance = jest.fn();
const findExams = jest.fn();
const findResults = jest.fn();
const findFees = jest.fn();
const aggregateFees = jest.fn();
const countStudents = jest.fn();
const countTeachers = jest.fn();
const countClasses = jest.fn();

jest.unstable_mockModule("../src/models/User.js", () => ({
  default: { findById: findUserById, find: jest.fn(), findOne: jest.fn(), create: jest.fn() },
}));
jest.unstable_mockModule("../src/models/Student.js", () => ({
  default: { find: findStudents, findOne: jest.fn(), findById: jest.fn(), countDocuments: countStudents },
}));
jest.unstable_mockModule("../src/models/Teacher.js", () => ({
  default: { findOne: findTeacher, countDocuments: countTeachers },
}));
jest.unstable_mockModule("../src/models/Class.js", () => ({
  default: { find: findClasses, exists: jest.fn(), countDocuments: countClasses },
}));
jest.unstable_mockModule("../src/models/Subject.js", () => ({
  default: { find: findSubjects },
}));
jest.unstable_mockModule("../src/models/Attendance.js", () => ({
  default: { find: findAttendance, aggregate: aggregateAttendance, create: jest.fn() },
}));
jest.unstable_mockModule("../src/models/Exam.js", () => ({
  default: { find: findExams, findById: jest.fn() },
}));
jest.unstable_mockModule("../src/models/Result.js", () => ({
  default: { find: findResults, create: jest.fn() },
}));
jest.unstable_mockModule("../src/models/Fee.js", () => ({
  default: { find: findFees, aggregate: aggregateFees, findById: jest.fn(), startSession: jest.fn() },
}));
jest.unstable_mockModule("../src/models/Payment.js", () => ({
  default: { find: jest.fn(), aggregate: jest.fn() },
}));

const { default: app } = await import("../src/server.js");

const makeQuery = (result) => {
  const query = {
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
};

const adminId = "507f1f77bcf86cd799439011";
const teacherId = "507f1f77bcf86cd799439012";
const guardianId = "507f1f77bcf86cd799439013";
const linkedStudentId = "507f1f77bcf86cd799439014";
const assignedClassId = "507f1f77bcf86cd799439015";
const assignedSubjectId = "507f1f77bcf86cd799439016";
const outsiderId = "507f1f77bcf86cd799439017";

function tokenFor(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET);
}

function mockAuthenticatedUser(userId, role) {
  findUserById.mockResolvedValue({
    _id: userId,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
    isActive: true,
  });
}

describe("role-specific dashboards", () => {
  beforeEach(() => {
    for (const mock of [
      findUserById,
      findStudents,
      findTeacher,
      findClasses,
      findSubjects,
      findAttendance,
      aggregateAttendance,
      findExams,
      findResults,
      findFees,
      aggregateFees,
      countStudents,
      countTeachers,
      countClasses,
    ]) {
      mock.mockReset();
    }
    process.env.JWT_SECRET = "dashboard-test-secret";
  });

  it("allows only admins to access the school-wide dashboard API", async () => {
    mockAuthenticatedUser(adminId, "ADMIN");
    countStudents.mockResolvedValue(4);
    countTeachers.mockResolvedValue(2);
    countClasses.mockResolvedValue(3);
    findAttendance.mockReturnValue(makeQuery([{ status: "PRESENT" }]));
    aggregateAttendance.mockResolvedValue([]);
    aggregateFees.mockResolvedValue([{ totalFees: 100, totalCollected: 40 }]);

    const adminResponse = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${tokenFor(adminId, "ADMIN")}`);

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.totalStudents).toBe(4);
    expect(adminResponse.body.data.totalCollected).toBe(40);

    mockAuthenticatedUser(teacherId, "TEACHER");
    const teacherResponse = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${tokenFor(teacherId, "TEACHER")}`);
    expect(teacherResponse.status).toBe(403);

    mockAuthenticatedUser(guardianId, "GUARDIAN");
    const guardianResponse = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${tokenFor(guardianId, "GUARDIAN")}`);
    expect(guardianResponse.status).toBe(403);
  });

  it("limits teacher dashboard queries to assigned classes and subjects", async () => {
    mockAuthenticatedUser(teacherId, "TEACHER");
    findTeacher.mockReturnValue(makeQuery({
      assignedClasses: [assignedClassId],
      subjects: [assignedSubjectId],
    }));
    findClasses.mockReturnValue(makeQuery([{ _id: assignedClassId, name: "Class 1", section: "A" }]));
    findSubjects.mockReturnValue(makeQuery([{ _id: assignedSubjectId, name: "Math", code: "MTH" }]));
    aggregateAttendance.mockResolvedValue([
      { _id: "PRESENT", count: 2 },
      { _id: "LATE", count: 1 },
    ]);
    findAttendance.mockReturnValue(makeQuery([]));
    findExams.mockReturnValue(makeQuery([]));

    const response = await request(app)
      .get(`/api/dashboard/teacher?classId=${outsiderId}&studentId=${outsiderId}`)
      .set("Authorization", `Bearer ${tokenFor(teacherId, "TEACHER")}`);

    expect(response.status).toBe(200);
    expect(response.body.data.assignedClasses).toHaveLength(1);
    expect(response.body.data.subjects).toHaveLength(1);
    expect(response.body.data.attendanceSummary).toMatchObject({
      total: 3,
      present: 2,
      late: 1,
    });
    expect(findClasses).toHaveBeenCalledWith({ _id: { $in: [assignedClassId] } });
    expect(findSubjects).toHaveBeenCalledWith({
      _id: { $in: [assignedSubjectId] },
      $or: [{ classes: { $size: 0 } }, { classes: { $in: [assignedClassId] } }],
    });
    expect(aggregateAttendance.mock.calls[0][0][0].$match.classId).toEqual({
      $in: [assignedClassId],
    });
    expect(findAttendance.mock.calls[0][0].classId).toEqual({ $in: [assignedClassId] });
    expect(findExams.mock.calls[0][0]).toMatchObject({
      classId: { $in: [assignedClassId] },
      subjectId: { $in: [assignedSubjectId] },
    });
  });

  it("denies non-teachers access to the teacher dashboard", async () => {
    mockAuthenticatedUser(guardianId, "GUARDIAN");
    const guardianResponse = await request(app)
      .get("/api/dashboard/teacher")
      .set("Authorization", `Bearer ${tokenFor(guardianId, "GUARDIAN")}`);

    expect(guardianResponse.status).toBe(403);

    mockAuthenticatedUser(adminId, "ADMIN");
    const adminResponse = await request(app)
      .get("/api/dashboard/teacher")
      .set("Authorization", `Bearer ${tokenFor(adminId, "ADMIN")}`);

    expect(adminResponse.status).toBe(403);
    expect(findTeacher).not.toHaveBeenCalled();
  });

  it("does not return dashboard data when the authenticated teacher has no profile", async () => {
    mockAuthenticatedUser(teacherId, "TEACHER");
    findTeacher.mockReturnValue(makeQuery(null));

    const response = await request(app)
      .get("/api/dashboard/teacher")
      .set("Authorization", `Bearer ${tokenFor(teacherId, "TEACHER")}`);

    expect(response.status).toBe(403);
    expect(findClasses).not.toHaveBeenCalled();
    expect(findExams).not.toHaveBeenCalled();
  });

  it("limits every guardian dashboard query to that guardian's linked students", async () => {
    mockAuthenticatedUser(guardianId, "GUARDIAN");
    const linkedStudent = {
      _id: linkedStudentId,
      name: "Linked student",
      admissionNo: "ADM-001",
      classId: { name: "Class 1", section: "A" },
    };
    const linkedStudentQuery = makeQuery([linkedStudent]);
    findStudents.mockReturnValue(linkedStudentQuery);
    aggregateAttendance.mockResolvedValue([
      { _id: { studentId: linkedStudentId, status: "PRESENT" }, count: 2 },
      { _id: { studentId: linkedStudentId, status: "ABSENT" }, count: 1 },
    ]);
    findAttendance.mockReturnValue(makeQuery([]));
    findResults.mockReturnValue(makeQuery([]));
    aggregateFees.mockResolvedValue([{
      _id: linkedStudentId,
      invoiceCount: 1,
      totalInvoiced: 100,
      paidAmount: 25,
      outstanding: 75,
      outstandingInvoiceCount: 1,
    }]);
    findFees.mockReturnValue(makeQuery([]));

    const response = await request(app)
      .get(`/api/dashboard/guardian?studentId=${outsiderId}&classId=${outsiderId}`)
      .set("Authorization", `Bearer ${tokenFor(guardianId, "GUARDIAN")}`);

    expect(response.status).toBe(200);
    expect(response.body.data.linkedStudents.map((student) => student._id)).toEqual([linkedStudentId]);
    expect(response.body.data.attendanceSummary).toMatchObject({
      total: 3,
      present: 2,
      absent: 1,
    });
    expect(response.body.data.feeSummaryByStudent).toEqual([expect.objectContaining({
      studentId: linkedStudentId,
      outstanding: 75,
    })]);
    expect(findStudents).toHaveBeenCalledWith({
      guardianIds: guardianId,
      isActive: { $ne: false },
    });
    expect(linkedStudentQuery.select).toHaveBeenCalledWith("name admissionNo classId");
    expect(aggregateAttendance.mock.calls[0][0][0].$match.studentId).toEqual({
      $in: [linkedStudentId],
    });
    expect(findAttendance.mock.calls[0][0].studentId).toEqual({ $in: [linkedStudentId] });
    expect(findResults).toHaveBeenCalledWith({ studentId: { $in: [linkedStudentId] } });
    expect(aggregateFees.mock.calls[0][0][0].$match.studentId).toEqual({
      $in: [linkedStudentId],
    });
    expect(findFees.mock.calls[0][0]).toEqual({
      studentId: { $in: [linkedStudentId] },
      $expr: { $lt: ["$paidAmount", "$totalAmount"] },
    });
    expect(JSON.stringify(response.body.data)).not.toContain(outsiderId);
  });

  it("returns empty guardian dashboard data when the guardian has no linked students", async () => {
    mockAuthenticatedUser(guardianId, "GUARDIAN");
    findStudents.mockReturnValue(makeQuery([]));

    const response = await request(app)
      .get("/api/dashboard/guardian")
      .set("Authorization", `Bearer ${tokenFor(guardianId, "GUARDIAN")}`);

    expect(response.status).toBe(200);
    expect(response.body.data.linkedStudents).toEqual([]);
    expect(response.body.data.attendanceSummary.total).toBe(0);
    expect(aggregateAttendance).not.toHaveBeenCalled();
    expect(findResults).not.toHaveBeenCalled();
    expect(aggregateFees).not.toHaveBeenCalled();
  });

  it("denies non-guardians access to the guardian dashboard", async () => {
    mockAuthenticatedUser(teacherId, "TEACHER");
    const teacherResponse = await request(app)
      .get("/api/dashboard/guardian")
      .set("Authorization", `Bearer ${tokenFor(teacherId, "TEACHER")}`);

    expect(teacherResponse.status).toBe(403);

    mockAuthenticatedUser(adminId, "ADMIN");
    const adminResponse = await request(app)
      .get("/api/dashboard/guardian")
      .set("Authorization", `Bearer ${tokenFor(adminId, "ADMIN")}`);

    expect(adminResponse.status).toBe(403);
    expect(findStudents).not.toHaveBeenCalled();
  });
});
