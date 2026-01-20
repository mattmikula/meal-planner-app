import type { Metadata } from "next";

import HouseholdClient from "@/app/household/HouseholdClient";

export const metadata: Metadata = {
  title: "Household",
  description: "Switch between households."
};

export default function HouseholdPage() {
  return <HouseholdClient />;
}
