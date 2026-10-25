import { createFileRoute } from "@tanstack/react-router";
import { ReportsHub } from "@/components/reports";

export const Route = createFileRoute("/reports/all")({
  ssr: false,
  component: ReportsHub,
});
