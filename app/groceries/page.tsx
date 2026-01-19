import type { Metadata } from "next";

import GroceriesClient from "@/app/groceries/GroceriesClient";

export const metadata: Metadata = {
  title: "Groceries",
  description: "Manage your household grocery list."
};

export default function GroceriesPage() {
  return <GroceriesClient />;
}
