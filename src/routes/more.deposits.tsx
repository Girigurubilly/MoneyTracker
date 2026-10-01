import { createFileRoute } from "@tanstack/react-router";
import { DepositsPage } from "@/components/reports-deposits";

export const Route = createFileRoute("/more/deposits")({
  ssr: false,
  component: function MoreDepositsPage() {
    return <DepositsPage backTo="/more" />;
  },
});
