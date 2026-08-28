import { createFileRoute } from "@tanstack/react-router";
import { FxPage } from "@/components/more";

export const Route = createFileRoute("/more/fx")({
  ssr: false,
  component: FxPage,
});
