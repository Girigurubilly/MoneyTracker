const FILE_NAME = "hk-life-money.backup.json";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_KEY = "hk-life-money-google-client-id";
const FILE_ID_KEY = "hk-life-money-drive-file-id";
const GIS_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
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

export function writeGoogleClientId(id: string) {
  try {
    if (id.trim()) localStorage.setItem(CLIENT_KEY, id.trim());
    else localStorage.removeItem(CLIENT_KEY);
  } catch {
    /* ignore */
  }
}

function readFileId(): string {
  try {
    return localStorage.getItem(FILE_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeFileId(id: string) {
  try {
    if (id) localStorage.setItem(FILE_ID_KEY, id);
    else localStorage.removeItem(FILE_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gis"));
    document.head.appendChild(s);
  });
}

export function requestDriveToken(clientId: string, prompt = ""): Promise<string> {
  return new Promise((resolve, reject) => {
    const api = window.google?.accounts?.oauth2;
    if (!api) {
      reject(new Error("gis"));
      return;
    }
    const client = api.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error_description || resp.error || "denied"));
      },
    });
    client.requestAccessToken({ prompt });
  });
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

export async function findBackupFileId(token: string): Promise<string> {
  const known = readFileId();
  if (known) return known;
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=5`, token);
  const data = (await res.json()) as { files?: { id: string }[] };
  const id = data.files?.[0]?.id ?? "";
  if (id) writeFileId(id);
  return id;
}

export async function uploadBackup(token: string, body: string): Promise<void> {
  const existing = await findBackupFileId(token);
  const meta = { name: FILE_NAME, mimeType: "application/json" };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([body], { type: "application/json" }));
  if (existing) {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(`drive ${res.status}`);
    return;
  }
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`drive ${res.status}`);
  const created = (await res.json()) as { id?: string };
  if (created.id) writeFileId(created.id);
}

export async function downloadBackup(token: string): Promise<string> {
  const id = await findBackupFileId(token);
  if (!id) throw new Error("missing");
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, token);
  return res.text();
}
