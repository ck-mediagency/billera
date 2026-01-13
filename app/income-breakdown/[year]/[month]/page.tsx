"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { loadState, saveState } from "@/lib/storage";
import type { AppState } from "@/lib/types";
import { IMPORTANT_CURRENCIES, normalizeCur } from "@/lib/fx";
import { useParams } from "next/navigation";

type IncomeCategory = { id: string; name: string };

type BreakdownItem = {
  id: string;
  label: string;
  amount: number;
  categoryIds: string[]; // multi-select
};

type BreakdownMonthPlan = {
  monthlyIncome: number;
  currency: string;
  items: BreakdownItem[];
};

type BreakdownStore = {
  categories: IncomeCategory[];
  plans: Record<string, BreakdownMonthPlan>; // key: YYYY-MM
};

type ExtendedState = AppState & {
  incomeBreakdownStore?: BreakdownStore;
};

function fmt(n: number) {
  const v = Number.isFinite(n as any) ? Number(n) : 0;
  return Math.round(v).toLocaleString("en-US");
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        background: "white",
        border: "none",
        borderRadius: 20,
        boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function labelStyle() {
  return { fontSize: 12, color: "rgba(0,0,0,0.65)", fontWeight: 800 as const, marginBottom: 6 };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 16,
    padding: "12px 12px",
    border: "1px solid rgba(0,0,0,0.08)",
    outline: "none",
    fontWeight: 900,
    color: "#000",
    background: "white",
  };
}

function topLinkStyle() {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900 as const,
    textDecoration: "none",
    color: "#000",
    background: "rgba(255,255,255,0.92)",
    border: "none",
    boxShadow: "0 8px 22px rgba(0,0,0,0.04)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

function IconChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="rgba(0,0,0,0.70)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useOutsideClick(refs: React.RefObject<HTMLElement>[], onOutside: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      const inside = refs.some((r) => r.current && r.current.contains(t));
      if (!inside) onOutside();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true } as any);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, [refs, onOutside, enabled]);
}

function keyYM(year: string, month: string) {
  const y = String(year || "").slice(0, 4) || "2026";
  const m = String(month || "").padStart(2, "0").slice(0, 2);
  return `${y}-${m}`;
}

function safeStore(s?: BreakdownStore): BreakdownStore {
  return {
    categories: Array.isArray(s?.categories) ? s!.categories : [],
    plans: s?.plans && typeof s.plans === "object" ? s.plans : {},
  };
}

