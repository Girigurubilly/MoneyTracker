import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@/components/more";

export const Route = createFileRoute("/more/security")({
  ssr: false,
  component: SecurityPage,
});
