import { createFileRoute } from "@tanstack/react-router";
import { AccountDetail } from "@/components/assets";

export const Route = createFileRoute("/_app/assets/$id")({
  component: AccountDetailRoute,
});

function AccountDetailRoute() {
  const { id } = Route.useParams();
  return <AccountDetail id={id} />;
}
