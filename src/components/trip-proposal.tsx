import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryPicker } from "@/components/category-picker";
import { AccountPicker } from "@/components/account-select";
import { todayISO, clockNow } from "@/lib/format";
import { WhenField } from "@/components/when-picker";
import { categoryPath, resolvedDefaultAccountId } from "@/lib/categories";
import { pickName } from "@/lib/i18n";
import { asMoneyCurrency, carriedTrip, linkFromHash, plannerTripUrl, proposalFromHash, type TripSpendItem } from "@/lib/trip-link";
import { CURRENCIES, type Category, type MoneyUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { newId, useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

type Draft = TripSpendItem & {
  id: string;
  kind: "adhoc" | "planned";
  on: boolean;
  currency: MoneyUnit;
  categoryId: string;
  accountId: string;
  time: string;
};

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
  const addTx = useApp((s) => s.addTransaction);
  const addAdhoc = useApp((s) => s.addAdhocBudget);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const locale = useUi((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [pickCat, setPickCat] = useState("");
  const [pickAccount, setPickAccount] = useState("");
  const [done, setDone] = useState(false);
  const [backUrl, setBackUrl] = useState("");
  const [tripName, setTripName] = useState("");
  const [tripId, setTripId] = useState("");
  const [bookId, setBookId] = useState("");
  const [rows, setRows] = useState<Draft[]>([]);

  useEffect(() => {
    const parsed = proposalFromHash(window.location.hash);
    if (!parsed) return;
    setTripName(parsed.trip);
    setTripId(parsed.tripId);
    setBookId(parsed.bookId || "");
    const today = todayISO();
    const accountId = remembered(ACCOUNT_KEY);
    const categoryId =
      remembered(CATEGORY_KEY) || categories.find((c) => c.kind === "expense" && c.theme === "travel")?.id || "";
    setRows(
      parsed.items.map((item) => ({
        ...item,
        id: newId(),
        currency: asMoneyCurrency(item.currency),
        kind: item.date > today ? "planned" : "adhoc",
        on: true,
        categoryId,
        accountId,
        time: clockNow(),
      })),
    );
    setDone(false);
    setBackUrl("");
    setOpen(true);
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, []);

  useEffect(() => {
    if (!open) return;
    const accountId =
      remembered(ACCOUNT_KEY) ||
      accounts.find((a) => a.type === "cash" || a.type === "current" || a.type === "savings")?.id ||
      accounts.find((a) => a.currency !== "MILES")?.id ||
      "";
    const categoryId =
      remembered(CATEGORY_KEY) || categories.find((c) => c.kind === "expense" && c.theme === "travel")?.id || "";
    setRows((list) =>
      list.map((row) => ({
        ...row,
        accountId: row.accountId || accountId,
        categoryId: row.categoryId || categoryId,
      })),
    );
  }, [open, accounts, categories]);

  function patch(id: string, next: Partial<Draft>) {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function chooseCategory(c: Category | null) {
    const id = pickCat;
    if (!id) return;
    const accountId = resolvedDefaultAccountId(c, categories);
    patch(id, {
      categoryId: c?.id ?? "",
      ...(accountId && accounts.some((a) => a.id === accountId) ? { accountId } : {}),
    });
    setPickCat("");
  }

  async function save() {
    const chosen = rows.filter((row) => row.on);
    if (!chosen.length) {
      setOpen(false);
      return;
    }
    if (chosen.some((row) => !(row.amount > 0))) {
      toast(t.reports.proposalNeedAmount);
      return;
    }
    const picked = chosen;
    const matched = carriedTrip(trips, { trip: tripName, tripId, bookId, items: picked });
    const expenseCats = categories.filter((c) => c.kind === "expense");
    for (const row of picked) {
      const categoryId = expenseCats.some((c) => c.id === row.categoryId) ? row.categoryId : undefined;
      const accountId = accounts.some((a) => a.id === row.accountId) ? row.accountId : "";
      if (!accountId) {
        toast(t.add.account);
        return;
      }
      remember(ACCOUNT_KEY, accountId);
      if (categoryId) remember(CATEGORY_KEY, categoryId);
      if (row.kind === "planned") {
        await addTx({
          type: "expense",
          amount: row.amount,
          currency: row.currency,
          accountId,
          categoryId,
          date: row.date,
          time: row.time,
          payee: row.label,
          payeeZh: row.label,
          note: tripName,
          planned: true,
          tripId: matched?.id,
          tripManual: Boolean(matched),
        });
      } else {
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
        });
      }
    }
    toast(t.reports.proposalDone);
    const day = picked[0]?.date || "";
    const trip = matched || trips.find((row) => row.id === tripId);
    setBackUrl(trip && day ? plannerTripUrl(trip, { day }) : "");
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
    <Overlay open={open} onClose={() => setOpen(false)} title={t.reports.proposalTitle}>
      <div className="px-5 pb-8">
        {done ? (
          <>
            <p className="text-sm leading-6">{t.reports.proposalDone}</p>
            {backUrl ? (
              <a href={backUrl} target="trip-planner" className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent">
                {t.reports.proposalBack}
              </a>
            ) : null}
            <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={() => setOpen(false)}>
              {t.reports.proposalStay}
            </button>
          </>
        ) : (
          <>
        <p className="text-xs leading-5 text-muted">
          {tripName ? `${tripName} · ` : ""}
          {t.reports.proposalHint}
        </p>
        {attached ? (
          <p className="mt-2 text-sm font-medium">{t.add.trip} · {pickName(locale, attached.name, attached.nameZh)}</p>
        ) : null}
        <div className="mt-3 space-y-3">
          {rows.map((row) => {
            const cat = categories.find((c) => c.id === row.categoryId);
            return (
            <div key={row.id} className={cn("overflow-hidden rounded-xl bg-elevated", !row.on && "opacity-50")}>
              <label className="flex items-start gap-2 px-4 pt-3">
                <input type="checkbox" className="mt-1" checked={row.on} onChange={(e) => patch(row.id, { on: e.target.checked })} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{row.label}</span>
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
              </div>
              <div className="flex gap-2 overflow-x-auto px-4 py-2">
                {CURRENCIES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={cn(
                      "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
                      row.currency === code ? "bg-accent text-on-accent" : "bg-background",
                    )}
                    onClick={() => patch(row.id, { currency: code })}
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
              <div className="flex gap-2 px-4 py-3">
                <button
                  type="button"
                  className={cn("h-8 flex-1 rounded-full text-xs font-medium", row.kind === "adhoc" ? "bg-accent text-on-accent" : "bg-background")}
                  onClick={() => patch(row.id, { kind: "adhoc" })}
                >
                  {t.reports.proposalAdhoc}
                </button>
                <button
                  type="button"
                  className={cn("h-8 flex-1 rounded-full text-xs font-medium", row.kind === "planned" ? "bg-accent text-on-accent" : "bg-background")}
                  onClick={() => patch(row.id, { kind: "planned" })}
                >
                  {t.reports.proposalPlanned}
                </button>
              </div>
            </div>
            );
          })}
        </div>
        <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void save()}>
          {t.reports.proposalSave}
        </button>
        <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={() => setOpen(false)}>
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
  useEffect(() => {
    const link = linkFromHash(window.location.hash);
    if (!link) return;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    const trip = trips.find((row) => row.id === link.tripId);
    if (!trip) {
      toast(t.reports.plannerMissing);
      return;
    }
    void update({ ...trip, plannerId: link.bookId, plannerTitle: link.title || trip.plannerTitle });
    toast(t.reports.plannerSaved);
  }, [trips, update, t]);
  return null;
}
