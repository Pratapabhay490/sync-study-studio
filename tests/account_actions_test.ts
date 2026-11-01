import { describe, expect, test } from "bun:test";
import { validateAccountConfirmation } from "../src/lib/account-actions";

describe("destructive account confirmation", () => {
  test("fresh start requires the exact RESET confirmation", () => {
    expect(validateAccountConfirmation("reset", "RESET")).toBe("RESET");
    for (const value of ["", "DELETE", "reset", undefined]) {
      expect(() => validateAccountConfirmation("reset", value)).toThrow();
    }
  });
  test("permanent deletion requires the exact DELETE confirmation", () => {
    expect(validateAccountConfirmation("delete", "DELETE")).toBe("DELETE");
    for (const value of ["", "RESET", "delete", undefined]) {
      expect(() => validateAccountConfirmation("delete", value)).toThrow();
    }
  });
});