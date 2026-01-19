import { describe, expect, it } from "vitest";

import {
  buildCreateGroceryItemRequest,
  buildUpdateGroceryItemRequest
} from "@/lib/groceries/client";

describe("buildCreateGroceryItemRequest", () => {
  it("rejects empty names", () => {
    expect(buildCreateGroceryItemRequest("   ", "")).toEqual({
      ok: false,
      error: "Item name is required."
    });
  });

  it("rejects long names", () => {
    expect(buildCreateGroceryItemRequest("a".repeat(201), "")).toEqual({
      ok: false,
      error: "Item name must be 200 characters or less."
    });
  });

  it("rejects long quantities", () => {
    expect(buildCreateGroceryItemRequest("Milk", "a".repeat(101))).toEqual({
      ok: false,
      error: "Quantity must be 100 characters or less."
    });
  });

  it("trims name and omits empty quantity", () => {
    expect(buildCreateGroceryItemRequest("  Milk  ", "   ")).toEqual({
      ok: true,
      value: { name: "Milk" }
    });
  });
});

describe("buildUpdateGroceryItemRequest", () => {
  it("allows checked-only updates without quantity", () => {
    expect(buildUpdateGroceryItemRequest("   ", undefined, true)).toEqual({
      ok: true,
      value: { checked: true }
    });
  });

  it("clears quantity when an empty string is provided", () => {
    expect(buildUpdateGroceryItemRequest("Milk", "", undefined)).toEqual({
      ok: true,
      value: { name: "Milk", quantity: null }
    });
  });

  it("omits quantity when it is not provided", () => {
    expect(buildUpdateGroceryItemRequest("Milk", undefined)).toEqual({
      ok: true,
      value: { name: "Milk" }
    });
  });
});
