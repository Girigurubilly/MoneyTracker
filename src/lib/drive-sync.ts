import { pickSyncSide } from "@/lib/sync-side";
import { isAppSnapshot } from "@/lib/import-btp";
import { todayISO } from "@/lib/format";
import {
  backupModifiedAt,
  downloadBackup,
  hasDriveGrant,
  readGoogleClientId,
  rememberAccessToken,
  requestSilentToken,
  storedAccessToken,
  uploadBackup,
} from "@/lib/google-drive";
import type { AppSnapshot } from "@/store/app";

const LOCAL_EDIT_KEY = "hk-life-money-local-edited";
const LAST_SYNC_KEY = "hk-life-money-last-sync";
const DAILY_KEY = "hk-life-money-daily-sync-day";
const DAILY_TRIED_KEY = "hk-life-money-daily-sync-tried";

export type SyncResult = "pulled" | "pushed" | "ok" | "offline" | "off" | "need-auth" | "fail";

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

export function markDailyDriveSync(today = todayISO()) {
  try {
    localStorage.setItem(DAILY_KEY, today);
    sessionStorage.setItem(DAILY_TRIED_KEY, today);
  } catch {
    /* ignore */
  }
}

export function dailyDriveSyncDue(today = todayISO()): boolean {
  try {
    if (sessionStorage.getItem(DAILY_TRIED_KEY) === today) return false;
    return localStorage.getItem(DAILY_KEY) !== today;
  } catch {
    return true;
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
  if (!readGoogleClientId()) return "need-auth";
  const token = storedAccessToken() ?? (await requestSilentToken());
  if (!token) return "need-auth";
  rememberAccessToken(token);

  let remoteIso: string | undefined;
  try {
    remoteIso = await backupModifiedAt(token);
  } catch (err) {
    if ((err as Error).message !== "missing") return "fail";
  }

  const side = pickSyncSide(localEditedAt() || lastDriveSyncAt(), remoteIso);
  if (side === "ok") {
    writeLastSync();
    return "ok";
  }
  if (side === "pull" && remoteIso) {
    try {
      const text = await downloadBackup(token);
      const parsed: unknown = JSON.parse(text);
      if (!isAppSnapshot(parsed)) return "fail";
      applyingRemote = true;
      try {
        await opts.replaceAll(parsed);
        markLocalEdit(parsed.exportedAt);
        writeLastSync(parsed.exportedAt);
      } finally {
        applyingRemote = false;
      }
      return "pulled";
    } catch {
      return "fail";
    }
  }
  try {
    const snap = opts.exportSnapshot();
    await uploadBackup(token, JSON.stringify(snap));
    markLocalEdit(snap.exportedAt);
    writeLastSync(snap.exportedAt);
    return "pushed";
  } catch {
    return "fail";
  }
}

let dailyInflight: Promise<SyncResult> | null = null;

/** Once per local day, and only if the user has already signed in to Drive. Never opens a Google login. */
export function runDailyDriveSync(opts: {
  exportSnapshot: () => AppSnapshot;
  replaceAll: (snap: AppSnapshot) => Promise<void>;
}): Promise<SyncResult> {
  if (dailyInflight) return dailyInflight;
  dailyInflight = (async () => {
    const today = todayISO();
    if (!dailyDriveSyncDue(today)) return "ok";
    try {
      sessionStorage.setItem(DAILY_TRIED_KEY, today);
    } catch {
      /* ignore */
    }
    if (!readGoogleClientId() || (!storedAccessToken() && !hasDriveGrant())) return "off";
    const result = await syncWithDrive(opts);
    if (result === "pulled" || result === "pushed" || result === "ok") markDailyDriveSync(today);
    return result;
  })();
  return dailyInflight.finally(() => {
    dailyInflight = null;
  });
}
