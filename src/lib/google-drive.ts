const FILE_NAME = "hk-life-money.backup.json";
const FOLDER_NAME = "HK Life Money";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_KEY = "hk-life-money-google-client-id";
const FILE_ID_KEY = "hk-life-money-drive-file-id";
const FOLDER_ID_KEY = "hk-life-money-drive-folder-id";
const ACTION_KEY = "hk-life-money-drive-action";
const TOKEN_KEY = "hk-life-money-drive-token";
const TOKEN_EXP_KEY = "hk-life-money-drive-token-exp";

export type DriveAction = "save" | "restore";

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
    prompt: "select_account consent",
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export function takePendingDriveAction(): DriveAction | null {
  const action = sessionStorage.getItem(ACTION_KEY);
  if (action === "save" || action === "restore") {
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

export function rememberAccessToken(token: string, expiresIn = 3500) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + Math.max(60, expiresIn - 60) * 1000));
  } catch {
    /* ignore */
  }
}

export function storedAccessToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) ?? "0");
    if (!token || Date.now() > exp) return null;
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
  if (!clientId) return null;
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
    const timer = window.setTimeout(() => finish(null), 8000);
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
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

export async function findBackupFileId(token: string): Promise<string> {
  const known = readStored(FILE_ID_KEY);
  if (known) return known;
  const folder = await ensureFolder(token);
  const q = encodeURIComponent(`name='${FILE_NAME}' and '${folder}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`, token);
  const data = (await res.json()) as { files?: { id: string }[] };
  const id = data.files?.[0]?.id ?? "";
  if (id) writeStored(FILE_ID_KEY, id);
  return id;
}

export async function uploadBackup(token: string, body: string): Promise<void> {
  const folder = await ensureFolder(token);
  const existing = await findBackupFileId(token);
  const meta = existing
    ? { name: FILE_NAME, mimeType: "application/json" }
    : { name: FILE_NAME, mimeType: "application/json", parents: [folder] };
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
  if (!res.ok) throw new Error(`drive ${res.status}`);
  if (!existing) {
    const created = (await res.json()) as { id?: string };
    if (created.id) writeStored(FILE_ID_KEY, created.id);
  }
}

export async function downloadBackup(token: string): Promise<string> {
  const id = await findBackupFileId(token);
  if (!id) throw new Error("missing");
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, token);
  return res.text();
}
