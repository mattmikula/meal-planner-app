import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  setAuthCookies: vi.fn()
}));

const householdMocks = vi.hoisted(() => ({
  ensureHouseholdContext: vi.fn()
}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn()
}));

const groceryMocks = vi.hoisted(() => ({
  listGroceries: vi.fn(),
  createGroceryItem: vi.fn(),
  updateGroceryItem: vi.fn(),
  deleteGroceryItem: vi.fn()
}));

vi.mock("@/lib/auth/server", () => authMocks);

vi.mock("@/lib/household/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/household/server")>(
    "@/lib/household/server"
  );
  return {
    ...actual,
    ensureHouseholdContext: householdMocks.ensureHouseholdContext
  };
});

vi.mock("@/lib/supabase/server", () => supabaseMocks);

vi.mock("@/lib/groceries/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/groceries/server")>(
    "@/lib/groceries/server"
  );
  return {
    ...actual,
    ...groceryMocks
  };
});

import { GET as getGroceries, POST as createGrocery } from "@/app/api/groceries/route";
import { PATCH as updateGrocery, DELETE as deleteGrocery } from "@/app/api/groceries/[id]/route";

const householdContext = {
  household: {
    id: "household-1",
    name: "Home",
    createdAt: "2024-02-12T10:00:00Z"
  },
  membership: {
    id: "member-1",
    householdId: "household-1",
    userId: "user-1",
    role: "owner",
    status: "active",
    createdAt: "2024-02-12T10:00:00Z"
  }
};

const authSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600
};

const groceryItemId = "99999999-9999-4999-8999-999999999999";

const sampleItem = {
  id: groceryItemId,
  name: "Milk",
  quantity: "2 cartons",
  checked: false,
  createdAt: "2024-02-12T10:00:00Z",
  createdBy: "user-1",
  updatedAt: null,
  updatedBy: null
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/groceries", () => {
  it("returns unauthorized when auth fails", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
    authMocks.requireApiUser.mockResolvedValue({ response: unauthorizedResponse });

    const response = await getGroceries(new Request("https://localhost/api/groceries"));

    expect(response).toBe(unauthorizedResponse);
  });

  it("returns items when authenticated", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    groceryMocks.listGroceries.mockResolvedValue([sampleItem]);

    const response = await getGroceries(new Request("https://localhost/api/groceries"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [sampleItem] });
  });

  it("calls listGroceries with household ID", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    groceryMocks.listGroceries.mockResolvedValue([]);

    await getGroceries(new Request("https://localhost/api/groceries"));

    expect(groceryMocks.listGroceries).toHaveBeenCalledWith(supabase, "household-1");
  });

  it("sets auth cookies when session exists", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    groceryMocks.listGroceries.mockResolvedValue([]);

    await getGroceries(new Request("https://localhost/api/groceries"));

    expect(authMocks.setAuthCookies).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/groceries", () => {
  it("returns 400 when body is invalid JSON", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const response = await createGrocery(
      new Request("https://localhost/api/groceries", {
        method: "POST",
        body: "invalid json"
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns validation errors when schema validation fails", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const response = await createGrocery(
      new Request("https://localhost/api/groceries", {
        method: "POST",
        body: JSON.stringify({ name: "" })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Item name is required." });
  });

  it("creates grocery items with valid input", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    groceryMocks.createGroceryItem.mockResolvedValue(sampleItem);

    const response = await createGrocery(
      new Request("https://localhost/api/groceries", {
        method: "POST",
        body: JSON.stringify({ name: "Milk", quantity: "2 cartons" })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sampleItem);
  });
});

describe("PATCH /api/groceries/[id]", () => {
  it("returns 400 when grocery item id is invalid", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await updateGrocery(
      new Request("https://localhost/api/groceries/not-a-uuid", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" })
      }),
      { params: { id: "not-a-uuid" } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Grocery item ID must be a valid UUID."
    });
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const response = await updateGrocery(
      new Request(`https://localhost/api/groceries/${groceryItemId}`, {
        method: "PATCH",
        body: "invalid json"
      }),
      { params: { id: groceryItemId } }
    );

    expect(response.status).toBe(400);
  });

  it("returns validation errors when no fields are provided", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const response = await updateGrocery(
      new Request(`https://localhost/api/groceries/${groceryItemId}`, {
        method: "PATCH",
        body: JSON.stringify({})
      }),
      { params: { id: groceryItemId } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field (name, quantity, or checked) must be provided."
    });
  });

  it("returns 404 when grocery item is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    groceryMocks.updateGroceryItem.mockResolvedValue(null);

    const response = await updateGrocery(
      new Request(`https://localhost/api/groceries/${groceryItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" })
      }),
      { params: { id: groceryItemId } }
    );

    expect(response.status).toBe(404);
  });

  it("returns updated grocery item when successful", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    groceryMocks.updateGroceryItem.mockResolvedValue(sampleItem);

    const response = await updateGrocery(
      new Request(`https://localhost/api/groceries/${groceryItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ checked: true })
      }),
      { params: { id: groceryItemId } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sampleItem);
  });
});

describe("DELETE /api/groceries/[id]", () => {
  it("returns 400 when grocery item id is invalid", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await deleteGrocery(
      new Request("https://localhost/api/groceries/not-a-uuid", {
        method: "DELETE"
      }),
      { params: { id: "not-a-uuid" } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Grocery item ID must be a valid UUID."
    });
  });

  it("returns 404 when grocery item is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    groceryMocks.deleteGroceryItem.mockResolvedValue(false);

    const response = await deleteGrocery(
      new Request(`https://localhost/api/groceries/${groceryItemId}`, {
        method: "DELETE"
      }),
      { params: { id: groceryItemId } }
    );

    expect(response.status).toBe(404);
  });

  it("returns ok when grocery item is deleted", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    groceryMocks.deleteGroceryItem.mockResolvedValue(true);

    const response = await deleteGrocery(
      new Request(`https://localhost/api/groceries/${groceryItemId}`, {
        method: "DELETE"
      }),
      { params: { id: groceryItemId } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
