const FILE_NAME = "hk-life-money.backup.json";
const FOLDER_NAME = "HK Life Money";
export const MAX_DRIVE_BACKUPS = 3;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_KEY = "hk-life-money-google-client-id";
const FOLDER_ID_KEY = "hk-life-money-drive-folder-id";
const ACTION_KEY = "hk-life-money-drive-action";
const PICK_KEY = "hk-life-money-drive-pick";
const TOKEN_KEY = "hk-life-money-drive-token";
const TOKEN_EXP_KEY = "hk-life-money-drive-token-exp";
const GRANTED_KEY = "hk-life-money-drive-granted";

export type DriveAction = "save" | "restore" | "sync" | "list";

export type DriveBackupRef = { id: string; name: string; modifiedTime: string };

export function isDriveBackupName(name: string): boolean {
  return name === FILE_NAME || /^hk-life-money-\d{8}-\d{6}\.backup\.json$/.test(name);
}

export function driveBackupName(at = new Date()): string {
  const iso = at.toISOString();
  const day = iso.slice(0, 10).replace(/-/g, "");
  const time = iso.slice(11, 19).replace(/:/g, "");
  return `hk-life-money-${day}-${time}.backup.json`;
}

/** Fewer than 3: create another copy. Otherwise overwrite the oldest, and drop any extras. */
export function planDriveBackups(files: DriveBackupRef[], max = MAX_DRIVE_BACKUPS): { replaceId?: string; trashIds: string[] } {
  const sorted = [...files].sort((a, b) => a.modifiedTime.localeCompare(b.modifiedTime) || a.id.localeCompare(b.id));
  if (sorted.length < max) return { trashIds: [] };
  const keep = new Set(sorted.slice(-(max - 1)).map((f) => f.id));
  const oldest = sorted[0];
  return {
    replaceId: oldest.id,
    trashIds: sorted.filter((f) => f.id !== oldest.id && !keep.has(f.id)).map((f) => f.id),
  };
}

export function newestDriveBackup(files: DriveBackupRef[]): DriveBackupRef | undefined {
  return [...files].sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime) || b.id.localeCompare(a.id))[0];
}

export function readGoogleClientId(): string {
  try {
    const saved = localStorage.getItem(CLIENT_KEY)?.trim();
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
}

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, id: string) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function hasDriveGrant(): boolean {
  return readStored(GRANTED_KEY) === "1";
}

/** Send the user to Google Sign-In, then back to this page with a token. */
export function startGoogleSignIn(action: DriveAction): void {
  const clientId = readGoogleClientId();
  if (!clientId) throw new Error("client");
  sessionStorage.setItem(ACTION_KEY, action);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: SCOPE,
    include_granted_scopes: "true",
  });
  // After the first grant, skip the account/consent screens so Google can
  // bounce back with a token. First-time users still see consent once.
  if (!hasDriveGrant()) params.set("prompt", "select_account consent");
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export function takePendingDriveAction(): DriveAction | null {
  const action = sessionStorage.getItem(ACTION_KEY);
  if (action === "save" || action === "restore" || action === "sync" || action === "list") {
    sessionStorage.removeItem(ACTION_KEY);
    return action;
  }
  return null;
}

export function takeRedirectToken(): string | null {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  const err = params.get("error");
  const expires = Number(params.get("expires_in") ?? "3600");
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (err) throw new Error(err);
  if (token) rememberAccessToken(token, expires);
  return token;
}

let memToken = "";
let memExp = 0;

function forgetLocalToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
  } catch {
    /* ignore */
  }
}

export function rememberAccessToken(token: string, expiresIn = 3500) {
  memToken = token;
  memExp = Date.now() + Math.max(60, expiresIn - 60) * 1000;
  try {
    localStorage.setItem(GRANTED_KEY, "1");
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXP_KEY, String(memExp));
  } catch {
    /* ignore */
  }
  forgetLocalToken();
}

export function clearAccessToken() {
  memToken = "";
  memExp = 0;
  forgetLocalToken();
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
  } catch {
    /* ignore */
  }
}

export function storedAccessToken(): string | null {
  forgetLocalToken();
  if (memToken && Date.now() < memExp) return memToken;
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || "0");
    if (!token || Date.now() > exp) return null;
    memToken = token;
    memExp = exp;
    return token;
  } catch {
    return null;
  }
}

type GisClient = { requestAccessToken: (opts: { prompt: string }) => void };

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-hk-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis")));
      return;
    }
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.dataset.hkGis = "1";
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("gis"));
    document.head.appendChild(el);
  });
}

