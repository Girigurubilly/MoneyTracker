import { pickSyncSide } from "@/lib/sync-side";
import { isAppSnapshot } from "@/lib/import-btp";
import {
  downloadBackup,
  readGoogleClientId,
  rememberAccessToken,
  requestSilentToken,
  storedAccessToken,
  uploadBackup,
} from "@/lib/google-drive";
import type { AppSnapshot } from "@/store/app";

const SYNC_ON_KEY = "hk-life-money-drive-sync";
const LOCAL_EDIT_KEY = "hk-life-money-local-edited";
const LAST_SYNC_KEY = "hk-life-money-last-sync";

export type SyncResult = "pulled" | "pushed" | "ok" | "offline" | "off" | "need-auth" | "fail";

export function isDriveSyncEnabled(): boolean {
  try {
    return localStorage.getItem(SYNC_ON_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDriveSyncEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(SYNC_ON_KEY, "1");
    else localStorage.removeItem(SYNC_ON_KEY);
  } catch {
    /* ignore */
  }
}

export function markLocalEdit(iso = new Date().toISOString()) {
  try {
    localStorage.setItem(LOCAL_EDIT_KEY, iso);
  } catch {
    /* ignore */
  }
}

export function localEditedAt(): string {
  try {
    return localStorage.getItem(LOCAL_EDIT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function lastDriveSyncAt(): string {
  try {
    return localStorage.getItem(LAST_SYNC_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastSync(iso = new Date().toISOString()) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    /* ignore */
  }
}

let applyingRemote = false;
export function isApplyingRemote(): boolean {
  return applyingRemote;
}

export async function syncWithDrive(opts: {
  exportSnapshot: () => AppSnapshot;
  replaceAll: (snap: AppSnapshot) => Promise<void>;
}): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (!isDriveSyncEnabled()) return "off";
  if (!readGoogleClientId()) return "need-auth";
  const token = storedAccessToken() ?? (await requestSilentToken());
  if (!token) return "need-auth";
  rememberAccessToken(token);

  let remote: AppSnapshot | undefined;
  try {
    const text = await downloadBackup(token);
    const parsed: unknown = JSON.parse(text);
    if (isAppSnapshot(parsed)) remote = parsed;
  } catch (err) {
    if ((err as Error).message !== "missing") return "fail";
  }

  const side = pickSyncSide(localEditedAt(), remote?.exportedAt);
  if (side === "pull" && remote) {
    applyingRemote = true;
    try {
      await opts.replaceAll(remote);
      markLocalEdit(remote.exportedAt);
      writeLastSync(remote.exportedAt);
    } finally {
      applyingRemote = false;
    }
    return "pulled";
  }
  if (side === "push" || !remote) {
    const snap = opts.exportSnapshot();
    await uploadBackup(token, JSON.stringify(snap));
    markLocalEdit(snap.exportedAt);
    writeLastSync(snap.exportedAt);
    return "pushed";
  }
  writeLastSync();
  return "ok";
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleDrivePush(run: () => void) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(run, 2500);
}
