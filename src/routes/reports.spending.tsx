import { createFileRoute } from "@tanstack/react-router";
import { SpendingPage } from "@/components/reports";

export const Route = createFileRoute("/reports/spending")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === "string" ? search.category : "",
  }),
  component: SpendingPage,
});
