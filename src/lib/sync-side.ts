export function pickSyncSide(localIso: string, remoteIso: string | undefined): "pull" | "push" | "ok" {
  const local = Date.parse(localIso || "") || 0;
  const remote = Date.parse(remoteIso || "") || 0;
  if (!remote && !local) return "ok";
  if (!remote) return "push";
  if (!local) return "pull";
  if (remote > local + 1500) return "pull";
  if (local > remote + 1500) return "push";
  return "ok";
}
