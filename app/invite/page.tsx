import type { Metadata } from "next";

import InviteClient from "@/app/invite/InviteClient";

export const metadata: Metadata = {
  title: "Accept invite",
  referrer: "no-referrer"
};

export default function InvitePage() {
  return <InviteClient />;
}
