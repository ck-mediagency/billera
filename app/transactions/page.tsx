"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import type { AppState } from "@/lib/types";
import { loadState, saveState } from "@/lib/storage";
import {
  IMPORTANT_CURRENCIES,
  normalizeCur,
  ratesFromState,
  txValueInBase,
  roundMoney,
  type FxRatesToUSD,
} from "@/lib/fx";
import { supabase } from "@/lib/supabaseClient";

type ExtendedState = AppState & {
  incomeBuckets?: { id: string; name: string; percent?: number }[];
  expenseBuckets?: { id: string; name: string; percent?: number }[];
  monthlyIncomeTarget?: number;
  lang?: "ar" | "en" | "de";
  fxRatesToUSD?: FxRatesToUSD;
};

function defaultState(): ExtendedState {
  return {
    baseCurrency: "USD",
    accounts: [],
    txs: [],
    incomeBuckets: [],
    expenseBuckets: [],
    monthlyIncomeTarget: 3000,
    lang: "ar",
    fxRatesToUSD: undefined,
  };
}

function r2(x: number) {
  return Math.round(x * 100) / 100;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function monthKeyFromISO(iso: string) {
  return iso.slice(0, 7);
}
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function yearFromKey(key: string) {
  return Number(key.slice(0, 4));
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const AR_MONTHS_SHORT = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

const CARD: React.CSSProperties = {
  background: "white",
  border: "none",
  borderRadius: 20,
  boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
};

function pill(active: boolean) {
  return {
    borderRadius: 999,
    padding: "9px 14px",
    fontWeight: 900 as const,
    border: "none",
    cursor: "pointer",
    background: active ? "rgba(50,194,182,0.16)" : "rgba(0,0,0,0.05)",
    color: active ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.75)",
    boxShadow: active ? "inset 0 0 0 1px rgba(50,194,182,0.25)" : "inset 0 0 0 1px rgba(0,0,0,0.04)",
  } as React.CSSProperties;
}

function fieldWrap(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 12,
    background: "rgba(0,0,0,0.04)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
    display: "grid",
    gap: 10,
  };
}
function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    border: "none",
    outline: "none",
    borderRadius: 14,
    padding: "12px 12px",
    fontWeight: 900,
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
  };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" };
}

function niceAxis(max: number) {
  const m = Math.max(1, Math.round(max));
  return [0, Math.round(m * 0.25), Math.round(m * 0.5), Math.round(m * 0.75), m];
}

