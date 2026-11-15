import { describe, expect, it } from "@jest/globals";
import Attendance from "../src/models/Attendance.js";

describe("Attendance indexes", () => {
  it("enforces one record per student, date, and session", () => {
    const uniqueAttendanceIndex = Attendance.schema.indexes().find(
      ([keys, options]) =>
        keys.studentId === 1 &&
        keys.date === 1 &&
        keys.session === 1 &&
        options.unique === true
    );

    expect(uniqueAttendanceIndex).toBeDefined();
  });
});
