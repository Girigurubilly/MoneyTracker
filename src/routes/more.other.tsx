import { createFileRoute } from "@tanstack/react-router";
import { OtherSettingsPage } from "@/components/more";

export const Route = createFileRoute("/more/other")({
  ssr: false,
  component: OtherSettingsPage,
});
