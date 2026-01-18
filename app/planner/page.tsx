import type { Metadata } from "next";

import PlannerClient from "@/app/planner/PlannerClient";

export const metadata: Metadata = {
  title: "Planner",
  description: "Plan your meals for the week."
};

export default function PlannerPage() {
  return <PlannerClient />;
}