export default function IncomeBreakdownMonthPage() {
  const params = useParams<{ year: string; month: string }>();
  const year = String(params?.year ?? "");
  const month = String(params?.month ?? "");
  const ym = keyYM(year, month);

  // ✅ ثابت أول رندر (لتجنب hydration mismatch)
  const [state, setState] = useState<ExtendedState>(() => ({
    baseCurrency: "USD",
    accounts: [],
    txs: [],
    incomeBreakdownStore: { categories: [], plans: {} },
  })) as any;

  const [hydrated, setHydrated] = useState(false);

  // ✅ Compact edit toggle
  const [editingId, setEditingId] = useState<string | null>(null);

  // ✅ Hydrate from localStorage بعد الـ mount فقط
  useEffect(() => {
    const s =
      (loadState() as ExtendedState | null) ??
      ({
        baseCurrency: "USD",
        accounts: [],
        txs: [],
      } as any);

    const store = safeStore((s as any).incomeBreakdownStore);

    // default month plan if missing
    if (!store.plans[ym]) {
      store.plans[ym] = {
        monthlyIncome: 2400,
        currency: "EUR",
        items: [
          { id: "rent", label: "أجار المنزل", amount: 900, categoryIds: [] },
          { id: "electric", label: "كهرباء", amount: 70, categoryIds: [] },
        ],
      };
    }

    // default categories if empty
    if (store.categories.length === 0) {
      store.categories = [
        { id: "cat_bills", name: "فواتير" },
        { id: "cat_fixed", name: "مصاريف ثابتة" },
        { id: "cat_debt", name: "دين" },
        { id: "cat_special", name: "حالات خاصة" },
        { id: "cat_charity", name: "صدقة" },
      ];
    }

    setState({ ...s, incomeBreakdownStore: store });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym]);

  // ✅ persist only after hydration
  useEffect(() => {
    if (!hydrated) return;
    saveState(state as any);
  }, [state, hydrated]);

  const baseCur = normalizeCur(state.baseCurrency || "USD");
  const currencyList = useMemo(() => Array.from(new Set([baseCur, ...IMPORTANT_CURRENCIES.map(normalizeCur)])), [baseCur]);

  const store = safeStore(state.incomeBreakdownStore);
  const plan = store.plans[ym];

  // currency dropdown
  const [curOpen, setCurOpen] = useState(false);
  const curBtnRef = useRef<HTMLButtonElement>(null);
  const curPanelRef = useRef<HTMLDivElement>(null);
  useOutsideClick([curBtnRef as any, curPanelRef as any], () => setCurOpen(false), curOpen);

  function setPlanPatch(patch: Partial<BreakdownMonthPlan>) {
    setState((prev: ExtendedState) => {
      const st = safeStore((prev as any).incomeBreakdownStore);
      st.plans[ym] = { ...(st.plans[ym] as any), ...patch };
      return { ...prev, incomeBreakdownStore: st };
    });
  }

  function setMonthlyIncome(v: number) {
    setPlanPatch({ monthlyIncome: Math.max(0, Math.round(v)) });
  }

  function setCurrency(c: string) {
    setPlanPatch({ currency: normalizeCur(c) });
    setCurOpen(false);
  }

  function addItem() {
    const id = `it_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const next: BreakdownItem[] = [...(plan?.items || []), { id, label: "بند جديد", amount: 0, categoryIds: [] }];
    setPlanPatch({ items: next });
    setEditingId(id);
  }

  function removeItem(id: string) {
    setEditingId((x) => (x === id ? null : x));
    setPlanPatch({ items: (plan?.items || []).filter((x) => x.id !== id) });
  }

  function setItem(id: string, patch: Partial<BreakdownItem>) {
    setPlanPatch({ items: (plan?.items || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  }

  // totals
  const planned = useMemo(
    () => (plan?.items || []).reduce((a, x) => a + (Number.isFinite(x.amount as any) ? Number(x.amount) : 0), 0),
    [plan?.items]
  );
  const diff = useMemo(() => Number(plan?.monthlyIncome || 0) - planned, [plan?.monthlyIncome, planned]);
  const usedPct = useMemo(
    () => (plan?.monthlyIncome > 0 ? Math.max(0, Math.min(100, (planned / plan.monthlyIncome) * 100)) : 0),
    [plan?.monthlyIncome, planned]
  );

  // categories CRUD
  function addCategory(name: string) {
    const n = String(name || "").trim();
    if (!n) return;
    const id = `cat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setState((prev: any) => {
      const st = safeStore((prev as any).incomeBreakdownStore);
      st.categories = [...st.categories, { id, name: n }];
      return { ...prev, incomeBreakdownStore: st };
    });
  }

  function deleteCategory(catId: string) {
    setState((prev: any) => {
      const st = safeStore((prev as any).incomeBreakdownStore);
      st.categories = st.categories.filter((c) => c.id !== catId);

      const plans = { ...st.plans };
      Object.keys(plans).forEach((k) => {
        plans[k] = {
          ...plans[k],
          items: (plans[k].items || []).map((it) => ({
            ...it,
            categoryIds: (it.categoryIds || []).filter((x) => x !== catId),
          })),
        };
      });
      st.plans = plans;

      return { ...prev, incomeBreakdownStore: st };
    });
  }

  function CategoryMultiSelect({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
    const [open, setOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);

    const btnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useOutsideClick([btnRef as any, panelRef as any], () => setOpen(false), open);

    const [newCat, setNewCat] = useState("");

    const selectedNames = useMemo(() => {
      const map = new Map(store.categories.map((c) => [c.id, c.name]));
      const names = (value || []).map((id) => map.get(id)).filter(Boolean) as string[];
      return names;
    }, [value]);

    return (
      <div style={{ position: "relative" }}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            const el = btnRef.current;
            if (el) {
              const r = el.getBoundingClientRect();
              const spaceBelow = window.innerHeight - r.bottom;
              const spaceAbove = r.top;
              const panelH = 320;
              setOpenUp(spaceBelow < panelH && spaceAbove > spaceBelow);
            }
            setOpen((v) => !v);
          }}
          style={{
            width: "100%",
            border: "none",
            cursor: "pointer",
            textAlign: "right",
            borderRadius: 16,
            padding: "12px 12px",
            background: "rgba(255,255,255,0.96)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {selectedNames.length ? (
              selectedNames.slice(0, 2).map((n) => (
                <span
                  key={n}
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(50,194,182,0.14)",
                    boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.26)",
                  }}
                >
                  {n}
                </span>
              ))
            ) : (
              <span style={{ fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>اختر فئة/فئات</span>
            )}
            {selectedNames.length > 2 ? (
              <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>+{selectedNames.length - 2}</span>
            ) : null}
          </div>

          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 14,
              background: "rgba(0,0,0,0.04)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IconChevronDown />
          </span>
        </button>

        {open && (
          <div
            ref={panelRef}
            style={{
              position: "absolute",
              right: 0,
              left: 0,
              zIndex: 200,
              borderRadius: 20,
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 22px 60px rgba(0,0,0,0.18)",
              overflow: "hidden",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(0,0,0,0.06)",
              maxHeight: 280,
              ...(openUp
                ? { bottom: "calc(100% + 10px)" as any, top: "auto" as any }
                : { top: "calc(100% + 10px)" as any, bottom: "auto" as any }),
            }}
          >
            <div style={{ maxHeight: 280, overflow: "auto", padding: 10, display: "grid", gap: 8 }}>
              {store.categories.map((c) => {
                const checked = (value || []).includes(c.id);
                return (
                  <div
                    key={c.id}
                    style={{
                      borderRadius: 16,
                      padding: "10px 10px",
                      background: checked ? "rgba(50,194,182,0.18)" : "rgba(0,0,0,0.04)",
                      boxShadow: checked
                        ? "inset 0 0 0 1px rgba(50,194,182,0.32)"
                        : "inset 0 0 0 1px rgba(0,0,0,0.05)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          const next = on
                            ? Array.from(new Set([...(value || []), c.id]))
                            : (value || []).filter((x) => x !== c.id);
                          onChange(next);
                        }}
                      />
                      <span style={{ fontWeight: 900, color: "#000" }}>{c.name}</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => deleteCategory(c.id)}
                      title="حذف الفئة"
                      style={{
                        border: "none",
                        cursor: "pointer",
                        padding: "8px 10px",
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.06)",
                        fontWeight: 900,
                        color: "#000",
                        whiteSpace: "nowrap",
                      }}
                    >
                      حذف
                    </button>
                  </div>
                );
              })}

              <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0" }} />

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="إنشاء فئة جديدة..."
                  style={{ ...inputStyle(), borderRadius: 14, padding: "10px 10px" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    addCategory(newCat);
                    setNewCat("");
                  }}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    borderRadius: 14,
                    padding: "10px 12px",
                    fontWeight: 900,
                    background: "rgba(50,194,182,0.16)",
                    boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.30)",
                    color: "#000",
                    whiteSpace: "nowrap",
                  }}
                >
                  إضافة
                </button>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
                يمكنك اختيار عدة فئات + إنشاء/حذف فئات من هنا.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const title = `Income breakdown ${ym}`;

  if (!hydrated || !plan) {
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
        <div style={{ height: 14 }} />
        <div style={{ fontWeight: 900, fontSize: 18, color: "#000" }}>Income breakdown</div>
        <div style={{ marginTop: 10, color: "rgba(0,0,0,0.55)", fontWeight: 800, fontSize: 12 }}>تحميل...</div>
      </main>
    );
  }

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
      <div style={{ height: 14 }} />

      <header style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2, color: "#000" }}>{title}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "rgba(0,0,0,0.65)" }}>تقسيم نظري فقط — لا يؤثر على الحسابات أو العمليات</div>
        </div>

        <a href="/income-breakdown" style={topLinkStyle()}>
          رجوع
        </a>
      </header>

      <div style={{ height: 14 }} />

      {/* ✅ HERO (الراتب الشهري + ملخص) */}
      <section
        style={{
          borderRadius: 24,
          padding: 14,
          background:
            "linear-gradient(135deg, rgba(50,194,182,0.18) 0%, rgba(50,194,182,0.10) 45%, rgba(255,255,255,0.60) 100%)",
          boxShadow: "0 14px 34px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 900, color: "#000", fontSize: 18 }}>الراتب الشهري</div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              padding: "7px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.90)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          >
            نظري فقط
          </span>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: 10 }}>
          <div>
            <div style={labelStyle()}>قيمة الراتب (نظري)</div>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={String(plan.monthlyIncome ?? 0)}
              onChange={(e) => setMonthlyIncome(Number(e.target.value || 0))}
              style={{ ...inputStyle(), borderRadius: 18 }}
            />
          </div>

          <div>
            <div style={labelStyle()}>العملة</div>
            <div style={{ position: "relative" }}>
              <button
                ref={curBtnRef}
                type="button"
                onClick={() => setCurOpen((v) => !v)}
                style={{
                  width: "100%",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "right",
                  borderRadius: 18,
                  padding: "12px 12px",
                  background: "rgba(255,255,255,0.96)",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.07)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  fontWeight: 900,
                }}
              >
                <span>{normalizeCur(plan.currency || "USD")}</span>
                <IconChevronDown />
              </button>

              {curOpen && (
                <div
                  ref={curPanelRef}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    left: 0,
                    zIndex: 120,
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.94)",
                    boxShadow: "0 22px 60px rgba(0,0,0,0.18)",
                    overflow: "hidden",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ maxHeight: 240, overflow: "auto", padding: 10, display: "grid", gap: 8 }}>
                    {currencyList.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        style={{
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 16,
                          padding: "12px 12px",
                          textAlign: "right",
                          background: "rgba(0,0,0,0.04)",
                          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
                          fontWeight: 900,
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div
          style={{
            borderRadius: 18,
            padding: 12,
            background: "rgba(255,255,255,0.72)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "#000" }}>الراتب</div>
            <div style={{ fontWeight: 900, color: "#000" }}>
              {normalizeCur(plan.currency)} {fmt(plan.monthlyIncome || 0)}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "#000" }}>المقسّم</div>
            <div style={{ fontWeight: 900, color: "#000" }}>
              {normalizeCur(plan.currency)} {fmt(planned)}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "#000" }}>{diff >= 0 ? "المتبقي" : "تجاوزت الراتب"}</div>
            <div style={{ fontWeight: 900, color: diff >= 0 ? "rgba(0,0,0,0.85)" : "rgba(180,0,0,0.85)" }}>
              {normalizeCur(plan.currency)} {fmt(Math.abs(diff))}
            </div>
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "rgba(0,0,0,0.06)",
              overflow: "hidden",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ height: "100%", width: `${usedPct}%`, background: "rgba(50,194,182,0.65)" }} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
            ملاحظة: هذا تقسيم نظري فقط ولا يغيّر أرصدة الحسابات أو العمليات.
          </div>
        </div>
      </section>

      {/* ✅ القسم الخفيف (بنود التقسيم + إضافة بند) */}
      <Card style={{ marginTop: 14, background: "rgba(255,255,255,0.92)" }}>
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "#000" }}>بنود التقسيم</div>
            <button
              type="button"
              onClick={addItem}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 16,
                padding: "10px 12px",
                fontWeight: 900,
                background: "rgba(50,194,182,0.16)",
                boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.30)",
                color: "#000",
              }}
            >
              + إضافة بند
            </button>
          </div>

          {/* ✅ Compact cards */}
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {(plan.items || []).map((it, idx) => {
              const isEditing = editingId === it.id;
              const cur = normalizeCur(plan.currency || "USD");

              const catNames = (() => {
                const map = new Map(store.categories.map((c) => [c.id, c.name]));
                return (it.categoryIds || []).map((id) => map.get(id)).filter(Boolean) as string[];
              })();

              return (
                <Card key={it.id} style={{ borderRadius: 18, background: "rgba(255,255,255,0.94)" }}>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 10, alignItems: "center" }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.04)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: "#000",
                          }}
                          title={it.label}
                        >
                          {it.label || "بند"}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
                            {cur} {fmt(it.amount || 0)}
                          </span>

                          {catNames.slice(0, 2).map((n) => (
                            <span
                              key={n}
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                padding: "5px 9px",
                                borderRadius: 999,
                                background: "rgba(50,194,182,0.12)",
                                boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.22)",
                                color: "rgba(0,0,0,0.78)",
                              }}
                            >
                              {n}
                            </span>
                          ))}
                          {catNames.length > 2 ? (
                            <span style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,0.45)" }}>
                              +{catNames.length - 2}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => setEditingId(isEditing ? null : it.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontWeight: 900,
                            fontSize: 12,
                            color: "rgba(0,0,0,0.65)",
                            padding: 0,
                          }}
                        >
                          {isEditing ? "إغلاق" : "تعديل"}
                        </button>

                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontWeight: 900,
                            fontSize: 12,
                            color: "rgba(180,0,0,0.75)",
                            padding: 0,
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />
                        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <div style={labelStyle()}>البند</div>
                              <input value={it.label} onChange={(e) => setItem(it.id, { label: e.target.value })} style={inputStyle()} />
                            </div>

                            <div>
                              <div style={labelStyle()}>الفئة (اختيار متعدد)</div>
                              <CategoryMultiSelect
                                value={Array.isArray(it.categoryIds) ? it.categoryIds : []}
                                onChange={(next) => setItem(it.id, { categoryIds: next })}
                              />
                            </div>
                          </div>

                          <div>
                            <div style={labelStyle()}>المبلغ</div>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={String(it.amount ?? 0)}
                              onChange={(e) => setItem(it.id, { amount: Math.max(0, Math.round(Number(e.target.value || 0))) })}
                              style={inputStyle()}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </Card>

      <BottomNav />
    </main>
  );
}
