import { createRouter, Link } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routerBasepath } from "@/lib/base";
import { routeTree } from "./routeTree.gen";

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div>
        <p className="text-base font-semibold">HK Life Money</p>
        <Link to="/" className="mt-3 inline-flex h-11 items-center text-sm font-medium text-accent">
          ←
        </Link>
      </div>
    </div>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    basepath: routerBasepath(),
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFound,
  });
}