import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/shared";

import InviteMemberClient from "./InviteMemberClient";

const hasSessionCookies = () => {
  const cookieStore = cookies();
  return Boolean(
    cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ||
      cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
  );
};

export default function InviteMemberPage() {
  if (!hasSessionCookies()) {
    redirect("/");
  }

  return <InviteMemberClient />;
}
