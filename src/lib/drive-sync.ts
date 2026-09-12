import { decryptSnapshot, encryptSnapshot, isEncryptedBackup } from "@/lib/backup";
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
const PASS_KEY = "hk-life-money-drive-pass";

export type SyncResult = "pulled" | "pushed" | "ok" | "offline" | "off" | "need-auth" | "need-pass" | "fail";

export function readDrivePass(): string {
  try {
    return sessionStorage.getItem(PASS_KEY) || localStorage.getItem(PASS_KEY) || "";
  } catch {
    return "";
  }
}

export function writeDrivePass(password: string) {
  try {
    if (password) {
      sessionStorage.setItem(PASS_KEY, password);
      localStorage.setItem(PASS_KEY, password);
    } else {
      sessionStorage.removeItem(PASS_KEY);
      localStorage.removeItem(PASS_KEY);
    }
  } catch {
    /* ignore */
  }
}

export async function encodeDriveBody(snap: AppSnapshot, password = readDrivePass()): Promise<string> {
  if (!password) throw new Error("pass");
  return encryptSnapshot(JSON.stringify(snap), password);
}

export async function decodeDriveBody(text: string, password = readDrivePass()): Promise<AppSnapshot> {
  let json = text;
  if (isEncryptedBackup(text)) {
    if (!password) throw new Error("pass");
    try {
      json = await decryptSnapshot(text, password);
    } catch {
      throw new Error("bad-pass");
    }
  }
  const parsed: unknown = JSON.parse(json);
  if (!isAppSnapshot(parsed)) throw new Error("format");
  return parsed;
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
  if (!readDrivePass()) return "need-pass";
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
      const remote = await decodeDriveBody(await downloadBackup(token));
      applyingRemote = true;
      try {
        await opts.replaceAll(remote);
        markLocalEdit(remote.exportedAt);
        writeLastSync(remote.exportedAt);
      } finally {
        applyingRemote = false;
      }
      return "pulled";
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "pass" || msg === "bad-pass") return "need-pass";
      return "fail";
    }
  }
  try {
    const snap = opts.exportSnapshot();
    await uploadBackup(token, await encodeDriveBody(snap));
    markLocalEdit(snap.exportedAt);
    writeLastSync(snap.exportedAt);
    return "pushed";
  } catch (err) {
    if ((err as Error).message === "pass") return "need-pass";
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
    if (!readGoogleClientId() || (!storedAccessToken() && !hasDriveGrant())) return "off";
    if (!readDrivePass()) return "need-pass";
    try {
      sessionStorage.setItem(DAILY_TRIED_KEY, today);
    } catch {
      /* ignore */
    }
    const result = await syncWithDrive(opts);
    if (result === "pulled" || result === "pushed" || result === "ok") markDailyDriveSync(today);
    return result;
  })();
  return dailyInflight.finally(() => {
    dailyInflight = null;
  });
}
