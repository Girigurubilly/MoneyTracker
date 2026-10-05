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

type TxClock = { createdAt?: string; date: string; planned?: boolean };

/** When this transaction was entered. Booked dates without a clock use the start of that phone-local day. */
export function txnCreatedInstant(tx: TxClock): number {
  if (tx.createdAt) {
    const exact = Date.parse(tx.createdAt);
    if (Number.isFinite(exact) && exact > 0) return exact;
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(tx.date);
  if (!day) return Date.parse(tx.date) || 0;
  return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime();
}

/** Newest posted transaction on this device. Planned rows do not count. */
export function latestTxnCreatedAt(txs: TxClock[]): string {
  let best = 0;
  for (const tx of txs) {
    if (tx.planned) continue;
    const at = txnCreatedInstant(tx);
    if (at > best) best = at;
  }
  return best ? new Date(best).toISOString() : "";
}