/** Re-use a grant without bouncing through the full consent screen. */
export async function requestSilentToken(): Promise<string | null> {
  const existing = storedAccessToken();
  if (existing) return existing;
  const clientId = readGoogleClientId();
  if (!clientId || !hasDriveGrant()) return null;
  try {
    await loadGis();
  } catch {
    return null;
  }
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (token: string | null) => {
      if (done) return;
      done = true;
      resolve(token);
    };
    const timer = window.setTimeout(() => finish(null), 6000);
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      hint: "",
      callback: (resp: { access_token?: string; expires_in?: number }) => {
        window.clearTimeout(timer);
        if (resp.access_token) {
          rememberAccessToken(resp.access_token, resp.expires_in ?? 3500);
          finish(resp.access_token);
          return;
        }
        finish(null);
      },
      error_callback: () => {
        window.clearTimeout(timer);
        finish(null);
      },
    }) as GisClient;
    try {
      client.requestAccessToken({ prompt: "none" });
    } catch {
      window.clearTimeout(timer);
      finish(null);
    }
  });
}

/** Stored token, silent GIS, or null — never opens Google unless the caller redirects. */
export async function getAccessToken(): Promise<string | null> {
  return storedAccessToken() ?? (await requestSilentToken());
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (opts: Record<string, unknown>) => GisClient;
        };
      };
    };
  }
}

async function driveFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearAccessToken();
    throw new Error("auth");
  }
  if (res.status === 404) throw new Error("missing");
  if (!res.ok) throw new Error(`drive ${res.status}`);
  return res;
}

async function ensureFolder(token: string): Promise<string> {
  const known = readStored(FOLDER_ID_KEY);
  if (known) return known;
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`, token);
  const data = (await found.json()) as { files?: { id: string }[] };
  if (data.files?.[0]?.id) {
    writeStored(FOLDER_ID_KEY, data.files[0].id);
    return data.files[0].id;
  }
  const created = await driveFetch("https://www.googleapis.com/drive/v3/files", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const folder = (await created.json()) as { id: string };
  writeStored(FOLDER_ID_KEY, folder.id);
  return folder.id;
}

export async function listDriveBackups(token: string): Promise<DriveBackupRef[]> {
  const folder = await ensureFolder(token);
  const q = encodeURIComponent(`'${folder}' in parents and trashed=false and name contains 'hk-life-money' and name contains '.backup.json'`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=20`,
    token,
  );
  const data = (await res.json()) as { files?: { id: string; name: string; modifiedTime?: string }[] };
  return (data.files ?? [])
    .filter((f) => f.id && isDriveBackupName(f.name))
    .map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime ?? "" }));
}

async function deleteDriveFile(token: string, id: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearAccessToken();
    throw new Error("auth");
  }
  if (!res.ok && res.status !== 404) throw new Error(`drive ${res.status}`);
}

export async function backupModifiedAt(token: string): Promise<string | undefined> {
  const newest = newestDriveBackup(await listDriveBackups(token));
  return newest?.modifiedTime || undefined;
}

async function uploadTo(token: string, body: string, existing: string, folder: string | undefined, name: string) {
  const meta = existing
    ? { name, mimeType: "application/json" }
    : { name, mimeType: "application/json", parents: folder ? [folder] : undefined };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([body], { type: "application/json" }));
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (res.status === 401) {
    clearAccessToken();
    throw new Error("auth");
  }
  if (res.status === 404) throw new Error("missing");
  if (!res.ok) throw new Error(`drive ${res.status}`);
}

export async function uploadBackup(token: string, body: string): Promise<void> {
  const folder = await ensureFolder(token);
  const files = await listDriveBackups(token);
  const plan = planDriveBackups(files);
  for (const id of plan.trashIds) await deleteDriveFile(token, id);
  const name = driveBackupName();
  if (plan.replaceId) {
    try {
      await uploadTo(token, body, plan.replaceId, undefined, name);
      return;
    } catch (err) {
      if ((err as Error).message !== "missing") throw err;
    }
  }
  await uploadTo(token, body, "", folder, name);
}

export function rememberDrivePick(id: string) {
  try {
    sessionStorage.setItem(PICK_KEY, id);
  } catch {
    /* ignore */
  }
}

export function takeDrivePick(): string {
  try {
    const id = sessionStorage.getItem(PICK_KEY) ?? "";
    sessionStorage.removeItem(PICK_KEY);
    return id;
  } catch {
    return "";
  }
}

export async function downloadBackupById(token: string, id: string): Promise<string> {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, token);
  return res.text();
}

export async function downloadBackup(token: string): Promise<string> {
  const newest = newestDriveBackup(await listDriveBackups(token));
  if (!newest) throw new Error("missing");
  return downloadBackupById(token, newest.id);
}
