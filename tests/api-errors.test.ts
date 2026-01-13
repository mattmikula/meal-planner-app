import { describe, expect, it } from "vitest";

import { getApiErrorMessage } from "@/lib/api/errors";

describe("getApiErrorMessage", () => {
  it("returns null for null input", () => {
    expect(getApiErrorMessage(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getApiErrorMessage(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getApiErrorMessage("")).toBeNull();
  });

  it("returns the string directly for non-empty string input", () => {
    expect(getApiErrorMessage("Something went wrong")).toBe("Something went wrong");
  });

  it("extracts message from Error instance", () => {
    const error = new Error("Test error message");
    expect(getApiErrorMessage(error)).toBe("Test error message");
  });

  it("returns null for Error with empty message", () => {
    const error = new Error("");
    expect(getApiErrorMessage(error)).toBeNull();
  });

  it("extracts message from object with message property", () => {
    expect(getApiErrorMessage({ message: "Object message" })).toBe("Object message");
  });

  it("extracts error string from object with error property", () => {
    expect(getApiErrorMessage({ error: "Error string" })).toBe("Error string");
  });

  it("prefers message over error property", () => {
    expect(getApiErrorMessage({ message: "Message value", error: "Error value" })).toBe("Message value");
  });

  it("extracts message from nested error object", () => {
    expect(getApiErrorMessage({ error: { message: "Nested message" } })).toBe("Nested message");
  });

  it("extracts message from nested Error instance", () => {
    const nested = new Error("Nested error");
    expect(getApiErrorMessage({ error: nested })).toBe("Nested error");
  });

  it("returns null for object with non-string message", () => {
    expect(getApiErrorMessage({ message: 123 })).toBeNull();
    expect(getApiErrorMessage({ message: null })).toBeNull();
    expect(getApiErrorMessage({ message: {} })).toBeNull();
  });

  it("returns null for object with empty error object", () => {
    expect(getApiErrorMessage({ error: {} })).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(getApiErrorMessage({})).toBeNull();
  });

  it("returns null for number input", () => {
    expect(getApiErrorMessage(404)).toBeNull();
  });

  it("returns null for boolean input", () => {
    expect(getApiErrorMessage(false)).toBeNull();
  });

  it("handles deeply nested error structures", () => {
    const deepError = {
      error: {
        message: "Deep error message"
      }
    };
    expect(getApiErrorMessage(deepError)).toBe("Deep error message");
  });
});
