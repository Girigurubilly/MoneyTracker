import { useState } from "react";
import { Plus } from "lucide-react";
import { Group, Overlay, ScreenHeader } from "@/components/shared";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { netWorthNow } from "@/lib/calc/networth";
import { accountsInGroup } from "@/lib/accounts";
import { ACCOUNT_TYPE_OPTIONS, groupForType, type Account, type AccountType } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function AssetsScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const nw = netWorthNow(accounts, rates);
  const [addOpen, setAddOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const groups: { id: Account["group"]; label: string }[] = [
    { id: "cash", label: t.assets.cash },
    { id: "credit", label: t.assets.credit },
    { id: "assets", label: t.assets.investments },
    { id: "housing", label: t.assets.housing },
    { id: "loyalty", label: t.assets.loyalty },
  ];
  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.assets.title}
        large
        right={
          <button type="button" aria-label={t.assets.addAccount} onClick={() => setAddOpen(true)} className="grid size-11 place-items-center text-accent">
            <Plus className="size-6" />
          </button>
        }
      />
      <div className="mx-4 mb-4 rounded-xl bg-elevated px-4 py-4">
        <div className="text-sm text-muted">{t.assets.netWorth}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(nw.net, "HKD")}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
          <span>
            {t.assets.totalAssets} {money(nw.assets, "HKD")}
          </span>
          <span>
            {t.assets.totalLiab} {money(nw.liab, "HKD")}
          </span>
        </div>
      </div>
      {groups.map((g) => {
        const rows = accountsInGroup(accounts, g.id).filter((a) => showHidden || !a.hidden);
        if (!rows.length) return null;
        return (
          <div key={g.id} className="mb-4">
            <h2 className="px-5 pb-1 text-sm font-medium text-muted">{g.label}</h2>
            <Group>
              {rows.map((a) => (
                <AccountRow key={a.id} a={a} />
              ))}
            </Group>
          </div>
        );
      })}
      <button type="button" className="mx-5 mt-2 text-sm text-accent" onClick={() => setShowHidden((v) => !v)}>
        {t.assets.showHidden}
      </button>
      <AddAccount open={addOpen} onClose={() => setAddOpen(false)} />
      <span className="hidden">{locale}</span>
    </div>
  );
}

function AccountRow({ a }: { a: Account }) {
  const locale = useUi((s) => s.locale);
  const update = useApp((s) => s.updateAccount);
  const [open, setOpen] = useState(false);
  const [bal, setBal] = useState(String(a.balance));
  return (
    <>
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(true)}>
        <span className="text-sm">{pickName(locale, a.name, a.nameZh)}</span>
        <span className="text-sm font-semibold tabular-nums">{money(a.balance, a.currency)}</span>
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} title={pickName(locale, a.name, a.nameZh)}>
        <div className="px-5 pb-8">
          <label className="block py-2 text-xs text-muted">
            {tAmount()}
            <input inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={a.includeInNetWorth}
              onChange={(e) => void update({ ...a, includeInNetWorth: e.target.checked })}
            />
            {useUi.getState().locale === "zh-HK" ? "計入淨資產" : "Included in net worth"}
          </label>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent"
            onClick={async () => {
              await update({ ...a, balance: Number(bal) || 0 });
              setOpen(false);
            }}
          >
            {useUi.getState().locale === "zh-HK" ? "儲存" : "Save"}
          </button>
        </div>
      </Overlay>
    </>
  );
}

function tAmount() {
  return useUi.getState().locale === "zh-HK" ? "結餘" : "Balance";
}

function AddAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const add = useApp((s) => s.addAccount);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("current");
  const [bal, setBal] = useState("0");
  return (
    <Overlay open={open} onClose={onClose} title={t.assets.addAccount}>
      <div className="px-5 pb-8">
        <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3" placeholder={locale === "zh-HK" ? "名稱" : "Name"} />
        <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className="mt-3 h-11 w-full rounded-lg bg-elevated px-3">
          {ACCOUNT_TYPE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {locale === "zh-HK" ? o.zh : o.en}
            </option>
          ))}
        </select>
        <input inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} className="mt-3 h-11 w-full rounded-lg bg-elevated px-3" />
        <button
          type="button"
          className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent"
          onClick={async () => {
            const n = name.trim() || (locale === "zh-HK" ? "帳戶" : "Account");
            await add({
              id: newId(),
              name: n,
              nameZh: n,
              type,
              currency: type === "miles" ? "MILES" : "HKD",
              balance: Number(bal) || 0,
              includeInNetWorth: type !== "miles",
              group: groupForType(type),
            });
            onClose();
          }}
        >
          {t.add.save}
        </button>
      </div>
    </Overlay>
  );
}
