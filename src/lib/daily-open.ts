import { todayISO } from "./format.ts";
import type { SyncResult } from "./drive-sync.ts";

const FX_KEY = "hk-life-money-daily-fx";
const QUOTE_KEY = "hk-life-quotes-day";

export function fxDue(doneDay: string | null, today: string): boolean {
  return doneDay !== today;
}

export function quotesDue(doneDay: string | null, holdingCount: number, today: string): boolean {
  return holdingCount > 0 && doneDay !== today;
}

const memoryDay = new Map<string, string>();

function readDay(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
  } catch {
    /* ignore */
  }
  return memoryDay.get(key) ?? null;
}

function writeDay(key: string, today: string) {
  memoryDay.set(key, today);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, today);
  } catch {
    /* ignore */
  }
}

export type DailyOpenResult = {
  fx: boolean;
  quotes: boolean;
  drive: SyncResult | "skip";
  fxPending: boolean;
  quotesPending: boolean;
};

let inflight: Promise<DailyOpenResult> | null = null;

function deviceOnline(online?: () => boolean): boolean {
  if (online) return online();
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** First time the phone is online on this local calendar day: rates, prices, then Drive. */
export function runDailyOpen(opts: {
  today?: string;
  holdingCount: number;
  refreshFx: () => Promise<void>;
  refreshQuotes: () => Promise<number>;
  drive: () => Promise<SyncResult>;
  resync?: () => Promise<SyncResult>;
  online?: () => boolean;
}): Promise<DailyOpenResult> {
  if (inflight) return inflight;
  inflight = runDailyOpenOnce(opts).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runDailyOpenOnce(opts: {
  today?: string;
  holdingCount: number;
  refreshFx: () => Promise<void>;
  refreshQuotes: () => Promise<number>;
  drive: () => Promise<SyncResult>;
  resync?: () => Promise<SyncResult>;
  online?: () => boolean;
}): Promise<DailyOpenResult> {
  const today = opts.today ?? todayISO();
  const pending = () => ({
    fxPending: fxDue(readDay(FX_KEY), today),
    quotesPending: quotesDue(readDay(QUOTE_KEY), opts.holdingCount, today),
  });
  if (!deviceOnline(opts.online)) {
    return { fx: false, quotes: false, drive: "offline", ...pending() };
  }
  const jobs: Promise<unknown>[] = [];
  let fx = false;
  let quotes = false;
  if (fxDue(readDay(FX_KEY), today)) {
    jobs.push(
      opts
        .refreshFx()
        .then(() => {
          writeDay(FX_KEY, today);
          fx = true;
        })
        .catch(() => undefined),
    );
  }
  if (quotesDue(readDay(QUOTE_KEY), opts.holdingCount, today)) {
    jobs.push(
      opts
        .refreshQuotes()
        .then((n) => {
          if (n > 0) {
            writeDay(QUOTE_KEY, today);
            quotes = true;
          }
        })
        .catch(() => undefined),
    );
  }
  await Promise.all(jobs);
  let drive: SyncResult | "skip" = "skip";
  try {
    drive = await opts.drive();
  } catch {
    drive = "fail";
  }
  if (drive === "pulled") {
    await Promise.all([
      opts
        .refreshFx()
        .then(() => {
          writeDay(FX_KEY, today);
          fx = true;
        })
        .catch(() => undefined),
      opts.holdingCount
        ? opts
            .refreshQuotes()
            .then((n) => {
              if (n > 0) {
                writeDay(QUOTE_KEY, today);
                quotes = true;
              }
            })
            .catch(() => undefined)
        : Promise.resolve(),
    ]);
    if (opts.resync) {
      try {
        await opts.resync();
      } catch {
        /* the cloud copy is already local; prices stay on this device until the next sync */
      }
    }
  }
  return { fx, quotes, drive, ...pending() };
}
