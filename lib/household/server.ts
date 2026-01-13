import "server-only";
import { createHash, randomBytes } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const INVITE_TTL_HOURS = 48;

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export type HouseholdContext = {
  household: {
    id: string;
    name: string | null;
    createdAt: string;
  };
  membership: {
    id: string;
    householdId: string;
    userId: string;
    role: string;
    status: string;
    createdAt: string;
  };
};

type HouseholdMemberRow = {
  id: string;
  household_id: string;
  role: string;
  status: string;
  created_at: string;
};

type HouseholdRow = {
  id: string;
  name: string | null;
  created_at: string;
};

type HouseholdSettingsRow = {
  current_household_id: string | null;
};

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashInviteToken(token)
  };
}

export function buildInviteExpiry(now: Date = new Date()) {
  const expiresAt = new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

export function buildInviteUrl(token: string) {
  const baseUrl = process.env.INVITE_ACCEPT_URL_BASE?.trim();
  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("invite_token", token);
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${encodeURI(baseUrl)}${separator}invite_token=${encodeURIComponent(token)}`;
  }
}

const mapMembership = (member: HouseholdMemberRow, userId: string) => ({
  id: member.id,
  householdId: member.household_id,
  userId,
  role: member.role,
  status: member.status,
  createdAt: member.created_at
});

async function fetchCurrentHouseholdId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_household_settings")
    .select("current_household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const settings = data as HouseholdSettingsRow | null;
  return settings?.current_household_id ?? null;
}

async function setCurrentHouseholdId(
  supabase: SupabaseClient,
  userId: string,
  householdId: string
) {
  const { error } = await supabase.from("user_household_settings").upsert(
    {
      user_id: userId,
      current_household_id: householdId,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchHouseholdMembership(
  supabase: SupabaseClient,
  userId: string,
  householdId?: string
) {
  const baseQuery = supabase
    .from("household_members")
    .select("id, household_id, role, status, created_at")
    .eq("user_id", userId)
    .eq("status", "active");

  if (householdId) {
    const { data, error } = await baseQuery
      .eq("household_id", householdId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapMembership(data as HouseholdMemberRow, userId);
  }

  const { data, error } = await baseQuery.order("created_at", { ascending: true }).limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const member = (data as HouseholdMemberRow[] | null)?.[0];
  return member ? mapMembership(member, userId) : null;
}

export async function fetchHouseholdContext(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdContext | null> {
  const currentHouseholdId = await fetchCurrentHouseholdId(supabase, userId);
  let membership = currentHouseholdId
    ? await fetchHouseholdMembership(supabase, userId, currentHouseholdId)
    : null;

  if (!membership) {
    membership = await fetchHouseholdMembership(supabase, userId);
    if (!membership) {
      return null;
    }
    await setCurrentHouseholdId(supabase, userId, membership.householdId);
  }

  const { data, error } = await supabase
    .from("households")
    .select("id, name, created_at")
    .eq("id", membership.householdId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Missing household");
  }

  const household = data as HouseholdRow;

  return {
    household: {
      id: household.id,
      name: household.name,
      createdAt: household.created_at
    },
    membership
  };
}

export async function ensureHouseholdContext(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdContext> {
  const existing = await fetchHouseholdContext(supabase, userId);
  if (existing) {
    return existing;
  }

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ created_by: userId })
    .select("id, name, created_at")
    .single();

  if (householdError || !household) {
    throw new Error(householdError?.message ?? "Unable to create household");
  }

  const { data: member, error: memberError } = await supabase
    .from("household_members")
    .insert({
      household_id: household.id,
      user_id: userId,
      role: "owner",
      status: "active"
    })
    .select("id, household_id, role, status, created_at")
    .single();

  if (memberError || !member) {
    throw new Error(memberError?.message ?? "Unable to create household member");
  }

  const membership = member as HouseholdMemberRow;

  await setCurrentHouseholdId(supabase, userId, household.id);

  return {
    household: {
      id: household.id,
      name: household.name,
      createdAt: household.created_at
    },
    membership: {
      id: membership.id,
      householdId: membership.household_id,
      userId,
      role: membership.role,
      status: membership.status,
      createdAt: membership.created_at
    }
  };
}