/** ✅ مخطط سنة RTL */
function YearBarsRTL({
  title,
  subtitle,
  values,
  maxY,
  baseCur,
}: {
  title: string;
  subtitle: string;
  values: number[];
  maxY: number;
  baseCur: string;
}) {
  const W = 900;
  const H = 190;

  const leftPad = 70;
  const rightPad = 20;
  const topPad = 18;
  const bottomPad = 42;

  const plotW = W - leftPad - rightPad;
  const plotH = H - topPad - bottomPad;

  const safeMax = Math.max(1, maxY);
  const ticks = niceAxis(safeMax);

  const barW = plotW / 12;
  const radius = 22;

  function yOf(v: number) {
    const p = clamp(v / safeMax, 0, 1);
    return topPad + (1 - p) * plotH;
  }

  const displayValues = [...values].reverse();
  const displayLabels = [...AR_MONTHS_SHORT].reverse();

  return (
    <section
      style={{
        ...CARD,
        padding: 14,
        background:
          "linear-gradient(135deg, rgba(50,194,182,0.14) 0%, rgba(50,194,182,0.08) 45%, rgba(255,255,255,0.55) 100%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>{title}</div>
          <div style={{ fontSize: 12, marginTop: 4, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>هذا الشهر</div>
      </div>

      <div style={{ marginTop: 10, overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", paddingBottom: 6 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {ticks.map((t, i) => {
            const y = yOf(t);
            return (
              <g key={i}>
                <line x1={leftPad} y1={y} x2={W - rightPad} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                <text x={W - rightPad + 16} y={y + 4} textAnchor="start" fontSize="11" fill="rgba(0,0,0,0.55)" fontWeight="900">
                  {t}
                </text>
              </g>
            );
          })}

          {displayValues.map((raw, idx) => {
            const v = r2(Number(raw || 0));
            const x = leftPad + idx * barW + barW * 0.2;
            const bw = barW * 0.6;

            const h = clamp((v / safeMax) * plotH, 0, plotH);
            const y = topPad + (plotH - h);
            const rr = Math.min(radius, bw / 2, h / 2);

            return (
              <g key={idx}>
                <rect x={x} y={topPad} width={bw} height={plotH} rx={22} ry={22} fill="rgba(0,0,0,0.03)" stroke="rgba(0,0,0,0.04)" />
                <rect x={x} y={y} width={bw} height={h} rx={rr} ry={rr} fill="rgba(50,194,182,0.75)" />

                <text x={x + bw / 2} y={Math.max(topPad + 12, y - 8)} textAnchor="middle" fontSize="13" fill="rgba(0,0,0,0.70)" fontWeight="900">
                  {v}
                </text>

                <text x={x + bw / 2} y={H - 14} textAnchor="middle" fontSize="13" fill="rgba(0,0,0,0.80)" fontWeight="900">
                  {displayLabels[idx]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)", textAlign: "center" }}>
        كل القيم المذكورة بالعملة الأساسية للحساب ({baseCur})
      </div>
    </section>
  );
}

function progressBar() {
  return {
    height: 10,
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    position: "relative" as const,
  };
}

/** ✅ قيمة بالعملة الأساسية: أولاً baseAmount (ثابت) ثم fallback قديم */
function baseValue(t: any, baseCur: string, state: any): number {
  if (typeof t?.baseAmount === "number" && Number.isFinite(t.baseAmount)) return r2(Number(t.baseAmount));
  const rates = ratesFromState(state);
  return roundMoney(txValueInBase(t, baseCur, rates), 2);
}

/** ✅ قيمة العملية كما دُفعت */
function paidValue(t: any) {
  const cur = normalizeCur(t?.currency || "");
  const amt = Number(t?.amount);
  return {
    cur: cur || "—",
    amountAbs: r2(Number.isFinite(amt) ? Math.abs(amt) : 0),
  };
}

function IconChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="rgba(0,0,0,0.70)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ✅ MultiSelect فخم وبسيط: checkboxes + chips */
function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedNames = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o.name]));
    return selected.map((id) => map.get(id) || id);
  }, [selected, options]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div style={fieldWrap()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={labelStyle()}>{label}</div>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              border: "none",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 12,
              color: "rgba(0, 0, 0, 0.7)",
              background: "transparent",
              textDecoration: "underline",
            }}
          >
            مسح
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputStyle(),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          textAlign: "right",
          cursor: "pointer",
        }}
      >
        <span style={{ color: selected.length ? "rgba(0,0,0,0.86)" : "rgba(0,0,0,0.45)" }}>
          {selected.length ? `مختار: ${selected.length}` : placeholder}
        </span>
        <span style={{ width: 34, height: 34, borderRadius: 14, background: "rgba(0,0,0,0.05)", display: "grid", placeItems: "center" }}>
          <IconChevronDown />
        </span>
      </button>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {selectedNames.slice(0, 6).map((name, idx) => (
            <span
              key={idx}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                background: "rgba(50,194,182,0.14)",
                boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.18)",
              }}
            >
              {name}
            </span>
          ))}
          {selectedNames.length > 6 && (
            <span style={{ padding: "8px 10px", borderRadius: 999, fontWeight: 900, fontSize: 12, background: "rgba(0,0,0,0.06)" }}>
              +{selectedNames.length - 6}
            </span>
          )}
        </div>
      )}

      {open && (
        <div
          style={{
            borderRadius: 18,
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 18px 55px rgba(0,0,0,0.14)",
            border: "1px solid rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div style={{ maxHeight: 240, overflow: "auto", padding: 10, display: "grid", gap: 8 }}>
            {options.map((o) => {
              const active = selectedSet.has(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "right",
                    padding: "12px 12px",
                    borderRadius: 16,
                    background: active ? "rgba(50,194,182,0.18)" : "rgba(0,0,0,0.04)",
                    boxShadow: active ? "inset 0 0 0 1px rgba(50,194,182,0.30)" : "inset 0 0 0 1px rgba(0,0,0,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    fontWeight: 900,
                  }}
                >
                  <span style={{ color: "#000", fontWeight: 900 }}>{o.name}</span>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 12,
                      background: active ? "rgba(50,194,182,0.34)" : "rgba(0,0,0,0.05)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 900,
                    }}
                  >
                    {active ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ padding: 10, display: "flex", gap: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                flex: 1,
                border: "none",
                cursor: "pointer",
                borderRadius: 16,
                padding: "12px 12px",
                fontWeight: 900,
                background: "rgba(50,194,182,0.18)",
                boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.20)",
                color: "#000",
              }}
            >
              تم
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** ✅ Supabase row shape */
type DbTxRow = {
  id: string;
  user_id: string;
  kind: "income" | "expense";
  amount: number;
  currency: string;
  account_id: string;
  date_iso: string;
  note?: string | null;
  bucket_id?: string | null;
  base_amount?: number | null;
  base_currency_snapshot?: string | null;
};

function rowToTx(r: DbTxRow) {
  return {
    id: r.id,
    kind: r.kind,
    amount: Number(r.amount),
    currency: normalizeCur(r.currency || "USD"),
    accountId: r.account_id,
    dateISO: r.date_iso,
    note: (r.note ?? "").toString(),
    bucketId: r.bucket_id ?? undefined,
    baseAmount: r.base_amount ?? undefined,
    baseCurrencySnapshot: r.base_currency_snapshot ?? undefined,
  };
}

type DbAccountRow = { id: string; user_id: string; name: string; currency: string };
type DbBucketRow = { id: string; user_id: string; name: string; kind: "income" | "expense"; percent?: number | null };

export default function TransactionsArchivePage() {
  const [state, setState] = useState<ExtendedState>(defaultState());
  const [hydrated, setHydrated] = useState(false);

  // ✅ NEW: local storage per user
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const localUserIdRef = useRef<string | null>(null);

  const [sbLoading, setSbLoading] = useState(true);
  const [sbError, setSbError] = useState("");

  const baseCur = normalizeCur(state.baseCurrency || "USD");
  const [tab, setTab] = useState<"expense" | "income">("expense");

  function refreshLocal(uid: string | null) {
    const s = loadState(uid) as ExtendedState | null;
    if (s) {
      setState({
        ...defaultState(),
        ...s,
        incomeBuckets: s.incomeBuckets ?? [],
        expenseBuckets: s.expenseBuckets ?? [],
        monthlyIncomeTarget:
          Number.isFinite((s as any).monthlyIncomeTarget) && Number((s as any).monthlyIncomeTarget) > 0
            ? Number((s as any).monthlyIncomeTarget)
            : 3000,
        fxRatesToUSD: (s as any).fxRatesToUSD,
      });
    } else {
      setState(defaultState());
    }
  }

  // ✅ init: get uid then load local with uid
  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id ?? null;
        if (!alive) return;

        localUserIdRef.current = uid;
        setLocalUserId(uid);

        refreshLocal(uid);
        setHydrated(true);
      } catch {
        if (!alive) return;
        localUserIdRef.current = null;
        setLocalUserId(null);
        refreshLocal(null);
        setHydrated(true);
      }
    }

    init();

    const onFocus = () => refreshLocal(localUserIdRef.current);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshLocal(localUserIdRef.current);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ✅ keep ref in sync + reload local when user changes
  useEffect(() => {
    localUserIdRef.current = localUserId;
    if (!hydrated) return;
    refreshLocal(localUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localUserId]);

  // ✅ save per-user
  useEffect(() => {
    if (!hydrated) return;
    saveState(state as any, localUserId);
  }, [state, hydrated, localUserId]);

  // ✅ تحميل Accounts + Buckets من Supabase
  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) return;

        const userId = session.user.id;

        const acc = await supabase.from("accounts").select("id,user_id,name,currency").eq("user_id", userId);
        const buc = await supabase.from("buckets").select("id,user_id,name,kind,percent").eq("user_id", userId);

        if (!alive) return;

        if (!acc.error && Array.isArray(acc.data)) {
          const accounts = (acc.data as DbAccountRow[]).map((a) => ({
            id: String(a.id),
            name: String(a.name),
            currency: normalizeCur(a.currency || "USD"),
          }));
          setState((prev) => ({ ...prev, accounts }));
        }

        if (!buc.error && Array.isArray(buc.data)) {
          const rows = buc.data as DbBucketRow[];
          const incomeBuckets = rows
            .filter((b) => b.kind === "income")
            .map((b) => ({ id: String(b.id), name: String(b.name), percent: b.percent ?? undefined }));
          const expenseBuckets = rows
            .filter((b) => b.kind === "expense")
            .map((b) => ({ id: String(b.id), name: String(b.name), percent: b.percent ?? undefined }));

          setState((prev) => ({ ...prev, incomeBuckets, expenseBuckets }));
        }
      } catch {
        // ignore
      }
    }

    loadMeta();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ تحميل txs من Supabase + Migration أول مرة (مع تنظيف FK)
  useEffect(() => {
    let alive = true;

    async function loadTxsFromSupabase() {
      setSbLoading(true);
      setSbError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session) {
          if (alive) {
            setSbError("لا يوجد جلسة دخول. سجّل دخول أولاً.");
            setSbLoading(false);
          }
          return;
        }

        const userId = session.user.id;

        // 0) نجيب meta ids لضمان FK
        const [accRes, bucRes] = await Promise.all([
          supabase.from("accounts").select("id").eq("user_id", userId),
          supabase.from("buckets").select("id").eq("user_id", userId),
        ]);

        const accIds = new Set<string>((accRes.data ?? []).map((a: any) => String(a.id)));
        const bucIds = new Set<string>((bucRes.data ?? []).map((b: any) => String(b.id)));

        // 1) fetch existing
        const existing = await supabase
          .from("transactions")
          .select("id,user_id,kind,amount,currency,account_id,date_iso,note,bucket_id,base_amount,base_currency_snapshot")
          .eq("user_id", userId);

        if (existing.error) throw new Error(existing.error.message);

        const sbTxs = (existing.data ?? []) as DbTxRow[];

        // 2) if empty -> migrate from GUEST local (قبل تسجيل الدخول)
        if (sbTxs.length === 0) {
          const guest = loadState(null) as ExtendedState | null;
          const localTxs = (guest?.txs ?? []) as any[];

          if (localTxs.length > 0) {
            const payload = localTxs
              .filter((t) => t?.id && t?.dateISO && t?.accountId && t?.currency && t?.kind)
              .filter((t) => accIds.has(String(t.accountId))) // ✅ FK accounts
              .map((t) => ({
                id: String(t.id),
                user_id: userId,
                kind: t.kind === "income" ? "income" : "expense",
                amount: Number(t.amount) || 0,
                currency: normalizeCur(t.currency || "USD"),
                account_id: String(t.accountId),
                date_iso: String(t.dateISO),
                note: (t.note ?? "").toString(),
                bucket_id: t.bucketId && bucIds.has(String(t.bucketId)) ? String(t.bucketId) : null, // ✅ FK buckets
                base_amount: typeof t.baseAmount === "number" ? Number(t.baseAmount) : null,
                base_currency_snapshot: t.baseCurrencySnapshot ? String(t.baseCurrencySnapshot) : null,
                updated_at: new Date().toISOString(),
              }));

            if (payload.length > 0) {
              const ins = await supabase.from("transactions").upsert(payload, { onConflict: "id" });
              if (ins.error) throw new Error(ins.error.message);
            }
          }
        }

        // 3) refetch ordered by date
        const res = await supabase
          .from("transactions")
          .select("id,user_id,kind,amount,currency,account_id,date_iso,note,bucket_id,base_amount,base_currency_snapshot")
          .eq("user_id", userId)
          .order("date_iso", { ascending: false });

        if (res.error) throw new Error(res.error.message);

        const finalRows = (res.data ?? []) as DbTxRow[];
        const finalTxs = finalRows.map(rowToTx);

        if (!alive) return;

        // ✅ ensure userId for local save
        localUserIdRef.current = userId;
        setLocalUserId(userId);

        setState((prev) => ({ ...prev, txs: finalTxs }));
        setSbLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setSbError(e?.message || "فشل تحميل العمليات من Supabase");
        setSbLoading(false);
      }
    }

    loadTxsFromSupabase();
    return () => {
      alive = false;
    };
  }, []);

  const today = todayISO();
  const thisMonthKey = monthKeyFromISO(today);
  const [monthOpen, setMonthOpen] = useState(false);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const t of state.txs ?? []) {
      if (!t?.dateISO) continue;
      set.add(monthKeyFromISO(t.dateISO));
    }
    const arr = Array.from(set);
    arr.sort((a, b) => b.localeCompare(a));
    if (arr.length > 0) return arr;

    const y = Number(thisMonthKey.slice(0, 4));
    const fallback = Array.from({ length: 12 }, (_, i) => `${y}-${pad2(i + 1)}`);
    fallback.sort((a, b) => b.localeCompare(a));
    return fallback;
  }, [state.txs, thisMonthKey]);

  const [selectedMonthKey, setSelectedMonthKey] = useState(thisMonthKey);

  useEffect(() => {
    if (!availableMonths.includes(selectedMonthKey)) {
      setSelectedMonthKey(availableMonths[0] || thisMonthKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMonths.join("|")]);

  const selectedYear = yearFromKey(selectedMonthKey);
  const monthlyTarget = Math.max(1, Math.round(Number(state.monthlyIncomeTarget || 3000)));

  const yearSeries = useMemo(() => {
    const income = Array(12).fill(0) as number[];
    const expense = Array(12).fill(0) as number[];

    for (const t of state.txs ?? []) {
      if (!t?.dateISO) continue;
      const y = Number(t.dateISO.slice(0, 4));
      if (y !== selectedYear) continue;
      const m = Number(t.dateISO.slice(5, 7));
      if (!m || m < 1 || m > 12) continue;

      const v = baseValue(t, baseCur, state);
      if (t.kind === "income") income[m - 1] += v;
      else expense[m - 1] += Math.abs(v);
    }

    return { income: income.map(r2), expense: expense.map(r2) };
  }, [state, state.txs, selectedYear, baseCur]);

  const breakdownBoth = useMemo(() => {
    function build(kind: "income" | "expense") {
      const map = new Map<string, number>();

      for (const t of state.txs ?? []) {
        if (!t?.dateISO) continue;
        if (monthKeyFromISO(t.dateISO) !== selectedMonthKey) continue;
        if (t.kind !== kind) continue;

        const v = baseValue(t, baseCur, state);
        const key = (t as any).bucketId || "no_bucket";
        map.set(key, (map.get(key) || 0) + Math.abs(v));
      }

      const buckets = kind === "income" ? state.incomeBuckets ?? [] : state.expenseBuckets ?? [];
      const nameById = new Map<string, string>();
      for (const b of buckets) nameById.set(b.id, b.name);

      const items = Array.from(map.entries()).map(([bucketId, amount]) => ({
        bucketId,
        name: bucketId === "no_bucket" ? "بدون تصنيف" : nameById.get(bucketId) || "صندوق (محذوف)",
        amount: r2(amount),
      }));

      items.sort((a, b) => b.amount - a.amount);
      const total = items.reduce((s, x) => s + x.amount, 0);
      return { items, total: r2(total) };
    }

    return { income: build("income"), expense: build("expense") };
  }, [state, state.txs, state.incomeBuckets, state.expenseBuckets, selectedMonthKey, baseCur]);

  const monthTxsFiltered = useMemo(() => {
    return (state.txs ?? [])
      .filter((t) => t?.dateISO && monthKeyFromISO(t.dateISO) === selectedMonthKey)
      .filter((t) => t.kind === tab)
      .slice()
      .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)));
  }, [state.txs, selectedMonthKey, tab]);

  async function deleteTx(id: string) {
    const ok = confirm("أكيد بدك تحذف هالعملية؟");
    if (!ok) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    const del = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId);
    if (del.error) {
      alert(del.error.message);
      return;
    }

    setState((prev) => ({ ...prev, txs: (prev.txs ?? []).filter((t) => t.id !== id) }));
  }

  // =============================
  // ✅ Edit Modal
  // =============================
  const [editOpen, setEditOpen] = useState(false);
  const [editTxId, setEditTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({
    kind: "expense",
    amount: "",
    currency: baseCur,
    accountId: "",
    dateISO: todayISO(),
    note: "",
    bucketId: "no_bucket",
  });

  function openEdit(t: any) {
    setEditTxId(t.id);
    setEditForm({
      kind: t.kind || "expense",
      amount: String(Number.isFinite(Number(t.amount)) ? Number(t.amount) : ""),
      currency: normalizeCur(t.currency || baseCur),
      accountId: t.accountId || "",
      dateISO: t.dateISO || todayISO(),
      note: (t.note ?? "").toString(),
      bucketId: (t as any).bucketId || "no_bucket",
    });
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditTxId(null);
  }

  async function saveEdit() {
    if (!editTxId) return;

    const amt = Number(editForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("حط مبلغ صحيح أكبر من 0");
      return;
    }

    const next = {
      kind: editForm.kind === "income" ? "income" : "expense",
      amount: r2(amt),
      currency: normalizeCur(editForm.currency || baseCur),
      accountId: editForm.accountId || "",
      dateISO: editForm.dateISO || todayISO(),
      note: (editForm.note ?? "").toString(),
      bucketId: editForm.bucketId && editForm.bucketId !== "no_bucket" ? editForm.bucketId : undefined,
    };

    const ratesToUSD = ratesFromState(state);
    const computedBase = roundMoney(txValueInBase({ ...next }, baseCur, ratesToUSD), 2);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    const up = await supabase
      .from("transactions")
      .update({
        kind: next.kind,
        amount: next.amount,
        currency: next.currency,
        account_id: next.accountId,
        date_iso: next.dateISO,
        note: next.note,
        bucket_id: next.bucketId ? next.bucketId : null,
        base_amount: computedBase,
        base_currency_snapshot: baseCur,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editTxId)
      .eq("user_id", userId);

    if (up.error) {
      alert(up.error.message);
      return;
    }

    setState((prev) => ({
      ...prev,
      txs: (prev.txs ?? []).map((t: any) => {
        if (t.id !== editTxId) return t;
        return { ...t, ...next, baseAmount: computedBase, baseCurrencySnapshot: baseCur };
      }),
    }));

    closeEdit();
  }

  // =============================
  // ✅ Filters
  // =============================
  const [filtersOpen, setFiltersOpen] = useState(false);
  type DateMode = "any" | "exact" | "range";

  const [filters, setFilters] = useState<{
    accountIds: string[];
    currencies: string[];
    bucketIds: string[];
    q: string;
    dateMode: DateMode;
    dateExact: string;
    dateFrom: string;
    dateTo: string;
  }>({
    accountIds: [],
    currencies: [],
    bucketIds: [],
    q: "",
    dateMode: "any",
    dateExact: "",
    dateFrom: "",
    dateTo: "",
  });

  const accountOptions = useMemo(
    () =>
      (state.accounts ?? []).map((a: any) => ({
        id: String(a.id),
        name: `${a.name} · ${normalizeCur(a.currency)}`,
      })),
    [state.accounts]
  );

  const currencyOptions = useMemo(
    () =>
      IMPORTANT_CURRENCIES.map((c) => ({
        id: c,
        name: c,
      })),
    []
  );

  const bucketOptions = useMemo(() => {
    const buckets = tab === "income" ? state.incomeBuckets ?? [] : state.expenseBuckets ?? [];
    return [{ id: "no_bucket", name: "بدون تصنيف" }, ...buckets.map((b: any) => ({ id: String(b.id), name: b.name }))];
  }, [tab, state.incomeBuckets, state.expenseBuckets]);

  const monthTxsFinal = useMemo(() => {
    const q = (filters.q ?? "").trim().toLowerCase();

    return monthTxsFiltered.filter((t: any) => {
      if (filters.accountIds.length > 0) {
        if (!filters.accountIds.includes(String(t.accountId || ""))) return false;
      }

      if (filters.currencies.length > 0) {
        const cur = normalizeCur(t.currency || "");
        if (!filters.currencies.map(normalizeCur).includes(cur)) return false;
      }

      if (filters.bucketIds.length > 0) {
        const bid = (t as any).bucketId || "no_bucket";
        if (!filters.bucketIds.includes(String(bid))) return false;
      }

      const d = String(t.dateISO || "");
      if (filters.dateMode === "exact") {
        if (filters.dateExact && d !== filters.dateExact) return false;
      } else if (filters.dateMode === "range") {
        if (filters.dateFrom && d < filters.dateFrom) return false;
        if (filters.dateTo && d > filters.dateTo) return false;
      }

      if (q) {
        const note = String(t.note || "").toLowerCase();
        if (!note.includes(q)) return false;
      }

      return true;
    });
  }, [monthTxsFiltered, filters]);

  const filtersActive =
    filters.accountIds.length > 0 ||
    filters.currencies.length > 0 ||
    filters.bucketIds.length > 0 ||
    (filters.q || "").trim() !== "" ||
    filters.dateMode !== "any";

  function resetFilters() {
    setFilters({
      accountIds: [],
      currencies: [],
      bucketIds: [],
      q: "",
      dateMode: "any",
      dateExact: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  // =============================
  // UI
  // =============================
  return (
    <main
      dir="rtl"
      style={{
        padding: 16,
        paddingBottom: 140,
        maxWidth: 560,
        margin: "0 auto",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F2F5F7 0%, #EEF2F5 55%, #EEF2F5 100%)",
      }}
    >
      {/* Header */}
      <header style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>الأرشيف</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {baseCur} · {selectedMonthKey}
          </div>

          {sbLoading ? (
            <div style={{ fontSize: 12, marginTop: 6, color: "rgba(0,0,0,0.55)", fontWeight: 800 }}>جاري تحميل العمليات…</div>
          ) : sbError ? (
            <div style={{ fontSize: 12, marginTop: 6, color: "rgba(180,0,0,0.85)", fontWeight: 900 }}>{sbError}</div>
          ) : null}
        </div>

        <a
          href="/"
          style={{
            borderRadius: 14,
            padding: "10px 12px",
            fontWeight: 900,
            textDecoration: "none",
            color: "#000",
            background: "rgba(255,255,255,0.92)",
            border: "none",
            boxShadow: "0 8px 22px rgba(0,0,0,0.04)",
          }}
        >
          رجوع
        </a>
      </header>

      {/* Tabs + Month Dropdown */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" onClick={() => setTab("income")} style={pill(tab === "income")}>
          دخل
        </button>
        <button type="button" onClick={() => setTab("expense")} style={pill(tab === "expense")}>
          مصاريف
        </button>

        <div style={{ marginInlineStart: "auto", position: "relative" }}>
          <button
            type="button"
            onClick={() => setMonthOpen((v) => !v)}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 18,
              padding: "12px 12px",
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 150,
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: 900, color: "rgba(0,0,0,0.85)" }}>{selectedMonthKey}</span>
            <span style={{ width: 34, height: 34, borderRadius: 14, background: "rgba(0,0,0,0.05)", display: "grid", placeItems: "center" }}>
              <IconChevronDown />
            </span>
          </button>

          {monthOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                left: 0,
                zIndex: 60,
                borderRadius: 20,
                background: "rgba(255,255,255,0.96)",
                boxShadow: "0 22px 60px rgba(0,0,0,0.18)",
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.06)",
                backdropFilter: "blur(10px)",
              }}
            >
              <div style={{ maxHeight: 280, overflow: "auto", padding: 10 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  {availableMonths.map((k) => {
                    const active = k === selectedMonthKey;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSelectedMonthKey(k);
                          setMonthOpen(false);
                        }}
                        style={{
                          border: "none",
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "right",
                          padding: "12px 12px",
                          borderRadius: 16,
                          background: active ? "rgba(50,194,182,0.18)" : "rgba(0,0,0,0.04)",
                          boxShadow: active ? "inset 0 0 0 1px rgba(50,194,182,0.32)" : "inset 0 0 0 1px rgba(0,0,0,0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontWeight: 900, color: "#000" }}>{k}</span>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 12,
                            background: active ? "rgba(50,194,182,0.34)" : "rgba(0,0,0,0.05)",
                            display: "grid",
                            placeItems: "center",
                            color: "#000",
                            fontWeight: 900,
                          }}
                        >
                          {active ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ marginTop: 12 }}>
        {tab === "income" ? (
          <YearBarsRTL title="مخطط السنة" subtitle={`مقارنة شهرية لعام ${selectedYear}`} values={yearSeries.income} maxY={monthlyTarget} baseCur={baseCur} />
        ) : (
          <YearBarsRTL title="مخطط السنة" subtitle={`مقارنة شهرية لعام ${selectedYear}`} values={yearSeries.expense} maxY={monthlyTarget} baseCur={baseCur} />
        )}
      </div>

      {/* Breakdown */}
      <section style={{ ...CARD, marginTop: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>تفصيل التصنيفات ({selectedMonthKey})</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 900 }}>
            هذا الشهر
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Expense */}
          <div style={{ borderRadius: 20, background: "rgba(0,0,0,0.02)", padding: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 16,
                background: "rgba(50,194,182,0.10)",
                boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.20)",
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(50,194,182,0.85)", boxShadow: "0 6px 14px rgba(50,194,182,0.25)" }} />
                <div style={{ fontWeight: 900, fontSize: 18, color: "rgba(0,0,0,0.88)" }}>صرف</div>
              </div>

              <div style={{ fontWeight: 900, fontSize: 16, color: "rgba(0,0,0,0.85)" }}>
                {baseCur} {breakdownBoth.expense.total}
              </div>
            </div>

            <div style={{ marginTop: 10, maxHeight: 240, overflow: "auto", paddingRight: 4, display: "grid", gap: 12 }}>
              {breakdownBoth.expense.items.map((b) => {
                const p = breakdownBoth.expense.total > 0 ? Math.round((b.amount / breakdownBoth.expense.total) * 100) : 0;
                return (
                  <div key={b.bucketId}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900 }}>{b.name}</div>
                      <div style={{ fontWeight: 900 }}>
                        {baseCur} {b.amount}
                      </div>
                    </div>
                    <div style={{ marginTop: 8, ...progressBar() }}>
                      <div style={{ height: "100%", width: `${p}%`, background: "rgba(50,194,182,0.70)" }} />
                    </div>
                  </div>
                );
              })}
              {breakdownBoth.expense.items.length === 0 && <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.45)" }}>لا يوجد تصنيفات صرف .</div>}
            </div>
          </div>

          {/* Income */}
          <div style={{ borderRadius: 20, background: "rgba(0,0,0,0.02)", padding: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 16,
                background: "rgba(50,194,182,0.10)",
                boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.20)",
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(50,194,182,0.85)", boxShadow: "0 6px 14px rgba(50,194,182,0.25)" }} />
                <div style={{ fontWeight: 900, fontSize: 18, color: "rgba(0,0,0,0.88)" }}>دخل</div>
              </div>

              <div style={{ fontWeight: 900, fontSize: 16, color: "rgba(0,0,0,0.85)" }}>
                {baseCur} {breakdownBoth.income.total}
              </div>
            </div>

            <div style={{ marginTop: 10, maxHeight: 240, overflow: "auto", paddingRight: 4, display: "grid", gap: 12 }}>
              {breakdownBoth.income.items.map((b) => {
                const p = breakdownBoth.income.total > 0 ? Math.round((b.amount / breakdownBoth.income.total) * 100) : 0;
                return (
                  <div key={b.bucketId}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900 }}>{b.name}</div>
                      <div style={{ fontWeight: 900 }}>
                        {baseCur} {b.amount}
                      </div>
                    </div>
                    <div style={{ marginTop: 8, ...progressBar() }}>
                      <div style={{ height: "100%", width: `${p}%`, background: "rgba(50,194,182,0.70)" }} />
                    </div>
                  </div>
                );
              })}
              {breakdownBoth.income.items.length === 0 && <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.45)" }}>لا يوجد تصنيفات دخل  .</div>}
            </div>
          </div>
        </div>
      </section>

      {/* ✅ العمليات + الفلاتر */}
      <section style={{ ...CARD, marginTop: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            العمليات ({monthTxsFinal.length}/{monthTxsFiltered.length}) — {tab === "income" ? "دخل" : "صرف"}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 14,
              padding: "10px 12px",
              fontWeight: 900,
              background: filtersActive ? "rgba(50,194,182,0.20)" : "rgba(0,0,0,0.06)",
              boxShadow: filtersActive ? "inset 0 0 0 1px rgba(50,194,182,0.28)" : "inset 0 0 0 1px rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.85)",
            }}
          >
            فلترة {filtersActive ? "•" : ""}
          </button>
        </div>

        {filtersOpen && (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <MultiSelect
                label="المحفظة"
                placeholder="اختر محفظة/محفظات"
                options={accountOptions}
                selected={filters.accountIds}
                onChange={(next) => setFilters((p) => ({ ...p, accountIds: next }))}
              />

              <MultiSelect
                label="العملة"
                placeholder="اختر عملة/عملات"
                options={currencyOptions}
                selected={filters.currencies}
                onChange={(next) => setFilters((p) => ({ ...p, currencies: next }))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <MultiSelect
                label="التصنيف"
                placeholder="اختر تصنيف/تصنيفات"
                options={bucketOptions}
                selected={filters.bucketIds}
                onChange={(next) => setFilters((p) => ({ ...p, bucketIds: next }))}
              />

              <div style={fieldWrap()}>
                <div style={labelStyle()}>بحث (اسم/ملاحظة)</div>
                <input
                  value={filters.q}
                  onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                  style={inputStyle()}
                  placeholder="مثال: إيجار، راتب..."
                />
              </div>
            </div>

            <div style={fieldWrap()}>
              <div style={labelStyle()}>التاريخ</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setFilters((p) => ({ ...p, dateMode: "any", dateExact: "", dateFrom: "", dateTo: "" }))} style={pill(filters.dateMode === "any")}>
                  الكل
                </button>
                <button type="button" onClick={() => setFilters((p) => ({ ...p, dateMode: "exact", dateFrom: "", dateTo: "" }))} style={pill(filters.dateMode === "exact")}>
                  تاريخ محدد
                </button>
                <button type="button" onClick={() => setFilters((p) => ({ ...p, dateMode: "range", dateExact: "" }))} style={pill(filters.dateMode === "range")}>
                  مدة زمنية
                </button>
              </div>

              {filters.dateMode === "exact" && (
                <input type="date" value={filters.dateExact} onChange={(e) => setFilters((p) => ({ ...p, dateExact: e.target.value }))} style={inputStyle()} />
              )}

              {filters.dateMode === "range" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={labelStyle()}>من</div>
                    <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))} style={inputStyle()} />
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={labelStyle()}>إلى</div>
                    <input type="date" value={filters.dateTo} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))} style={inputStyle()} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  flex: 1,
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 18,
                  padding: "14px 14px",
                  fontWeight: 900,
                  background: "rgba(0,0,0,0.06)",
                  color: "rgba(0,0,0,0.85)",
                }}
              >
                تصفير الفلاتر
              </button>

              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                style={{
                  flex: 1,
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 18,
                  padding: "14px 14px",
                  fontWeight: 900,
                  background: "rgba(50,194,182,0.14)",
                  boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.22)",
                  color: "#000",
                }}
              >
                إخفاء
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {monthTxsFinal.map((t: any) => {
            const { cur, amountAbs } = paidValue(t);
            const kindLabel = t.kind === "income" ? "دخل" : "صرف";
            const note = (t.note ?? "").trim();
            const date = t.dateISO ?? "";

            return (
              <div
                key={t.id}
                style={{
                  borderRadius: 18,
                  background: "rgba(0,0,0,0.02)",
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 22 }}>
                    {cur} {amountAbs}
                  </div>
                  <div className="text-muted" style={{ fontWeight: 800 }}>
                    {note ? `${note} · ` : ""}
                    {date}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <div style={{ fontWeight: 900, fontSize: 22 }}>{kindLabel}</div>

                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 14,
                      padding: "10px 12px",
                      fontWeight: 900,
                      background: "rgba(50,194,182,0.14)",
                      color: "rgba(0,0,0,0.78)",
                      boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.22)",
                    }}
                  >
                    تعديل
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteTx(t.id)}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 14,
                      padding: "10px 12px",
                      fontWeight: 900,
                      background: "rgba(0,0,0,0.06)",
                      color: "rgba(0,0,0,0.78)",
                    }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })}

          {monthTxsFinal.length === 0 && (
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 900 }}>
              لا يوجد نتائج حسب الفلاتر الحالية.
            </div>
          )}
        </div>
      </section>

      {/* Edit Modal */}
      {editOpen && (
        <div
          onClick={closeEdit}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 200,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 24,
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 30px 90px rgba(0,0,0,0.25)",
              border: "1px solid rgba(0,0,0,0.06)",
              overflow: "hidden",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>تعديل العملية</div>

              <button
                type="button"
                onClick={closeEdit}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 14,
                  padding: "10px 12px",
                  fontWeight: 900,
                  background: "rgba(0,0,0,0.06)",
                }}
              >
                إغلاق
              </button>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div style={fieldWrap()}>
                <div style={labelStyle()}>نوع العملية</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setEditForm((p: any) => ({ ...p, kind: "income" }))} style={pill(editForm.kind === "income")}>
                    دخل
                  </button>
                  <button type="button" onClick={() => setEditForm((p: any) => ({ ...p, kind: "expense" }))} style={pill(editForm.kind === "expense")}>
                    صرف
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                <div style={fieldWrap()}>
                  <div style={labelStyle()}>المبلغ</div>
                  <input
                    inputMode="decimal"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((p: any) => ({ ...p, amount: e.target.value }))}
                    style={inputStyle()}
                    placeholder="مثال: 120"
                  />
                </div>

                <div style={fieldWrap()}>
                  <div style={labelStyle()}>العملة</div>
                  <select value={editForm.currency} onChange={(e) => setEditForm((p: any) => ({ ...p, currency: e.target.value }))} style={inputStyle()}>
                    {IMPORTANT_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={fieldWrap()}>
                <div style={labelStyle()}>المحفظة</div>
                <select value={editForm.accountId} onChange={(e) => setEditForm((p: any) => ({ ...p, accountId: e.target.value }))} style={inputStyle()}>
                  <option value="">— اختر محفظة —</option>
                  {(state.accounts ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {normalizeCur(a.currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldWrap()}>
                <div style={labelStyle()}>التاريخ</div>
                <input type="date" value={editForm.dateISO} onChange={(e) => setEditForm((p: any) => ({ ...p, dateISO: e.target.value }))} style={inputStyle()} />
              </div>

              <div style={fieldWrap()}>
                <div style={labelStyle()}>الاسم / الملاحظة</div>
                <input value={editForm.note} onChange={(e) => setEditForm((p: any) => ({ ...p, note: e.target.value }))} style={inputStyle()} placeholder="مثال: أكل / إيجار / راتب..." />
              </div>

              <div style={fieldWrap()}>
                <div style={labelStyle()}>التصنيف</div>
                <select value={editForm.bucketId} onChange={(e) => setEditForm((p: any) => ({ ...p, bucketId: e.target.value }))} style={inputStyle()}>
                  <option value="no_bucket">بدون تصنيف</option>
                  {(editForm.kind === "income" ? state.incomeBuckets ?? [] : state.expenseBuckets ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={saveEdit}
                style={{
                  flex: 1,
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 18,
                  padding: "14px 14px",
                  fontWeight: 900,
                  background: "rgba(50,194,182,0.85)",
                  color: "#000",
                  boxShadow: "0 16px 30px rgba(50,194,182,0.25)",
                }}
              >
                حفظ التعديل
              </button>

              <button
                type="button"
                onClick={closeEdit}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 18,
                  padding: "14px 14px",
                  fontWeight: 900,
                  background: "rgba(0,0,0,0.06)",
                  color: "rgba(0,0,0,0.80)",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
