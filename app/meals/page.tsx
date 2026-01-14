import type { Metadata } from "next";

import MealsClient from "@/app/meals/MealsClient";

export const metadata: Metadata = {
  title: "Meals",
  description: "Manage your meal list."
};

export default function MealsPage() {
  return <MealsClient />;
}
