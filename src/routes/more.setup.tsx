import { createFileRoute } from "@tanstack/react-router";
import { SetupPage } from "@/components/more";

export const Route = createFileRoute("/more/setup")({
  ssr: false,
  component: SetupPage,
});
