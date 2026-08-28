import { createFileRoute } from "@tanstack/react-router";
import { TripDetailPage } from "@/components/reports";

export const Route = createFileRoute("/reports/travel/$id")({
  ssr: false,
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <TripDetailPage id={id} />;
}
