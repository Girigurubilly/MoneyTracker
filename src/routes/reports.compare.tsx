import { createFileRoute } from "@tanstack/react-router";
import { YearComparePage } from "@/components/reports-compare";

export const Route = createFileRoute("/reports/compare")({
  ssr: false,
  component: YearComparePage,
});
