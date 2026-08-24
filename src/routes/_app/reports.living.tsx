import { createFileRoute } from "@tanstack/react-router";
import { LivingScreen } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/living")({
  component: LivingScreen,
});
