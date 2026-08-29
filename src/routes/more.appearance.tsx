import { createFileRoute } from "@tanstack/react-router";
import { AppearancePage } from "@/components/more";

export const Route = createFileRoute("/more/appearance")({
  ssr: false,
  component: AppearancePage,
});
