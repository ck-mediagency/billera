"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import type { AppState } from "@/lib/types";
import { loadState, saveState } from "@/lib/storage";
import { normalizeCur, ratesFromState, txValueInBase, roundMoney } from "@/lib/fx";
import { supabase } from "@/lib/supabaseClient";

type AccountRow = {
  id: string;
  name: string;
  currency: string;
};


type ExtendedState = AppState & {
  incomeBuckets?: any[];
  expenseBuckets?: any[];
  monthlyIncomeTarget?: number;
};

function defaultState(): ExtendedState {
  return {
    baseCurrency: "USD",
    accounts: [],
    txs: [],
    incomeBuckets: [],
    expenseBuckets: [],
    monthlyIncomeTarget: 0,
  };
}

function r2(x: number) {
  return Math.round(x * 100) / 100;
}

function clampPct(x: number) {
  return Math.max(0, Math.min(100, x));
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKeyFromISO(iso: string) {
  return iso.slice(0, 7);
}

function monthLabelFromKey(key: string) {
  const [y, m] = key.split("-");
  return `${m}/${y}`;
}

function Ring({ percent, centerTop }: { percent: number; centerTop: string; centerBottom: string }) {
  const p = clampPct(percent);
  const size = 92;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 8 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>{centerTop}</div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.2 }}>
            الصرف من <br /> الدخل
          </div>
        </div>
      </div>
    </div>
  );
}

function pillStyle() {
  return {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900 as const,
    background: "rgba(255,255,255,0.92)",
    border: "none",
  };
}

function fancyLinkStyle() {
  return {
    fontWeight: 900 as const,
    textDecoration: "none",
    color: "rgba(0,0,0,0.78)",
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.92)",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 8px 22px rgba(0,0,0,0.04)",
  };
}

const CARD_STYLE: any = {
  background: "white",
  border: "none",
  borderRadius: 18,
  boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
};

function Card({ children }: { children: React.ReactNode }) {
  return <section style={CARD_STYLE}>{children}</section>;
}

export default function HomePage() {
  
  const [state, setState] = useState<ExtendedState>(defaultState());
  const [hydrated, setHydrated] = useState(false);
    // ✅ Accounts من Supabase (للرئيسية فقط)
  const [accountsSB, setAccountsSB] = useState<AccountRow[]>([]);
  const [accLoading, setAccLoading] = useState(false);


  // ✅ أهم شي: نخزن/نقرأ حسب المستخدم
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);


  // ✅ helper: تحميل من localStorage حسب userId
  function refreshFromStorage(uid: string | null) {
    const s = loadState(uid) as ExtendedState | null;
    if (s) {
      setState({
        ...defaultState(),
        ...s,
        incomeBuckets: s.incomeBuckets ?? [],
        expenseBuckets: s.expenseBuckets ?? [],
        monthlyIncomeTarget: Number.isFinite((s as any).monthlyIncomeTarget) ? Number((s as any).monthlyIncomeTarget) : 0,
      });
    } else {
      // إذا ما في شي محفوظ لهالمستخدم، خلي default
      setState(defaultState());
    }
  }

  // ✅ عند فتح الصفحة: هات userId ثم اقرأ state تبعه
  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id ?? null;
        if (!alive) return;

        setUserId(uid);
        userIdRef.current = uid; // ⬅️ مهم جداً
        refreshFromStorage(uid);
        setHydrated(true);
      } catch {
        if (!alive) return;
        // fallback guest
        setUserId(null);
        refreshFromStorage(null);
        setHydrated(true);
      }
    }

    init();

    // ✅ تحديث عند الرجوع للتبويب/النافذة
    const onFocus = () => refreshFromStorage(userIdRef.current);
const onVis = () => {
  if (document.visibilityState === "visible") {
    refreshFromStorage(userIdRef.current);
  }
};


    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ✅ جلب المحافظ من Supabase (حتى ما تختفي)
  useEffect(() => {
    let alive = true;

    async function fetchAccounts() {
      if (!userId) {
        setAccountsSB([]);
        return;
      }

      setAccLoading(true);

      const { data, error } = await supabase
        .from("accounts")
        .select("id,name,currency")
        .eq("user_id", userId)
        .order("name", { ascending: true });

      if (!alive) return;

      if (!error) setAccountsSB((data ?? []) as AccountRow[]);
      setAccLoading(false);
    }

    fetchAccounts();

    return () => {
      alive = false;
    };
  }, [userId]);



  // ✅ إذا تغيّر userId (تسجيل دخول/خروج) اقرأ state تبعه فوراً
  useEffect(() => {
    if (!hydrated) return;
    refreshFromStorage(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ✅ حفظ محلي حسب userId
  useEffect(() => {
    if (!hydrated) return;
    saveState(state as any, userId);
  }, [state, hydrated, userId]);

  const baseCur = normalizeCur(state.baseCurrency || "USD");
  const today = todayISO();
  const thisMonthKey = monthKeyFromISO(today);

  const monthTotals = useMemo(() => {
  let income = 0;
  let expense = 0;

  for (const t of state.txs ?? []) {
    if (!t.dateISO) continue;
    if (monthKeyFromISO(t.dateISO) !== thisMonthKey) continue;

const v = txValueInBase(t as any, baseCur, ratesFromState(state as any));

    if (t.kind === "income") income += v;
    else expense += v;
  }

  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    net: roundMoney(income - expense),
  };
}, [state.txs, state.baseCurrency, (state as any).fxRatesToUSD, thisMonthKey]);


  const spendingPercent = useMemo(() => {
    const inc = monthTotals.income;
    const exp = monthTotals.expense;
    if (!inc || inc <= 0) return 0;
    return clampPct(Math.round((exp / inc) * 100));
  }, [monthTotals.income, monthTotals.expense]);

  const target = useMemo(() => {
    const t = Number.isFinite(state.monthlyIncomeTarget as any) ? Number(state.monthlyIncomeTarget) : 0;
    return Math.max(0, Math.round(t));
  }, [state.monthlyIncomeTarget]);

  const incomeFillPercent = useMemo(() => {
    if (!target || target <= 0) return 0;
    return clampPct(Math.round((monthTotals.income / target) * 100));
  }, [monthTotals.income, target]);

    const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accountsSB) map.set(a.id, 0);

    for (const t of state.txs ?? []) {
      const delta = t.kind === "income" ? t.amount : -t.amount;
      map.set(t.accountId, (map.get(t.accountId) || 0) + delta);
    }

    return map;
  }, [accountsSB, state.txs]);


  const hasAccounts = accountsSB.length > 0;
  const monthLabel = monthLabelFromKey(thisMonthKey);
