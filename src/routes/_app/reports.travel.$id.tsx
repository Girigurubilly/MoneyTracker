import { createFileRoute } from "@tanstack/react-router";
import { TripDetail } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/travel/$id")({
  component: TripDetailRoute,
});

function TripDetailRoute() {
  const { id } = Route.useParams();
  return <TripDetail id={id} />;
}
