import { createFileRoute } from "@tanstack/react-router";
import { ReportsHub } from "@/components/reports";

export const Route = createFileRoute("/reports/")({
  ssr: false,
  component: ReportsHub,
});
