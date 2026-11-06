import { describe, expect, test } from "@jest/globals";
import { calculateDiscountPaise } from "../../utils/money.js";

describe("calculateDiscountPaise", () => {
  test("AC-20: rounds percentage discount half-up in integer paise", () => {
    expect(calculateDiscountPaise("PERCENTAGE", 10, 100005)).toBe(10001);
  });
  test("AC-20a: calculates 5 percent in integer paise", () => {
    expect(calculateDiscountPaise("PERCENTAGE", 5, 2499910)).toBe(124996);
  });
  test("handles one paisa at one percent", () => {
    expect(calculateDiscountPaise("PERCENTAGE", 1, 1)).toBe(0);
  });
  test("returns fixed discount paise unchanged", () => {
    expect(calculateDiscountPaise("FIXED", 50000, 100000)).toBe(50000);
  });
});
