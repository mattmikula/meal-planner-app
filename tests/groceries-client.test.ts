import { describe, expect, it } from "vitest";

import { buildUpdateGroceryItemRequest } from "@/lib/groceries/client";

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
