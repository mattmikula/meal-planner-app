import { describe, expect, it } from "vitest";

import {
  buildCreateMealRequest,
  buildUpdateMealRequest
} from "@/lib/meals/client";

describe("buildCreateMealRequest", () => {
  it("rejects empty names", () => {
    expect(buildCreateMealRequest("   ", "", "")).toEqual({
      ok: false,
      error: "Name is required."
    });
  });

  it("rejects names longer than 200 characters", () => {
    expect(buildCreateMealRequest("a".repeat(201), "", "")).toEqual({
      ok: false,
      error: "Name must be 200 characters or less."
    });
  });

  it("rejects notes longer than 1000 characters", () => {
    expect(buildCreateMealRequest("Tacos", "a".repeat(1001), "")).toEqual({
      ok: false,
      error: "Notes must be 1000 characters or less."
    });
  });

  it("rejects invalid image URLs", () => {
    expect(buildCreateMealRequest("Tacos", "", "not-a-url")).toEqual({
      ok: false,
      error: "Image URL must be a valid URL."
    });
  });

  it("trims the name and omits empty notes", () => {
    expect(buildCreateMealRequest("  Tacos  ", "   ", "   ")).toEqual({
      ok: true,
      value: { name: "Tacos" }
    });
  });
});

describe("buildUpdateMealRequest", () => {
  it("requires at least one field", () => {
    expect(buildUpdateMealRequest("   ", "   ", "   ")).toEqual({
      ok: false,
      error: "At least one field (name, notes, or imageUrl) must be provided."
    });
  });

  it("accepts notes-only updates", () => {
    expect(buildUpdateMealRequest("", "  add lime  ", "")).toEqual({
      ok: true,
      value: { notes: "add lime", imageUrl: null }
    });
  });

  it("trims name and notes and preserves empty notes", () => {
    expect(buildUpdateMealRequest("  Tacos  ", "   ", "")).toEqual({
      ok: true,
      value: { name: "Tacos", notes: "", imageUrl: null }
    });
  });

  it("rejects invalid image URLs", () => {
    expect(buildUpdateMealRequest("Tacos", "", "invalid-url")).toEqual({
      ok: false,
      error: "Image URL must be a valid URL."
    });
  });

  it("includes a valid image URL", () => {
    expect(buildUpdateMealRequest("Tacos", "", "https://example.com/tacos.jpg")).toEqual({
      ok: true,
      value: { name: "Tacos", notes: "", imageUrl: "https://example.com/tacos.jpg" }
    });
  });
});
