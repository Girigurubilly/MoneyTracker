const TRIPS_KEY = "tripbooks.v1";
const NOTES_KEY = "tripnotes.v1";
const VISITS_KEY = "tripvisits.v1";
const EXTRAS_KEY = "tripextras.v1";
const WISHES_KEY = "tripwishes.v1";
const CHECKS_KEY = "tripchecks.v1";
const LINKS_KEY = "tripbook-money-links";
const EDIT_KEY = "tripbook-local-edited";

export type TripLibrary = {
  schemaVersion: 1;
  kind: "trip-book";
  exportedAt: string;
  trips: unknown[];
  notes: Record<string, unknown>;
  checks?: unknown;
  visits?: unknown;
  extras?: unknown;
  wishes?: unknown;
  links?: Record<string, string>;
};

type Store = Pick<Storage, "getItem" | "setItem">;

export function laterIso(a: string, b: string): string {
  const left = Date.parse(a || "") || 0;
  const right = Date.parse(b || "") || 0;
  if (!left && !right) return "";
  return left >= right ? a : b;
}

function readJson(storage: Store, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function readTripEditedAt(storage: Store = localStorage): string {
  try {
    return storage.getItem(EDIT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readTripLibrary(storage: Store = localStorage): TripLibrary | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(TRIPS_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  const trips = readJson(storage, TRIPS_KEY);
  if (!Array.isArray(trips)) return null;
  const notes = readJson(storage, NOTES_KEY);
  const links = readJson(storage, LINKS_KEY);
  return {
    schemaVersion: 1,
    kind: "trip-book",
    exportedAt: readTripEditedAt(storage) || new Date(0).toISOString(),
    trips,
    notes: notes && typeof notes === "object" && !Array.isArray(notes) ? (notes as Record<string, unknown>) : {},
    checks: readJson(storage, CHECKS_KEY),
    visits: readJson(storage, VISITS_KEY),
    extras: readJson(storage, EXTRAS_KEY),
    wishes: readJson(storage, WISHES_KEY),
    links: links && typeof links === "object" && !Array.isArray(links) ? (links as Record<string, string>) : {},
  };
}

export function writeTripLibrary(library: TripLibrary, storage: Store = localStorage): void {
  if (!Array.isArray(library.trips)) return;
  try {
    storage.setItem(TRIPS_KEY, JSON.stringify(library.trips));
    storage.setItem(NOTES_KEY, JSON.stringify(library.notes || {}));
    if (library.checks && typeof library.checks === "object") storage.setItem(CHECKS_KEY, JSON.stringify(library.checks));
    if (library.visits && typeof library.visits === "object") storage.setItem(VISITS_KEY, JSON.stringify(library.visits));
    if (library.extras && typeof library.extras === "object") storage.setItem(EXTRAS_KEY, JSON.stringify(library.extras));
    if (library.wishes && typeof library.wishes === "object") storage.setItem(WISHES_KEY, JSON.stringify(library.wishes));
    if (library.links && typeof library.links === "object") storage.setItem(LINKS_KEY, JSON.stringify(library.links));
    if (library.exportedAt) storage.setItem(EDIT_KEY, library.exportedAt);
  } catch {
    /* this browser may block storage */
  }
}

/** Keep a remote itinerary when this phone has never opened the trip app. */
export function attachTripLibrary<T extends { tripLibrary?: TripLibrary }>(
  local: T,
  remote: { tripLibrary?: TripLibrary } | null,
): T {
  if (local.tripLibrary) return local;
  if (remote?.tripLibrary && Array.isArray(remote.tripLibrary.trips) && remote.tripLibrary.trips.length) {
    return { ...local, tripLibrary: remote.tripLibrary };
  }
  return local;
}
