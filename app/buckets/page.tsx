"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import type { AppState } from "@/lib/types";
import { loadState, APPSTATE_CHANGED_EVENT } from "@/lib/storage";
import { normalizeCur, txValueInBase, roundMoney } from "@/lib/fx";
import { supabase } from "@/lib/supabaseClient";
import { useRef } from "react";


type Bucket = {
  id: string; // uuid
  name: string;
  kind?: "income" | "expense";
};

type ExtendedState = AppState & {
  incomeBuckets?: Bucket[];
  expenseBuckets?: Bucket[];
  monthlyGoal?: number; // base currency amount
  ownerUserId?: string;
};

function defaultState(): ExtendedState {
  return {
    baseCurrency: "USD",
    accounts: [],
    txs: [],
    incomeBuckets: [],
    expenseBuckets: [],
    monthlyGoal: 3000,
    ownerUserId: undefined,
  };
}

function r2(x: number) {
  return Math.round(x * 100) / 100;
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const CARD_STYLE: React.CSSProperties = {
  background: "white",
  border: "none",
  borderRadius: 18,
  boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
};

function pillStyle(active: boolean) {
  return {
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 900 as const,
    border: "none",
    cursor: "pointer",
    background: active ? "rgba(50,194,182,0.18)" : "rgba(0,0,0,0.06)",
    boxShadow: active ? "inset 0 0 0 1px rgba(50,194,182,0.28)" : "none",
    color: "rgba(0,0,0,0.82)",
  };
}

/** ✅ نفس شكل مخطط السنة */
function CompareBarsLikeYear({
  title,
  subtitle,
  items,
  maxY,
  baseCur,
}: {
  title: string;
  subtitle?: string;
  items: { label: string; value: number }[];
  maxY: number;
  baseCur: string;
}) {
  const baseW = 520;
  const H = 160;

  const leftPad = 10;
  const rightPad = 56;
  const topPad = 16;
  const bottomPad = 34;

  const safeMax = Math.max(1, maxY);

  const perItem = 110;
  const W = Math.max(baseW, leftPad + rightPad + items.length * perItem);

  const plotW = W - leftPad - rightPad;
  const plotH = H - topPad - bottomPad;

  function niceAxis(max: number) {
    const m = Math.max(1, Math.round(max));
    return [0, Math.round(m * 0.25), Math.round(m * 0.5), Math.round(m * 0.75), m];
  }
  const ticks = niceAxis(safeMax);

  const barW = plotW / Math.max(1, items.length);
  const radius = 18;

  function yOf(v: number) {
    const p = clamp(v / safeMax, 0, 1);
    return topPad + (1 - p) * plotH;
  }

  const displayItems = [...items].reverse();

  return (
    <section
      style={{
        ...CARD_STYLE,
        padding: 14,
        background:
          "linear-gradient(135deg, rgba(50,194,182,0.14) 0%, rgba(50,194,182,0.08) 45%, rgba(255,255,255,0.55) 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: "rgba(0,0,0,0.86)" }}>{title}</div>
          {subtitle ? (
            <div style={{ marginTop: 4, fontWeight: 800, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{subtitle}</div>
          ) : null}
        </div>

        <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>هذا الشهر</div>
      </div>

      <div
        style={{
          marginTop: 10,
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 6,
        }}
      >
        <svg width={W} height={H} style={{ display: "block" }}>
          {ticks.map((t, i) => {
            const y = yOf(t);
            return (
              <g key={i}>
                <line x1={leftPad} y1={y} x2={W - rightPad} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                <text
                  x={W - rightPad + 10}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="10"
                  fill="rgba(0,0,0,0.55)"
                  fontWeight="800"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {displayItems.map((it, idx) => {
            const v = r2(it.value);
            const bw = barW * 0.62;
            const x = leftPad + idx * barW + barW * 0.19;

            const h = clamp((v / safeMax) * plotH, 0, plotH);
            const y = topPad + (plotH - h);
            const rr = Math.min(radius, bw / 2, h / 2);

            const labelX = leftPad + idx * barW + barW * 0.5;

            return (
              <g key={`${it.label}-${idx}`}>
                <rect x={x} y={topPad} width={bw} height={plotH} rx={18} ry={18} fill="rgba(0,0,0,0.03)" />
                <rect x={x} y={y} width={bw} height={h} rx={rr} ry={rr} fill="rgba(50,194,182,0.70)" />

                <text
                  x={labelX}
                  y={Math.max(topPad + 12, y - 8)}
                  textAnchor="middle"
                  fontSize="12"
                  fill="rgba(0,0,0,0.65)"
                  fontWeight="900"
                >
                  {v}
                </text>

                <text x={labelX} y={H - 10} textAnchor="middle" fontSize="12" fill="rgba(0,0,0,0.75)" fontWeight="900">
                  {it.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
        كل القيم بالعملة الأساسية للحساب ({baseCur})
      </div>
    </section>
  );
}

function BucketCards({
  title,
  baseCur,
  buckets,
  totalsByBucket,
  denomIncome,
  onAdd,
  onRename,
  onDelete,
}: {
  title: string;
  baseCur: string;
  buckets: Bucket[];
  totalsByBucket: Map<string, number>;
  denomIncome: number;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section style={{ ...CARD_STYLE, marginTop: 12, padding: 14 }}>
      {/* Header مثل المحفظات */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>({buckets.length})</div>
      </div>

      {/* زر إضافة – نفس روح المحفظات */}
      <button
        onClick={() => {
          const n = prompt("اسم التصنيف:");
          if (!n) return;
          onAdd(n.trim());
        }}
        style={{
          marginTop: 12,
          width: "100%",
          borderRadius: 18,
          padding: "14px 0",
          fontWeight: 900,
          border: "none",
          background: "var(--primary)",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
        }}
      >
        + إضافة
      </button>

      {/* قائمة التصنيفات */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {buckets.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
            لا يوجد تصنيفات بعد.
          </div>
        ) : (
          buckets.map((b) => {
            const val = Math.round((totalsByBucket.get(b.id) || 0) * 100) / 100;
            const pct =
              denomIncome > 0 ? Math.min(100, Math.round((val / denomIncome) * 100)) : 0;

            return (
              <div
                key={b.id}
                style={{
                  background: "white",
                  borderRadius: 18,
                  padding: 14,
                  boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
                }}
              >
                {/* الاسم + المبلغ */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{b.name}</div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {val} {baseCur}
                  </div>
                </div>

                {/* النسبة */}
                <div style={{ fontSize: 12, marginTop: 6, color: "rgba(0,0,0,0.65)" }}>
                  نسبة من دخل هذا الشهر: {pct}%
                </div>

                {/* أزرار – نفس المحفظات */}
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      const n = prompt("تعديل الاسم:", b.name);
                      if (!n) return;
                      onRename(b.id, n.trim());
                    }}
                    style={{
                      borderRadius: 14,
                      padding: "10px 12px",
                      fontWeight: 900,
                      border: "none",
                      background: "rgba(0,0,0,0.08)",
                      cursor: "pointer",
                    }}
                  >
                    تعديل
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("حذف التصنيف؟")) onDelete(b.id);
                    }}
                    style={{
                      borderRadius: 14,
                      padding: "10px 12px",
                      fontWeight: 900,
                      border: "none",
                      background: "#d23c3ce6",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}


type DbBucketRow = {
  id: string;
  user_id: string;
  name: string;
  kind: "income" | "expense";
};

export default function BucketsPage() {
  const [state, setState] = useState<ExtendedState>(defaultState());
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"income" | "expense">("expense");

  // ✅ Supabase status
  const [sbLoading, setSbLoading] = useState(true);
  const [sbError, setSbError] = useState("");
const [localUserId, setLocalUserId] = useState<string | null>(null);
const localUserIdRef = useRef<string | null>(null);


useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user?.id ?? null;
    localUserIdRef.current = uid;
    setLocalUserId(uid);
  });
}, []);

  /** ✅ حمّل من local أولاً (txs/accounts/baseCurrency...) */
  useEffect(() => {
  if (!localUserId) {
    setHydrated(true);
    return;
  }

  const refreshLocal = () => {
    const s = loadState(localUserId) as ExtendedState | null;
    if (s) {
      setState({
        ...defaultState(),
        ...s,
        incomeBuckets: s.incomeBuckets ?? [],
        expenseBuckets: s.expenseBuckets ?? [],
        monthlyGoal: Number.isFinite((s as any).monthlyGoal)
          ? (s as any).monthlyGoal
          : defaultState().monthlyGoal,
      });
    }
  };

  refreshLocal();

  window.addEventListener(APPSTATE_CHANGED_EVENT, refreshLocal);
  const onVis = () => {
    if (document.visibilityState === "visible") refreshLocal();
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    window.removeEventListener(APPSTATE_CHANGED_EVENT, refreshLocal);
    document.removeEventListener("visibilitychange", onVis);
  };
}, [localUserId]);



  

  const baseCur = normalizeCur(state.baseCurrency || "USD");
  const today = todayISO();
  const thisMonthKey = monthKeyFromISO(today);

  

  /** ✅ تحميل + Migration للـ buckets */
  useEffect(() => {
    let alive = true;

    async function loadBucketsFromSupabase() {
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

        // 1) جلب buckets من supabase
        const existing = await supabase
          .from("buckets")
          .select("id,user_id,name,kind")
          .eq("user_id", userId);

        if (existing.error) throw new Error(existing.error.message);

        const sbBuckets = (existing.data ?? []) as DbBucketRow[];

        // 2) إذا supabase فاضي و local فيه buckets => migration بنفس ids
        // ✅ Migration مضبوط للصناديق: فقط إذا الـ local تابع لنفس المستخدم
if (sbBuckets.length === 0) {
  const local = loadState() as ExtendedState | null;

  // ✅ إذا الـ local لمستخدم ثاني: لا تهاجر + صفّي الصناديق محلياً
  if (local?.ownerUserId && local.ownerUserId !== userId) {
    setState((prev) => ({
      ...prev,
      ownerUserId: userId,
      incomeBuckets: [],
      expenseBuckets: [],
    }));
  } else {
    const localIncome = (local?.incomeBuckets ?? []) as any[];
    const localExpense = (local?.expenseBuckets ?? []) as any[];

    // ✅ ثبّت مالك الـ local لأول مرة
    if (!local?.ownerUserId) {
      setState((prev) => ({ ...prev, ownerUserId: userId }));
    }

    // ✅ جهّز payload (IDs جديدة لتجنب duplicate pkey)
    const payload = [
      ...localIncome
        .filter((b) => b?.name)
        .map((b) => ({
          id: crypto.randomUUID(), // ✅ لا تستخدم id القديمة
          user_id: userId,
          kind: "income",
          name: String(b.name).trim(),
          percent: Number.isFinite(Number(b.percent)) ? Number(b.percent) : null,
          updated_at: new Date().toISOString(),
        })),
      ...localExpense
        .filter((b) => b?.name)
        .map((b) => ({
          id: crypto.randomUUID(), // ✅ لا تستخدم id القديمة
          user_id: userId,
          kind: "expense",
          name: String(b.name).trim(),
          percent: Number.isFinite(Number(b.percent)) ? Number(b.percent) : null,
          updated_at: new Date().toISOString(),
        })),
    ].filter((x) => x.name);

    if (payload.length > 0) {
      const ins = await supabase.from("buckets").insert(payload);
      if (ins.error) throw new Error(ins.error.message);
    }
  }
}


        // 3) إعادة الجلب بعد المايغريشن
        const res = await supabase
          .from("buckets")
          .select("id,user_id,name,kind,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (res.error) throw new Error(res.error.message);

        const rows = (res.data ?? []) as any[];
        const income: Bucket[] = rows
          .filter((b) => b.kind === "income")
          .map((b) => ({ id: b.id, name: b.name, kind: "income" }));
        const expense: Bucket[] = rows
          .filter((b) => b.kind === "expense")
          .map((b) => ({ id: b.id, name: b.name, kind: "expense" }));

        if (!alive) return;

        setState((prev) => ({ ...prev, incomeBuckets: income, expenseBuckets: expense }));
        setSbLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setSbError(e?.message || "فشل تحميل التصنيفات من Supabase");
        setSbLoading(false);
      }
    }

    loadBucketsFromSupabase();
    return () => {
      alive = false;
    };
  }, []);

  /** ✅ refetch سريع بعد أي CRUD */
  async function refreshBucketsFromDB() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return;
    const userId = session.user.id;

    const res = await supabase
      .from("buckets")
      .select("id,name,kind,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (res.error) {
      console.error(res.error);
      return;
    }

    const all = (res.data ?? []) as any[];
    const income = all.filter((b) => b.kind === "income").map((b) => ({ id: b.id, name: b.name, kind: "income" as const }));
    const expense = all.filter((b) => b.kind === "expense").map((b) => ({ id: b.id, name: b.name, kind: "expense" as const }));

    setState((prev) => ({ ...prev, incomeBuckets: income, expenseBuckets: expense }));
  }

  const monthTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of state.txs ?? []) {
      if (!t.dateISO) continue;
      if (monthKeyFromISO(t.dateISO) !== thisMonthKey) continue;

      const v =  txValueInBase(state as any, t as any);
      if (t.kind === "income") income += v;
      else expense += v;
    }

return { income: roundMoney(income), expense: roundMoney(expense) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.txs, thisMonthKey, baseCur]);

  const monthIncome = monthTotals.income;

  const incomeTotalsByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of state.incomeBuckets ?? []) map.set(b.id, 0);

    for (const t of state.txs ?? []) {
      if (t.kind !== "income") continue;
      if (!t.dateISO) continue;
      if (monthKeyFromISO(t.dateISO) !== thisMonthKey) continue;

      const bid = (t as any).bucketId as string | undefined;
      if (!bid) continue;

      const v =  txValueInBase(state as any, t as any);
      map.set(bid, (map.get(bid) || 0) + v);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.txs, state.incomeBuckets, thisMonthKey, baseCur]);

  const expenseTotalsByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of state.expenseBuckets ?? []) map.set(b.id, 0);

    for (const t of state.txs ?? []) {
      if (t.kind !== "expense") continue;
      if (!t.dateISO) continue;
      if (monthKeyFromISO(t.dateISO) !== thisMonthKey) continue;

      const bid = (t as any).bucketId as string | undefined;
      if (!bid) continue;

      const v =  txValueInBase(state as any, t as any);
      map.set(bid, (map.get(bid) || 0) + v);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.txs, state.expenseBuckets, thisMonthKey, baseCur]);

  const topExpenseItems = useMemo(() => {
    const buckets = state.expenseBuckets ?? [];
    const list = buckets.map((b) => ({
      label: b.name,
      value: r2(expenseTotalsByBucket.get(b.id) || 0),
    }));
    return list.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [state.expenseBuckets, expenseTotalsByBucket]);

  const topIncomeItems = useMemo(() => {
    const buckets = state.incomeBuckets ?? [];
    const list = buckets.map((b) => ({
      label: b.name,
      value: r2(incomeTotalsByBucket.get(b.id) || 0),
    }));
    return list.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [state.incomeBuckets, incomeTotalsByBucket]);

  const maxYExpenses = Math.max(1, monthIncome);
  const monthlyGoal = Number.isFinite(state.monthlyGoal as any) ? (state.monthlyGoal as number) : 0;
  const maxYIncome = Math.max(1, monthlyGoal || monthIncome || 1);

  const showExpenses = mode === "expense";

  /** ✅ CRUD على Supabase (محمي user_id) */
  async function addBucket(kind: "income" | "expense", name: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    const id = crypto.randomUUID();

    const ins = await supabase
      .from("buckets")
      .insert({ id, user_id: userId, kind, name: name.trim(), updated_at: new Date().toISOString() })
      .select("id,name,kind")
      .single();

    if (ins.error) {
      alert(ins.error.message);
      return;
    }

    const row = ins.data as any;

    setState((prev) => {
      if (kind === "income") return { ...prev, incomeBuckets: [...(prev.incomeBuckets ?? []), { id: row.id, name: row.name, kind: "income" }] };
      return { ...prev, expenseBuckets: [...(prev.expenseBuckets ?? []), { id: row.id, name: row.name, kind: "expense" }] };
    });

    refreshBucketsFromDB();
  }

  async function renameBucket(kind: "income" | "expense", id: string, name: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    const up = await supabase
      .from("buckets")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (up.error) {
      alert(up.error.message);
      return;
    }

    setState((prev) => {
      if (kind === "income") {
        const arr = prev.incomeBuckets ?? [];
        return { ...prev, incomeBuckets: arr.map((b) => (b.id === id ? { ...b, name } : b)) };
      }
      const arr = prev.expenseBuckets ?? [];
      return { ...prev, expenseBuckets: arr.map((b) => (b.id === id ? { ...b, name } : b)) };
    });

    refreshBucketsFromDB();
  }

  async function deleteBucket(kind: "income" | "expense", id: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    // ✅ افصل العمليات المرتبطة (user-scoped)
    const nullify = await supabase
      .from("transactions")
      .update({ bucket_id: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("bucket_id", id);

    if (nullify.error) {
      console.warn(nullify.error);
      // ما منوقف، بس منكمّل
    }

    // ✅ حذف الصندوق (user-scoped)
    const del = await supabase.from("buckets").delete().eq("id", id).eq("user_id", userId);
    if (del.error) {
      alert(del.error.message);
      return;
    }

    // ✅ محلياً: اشيل الربط من txs
    setState((prev) => {
      const txs = (prev.txs ?? []).map((t: any) => {
        if (t?.bucketId === id) {
          const copy = { ...t };
          delete copy.bucketId;
          return copy;
        }
        return t;
      });

      if (kind === "income") {
        const arr = prev.incomeBuckets ?? [];
        return { ...prev, txs, incomeBuckets: arr.filter((b) => b.id !== id) };
      }
      const arr = prev.expenseBuckets ?? [];
      return { ...prev, txs, expenseBuckets: arr.filter((b) => b.id !== id) };
    });

    refreshBucketsFromDB();
  }
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
      dir="rtl"
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
          <div style={{ fontSize: 22, fontWeight: 900 }}>التصنيفات</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "rgba(0,0,0,0.65)", fontWeight: 800 }}>
            {baseCur} · {thisMonthKey}
          </div>

          {/* ✅ Supabase status */}
          {sbLoading ? (
            <div style={{ fontSize: 12, marginTop: 6, color: "rgba(0,0,0,0.55)", fontWeight: 800 }}>
              جاري تحميل التصنيفات..
            </div>
          ) : sbError ? (
            <div style={{ fontSize: 12, marginTop: 6, color: "rgba(180,0,0,0.85)", fontWeight: 900 }}>
              {sbError}
            </div>
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

      <section style={{ ...CARD_STYLE, marginTop: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setMode("income")} style={pillStyle(mode === "income")}>
            دخل
          </button>
          <button type="button" onClick={() => setMode("expense")} style={pillStyle(mode === "expense")}>
            مصاريف
          </button>
        </div>
      </section>

      {showExpenses ? (
        <div style={{ marginTop: 12 }}>
          <CompareBarsLikeYear title="مقارنة المصاريف" subtitle="أعلى 5 تصنيفات هذا الشهر" items={topExpenseItems} maxY={maxYExpenses} baseCur={baseCur} />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <CompareBarsLikeYear title="مقارنة الدخل" subtitle="أعلى 5 تصنيفات هذا الشهر" items={topIncomeItems} maxY={maxYIncome} baseCur={baseCur} />
        </div>
      )}

      {showExpenses ? (
        <BucketCards
          title={`تصنيفات المصاريف (${(state.expenseBuckets ?? []).length})`}
          baseCur={baseCur}
          buckets={state.expenseBuckets ?? []}
          totalsByBucket={expenseTotalsByBucket}
          denomIncome={monthIncome}
          onAdd={(name) => addBucket("expense", name)}
          onRename={(id, name) => renameBucket("expense", id, name)}
          onDelete={(id) => deleteBucket("expense", id)}
        />
      ) : (
        <BucketCards
          title={`تصنيفات الدخل (${(state.incomeBuckets ?? []).length})`}
          baseCur={baseCur}
          buckets={state.incomeBuckets ?? []}
          totalsByBucket={incomeTotalsByBucket}
          denomIncome={monthIncome}
          onAdd={(name) => addBucket("income", name)}
          onRename={(id, name) => renameBucket("income", id, name)}
          onDelete={(id) => deleteBucket("income", id)}
        />
      )}

      <div style={{ height: 12 }} />
      <BottomNav />
    </main>
  );
}