if (!hydrated) {
  return (
    <main
      dir="rtl"
      style={{
        padding: 16,
        paddingBottom: 120,
        maxWidth: 560,
        margin: "0 auto",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F2F5F7 0%, #EEF2F5 55%, #EEF2F5 100%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ fontWeight: 900, color: "rgba(0,0,0,0.65)" }}>جاري تحميل بياناتك…</div>
      <BottomNav />
    </main>
  );
}

  return (
    <main
      style={{
        padding: 16,
        paddingBottom: 120,
        maxWidth: 560,
        margin: "0 auto",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F2F5F7 0%, #EEF2F5 55%, #EEF2F5 100%)",
      }}
    >
      <div style={{ height: 10 }} />

      <header style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>الرئيسية</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            الشهر · {monthLabel} · {baseCur}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/transactions" style={fancyLinkStyle()}>
            المعاملات
          </a>
          <a href="/buckets" style={fancyLinkStyle()}>
            التصنيفات
          </a>
        </div>
      </header>

      <section
        style={{
          marginTop: 14,
          borderRadius: 22,
          padding: 14,
          background: "linear-gradient(135deg, rgba(50,194,182,0.14) 0%, rgba(50,194,182,0.08) 45%, rgba(255,255,255,0.55) 100%)",
          border: "none",
          boxShadow: "0 12px 28px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>
              ملخص الشهر
            </div>

            <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900, lineHeight: 1.05 }}>
              {monthTotals.net} {baseCur}
            </div>

            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              صافي = دخل − صرف
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={pillStyle()}>
                دخل: {monthTotals.income} {baseCur}
              </span>
              <span style={pillStyle()}>
                صرف: {monthTotals.expense} {baseCur}
              </span>
            </div>
          </div>

          <Ring percent={spendingPercent} centerTop={`${spendingPercent}%`} centerBottom="" />
        </div>
      </section>

      

      <section style={{ ...CARD_STYLE, marginTop: 12, marginBottom: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>المحفظات</div>
          <a href="/accounts" className="text-primary" style={{ fontWeight: 900, textDecoration: "none" }}>
            إدارة
          </a>
        </div>

                {!hasAccounts ? (
          <div className="text-muted" style={{ marginTop: 12, fontSize: 12 }}>
            {accLoading ? "جاري تحميل المحفظات..." : "لا يوجد محفظات بعد. افتح “المحفظات” لإضافة محفظة."}
          </div>
        ) : (

          <div style={{ marginTop: 12 }}>
            {accountsSB.map((a, idx) => {
              const cur = normalizeCur(a.currency);
              const bal = r2(balances.get(a.id) || 0);

              return (
                <div key={a.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 6px", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {cur}
                      </div>
                    </div>

                    <div style={{ fontWeight: 900 }}>
                      {bal} {cur}
                    </div>
                  </div>

                  {idx !== accountsSB.length - 1 && <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Card>
        <div style={{ padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10, color: "#000" }}>Income Breakdown</div>

          <a
            href="/income-breakdown"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "14px 14px",
              borderRadius: 18,
              background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.90) 100%)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.07), 0 12px 28px rgba(0,0,0,0.06)",
              textDecoration: "none",
              color: "#000",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 900 }}>تقسيم نظري للمدخول</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>التخطيط الشهري الخاص بك</div>
            </div>

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
              ›
            </div>
          </a>
        </div>
      </Card>

      

      <a
        href="/add"
        aria-label="إضافة عملية"
        title="إضافة عملية"
        style={{
          position: "fixed",
          right: 18,
          bottom: 122,
          width: 54,
          height: 54,
          borderRadius: 999,
          background: "var(--primary)",
          color: "white",
          display: "grid",
          placeItems: "center",
          fontSize: 28,
          fontWeight: 900,
          textDecoration: "none",
          boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
          zIndex: 70,
        }}
      >
        +
      </a>

      <BottomNav />
    </main>
  );
}
