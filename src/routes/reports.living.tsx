import { createFileRoute } from "@tanstack/react-router";
import { LivingPage } from "@/components/reports";

export const Route = createFileRoute("/reports/living")({
  ssr: false,
  component: LivingPage,
});
