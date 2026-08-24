/** Prefix a public asset path with the Vite base (needed on GitHub Pages project sites). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}

export function routerBasepath(): string | undefined {
  const base = import.meta.env.BASE_URL || "/";
  if (!base || base === "/") return undefined;
  return base.replace(/\/$/, "");
}
