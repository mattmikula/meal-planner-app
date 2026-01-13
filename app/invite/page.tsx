import type { Metadata } from "next";

import InviteClient from "@/app/invite/InviteClient";

export const metadata: Metadata = {
  title: "Accept invite",
  // Use a strict referrer policy because invite tokens are passed in the URL;
  // "no-referrer" prevents these tokens from being sent in the Referer header to other origins.
  referrer: "no-referrer"
};

export default function InvitePage() {
  return <InviteClient />;
}
