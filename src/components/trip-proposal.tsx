import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { AmountWithHkd, accountFiat } from "@/components/currency-field";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryPicker } from "@/components/category-picker";
import { AccountPicker } from "@/components/account-select";
import { clockNow, dateRangeLabel, todayISO } from "@/lib/format";
import { WhenField } from "@/components/when-picker";
import { categoryPath, resolvedDefaultAccountId } from "@/lib/categories";
import { pickName } from "@/lib/i18n";
import {
  MONEY_CHANNEL,
  asMoneyCurrency,
  carriedTrip,
  categoryFromSpendHint,
  clearTripHash,
  linkFromHash,
  loggedPlannerKeys,
  pendingTripHash,
  plannerTripUrl,
  proposalAction,
  proposalFromHash,
  publishLoggedKeys,
  spendCategoryMemoryKey,
  travelFallbackCategory,
  type TripSpendItem,
} from "@/lib/trip-link";
import { CURRENCIES, type Category, type MoneyUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getDb } from "@/lib/idb";
import { newId, useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

type Draft = TripSpendItem & {
  id: string;
  on: boolean;
  currency: MoneyUnit;
  categoryId: string;
  accountId: string;
  time: string;
  /** Item key already exists on a ledger row. */
  logged: boolean;
};

function hintCategory(item: TripSpendItem, categories: Category[], fallback: string): string {
  return (
    categoryFromSpendHint(item.category, categories, fallback, {
      label: item.label,
      remembered: remembered(spendCategoryMemoryKey(CATEGORY_KEY, item.category, item.label)),
    }) || fallback
  );
}

const ACCOUNT_KEY = "hk-life-money-pay-account";
const CATEGORY_KEY = "hk-life-money-pay-category";

function remembered(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function remember(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function TripProposal() {
  const t = useT();
  const addAdhoc = useApp((s) => s.addAdhocBudget);
  const addTransaction = useApp((s) => s.addTransaction);
  const updateTrip = useApp((s) => s.updateTrip);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const rates = useApp((s) => s.fxRates);
  const transactions = useApp((s) => s.transactions);
  const adhocBudgets = useApp((s) => s.adhocBudgets);
  const locale = useUi((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [pickCat, setPickCat] = useState("");
  const [pickAccount, setPickAccount] = useState("");
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [tripName, setTripName] = useState("");
  const [tripId, setTripId] = useState("");
  const [bookId, setBookId] = useState("");
  const [tripPick, setTripPick] = useState<string | null>(null);
  const [rows, setRows] = useState<Draft[]>([]);

  // Keep TripPlanner's ✓ 已記 in step with the ledger (see LOGGED_KEYS_STORAGE contract).
  useEffect(() => {
    publishLoggedKeys(loggedPlannerKeys([...transactions, ...adhocBudgets]));
  }, [transactions, adhocBudgets]);

  useEffect(() => {
    const parsed = proposalFromHash(pendingTripHash());
    if (!parsed) return;
    const state = useApp.getState();
    const logged = new Set(loggedPlannerKeys([...state.transactions, ...state.adhocBudgets]));
    setTripName(parsed.trip);
    setTripId(parsed.tripId);
    setBookId(parsed.bookId || "");
    setTripPick(null);
    const accountId = remembered(ACCOUNT_KEY);
    const fallbackCategory = travelFallbackCategory(categories, remembered(CATEGORY_KEY));
    setRows(
      parsed.items.map((item) => ({
        ...item,
        id: newId(),
        currency: asMoneyCurrency(item.currency),
        logged: Boolean(item.key && logged.has(item.key)),
        on: !(item.key && logged.has(item.key)),
        categoryId: hintCategory(item, categories, fallbackCategory),
        accountId,
        time: item.time && /^\d{2}:\d{2}$/.test(item.time) ? item.time : clockNow(),
      })),
    );
    setDone(false);
    setBackUrl("");
    setOpen(true);
    clearTripHash("proposal", true);
  }, []);

  useEffect(() => {
    function onHash() {
      if (!proposalFromHash(window.location.hash)) return;
      window.location.reload();
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!open) return;
    const accountId =
      remembered(ACCOUNT_KEY) ||
      accounts.find((a) => a.type === "cash" || a.type === "current" || a.type === "savings")?.id ||
      accounts.find((a) => a.currency !== "MILES")?.id ||
      "";
    const fallbackCategory = travelFallbackCategory(categories, remembered(CATEGORY_KEY));
    setRows((list) =>
      list.map((row) => ({
        ...row,
        accountId: row.accountId || accountId,
        categoryId: row.categoryId || hintCategory(row, categories, fallbackCategory),
        time: row.time && /^\d{2}:\d{2}$/.test(row.time) ? row.time : row.time || clockNow(),
      })),
    );
  }, [open, accounts, categories]);

  // Forget the stashed proposal only once it is dismissed or saved (a remount mid-onboarding keeps it).
  function closeSheet() {
    clearTripHash("proposal");
    setOpen(false);
  }

  function patch(id: string, next: Partial<Draft>) {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function chooseCategory(c: Category | null) {
    const id = pickCat;
    if (!id) return;
    const accountId = resolvedDefaultAccountId(c, categories);
    const acc = accountId ? accounts.find((a) => a.id === accountId) : undefined;
    const nextCcy = acc ? accountFiat(acc.currency) : null;
    patch(id, {
      categoryId: c?.id ?? "",
      ...(acc ? { accountId: acc.id } : {}),
      ...(nextCcy ? { currency: nextCcy } : {}),
    });
    setPickCat("");
  }

  async function save() {
    const chosen = rows.filter((row) => row.on);
    const skipped = rows.filter((row) => row.logged && !row.on).length;
    if (!chosen.length) {
      if (skipped) toast(t.reports.proposalAllLogged);
      closeSheet();
      return;
    }
    if (chosen.some((row) => !(row.amount > 0))) {
      toast(t.reports.proposalNeedAmount);
      return;
    }
    const picked = chosen;
    const guess = carriedTrip(trips, { trip: tripName, tripId, bookId, items: picked });
    const matched = trips.find((trip) => trip.id === (tripPick ?? guess?.id ?? ""));
    const expenseCats = categories.filter((c) => c.kind === "expense");
    const today = todayISO();
    let posted = 0;
    let scheduled = 0;
    for (const row of picked) {
      const categoryId = expenseCats.some((c) => c.id === row.categoryId) ? row.categoryId : undefined;
      const accountId = accounts.some((a) => a.id === row.accountId) ? row.accountId : "";
      if (!accountId) {
        toast(t.add.account);
        return;
      }
      remember(ACCOUNT_KEY, accountId);
      if (categoryId) {
        remember(CATEGORY_KEY, categoryId);
        remember(spendCategoryMemoryKey(CATEGORY_KEY, row.category, row.label), categoryId);
      }
      // Today or earlier → real expense on that date; later → scheduled one-off in that month.
      const post = proposalAction(row.date, today) === "post";
      const plannerKey = row.key && !row.logged ? row.key : undefined;
      await addAdhoc({
        id: newId(),
        label: row.label,
        labelZh: row.label,
        amount: row.amount,
        currency: row.currency,
        month: row.date.slice(0, 7),
        date: row.date,
        time: row.time,
        categoryId,
        accountId,
        tripId: matched?.id,
        ...(plannerKey ? { plannerKey } : {}),
        ...(post ? { paidOn: row.date } : {}),
      });
      if (!post) scheduled += 1;
      if (post) {
        await addTransaction({
          type: "expense",
          date: row.date,
          time: row.time,
          amount: row.amount,
          currency: row.currency === "MILES" ? "HKD" : row.currency,
          accountId,
          categoryId,
          payee: row.label,
          payeeZh: row.label,
          note: row.label,
          adhoc: true,
          tripId: matched?.id,
          tripManual: Boolean(matched?.id),
          ...(plannerKey ? { plannerKey } : {}),
        });
        posted += 1;
      }
    }
    if (matched && bookId && !matched.plannerId) {
      await updateTrip({ ...matched, plannerId: bookId, plannerTitle: tripName || matched.plannerTitle });
    }
    const msg = posted && scheduled ? t.reports.proposalMixed : posted ? t.reports.proposalPosted : t.reports.proposalDone;
    toast(msg);
    if (skipped) toast(t.reports.proposalSkippedLogged.replace("{n}", String(skipped)));
    setDoneMsg(msg);
    const day = picked[0]?.date || "";
    const trip = matched || trips.find((row) => row.id === tripId);
    setBackUrl(trip && day ? plannerTripUrl(trip, { day }) : "");
    clearTripHash("proposal");
    setDone(true);
  }

  const attached = carriedTrip(trips, { trip: tripName, tripId, bookId, items: rows });

  if (pickAccount) {
    return (
      <AccountPicker
        accounts={accounts}
        value={rows.find((item) => item.id === pickAccount)?.accountId || ""}
        onClose={() => setPickAccount("")}
        onSelect={(id) => {
          patch(pickAccount, { accountId: id });
          setPickAccount("");
        }}
      />
    );
  }

  if (pickCat) {
    const row = rows.find((item) => item.id === pickCat);
    return (
      <CategoryPicker
        categories={categories}
        kind="expense"
        selectedId={row?.categoryId || undefined}
        txType="expense"
        onClose={() => setPickCat("")}
        onSelect={chooseCategory}
      />
    );
  }

  return (
    <Overlay open={open} onClose={() => closeSheet()} title={t.reports.proposalTitle}>
      <div className="px-5 pb-8">
        {done ? (
          <>
            <p className="text-sm leading-6">{doneMsg}</p>
            {backUrl ? (
              <a href={backUrl} target="trip-planner" className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent">
                {t.reports.proposalBack}
              </a>
            ) : null}
            <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={() => closeSheet()}>
              {t.reports.proposalStay}
            </button>
          </>
        ) : !accounts.length ? (
          <>
            <p className="text-sm leading-6">{t.reports.proposalNoLedger}</p>
            <button type="button" className="mt-4 h-11 w-full rounded-xl bg-elevated text-sm font-medium" onClick={() => closeSheet()}>
              {t.reports.proposalStay}
            </button>
          </>
        ) : (
          <>
        <p className="text-xs leading-5 text-muted">
          {tripName ? `${tripName} · ` : ""}
          {t.reports.proposalHint}
        </p>
        {attached || trips.some((trip) => trip.status !== "cancelled") ? (
          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{t.add.trip}</span>
            <select
              value={tripPick ?? attached?.id ?? ""}
              onChange={(e) => setTripPick(e.target.value)}
              className="h-10 max-w-[16rem] bg-transparent text-right text-sm font-medium text-accent outline-none"
            >
              <option value="">{t.reports.noneTrip}</option>
              {trips
                .filter((trip) => trip.status !== "cancelled")
                .map((trip) => {
                  const today = todayISO();
                  const status =
                    trip.start <= today && today <= trip.end
                      ? t.reports.onTrip
                      : trip.end < today
                        ? t.reports.tripEnded
                        : t.reports.tripUpcoming;
                  return (
                    <option key={trip.id} value={trip.id}>
                      {pickName(locale, trip.name, trip.nameZh)} · {dateRangeLabel(trip.start, trip.end, locale)} · {status}
                    </option>
                  );
                })}
            </select>
          </label>
        ) : null}
        <div className="mt-3 space-y-3">
          {rows.map((row) => {
            const cat = categories.find((c) => c.id === row.categoryId);
            return (
            <div key={row.id} className={cn("overflow-hidden rounded-xl bg-elevated", !row.on && "opacity-50")}>
              <label className="flex items-start gap-2 px-4 pt-3">
                <input type="checkbox" className="mt-1" checked={row.on} onChange={(e) => patch(row.id, { on: e.target.checked })} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.logged ? (
                      <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted">✓ {t.reports.proposalLogged}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {row.logged && !row.on
                      ? t.reports.proposalLoggedHint
                      : proposalAction(row.date, todayISO()) === "post"
                        ? t.reports.proposalRowPost
                        : t.reports.proposalRowSchedule}
                  </span>
                </span>
              </label>
              <WhenField
                date={row.date}
                time={row.time}
                locale={locale}
                onDate={(iso) => patch(row.id, { date: iso })}
                onTime={(next) => patch(row.id, { time: next })}
              />
              <div className="px-4 py-2">
                <input
                  inputMode="decimal"
                  value={row.amount > 0 ? String(row.amount) : ""}
                  placeholder={t.reports.proposalAmount}
                  onChange={(e) => patch(row.id, { amount: Number(e.target.value) || 0 })}
                  className="h-10 w-full rounded-lg bg-background px-2 text-sm tabular-nums"
                />
                {row.amount > 0 && row.currency !== "HKD" ? (
                  <div className="mt-1 text-xs text-muted">
                    <AmountWithHkd amount={row.amount} currency={row.currency} rates={rates} className="text-xs text-muted" />
                  </div>
                ) : null}
              </div>
              {row.currencyGuess ? (
                <p className="mx-4 mt-1 rounded-lg bg-watch-soft px-3 py-2 text-xs leading-5 text-watch" role="note">
                  {t.reports.proposalCurrencyGuess.replace("{code}", row.currency)}
                </p>
              ) : null}
              <div className="flex gap-2 overflow-x-auto px-4 py-2">
                {CURRENCIES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={cn(
                      "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
                      row.currency === code ? "bg-accent text-on-accent" : "bg-background",
                    )}
                    onClick={() => patch(row.id, { currency: code, currencyGuess: undefined })}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <button type="button" className="flex h-12 w-full items-center gap-3 border-b border-line px-4 text-left" onClick={() => setPickAccount(row.id)}>
                <span className={cn("min-w-0 flex-1 truncate text-sm", row.accountId ? "text-foreground" : "text-muted")}>
                  {(() => {
                    const acc = accounts.find((a) => a.id === row.accountId);
                    return acc ? pickName(locale, acc.name, acc.nameZh) : t.add.account;
                  })()}
                </span>
              </button>
              <button type="button" className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left" onClick={() => setPickCat(row.id)}>
                {cat ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background">
                    <CategoryIcon name={cat.icon} />
                  </span>
                ) : null}
                <span className={cn("min-w-0 flex-1 text-sm", cat ? "text-foreground" : "text-muted")}>
                  {cat ? categoryPath(cat, categories, locale) : t.add.pickCategory}
                </span>
              </button>
            </div>
            );
          })}
        </div>
        <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void save()}>
          {t.reports.proposalSave}
        </button>
        <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={() => closeSheet()}>
          {t.reports.proposalSkip}
        </button>
          </>
        )}
      </div>
    </Overlay>
  );
}

export function TripLinkCatcher() {
  const t = useT();
  const trips = useApp((s) => s.trips);
  const update = useApp((s) => s.updateTrip);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onHash = () => setTick((n) => n + 1);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Another MoneyTracker tab linked a trip → reload trips here so the link shows without a refresh.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(MONEY_CHANNEL);
    ch.onmessage = (event) => {
      if ((event.data as { type?: string })?.type !== "trip") return;
      const db = getDb();
      if (db) void db.trips.toArray().then((rows) => useApp.setState({ trips: rows }));
    };
    return () => ch.close();
  }, []);
  useEffect(() => {
    const link = linkFromHash(pendingTripHash());
    if (!link) return;
    clearTripHash("link");
    const trip = trips.find((row) => row.id === link.tripId);
    if (!trip) {
      toast(trips.length ? t.reports.plannerMissing : t.reports.plannerMissingEmpty);
      return;
    }
    void update({ ...trip, plannerId: link.bookId, plannerTitle: link.title || trip.plannerTitle }).then(() => {
      if (typeof BroadcastChannel === "undefined") return;
      const ch = new BroadcastChannel(MONEY_CHANNEL);
      ch.postMessage({ type: "trip", id: trip.id });
      ch.close();
    });
    toast(t.reports.plannerSaved);
  }, [trips, update, t, tick]);
  return null;
}
