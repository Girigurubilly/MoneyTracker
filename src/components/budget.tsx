import { useState } from "react";
import { Plus, ChevronRight, ChevronDown, Pencil, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { InfoButton, Overlay, ScreenHeader } from "@/components/shared";
import { CategoryPicker, TypeSwitch } from "@/components/category-picker";
import { CategoryIcon } from "@/components/category-icon";
import { AmountWithHkd, accountFiat, asFiat, autoDestAmount } from "@/components/currency-field";
import { money, pct, todayISO, clockNow } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { travelThemedIds } from "@/lib/categories";
import { resolveAmountInput } from "@/lib/money-expr";
import {
  AccountLine,
  ActiveKeypad,
  ComposerHeader,
  ComposerShell,
  ExtraIconBar,
  LineRow,
  SelectLine,
  TextLine,
} from "@/components/txn-composer";
import { asOfForMonth, adhocTotal, budgetActuals, chargedDayOf, chargedIso, forecastTone, monthlyRegularsNetHkd, regularSettledInMonth, spentInMonth } from "@/lib/calc/budget";
import { WhenField } from "@/components/when-picker";
import { effectiveAnnualTravelBudget, travelSpendYtd, isTripActive } from "@/lib/calc/trips";
import { monthKey } from "@/lib/calc/ledger";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import type { AdhocBudget, Budget, Currency, Recurring, TxType, WishItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { WishlistBlock } from "@/components/wishlist";
import { defaultMortgageAccountId, moneyAccountsForPicker } from "@/lib/accounts";
import { mortgageFromRegulars } from "@/lib/calc/housing";
import { categoryPath, canSplitMortgage, isMortgageInterestCategory, isMortgagePrincipalCategory, mortgageEntryKind, resolvedDefaultAccountId } from "@/lib/categories";
import { applyTxRules } from "@/lib/tx-rules";

export function BudgetScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const kid = useUi((s) => s.accessMode) === "kid";
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const categories = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const adhocRows = useApp((s) => s.adhocBudgets);
  const targetMode = useApp((s) => s.budgetTargetMode);
  const annual = useApp((s) => s.annualTravelBudget);
  const trips = useApp((s) => s.trips);
  const updateBudget = useApp((s) => s.updateBudget);
  const today = todayISO();
  const month = monthKey(today);
  const asOf = asOfForMonth(month, today);
  const actuals = budgetActuals(budgets, txs, month, rates, categories, recurring, asOf, adhocRows, targetMode);
  const storedTotal = actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID);
  const monthSpent = storedTotal?.spent ?? 0;
  const reserved = storedTotal?.reserved ?? 0;
  const reservedA = storedTotal?.reservedAdhoc ?? 0;
  const realized = storedTotal?.realized ?? 0;
  const projected = storedTotal?.projected ?? 0;
  const projectedRemain = storedTotal?.projectedRemain ?? 0;
  const avgDaily = storedTotal?.avgDaily ?? 0;
  const dailyAllowed = storedTotal?.dailyAllowed ?? 0;
  const daysRemaining = storedTotal?.daysRemaining ?? 0;
  const monthCap = storedTotal?.monthly ?? 0;
  const monthUsed = storedTotal?.expected ?? monthSpent + reserved + (targetMode === "regular" ? 0 : reservedA) + projectedRemain;
  const monthRemain = storedTotal?.remaining ?? monthCap - monthSpent - reserved - (targetMode === "regular" ? 0 : reservedA);
  const monthTone = forecastTone(monthCap > 0 ? monthUsed / monthCap : 0);
  const heldInBar = reserved + (targetMode === "regular" ? 0 : reservedA);
  const categoryActuals = actuals.filter((b) => b.id !== MONTH_TOTAL_BUDGET_ID);
  const travelIds = travelThemedIds(categories);
  const spent = travelSpendYtd(txs, Number(month.slice(0, 4)), travelIds, rates);
  const travelYear = Number(month.slice(0, 4));
  const annualEff = effectiveAnnualTravelBudget(annual, trips, travelYear);
  const travelBudget = annualEff.budget;
  const travelPct = travelBudget > 0 ? spent / travelBudget : 0;
  const travelTone = forecastTone(travelPct);
  const [editCap, setEditCap] = useState(false);
  const [capDraft, setCapDraft] = useState("");
  const [regOpen, setRegOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<Recurring | null>(null);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [editingAdhoc, setEditingAdhoc] = useState<AdhocBudget | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  function openCap() {
    setCapDraft(String(monthCap || ""));
    setEditCap(true);
  }
  function openCategoryBudget(b: Budget | null) {
    setEditingBudget(b);
    setCatOpen(true);
  }

  return (
    <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <ScreenHeader title={t.budget.title} large />

      {/* Month summary — one hero number, one bar, two supporting tiles */}
      <section className="rt-enter mx-4 rounded-xl bg-elevated px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">{monthCap > 0 ? t.budget.leftToSpend : t.budget.spent}</span>
          <InfoButton k="cap" />
        </div>
        <div
          className={cn(
            "text-3xl font-semibold tabular-nums tracking-tight",
            monthCap > 0 && monthRemain < 0 && "text-expense",
          )}
        >
          {money(monthCap > 0 ? monthRemain : monthSpent, "HKD")}
        </div>
        {monthCap > 0 ? (
          <>
            <button
              type="button"
              onClick={openCap}
              className="tr-press mt-1 flex min-h-8 flex-wrap items-center gap-x-1 text-left text-sm text-muted"
            >
              <span>
                {t.budget.spent} <span className="tabular-nums text-foreground">{money(monthSpent, "HKD")}</span>
              </span>
              <span className="text-faint">/</span>
              <span className="tabular-nums">{money(monthCap, "HKD")}</span>
              <Pencil className="size-3 text-faint" aria-label={t.budget.editCap} />
            </button>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track">
              <div className="flex h-full w-full">
                <div
                  className={cn("h-full motion-safe:transition-[width] motion-safe:duration-300", toneBg(monthTone))}
                  style={{ width: `${Math.min(100, (monthSpent / monthCap) * 100)}%` }}
                />
                <div
                  className="h-full bg-accent/40 motion-safe:transition-[width] motion-safe:duration-300"
                  style={{ width: `${Math.min(Math.max(0, 100 - (monthSpent / monthCap) * 100), (heldInBar / monthCap) * 100)}%` }}
                />
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
              <span>
                <span className={cn("mr-1 inline-block size-1.5 rounded-full align-middle", toneBg(monthTone))} />
                {t.budget.barPosted}
              </span>
              {heldInBar > 0 ? (
                <span>
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-accent/40 align-middle" />
                  {t.budget.barReserved}
                </span>
              ) : null}
              <span className="ml-auto text-faint">
                {daysRemaining > 0 ? t.budget.daysLeft.replace("{n}", String(daysRemaining)) : t.budget.lastDay}
              </span>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={openCap}
            className="tr-press mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent-soft text-sm font-semibold text-accent"
          >
            <Plus className="size-4" />
            {t.budget.setCap}
          </button>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {monthCap > 0 ? (
            <div className="rounded-xl bg-accent-soft px-3 py-2.5">
              <div className="text-[11px] font-medium leading-4 text-accent">{t.budget.dailyAllowed}</div>
              <div className="mt-0.5 text-base font-semibold leading-tight tabular-nums text-accent">{money(dailyAllowed, "HKD")}</div>
            </div>
          ) : (
            <div className="rounded-xl px-3 py-2.5 ring-1 ring-line">
              <div className="text-[11px] font-medium leading-4 text-muted">{t.budget.avgDaily}</div>
              <div className="mt-0.5 text-base font-semibold leading-tight tabular-nums">{money(avgDaily, "HKD")}</div>
            </div>
          )}
          <div className="rounded-xl px-3 py-2.5 ring-1 ring-line">
            <div className="text-[11px] font-medium leading-4 text-muted">{t.budget.expectedMonth}</div>
            <div className={cn("mt-0.5 text-base font-semibold leading-tight tabular-nums", monthCap > 0 && monthTone !== "income" && toneText(monthTone))}>
              {money(monthUsed, "HKD")}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={showBreakdown}
          className="mt-2 flex min-h-9 w-full items-center justify-center gap-1 text-xs font-medium text-accent"
          onClick={() => setShowBreakdown((v) => !v)}
        >
          {showBreakdown ? t.budget.hideBreakdown : t.budget.showBreakdown}
          <ChevronDown className={cn("size-3.5 motion-safe:transition", showBreakdown && "rotate-180")} />
        </button>
        {showBreakdown ? (
          <div className="rt-enter mt-1 space-y-1.5 text-xs text-muted">
            <BreakRow label={t.today.reservedRegulars} value={reserved + reservedA} />
            <BreakRow label={t.budget.dueNotPostedBoth} value={Math.max(0, realized - monthSpent)} />
            <BreakRow label={`${t.budget.projected} · ${t.budget.atPace}`} value={projected} />
            {monthCap > 0 ? <BreakRow label={t.budget.avgDaily} value={avgDaily} /> : null}
          </div>
        ) : null}
      </section>

      {/* Scheduled one-offs this month come first */}
      {kid ? null : (
        <AdhocBlock
          month={month}
          onAdd={() => {
            setEditingAdhoc(null);
            setAdhocOpen(true);
          }}
          onEdit={(a) => {
            setEditingAdhoc(a);
            setAdhocOpen(true);
          }}
        />
      )}

      {/* Category budgets — what each cap is tracking this month */}
      <SectionHead
        title={t.budget.byCategory}
        action={
          <button
            type="button"
            onClick={() => openCategoryBudget(null)}
            className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-accent"
          >
            <Plus className="size-4" />
            {t.budget.addShort}
          </button>
        }
      />
      {categoryActuals.length === 0 ? (
        <div className="mx-4 rounded-xl bg-elevated px-4 py-5 text-center">
          <p className="text-sm text-muted">{t.budget.catEmpty}</p>
          <button
            type="button"
            onClick={() => openCategoryBudget(null)}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
          >
            {t.budget.addCategoryBudget}
          </button>
        </div>
      ) : (
        <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
          {categoryActuals.map((b) => (
            <CategoryBudgetRow
              key={b.id}
              row={b}
              onEdit={() =>
                openCategoryBudget(
                  budgets.find((x) => x.id === b.id) ?? { id: b.id, label: b.label, labelZh: b.labelZh, monthly: b.monthly, spent: 0, categoryId: b.categoryId },
                )
              }
            />
          ))}
        </div>
      )}

      {kid ? null : (
        <Link to="/reports/travel" className="tr-press mx-4 mt-3 block rounded-xl bg-elevated px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t.budget.annualTravel}</span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <span className="tabular-nums">
                {money(spent, "HKD")} / {travelBudget > 0 ? money(travelBudget, "HKD") : "—"}
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </span>
          </div>
          {annualEff.fromTrips ? <div className="mt-0.5 text-[11px] text-faint">{t.reports.travelBudgetFromTrips}</div> : null}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track">
            <div
              className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300", toneBg(travelTone))}
              style={{ width: `${Math.min(100, travelPct * 100)}%` }}
            />
          </div>
        </Link>
      )}

      <RegularsBlock
        onAdd={() => {
          setEditingReg(null);
          setRegOpen(true);
        }}
        onEdit={(r) => {
          setEditingReg(r);
          setRegOpen(true);
        }}
      />

      {kid ? null : <WishlistBlock compact collapsible />}

      <Overlay open={editCap} onClose={() => setEditCap(false)} title={t.budget.monthlyTotal}>
        <div className="px-5 pb-8">
          <label className="flex h-12 items-center gap-2 rounded-lg bg-elevated px-3">
            <span className="text-sm text-muted">HK$</span>
            <input
              inputMode="decimal"
              value={capDraft}
              onChange={(e) => setCapDraft(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums outline-none"
              placeholder="0"
              aria-label={t.budget.monthlyTotal}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-muted">{t.budget.capSheetHint}</p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent"
            onClick={async () => {
              await updateBudget({
                id: MONTH_TOTAL_BUDGET_ID,
                label: "Monthly total",
                labelZh: "本月總額",
                monthly: Math.max(0, resolveAmountInput(capDraft)),
                spent: 0,
              });
              setEditCap(false);
            }}
          >
            {t.add.save}
          </button>
        </div>
      </Overlay>

      <Overlay
        open={catOpen}
        onClose={() => {
          setCatOpen(false);
          setEditingBudget(null);
        }}
        title={editingBudget ? t.budget.editCategoryBudget : t.budget.addCategoryBudget}
      >
        {catOpen ? (
          <CategoryBudgetForm
            key={editingBudget?.id ?? "new"}
            initial={editingBudget}
            month={month}
            onDone={() => {
              setCatOpen(false);
              setEditingBudget(null);
            }}
          />
        ) : null}
      </Overlay>

      <RegularEditor open={regOpen} initial={editingReg} onClose={() => { setRegOpen(false); setEditingReg(null); }} />
      <AdhocEditor open={adhocOpen} initial={editingAdhoc} month={month} onClose={() => { setAdhocOpen(false); setEditingAdhoc(null); }} />
    </div>
  );
}

type Tone = "income" | "watch" | "expense";

function toneBg(tone: Tone): string {
  return tone === "expense" ? "bg-expense" : tone === "watch" ? "bg-watch" : "bg-income";
}

function toneText(tone: Tone): string {
  return tone === "expense" ? "text-expense" : tone === "watch" ? "text-watch" : "text-income";
}

function BreakRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{money(value, "HKD")}</span>
    </div>
  );
}

function SectionHead({
  title,
  total,
  action,
  collapsed,
  onToggle,
}: {
  title: string;
  total?: React.ReactNode;
  action?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-5 pt-5">
      <h2 className="min-w-0 text-sm font-medium text-muted">
        {onToggle ? (
          <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex min-h-11 min-w-0 items-center gap-2 text-left">
            <ChevronDown className={cn("size-4 shrink-0 text-faint motion-safe:transition-transform motion-safe:duration-200", collapsed && "-rotate-90")} />
            <span>{title}</span>
            {total}
          </button>
        ) : (
          <span className="flex items-baseline gap-2">
            <span>{title}</span>
            {total}
          </span>
        )}
      </h2>
      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </div>
  );
}

function CategoryBudgetRow({
  row,
  onEdit,
}: {
  row: Budget & { spent: number; remaining: number; ratio: number };
  onEdit: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const categories = useApp((s) => s.categories);
  const cat = row.categoryId ? categories.find((c) => c.id === row.categoryId) : undefined;
  const linked = Boolean(row.categoryId || row.theme);
  const tone = forecastTone(row.ratio);
  const over = row.remaining < 0;
  const name = cat ? categoryPath(cat, categories, locale) : pickName(locale, row.label, row.labelZh);
  return (
    <button type="button" className="tr-press block w-full border-t border-line px-4 py-3 text-left first:border-0" onClick={onEdit}>
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background">
          {cat ? <CategoryIcon name={cat.icon} /> : <Wallet className="size-4 text-muted" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 break-words text-sm font-medium">{name}</span>
            {linked ? (
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", over ? "text-expense" : tone === "watch" ? "text-watch" : undefined)}>
                {over ? t.budget.overBy.replace("{amt}", money(-row.remaining, "HKD")) : t.budget.leftAmt.replace("{amt}", money(row.remaining, "HKD"))}
              </span>
            ) : null}
          </div>
          {linked ? (
            <>
              <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted">
                <span className="tabular-nums">
                  {money(row.spent, "HKD")} / {money(row.monthly, "HKD")}
                </span>
                <span className="tabular-nums">{pct(row.ratio)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ring-track">
                <div
                  className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300", toneBg(tone))}
                  style={{ width: `${Math.min(100, row.ratio * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="mt-0.5 text-xs text-watch">{t.budget.unlinked}</div>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-faint" />
      </div>
    </button>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CategoryBudgetForm({ initial, month, onDone }: { initial: Budget | null; month: string; onDone: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const budgets = useApp((s) => s.budgets);
  const categories = useApp((s) => s.categories);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const updateBudget = useApp((s) => s.updateBudget);
  const deleteBudget = useApp((s) => s.deleteBudget);
  const [catId, setCatId] = useState(initial?.categoryId ?? "");
  const [amt, setAmt] = useState(initial?.monthly ? String(initial.monthly) : "");
  const taken = new Set(budgets.filter((b) => b.categoryId && b.id !== initial?.id).map((b) => b.categoryId as string));
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const parents = expenseCats.filter((c) => !c.parentId || c.parentId === c.id || !expenseCats.some((p) => p.id === c.parentId));
  const options = parents.flatMap((p) => [
    { c: p, label: pickName(locale, p.name, p.nameZh) },
    ...expenseCats
      .filter((c) => c.parentId === p.id && c.id !== p.id)
      .map((c) => ({ c, label: `${pickName(locale, p.name, p.nameZh)} › ${pickName(locale, c.name, c.nameZh)}` })),
  ]);
  const cat = categories.find((c) => c.id === catId);
  const hasSubs = cat ? categories.some((c) => c.parentId === cat.id && c.id !== cat.id) : false;
  const thisMonth = cat ? spentInMonth(txs, month, rates, { categoryId: cat.id, categories }) : 0;
  const avg3 = cat
    ? [1, 2, 3].reduce((s, n) => s + spentInMonth(txs, shiftMonth(month, -n), rates, { categoryId: cat.id, categories }), 0) / 3
    : 0;
  const capN = resolveAmountInput(amt);

  async function save() {
    if (!cat) {
      toast(t.budget.needCategory);
      return;
    }
    if (!(capN > 0)) {
      toast(t.budget.needCap);
      return;
    }
    await updateBudget({
      id: initial?.id ?? `b-${newId().slice(0, 8)}`,
      categoryId: cat.id,
      theme: undefined,
      label: cat.name,
      labelZh: cat.nameZh,
      monthly: capN,
      spent: 0,
    });
    toast(t.add.savedToast);
    onDone();
  }

  return (
    <div className="px-5 pb-8">
      <label className="block text-xs font-medium text-muted" htmlFor="cb-cat">
        {t.budget.categoryLabel}
      </label>
      <div className="mt-1 flex h-12 items-center gap-2 rounded-lg bg-elevated px-3">
        {cat ? <CategoryIcon name={cat.icon} /> : null}
        <select
          id="cb-cat"
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
        >
          <option value="">{t.add.pickCategory}</option>
          {options.map(({ c, label }) => (
            <option key={c.id} value={c.id} disabled={taken.has(c.id)}>
              {taken.has(c.id) ? `${label} · ${t.budget.alreadySet}` : label}
            </option>
          ))}
        </select>
      </div>
      {hasSubs ? <p className="mt-1 text-[11px] leading-4 text-faint">{t.budget.includesSubs}</p> : null}

      <label className="mt-4 block text-xs font-medium text-muted" htmlFor="cb-amt">
        {t.budget.monthlyCap}
      </label>
      <div className="mt-1 flex h-12 items-center gap-2 rounded-lg bg-elevated px-3">
        <span className="text-sm text-muted">HK$</span>
        <input
          id="cb-amt"
          inputMode="decimal"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums outline-none"
          placeholder="0"
        />
      </div>

      {cat ? (
        <div className="rt-enter mt-3 space-y-1.5 rounded-xl px-3 py-3 text-xs text-muted ring-1 ring-line">
          <div className="flex items-baseline justify-between gap-3">
            <span>{t.budget.spentThisMonth}</span>
            <span className="tabular-nums text-foreground">{money(thisMonth, "HKD")}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{t.budget.avg3m}</span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-foreground">{money(avg3, "HKD")}</span>
              {avg3 > 0 ? (
                <button
                  type="button"
                  className="min-h-8 rounded-full bg-accent-soft px-2.5 text-[11px] font-medium text-accent"
                  onClick={() => setAmt(String(Math.ceil(avg3 / 10) * 10))}
                >
                  {t.budget.useThis}
                </button>
              ) : null}
            </span>
          </div>
          {capN > 0 ? (
            <div className="pt-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-ring-track">
                <div
                  className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300", toneBg(forecastTone(thisMonth / capN)))}
                  style={{ width: `${Math.min(100, (thisMonth / capN) * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-right tabular-nums">{pct(thisMonth / capN)}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent" onClick={() => void save()}>
        {t.add.save}
      </button>
      {initial && initial.id !== MONTH_TOTAL_BUDGET_ID ? (
        <button
          type="button"
          className="mt-2 h-12 w-full text-sm text-expense"
          onClick={async () => {
            await deleteBudget(initial.id);
            toast(t.tx.deleted);
            onDone();
          }}
        >
          {t.tx.delete}
        </button>
      ) : null}
    </div>
  );
}

function dayPart(isoOrDay: string | number, locale: string): string {
  const day = typeof isoOrDay === "number" ? isoOrDay : Number(String(isoOrDay).slice(8, 10));
  if (!Number.isFinite(day) || day <= 0) return "—";
  return locale === "zh-HK" ? `${day}日` : `Day ${day}`;
}

function freqLabel(frequency: Recurring["frequency"], t: ReturnType<typeof useT>): string {
  if (frequency === "weekly") return t.budget.freqWeekly;
  if (frequency === "quarterly") return t.budget.freqQuarterly;
  if (frequency === "yearly") return t.budget.freqYearly;
  return "";
}

export function RegularRow({ r, onEdit, showType }: { r: Recurring; onEdit: (r: Recurring) => void; showType?: boolean }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const accounts = useApp((s) => s.accounts);
  const addTx = useApp((s) => s.addTransaction);
  const todayIso = todayISO();
  const month = todayIso.slice(0, 7);
  const today = Number(todayIso.slice(8, 10));
  const day = r.frequency === "monthly" ? chargedDayOf(r) : Number(r.nextDate.slice(8, 10)) || chargedDayOf(r);
  const settledIso = r.frequency === "monthly" ? chargedIso(month, day) : r.nextDate;
  const posted = regularSettledInMonth(r, txs, month, settledIso);
  const due = r.frequency === "monthly" ? day <= today : r.nextDate <= todayIso;
  const signed = r.type === "income" ? r.amount : r.type === "expense" || r.countsAsExpense ? -r.amount : r.amount;
  const badgeClass = posted ? "bg-success-soft text-income" : due ? "bg-watch-soft text-watch" : "bg-accent-soft text-accent";
  const badgeLabel =
    r.type === "income"
      ? posted
        ? t.add.received
        : due
          ? t.budget.dueNotPosted
          : t.budget.upcomingIncome
      : posted
        ? t.budget.charged
        : due
          ? t.budget.dueNotPosted
          : t.budget.upcomingStatus;
  const acc = accounts.find((a) => a.id === r.accountId);
  const freq = freqLabel(r.frequency, t);
  const kind =
    r.type === "income" ? t.add.income : r.type === "transfer" ? (r.countsAsExpense ? `${t.add.transfer} · ${t.add.principal}` : t.add.transfer) : t.add.expense;

  async function postCharge() {
    const when = r.frequency === "monthly" ? chargedIso(month, chargedDayOf(r)) : r.nextDate <= todayIso ? r.nextDate : todayIso;
    await addTx({
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      destAmount: r.type === "transfer" ? (r.destAmount ?? r.amount) : undefined,
      categoryId: r.categoryId,
      date: when,
      payee: r.label,
      payeeZh: r.labelZh,
      planned: false,
      recurringId: r.id,
      countsAsExpense: r.countsAsExpense,
      housing: r.housing,
    });
    toast(t.add.savedToast);
  }

  return (
    <div className="flex items-stretch border-t border-line first:border-0">
      <button type="button" className="min-w-0 flex-1 px-4 py-3 text-left" onClick={() => onEdit(r)}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="break-words text-sm font-medium">{pickName(locale, r.label, r.labelZh)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">
                {dayPart(r.frequency === "monthly" ? day : settledIso, locale)}
                {showType ? ` · ${kind}` : ""}
                {acc ? ` · ${pickName(locale, acc.name, acc.nameZh)}` : ""}
                {freq ? ` · ${freq}` : ""}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badgeClass)}>{badgeLabel}</span>
            </div>
          </div>
          <AmountWithHkd
            amount={signed}
            currency={r.currency}
            rates={rates}
            sign
            className={cn(
              "shrink-0 text-sm font-semibold",
              r.type === "income" ? "text-income" : r.type === "expense" || r.countsAsExpense ? "text-expense" : undefined,
            )}
          />
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint" />
        </div>
      </button>
      {due && !posted ? (
        <button type="button" className="tr-press shrink-0 border-l border-line px-3 text-xs font-semibold text-accent" onClick={() => void postCharge()}>
          {t.budget.postCharge}
        </button>
      ) : null}
    </div>
  );
}

function RegularsBlock({ onAdd, onEdit }: { onAdd: () => void; onEdit: (r: Recurring) => void }) {
  const t = useT();
  const recurring = useApp((s) => s.recurring);
  const rates = useApp((s) => s.fxRates);
  const rows = recurring
    .filter((r) => r.type !== "miles")
    .sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label));
  const lump = monthlyRegularsNetHkd(recurring, rates);
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div>
      <SectionHead
        title={t.budget.monthlyRegulars}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        total={
          rows.length ? (
            <span className={cn("text-xs font-semibold tabular-nums", lump > 0 ? "text-income" : lump < 0 ? "text-expense" : "text-muted")}>
              {money(lump, "HKD", { sign: true })}
            </span>
          ) : null
        }
        action={
          <>
            <Link to="/more/regulars" className="flex min-h-11 items-center text-xs font-medium text-accent">
              {t.budget.manageRegulars}
            </Link>
            <button type="button" onClick={onAdd} aria-label={t.budget.addRegular} className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-accent">
              <Plus className="size-4" />
              {t.budget.addShort}
            </button>
          </>
        }
      />
      {collapsed ? null : rows.length === 0 ? <p className="px-5 pb-1 text-xs text-faint">{t.budget.regularsNone}</p> : null}
      {collapsed || rows.length === 0 ? null : (
        <div className="rt-enter mx-4 overflow-hidden rounded-xl bg-elevated">
          {rows.map((r) => (
            <RegularRow key={r.id} r={r} onEdit={onEdit} showType />
          ))}
        </div>
      )}
    </div>
  );
}

function wishFromAdhoc(a: AdhocBudget, locale: "en" | "zh-HK"): WishItem {
  return {
    id: newId(),
    name: pickName(locale, a.label, a.labelZh),
    price: a.amount,
    currency: a.currency === "MILES" ? "HKD" : a.currency,
    categoryId: a.categoryId,
    priceCards: a.priceCards,
    valueCards: a.valueCards,
  };
}

function AdhocBlock({
  month,
  onAdd,
  onEdit,
}: {
  month: string;
  onAdd: () => void;
  onEdit: (a: AdhocBudget) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rates = useApp((s) => s.fxRates);
  const accounts = useApp((s) => s.accounts);
  const delAdhoc = useApp((s) => s.deleteAdhocBudget);
  const addWish = useApp((s) => s.addWishItem);
  const today = todayISO();
  const [posting, setPosting] = useState<AdhocBudget | null>(null);
  const rows = useApp((s) => s.adhocBudgets)
    .filter((a) => a.month === month || a.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  const lump = adhocTotal(rows, month, rates);
  return (
    <div>
      <SectionHead
        title={t.budget.adhoc}
        total={rows.length ? <span className="text-xs font-semibold tabular-nums text-expense">{money(-lump, "HKD", { sign: true })}</span> : null}
        action={
          <>
            <Link to="/more/adhoc" className="flex min-h-11 items-center text-xs font-medium text-accent">
              {t.budget.manageAdhoc}
            </Link>
            {rows.length ? (
              <button type="button" onClick={onAdd} aria-label={t.budget.addAdhoc} className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-accent">
                <Plus className="size-4" />
                {t.budget.addShort}
              </button>
            ) : null}
          </>
        }
      />
      {rows.length === 0 ? (
        <div className="mx-4 rounded-xl bg-elevated px-4 py-5 text-center">
          <p className="text-sm text-muted">{t.budget.adhocHint}</p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
          >
            {t.budget.adhocEmptyCta}
          </button>
        </div>
      ) : (
        <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
          {rows.map((a) => {
            const paid = Boolean(a.paidOn);
            const upcoming = !paid && a.date > today;
            const dueUnpaid = !paid && a.date <= today;
            return (
            <div key={a.id} className="border-t border-line px-4 py-3 first:border-0">
              <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => onEdit(a)}>
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium">{pickName(locale, a.label, a.labelZh)}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {dayPart(paid ? (a.paidOn ?? today) : a.date, locale)}
                    {(() => {
                      const acc = accounts.find((x) => x.id === a.accountId);
                      return acc ? ` · ${pickName(locale, acc.name, acc.nameZh)}` : "";
                    })()}
                  </div>
                </div>
                <AmountWithHkd amount={-a.amount} currency={a.currency} rates={rates} sign className="shrink-0 text-sm font-semibold text-expense" />
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint" />
              </button>
              {paid ? (
                <span className="mt-2 inline-flex rounded-full bg-success-soft px-2 py-1 text-xs font-medium text-income">{t.budget.charged}</span>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {dueUnpaid ? (
                    <span className="inline-flex rounded-full bg-watch-soft px-2 py-1 text-xs font-medium text-watch">{t.budget.awaitingPost}</span>
                  ) : upcoming ? (
                    <span className="inline-flex rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{t.budget.upcomingStatus}</span>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-11 items-center rounded-full bg-accent-soft px-4 text-xs font-medium text-accent"
                    onClick={() => setPosting(a)}
                  >
                    {t.budget.postAdhocShort}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center rounded-full bg-background px-4 text-xs font-medium"
                    onClick={async () => {
                      await addWish(wishFromAdhoc(a, locale));
                      await delAdhoc(a.id);
                      toast(t.budget.toWishlistDone);
                    }}
                  >
                    {t.budget.toWishlistShort}
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
      <PostAdhocSheet item={posting} onClose={() => setPosting(null)} />
    </div>
  );
}

export function PostAdhocSheet({ item, onClose }: { item: AdhocBudget | null; onClose: () => void }) {
  return (
    <Overlay open={item != null} onClose={onClose} variant="page">
      {item ? <PostAdhocBody key={item.id} item={item} onClose={onClose} /> : null}
    </Overlay>
  );
}

function PostAdhocBody({ item, onClose }: { item: AdhocBudget; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const addTx = useApp((s) => s.addTransaction);
  const update = useApp((s) => s.updateAdhocBudget);
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const today = todayISO();
  const [accountId, setAccountId] = useState(
    () => item.accountId || moneyAccounts.find((x) => x.type === "cash" || x.type === "current" || x.type === "savings")?.id || moneyAccounts[0]?.id || "",
  );
  const [amount, setAmount] = useState(() => String(item.amount ?? ""));
  const [currency, setCurrency] = useState<Currency>(() => (item.currency !== "MILES" ? item.currency : "HKD"));
  const cat = categories.find((c) => c.id === item.categoryId);

  async function save() {
    if (!accountId) {
      toast(t.add.account);
      return;
    }
    const amt = resolveAmountInput(amount);
    if (amt <= 0) {
      toast(t.add.needAmount);
      return;
    }
    await addTx({
      type: "expense",
      date: today,
      time: item.time,
      amount: amt,
      currency,
      accountId,
      categoryId: item.categoryId,
      payee: item.label,
      payeeZh: item.labelZh,
      note: item.label,
      adhoc: true,
      tripId: item.tripId,
      tripManual: Boolean(item.tripId),
    });
    await update({ ...item, amount: amt, currency, accountId, paidOn: today });
    onClose();
  }

  return (
    <div className="rt-sheet-in">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={() => void save()} title={t.budget.postAdhoc} />}
        keypad={
          <ActiveKeypad
            field="amount"
            amount={amount}
            dest=""
            principal=""
            interest=""
            setAmount={setAmount}
            setDest={() => undefined}
            setPrincipal={() => undefined}
            setInterest={() => undefined}
            currency={currency}
            onCurrency={setCurrency}
          />
        }
      >
        <div className="rt-enter">
          <LineRow
            label={pickName(locale, item.label, item.labelZh)}
            amount={amount}
            currency={currency}
            active
            onFocusAmount={() => undefined}
          />
        </div>
        <div className="px-4 pt-3 text-xs text-muted">{t.budget.postAdhocFrom}</div>
        <AccountLine accounts={moneyAccounts} value={accountId} onChange={(id) => {
          setAccountId(id);
          const next = accountFiat(accounts.find((a) => a.id === id)?.currency);
          if (next) setCurrency(next);
        }} placeholder={t.add.account} />
        {cat ? (
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm">
            <span className="grid size-8 place-items-center rounded-full bg-elevated">
              <CategoryIcon name={cat.icon} />
            </span>
            {categoryPath(cat, categories, locale)}
          </div>
        ) : null}
        <p className="px-4 py-3 text-xs leading-5 text-muted">{t.budget.paidToday}</p>
      </ComposerShell>
    </div>
  );
}

export function AdhocEditor({
  open,
  initial,
  month,
  lockToMonth = true,
  onClose,
}: {
  open: boolean;
  initial: AdhocBudget | null;
  month: string;
  lockToMonth?: boolean;
  onClose: () => void;
}) {
  return (
    <Overlay open={open} onClose={onClose} variant="page">
      {open ? (
        <AdhocEditorBody key={initial?.id ?? `new-${month}`} initial={initial} month={month} lockToMonth={lockToMonth} onClose={onClose} />
      ) : null}
    </Overlay>
  );
}

function AdhocEditorBody({
  initial,
  month,
  lockToMonth,
  onClose,
}: {
  initial: AdhocBudget | null;
  month: string;
  lockToMonth: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const add = useApp((s) => s.addAdhocBudget);
  const update = useApp((s) => s.updateAdhocBudget);
  const addTx = useApp((s) => s.addTransaction);
  const del = useApp((s) => s.deleteAdhocBudget);
  const addWish = useApp((s) => s.addWishItem);
  const categories = useApp((s) => s.categories);
  const accounts = useApp((s) => s.accounts);
  const trips = useApp((s) => s.trips);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const today = todayISO();
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(initial && initial.currency !== "MILES" ? initial.currency : defaultCurrency);
  const defaultDate = (() => {
    if (initial?.date) return initial.date;
    if (!today.startsWith(month)) return `${month}-28`;
    const [y, m, d] = today.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    return iso.startsWith(month) ? iso : today;
  })();
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(initial?.time || clockNow());
  const [tripId, setTripId] = useState(initial?.tripId ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [accountId, setAccountId] = useState(
    () =>
      initial?.accountId ||
      moneyAccounts.find((x) => x.type === "cash" || x.type === "current" || x.type === "savings")?.id ||
      moneyAccounts[0]?.id ||
      "",
  );
  const [pickCat, setPickCat] = useState(false);
  const [postNow, setPostNow] = useState(false);
  const cat = categories.find((c) => c.id === categoryId);
  const dateIsToday = date === today;
  const postToday = !initial && dateIsToday && postNow;

  async function save() {
    const n = name.trim();
    const amt = resolveAmountInput(amount);
    if (!n || amt <= 0) {
      toast(t.add.needAmount);
      return;
    }
    if (!accountId) {
      toast(t.add.account);
      return;
    }
    const iso = lockToMonth ? (date.startsWith(month) ? date : `${month}-28`) : date.slice(0, 7) < today.slice(0, 7) ? today : date;
    const rowMonth = lockToMonth ? month : iso.slice(0, 7);
    const row: AdhocBudget = {
      id: initial?.id ?? newId(),
      label: n,
      labelZh: n,
      amount: amt,
      currency,
      month: rowMonth,
      date: iso,
      time,
      categoryId: categoryId || undefined,
      paidOn: postToday && iso === today ? today : initial?.paidOn,
      priceCards: initial?.priceCards,
      valueCards: initial?.valueCards,
      tripId: tripId || undefined,
      accountId: accountId || undefined,
    };
    if (initial) await update(row);
    else await add(row);
    if (postToday && iso === today) {
      await addTx({
        type: "expense",
        date: today,
        time,
        amount: amt,
        currency,
        accountId,
        categoryId: categoryId || undefined,
        payee: n,
        payeeZh: n,
        note: n,
        adhoc: true,
        tripId: row.tripId,
        tripManual: Boolean(row.tripId),
      });
    }
    onClose();
  }

  if (pickCat) {
    return (
      <CategoryPicker
        categories={categories}
        kind="expense"
        selectedId={categoryId || undefined}
        onClose={() => setPickCat(false)}
        onSelect={(c) => {
          setCategoryId(c?.id ?? "");
          setPickCat(false);
          const def = resolvedDefaultAccountId(c, categories);
          if (!def || !accounts.some((a) => a.id === def)) return;
          setAccountId(def);
          const next = accountFiat(accounts.find((a) => a.id === def)?.currency);
          if (next) setCurrency(next);
        }}
      />
    );
  }

  return (
    <ComposerShell
      header={<ComposerHeader onClose={onClose} onSave={() => void save()} title={initial ? t.common.edit : lockToMonth ? t.budget.addAdhoc : t.budget.addAdhocAny} />}
      keypad={
        <ActiveKeypad
          field="amount"
          amount={amount}
          dest=""
          principal=""
          interest=""
          setAmount={setAmount}
          setDest={() => undefined}
          setPrincipal={() => undefined}
          setInterest={() => undefined}
          currency={currency}
          onCurrency={setCurrency}
        />
      }
    >
      <TextLine value={name} onChange={setName} placeholder={t.budget.regularName} />
      <button type="button" className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left" onClick={() => setPickCat(true)}>
        {cat ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-elevated">
            <CategoryIcon name={cat.icon} />
          </span>
        ) : null}
        <span className={cn("min-w-0 flex-1 text-sm", cat ? "text-foreground" : "text-muted")}>
          {cat ? categoryPath(cat, categories, locale) : t.add.pickCategory}
        </span>
      </button>
      <LineRow
        label=""
        placeholder={t.add.amount}
        amount={amount}
        currency={currency}
        active
        onFocusAmount={() => undefined}
      />
      <WhenField
        date={date}
        time={time}
        locale={locale}
        min={lockToMonth ? `${month}-01` : `${today.slice(0, 7)}-01`}
        max={lockToMonth ? monthEnd(month) : undefined}
        onDate={setDate}
        onTime={setTime}
      />
      <label className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="text-sm text-muted">{t.add.trip}</span>
        <select value={tripId} onChange={(e) => setTripId(e.target.value)} className="h-10 max-w-[14rem] bg-transparent text-right text-sm text-accent outline-none">
          <option value="">{t.reports.noneTrip}</option>
          {trips
            .filter((trip) => isTripActive(trip, today) || trip.id === tripId)
            .map((trip) => (
              <option key={trip.id} value={trip.id}>
                {pickName(locale, trip.name, trip.nameZh)}
              </option>
            ))}
        </select>
      </label>
      {!initial && dateIsToday ? (
        <div className="border-b border-line px-4 py-3">
          <div className="text-xs font-medium text-muted">{t.budget.postTodayHint}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-sm font-medium transition",
                !postNow ? "bg-accent text-on-accent" : "bg-elevated",
              )}
              onClick={() => setPostNow(false)}
            >
              {t.budget.budgetOnly}
            </button>
            <button
              type="button"
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-sm font-medium transition",
                postNow ? "bg-accent text-on-accent" : "bg-elevated",
              )}
              onClick={() => setPostNow(true)}
            >
              {t.budget.postNow}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-faint">{postNow ? t.budget.postNowHint : t.budget.budgetOnlyHint}</p>
        </div>
      ) : null}
        <AccountLine accounts={moneyAccounts} value={accountId} onChange={(id) => {
          setAccountId(id);
          const next = accountFiat(accounts.find((a) => a.id === id)?.currency);
          if (next) setCurrency(next);
        }} placeholder={t.add.account} role={t.budget.expectedAccount} />
      <p className="px-4 pb-2 text-[11px] leading-4 text-faint">{t.budget.expectedAccountHint}</p>
      {initial ? (
        <>
          {initial.paidOn || !(initial.date > today) ? null : (
            <button
              type="button"
              className="px-4 py-3 text-sm font-medium text-accent"
              onClick={async () => {
                await addWish(wishFromAdhoc(initial, locale));
                await del(initial.id);
                toast(t.budget.toWishlistDone);
                onClose();
              }}
            >
              {t.budget.toWishlist}
            </button>
          )}
          <button type="button" className="px-4 py-3 text-sm text-expense" onClick={async () => { await del(initial.id); onClose(); }}>
            {t.tx.delete}
          </button>
        </>
      ) : null}
    </ComposerShell>
  );
}

export function RegularEditor({ open, initial, onClose }: { open: boolean; initial: Recurring | null; onClose: () => void }) {
  return (
    <Overlay open={open} onClose={onClose} variant="page">
      {open ? <RegularEditorBody key={initial?.id ?? "new"} initial={initial} onClose={onClose} /> : null}
    </Overlay>
  );
}

function RegularEditorBody({ initial, onClose }: { initial: Recurring | null; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const rates = useApp((s) => s.fxRates);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const addRecurring = useApp((s) => s.addRecurring);
  const updateRecurring = useApp((s) => s.updateRecurring);
  const deleteRecurring = useApp((s) => s.deleteRecurring);
  const mortgage = useApp((s) => s.mortgage);
  const updateMortgage = useApp((s) => s.updateMortgage);
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const mate = initial?.splitWithId ? recurring.find((r) => r.id === initial.splitWithId) : null;
  const alreadySplit = Boolean(mate);
  const [kind, setKind] = useState<TxType>(
    initial?.type === "transfer" && initial.countsAsExpense ? "expense" : (initial?.type ?? "expense"),
  );
  const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
  const [amount, setAmount] = useState(initial ? String((alreadySplit ? initial.amount + (mate?.amount ?? 0) : initial.amount)) : "");
  const [currency, setCurrency] = useState<Currency>(initial && initial.currency !== "MILES" ? initial.currency : defaultCurrency);
  const [destAmount, setDestAmount] = useState(initial?.destAmount != null ? String(initial.destAmount) : "");
  const [destLocked, setDestLocked] = useState(initial?.destAmount != null);
  const [principalAmt, setPrincipalAmt] = useState(alreadySplit && initial?.type === "transfer" ? String(initial.amount) : alreadySplit && mate?.type === "transfer" ? String(mate.amount) : "");
  const [interestAmt, setInterestAmt] = useState(alreadySplit && initial?.type === "expense" ? String(initial.amount) : alreadySplit && mate?.type === "expense" ? String(mate.amount) : "");
  const [day, setDay] = useState(String(initial ? chargedDayOf(initial) : 1));
  const [accountId, setAccountId] = useState(initial?.accountId ?? moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId ?? defaultMortgageAccountId(accounts) ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [splitMortgage, setSplitMortgage] = useState(
    alreadySplit ||
      canSplitMortgage(mortgageEntryKind(categories.find((c) => c.id === initial?.categoryId), categories)),
  );
  const [living, setLiving] = useState(Boolean(initial?.living));
  const [pickCat, setPickCat] = useState(false);
  const [field, setField] = useState<"amount" | "dest" | "principal" | "interest">("amount");
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageKind = mortgageEntryKind(cat, categories);
  const showSplit = kind !== "income" && (alreadySplit || canSplitMortgage(mortgageKind));
  const principalOnly = (kind === "expense" || kind === "transfer") && mortgageKind === "principal";
  const destAcc = accounts.find((a) => a.id === toAccountId);
  const destCcy: Currency = destAcc ? asFiat(destAcc.currency, currency) : currency;
  const autoDest = autoDestAmount(resolveAmountInput(amount), currency, destCcy, rates);
  const destN = destLocked ? resolveAmountInput(destAmount) : autoDest;

  async function save() {
    const n = name.trim();
    const d = Math.min(31, Math.max(1, Number(day) || 1));
    const next = `2026-08-${String(d).padStart(2, "0")}`;
    if (showSplit && splitMortgage) {
      const p = resolveAmountInput(principalAmt);
      const i = resolveAmountInput(interestAmt);
      const pId = initial?.type === "transfer" ? initial.id : mate?.type === "transfer" ? mate.id : newId();
      const iId = initial?.type === "expense" ? initial.id : mate?.type === "expense" ? mate.id : newId();
      const pCat = categories.find((c) => isMortgagePrincipalCategory(c));
      const iCat = categories.find((c) => isMortgageInterestCategory(c));
      const dest = toAccountId || defaultMortgageAccountId(accounts) || "";
      await addRecurring({
        id: pId,
        type: "transfer",
        label: `${n} ${t.add.principal}`,
        labelZh: `${n} ${t.add.principal}`,
        amount: p,
        currency,
        accountId,
        toAccountId: dest,
        destAmount: autoDestAmount(p, currency, destCcy, rates) || p,
        categoryId: pCat?.id,
        frequency: initial?.frequency && initial.frequency !== "monthly" ? initial.frequency : "monthly",
        nextDate: next,
        chargedDay: d,
        living: true,
        countsAsExpense: true,
        splitWithId: iId,
      });
      await addRecurring({
        id: iId,
        type: "expense",
        label: `${n} ${t.add.interest}`,
        labelZh: `${n} ${t.add.interest}`,
        amount: i,
        currency,
        accountId,
        categoryId: iCat?.id,
        frequency: initial?.frequency && initial.frequency !== "monthly" ? initial.frequency : "monthly",
        nextDate: next,
        chargedDay: d,
        living: true,
        splitWithId: pId,
      });
    } else {
      const ruled = applyTxRules(
        {
          type: kind,
          amount: resolveAmountInput(amount),
          accountId,
          toAccountId: kind === "transfer" || principalOnly ? toAccountId : undefined,
          destAmount: kind === "transfer" || principalOnly ? destN || resolveAmountInput(amount) : undefined,
          categoryId: categoryId || undefined,
          housing: undefined,
          countsAsExpense: undefined,
        },
        { categories, accounts },
      );
      const row: Recurring = {
        id: initial?.id ?? newId(),
        type: ruled.type,
        label: n,
        labelZh: n,
        amount: ruled.amount,
        currency,
        accountId: ruled.accountId,
        toAccountId: ruled.toAccountId,
        destAmount: ruled.destAmount,
        categoryId: ruled.categoryId,
        frequency: initial?.frequency && initial.frequency !== "monthly" ? initial.frequency : "monthly",
        nextDate: next,
        chargedDay: d,
        living,
        countsAsExpense: ruled.countsAsExpense,
        housing: ruled.housing,
      };
      if (initial) await updateRecurring(row);
      else await addRecurring(row);
    }
    if (mortgage) {
      const latest = useApp.getState();
      const nextMortgage = mortgageFromRegulars(mortgage, latest.recurring, categories, todayISO());
      if (nextMortgage) await updateMortgage(nextMortgage);
    }
    toast(t.add.savedToast);
    onClose();
  }

  if (pickCat) {
    return (
      <CategoryPicker
        categories={categories}
        kind={kind === "income" ? "income" : "expense"}
        selectedId={categoryId || undefined}
        txType={kind}
        onTxTypeChange={(next) => {
          if (next !== "bulk") setKind(next);
        }}
        onClose={() => setPickCat(false)}
        onSelect={(c) => {
          setCategoryId(c?.id ?? "");
          const nextKind = mortgageEntryKind(c, categories);
          setSplitMortgage(alreadySplit || canSplitMortgage(nextKind));
          const def = resolvedDefaultAccountId(c, categories);
          if (def && accounts.some((a) => a.id === def)) {
            setAccountId(def);
            const next = accountFiat(accounts.find((a) => a.id === def)?.currency);
            if (next) {
              setCurrency(next);
              setDestLocked(false);
            }
          }
        }}
      />
    );
  }

  return (
    <ComposerShell
      header={<ComposerHeader onClose={onClose} onSave={() => void save()} center={<TypeSwitch value={kind} onChange={(next) => { if (next !== "bulk") setKind(next); }} />} />}
      keypad={
        <ActiveKeypad
          field={field}
          amount={amount}
          dest={destLocked ? destAmount : String(autoDest || "")}
          principal={principalAmt}
          interest={interestAmt}
          setAmount={setAmount}
          setDest={(v) => {
            setDestLocked(true);
            setDestAmount(v);
          }}
          setPrincipal={setPrincipalAmt}
          setInterest={setInterestAmt}
          currency={field === "dest" ? destCcy : currency}
          onCurrency={(c) => {
            if (field === "dest") return;
            setCurrency(c);
            setDestLocked(false);
          }}
        />
      }
    >
      <TextLine value={name} onChange={setName} placeholder={t.budget.regularName} />
      {kind === "transfer" ? (
        <>
          <AccountLine accounts={accounts} value={accountId} onChange={(id) => {
            setAccountId(id);
            const next = accountFiat(accounts.find((a) => a.id === id)?.currency);
            if (next) {
              setCurrency(next);
              setDestLocked(false);
            }
          }} placeholder={t.add.fromAccount} role={t.add.fromAccount} amount={amount} currency={currency} active={field === "amount"} onFocusAmount={() => setField("amount")} />
          <AccountLine
            accounts={accounts}
            value={toAccountId}
            onChange={(id) => {
              setToAccountId(id);
              setDestLocked(false);
            }}
            excludeId={accountId}
            placeholder={t.add.toAccount}
            role={t.add.toAccount}
            amount={destLocked ? destAmount : String(autoDest || amount || "0")}
            currency={destCcy}
            active={field === "dest"}
            onFocusAmount={() => setField("dest")}
          />
        </>
      ) : (
        <>
          <AccountLine accounts={accounts} value={accountId} onChange={(id) => {
            setAccountId(id);
            const next = accountFiat(accounts.find((a) => a.id === id)?.currency);
            if (next) {
              setCurrency(next);
              setDestLocked(false);
            }
          }} placeholder={t.add.account} />
          <LineRow
            leading={
              cat ? (
                <span className="grid size-8 place-items-center rounded-full bg-elevated">
                  <CategoryIcon name={cat.icon} />
                </span>
              ) : null
            }
            label={cat ? categoryPath(cat, categories, locale) : ""}
            placeholder={t.add.pickCategory}
            amount={showSplit && splitMortgage ? undefined : amount}
            currency={currency}
            active={field === "amount"}
            onFocusAmount={showSplit && splitMortgage ? undefined : () => setField("amount")}
            onPressLabel={() => setPickCat(true)}
          />
        </>
      )}
      {showSplit && splitMortgage ? (
        <>
          <LineRow label={t.add.principal} amount={principalAmt} currency={currency} active={field === "principal"} onFocusAmount={() => setField("principal")} />
          <LineRow label={t.add.interest} amount={interestAmt} currency={currency} active={field === "interest"} onFocusAmount={() => setField("interest")} />
          <AccountLine accounts={accounts} value={toAccountId} onChange={setToAccountId} placeholder={t.add.mortgageTo} />
        </>
      ) : null}
      <SelectLine label={t.budget.chargedDay} value={day} onChange={setDay} options={Array.from({ length: 31 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }))} />
      <ExtraIconBar
        housingOn={living}
        splitOn={splitMortgage}
        showHousing
        showSplit={showSplit}
        onHousing={() => setLiving((v) => !v)}
        onSplit={() => setSplitMortgage((v) => !v)}
      />
      {initial ? (
        <button type="button" className="px-4 py-3 text-sm text-expense" onClick={async () => { await deleteRecurring(initial.id); if (mate) await deleteRecurring(mate.id); onClose(); }}>
          {t.tx.delete}
        </button>
      ) : null}
    </ComposerShell>
  );
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const day = new Date(y, m, 0).getDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}
