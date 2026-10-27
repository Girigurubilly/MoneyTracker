import { createFileRoute } from "@tanstack/react-router";
import { RegularsPlanPage } from "@/components/regulars-plan";

export const Route = createFileRoute("/more/regulars")({
  ssr: false,
  component: RegularsPlanPage,
});
