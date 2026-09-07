const FILE_NAME = "hk-life-money.backup.json";
const FOLDER_NAME = "HK Life Money";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_KEY = "hk-life-money-google-client-id";
const FILE_ID_KEY = "hk-life-money-drive-file-id";
const FOLDER_ID_KEY = "hk-life-money-drive-folder-id";
const ACTION_KEY = "hk-life-money-drive-action";

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
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (err) throw new Error(err);
  return token;
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
