import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/more";

export const Route = createFileRoute("/more/import")({
  ssr: false,
  component: ImportPage,
});
