import { redirect } from "next/navigation";

import PageLayout from "@/app/ui/PageLayout";
import { requireUser } from "@/lib/auth/server";
import HouseholdSettingsClient from "./HouseholdSettingsClient";

export default async function HouseholdSettingsPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/");
  }

  return (
    <PageLayout
      title="Household Settings"
      subtitle="Manage your household members and settings"
    >
      <HouseholdSettingsClient />
    </PageLayout>
  );
}
