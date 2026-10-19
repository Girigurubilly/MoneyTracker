import { readTripEditedAt, readTripLibrary, writeTripLibrary, type TripLibrary } from "@/lib/trip-library";
import { downloadNamedFile, uploadNamedFile } from "@/lib/google-drive";
import { pickSyncSide } from "@/lib/sync-side";

export const TRIP_FILE_NAME = "hk-life-trip.backup.json";

function b64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encodeTripFile(library: TripLibrary, password: string): Promise<string> {
  if (!password) throw new Error("pass");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(library)));
  return JSON.stringify({
    v: 1,
    kind: "trip-book-encrypted",
    alg: "AES-GCM",
    salt: b64(salt),
    iv: b64(iv),
    data: b64(new Uint8Array(cipher)),
  });
}

export async function decodeTripFile(text: string, password: string): Promise<TripLibrary> {
  const parsed = JSON.parse(text) as { kind?: string; salt?: string; iv?: string; data?: string };
  let json = text;
  if (parsed.kind === "trip-book-encrypted") {
    if (!password || !parsed.salt || !parsed.iv || !parsed.data) throw new Error("pass");
    try {
      const key = await deriveKey(password, fromB64(parsed.salt));
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64(parsed.iv) as BufferSource },
        key,
        fromB64(parsed.data) as BufferSource,
      );
      json = new TextDecoder().decode(plain);
    } catch {
      throw new Error("bad-pass");
    }
  }
  const data = JSON.parse(json) as TripLibrary;
  if (data.kind !== "trip-book" || !Array.isArray(data.trips)) throw new Error("format");
  return data;
}

/** Read or write the itinerary that lives beside the money backups. */
export async function syncSharedTripFile(token: string, password: string): Promise<"pulled" | "pushed" | "ok" | "fail"> {
  if (!password) return "ok";
  let remote: { text: string; modifiedTime: string } | null = null;
  try {
    remote = await downloadNamedFile(token, TRIP_FILE_NAME);
  } catch (err) {
    if ((err as Error).message !== "missing") return "fail";
  }
  const local = readTripLibrary();
  const localAt = readTripEditedAt();
  if (!remote) {
    if (!local?.trips.length) return "ok";
    await uploadNamedFile(token, TRIP_FILE_NAME, await encodeTripFile({ ...local, exportedAt: localAt || new Date().toISOString() }, password));
    return "pushed";
  }
  let decoded: TripLibrary;
  try {
    decoded = await decodeTripFile(remote.text, password);
  } catch (err) {
    if ((err as Error).message === "pass" || (err as Error).message === "bad-pass") throw err;
    return "fail";
  }
  const remoteAt = decoded.exportedAt || remote.modifiedTime;
  if (!local) {
    writeTripLibrary(decoded);
    return "pulled";
  }
  const side = pickSyncSide(localAt, remoteAt);
  if (side === "pull") {
    writeTripLibrary({ ...decoded, exportedAt: remoteAt });
    return "pulled";
  }
  if (side === "push") {
    await uploadNamedFile(token, TRIP_FILE_NAME, await encodeTripFile({ ...local, exportedAt: localAt || new Date().toISOString() }, password));
    return "pushed";
  }
  return "ok";
}
