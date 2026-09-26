import { createFileRoute } from "@tanstack/react-router";
import { AdhocPlanPage } from "@/components/adhoc-plan";

export const Route = createFileRoute("/more/adhoc")({
  ssr: false,
  component: AdhocPlanPage,
});
