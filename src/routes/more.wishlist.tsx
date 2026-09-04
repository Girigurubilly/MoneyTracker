import { createFileRoute } from "@tanstack/react-router";
import { WishlistPage } from "@/components/wishlist";

export const Route = createFileRoute("/more/wishlist")({
  ssr: false,
  component: WishlistPage,
});
