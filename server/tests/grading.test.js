import { describe, expect, it } from "@jest/globals";
import { calculateGrade } from "../src/services/grading.js";

describe("calculateGrade", () => {
  it.each([
    [90, "A+"],
    [80, "A"],
    [70, "B"],
    [60, "C"],
    [40, "D"],
    [39.99, "F"],
  ])("returns %s grade at percentage %s", (percentage, grade) => {
    expect(calculateGrade(percentage)).toBe(grade);
  });
});
