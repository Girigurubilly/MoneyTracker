import { createFileRoute } from "@tanstack/react-router";
import { BackupPage } from "@/components/more";

export const Route = createFileRoute("/more/backup")({
  ssr: false,
  component: BackupPage,
});
