"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import type { AppState, Account } from "@/lib/types";
import { loadState, saveState } from "@/lib/storage";
import { normalizeCur, ratesFromState, roundMoney } from "@/lib/fx";
import { supabase } from "@/lib/supabaseClient";

type ExtendedState = AppState & {
  incomeBuckets?: any[];
  expenseBuckets?: any[];
  ownerUserId?: string;
};

function defaultState(): ExtendedState {
  return {
    baseCurrency: "USD",
    accounts: [],
    txs: [],
    incomeBuckets: [],
    expenseBuckets: [],
    ownerUserId: undefined,
  };
}

function r2(x: number) {
  return Math.round(x * 100) / 100;
}

const CARD_STYLE: CSSProperties = {
  background: "white",
  border: "none",
  borderRadius: 18,
  boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
};

function chipStyle() {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900 as const,
    textDecoration: "none",
    color: "rgba(0,0,0,0.86)",
    background: "rgba(255,255,255,0.92)",
    border: "none",
    boxShadow: "0 8px 22px rgba(0,0,0,0.04)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "white",
          borderRadius: 20,
          boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
          padding: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#000" }}>{title}</div>
          <button
            className="secondary"
            onClick={onClose}
            style={{
              borderRadius: 14,
              padding: "10px 12px",
              fontWeight: 900,
              color: "#000",
            }}
          >
            إغلاق
          </button>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

type DbAccountRow = {
  id: string;
  user_id: string;
  name: string;
  currency: string;
};

export default function AccountsPage() {
  const [state, setState] = useState<ExtendedState>(defaultState());
  const [hydrated, setHydrated] = useState(false);

  // ✅ NEW: local storage per user
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const localUserIdRef = useRef<string | null>(null);

  const [openAdd, setOpenAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [sbLoading, setSbLoading] = useState(true);
  const [sbError, setSbError] = useState("");

  function refreshLocal(uid: string | null) {
    const s = loadState(uid) as ExtendedState | null;
    if (s) {
      setState({
        ...defaultState(),
        ...s,
        incomeBuckets: s.incomeBuckets ?? [],
        expenseBuckets: s.expenseBuckets ?? [],
      });
    } else {
      setState(defaultState());
    }
  }

  // ✅ init: get session -> set uid -> load local with uid
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

  // ✅ util: تحويل باستخدام ratesToUSD (1 UNIT = كم USD)
  function convertWithRates(amount: number, from: string, to: string) {
    const f = normalizeCur(from);
    const t = normalizeCur(to);
    if (f === t) return amount;

    const rates = ratesFromState(state) || {};
    const rf = rates[f];
    const rt = rates[t];

    if (!rf || !rt) return amount; // fallback: ما نكسر الحساب
    const usd = amount * rf;
    const out = usd / rt;
    return out;
  }

  // ✅ util: refetch accounts from supabase وتحديث state.accounts
  async function refetchAccounts() {
    setSbLoading(true);
    setSbError("");

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setSbError("لا يوجد جلسة دخول. سجّل دخول أولاً.");
      setSbLoading(false);
      return;
    }

    const userId = session.user.id;

    const res = await supabase
      .from("accounts")
      .select("id,user_id,name,currency")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (res.error) {
      setSbError(res.error.message);
      setSbLoading(false);
      return;
    }

    const finalRows = (res.data ?? []) as DbAccountRow[];
    const finalAccounts: Account[] = finalRows.map((r) => ({
      id: r.id,
      name: r.name,
      currency: normalizeCur(r.currency),
    }));

    setState((prev) => ({ ...prev, accounts: finalAccounts }));
    setSbLoading(false);
  }

  // ✅ تحميل حسابات Supabase + Migration أول مرة
  useEffect(() => {
    let alive = true;

    async function loadAccountsFromSupabase() {
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

        const existing = await supabase
          .from("accounts")
          .select("id,user_id,name,currency")
          .eq("user_id", userId);

        if (existing.error) throw new Error(existing.error.message);

        const sbAccounts = (existing.data ?? []) as DbAccountRow[];

        // ✅ Migration:
        // إذا Supabase فاضي و guest-local فيه حسابات => ارفعها بنفس IDs
        // (مهم لأنك ممكن تكون شغّال قبل تسجيل الدخول)
        // ✅ Migration مضبوط: فقط إذا الـ local تابع لنفس المستخدم
if (sbAccounts.length === 0) {
  const local = loadState() as ExtendedState | null;

  // ✅ إذا في Local لمستخدم آخر: لا تهاجر + صفّي local
  if (local?.ownerUserId && local.ownerUserId !== userId) {
    setState((prev) => ({
      ...prev,
      ownerUserId: userId,
      accounts: [],
      txs: [],
      incomeBuckets: [],
      expenseBuckets: [],
    }));
  } else {
    const localAccounts = (local?.accounts ?? []) as Account[];

    // ✅ ثبّت مالك الـ local لأول مرة
    if (!local?.ownerUserId) {
      setState((prev) => ({ ...prev, ownerUserId: userId }));
    }

    if (localAccounts.length > 0) {
      const payload = localAccounts
        .filter((a) => a?.id && a?.name)
        .map((a) => ({
          // ❗️مهم: لا تستخدم نفس id القديمة لتفادي تعارض بين المستخدمين
          id: crypto.randomUUID(),
          user_id: userId,
          name: String(a.name).trim(),
          currency: normalizeCur(String(a.currency || "USD")),
          updated_at: new Date().toISOString(),
        }));

      if (payload.length > 0) {
        const ins = await supabase.from("accounts").insert(payload);
        if (ins.error) throw new Error(ins.error.message);
      }
    }
  }
}


        // ✅ refetch
        const res = await supabase
          .from("accounts")
          .select("id,user_id,name,currency")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (res.error) throw new Error(res.error.message);

        const finalRows = (res.data ?? []) as DbAccountRow[];
        const finalAccounts: Account[] = finalRows.map((r) => ({
          id: r.id,
          name: r.name,
          currency: normalizeCur(r.currency),
        }));

        if (!alive) return;

        // ✅ set + also ensure localUserId is set (for per-user save)
        localUserIdRef.current = userId;
        setLocalUserId(userId);

        setState((prev) => ({ ...prev, accounts: finalAccounts }));
        setSbLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setSbError(e?.message || "فشل تحميل المحفظات من Supabase");
        setSbLoading(false);
      }
    }

    loadAccountsFromSupabase();
    return () => {
      alive = false;
    };
  }, []);

  const baseCur = normalizeCur(state.baseCurrency || "USD");

  // ✅ balances: اجمع كل العمليات محوّلة لعملة الحساب
  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of state.accounts ?? []) map.set(a.id, 0);

    for (const t of state.txs ?? []) {
      const acc = (state.accounts ?? []).find((a) => a.id === t.accountId);
      if (!acc) continue;

      const accCur = normalizeCur(acc.currency);
      const txCur = normalizeCur(t.currency || accCur);

      const amtInAccCur = convertWithRates(Number(t.amount || 0), txCur, accCur);
      const delta = t.kind === "income" ? amtInAccCur : -amtInAccCur;

      map.set(t.accountId, (map.get(t.accountId) || 0) + delta);
    }

    for (const [k, v] of map.entries()) map.set(k, roundMoney(v, 2));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accounts, state.txs]);

  const totalAccounts = (state.accounts ?? []).length;

  const usedCurrencies = useMemo(() => {
    const s = new Set<string>();
    for (const a of state.accounts ?? []) s.add(normalizeCur(a.currency));
    return Array.from(s);
  }, [state.accounts]);

  const currencyOptions = useMemo(() => {
    const common = ["USD", "EUR", "TRY", "SYP", "GBP", "AED", "SAR", "QAR", "KWD"];
    const merged = Array.from(new Set([...usedCurrencies, ...common].map(normalizeCur)));
    return merged;
  }, [usedCurrencies]);

  function openAddModal() {
    setEditId(null);
    setName("");
    setCurrency("USD");
    setOpenAdd(true);
  }

  function openEditModal(id: string) {
    const a = (state.accounts ?? []).find((x) => x.id === id);
    if (!a) return;
    setEditId(id);
    setName(a.name);
    setCurrency(normalizeCur(a.currency));
    setOpenAdd(true);
  }

  async function saveAccount() {
    const nm = name.trim();
    if (!nm) return;

    const cur = normalizeCur(currency || "USD");

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    if (editId) {
      const up = await supabase
        .from("accounts")
        .update({ name: nm, currency: cur, updated_at: new Date().toISOString() })
        .eq("id", editId)
        .eq("user_id", userId);

      if (up.error) {
        alert(up.error.message);
        return;
      }

      setState((prev) => ({
        ...prev,
        accounts: (prev.accounts ?? []).map((x) => (x.id === editId ? { ...x, name: nm, currency: cur } : x)),
      }));

      await refetchAccounts();
    } else {
      const id = crypto.randomUUID();

      const ins = await supabase.from("accounts").insert([
        {
          id,
          user_id: userId,
          name: nm,
          currency: cur,
          updated_at: new Date().toISOString(),
        },
      ]);

      if (ins.error) {
        alert(ins.error.message);
        return;
      }

      const acc: Account = { id, name: nm, currency: cur };
      setState((prev) => ({ ...prev, accounts: [...(prev.accounts ?? []), acc] }));

      await refetchAccounts();
    }

    setOpenAdd(false);
  }

  async function deleteAccount(id: string) {
    const hasTx = (state.txs ?? []).some((t) => t.accountId === id);
    if (hasTx) {
      alert("لا يمكن حذف المحفظة لأنها مرتبطة بعمليات. احذف العمليات أولًا أو انقلها محفظة أخرى.");
      return;
    }
    if (!confirm("حذف المحفظة")) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    const del = await supabase.from("accounts").delete().eq("id", id).eq("user_id", userId);
    if (del.error) {
      alert(del.error.message);
      return;
    }

    setState((prev) => ({ ...prev, accounts: (prev.accounts ?? []).filter((x) => x.id !== id) }));
    await refetchAccounts();
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
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2, color: "#000" }}>المحفظات</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "rgba(0,0,0,0.65)" }}>
            رصيد كل محفظة بعملة المحفظة نفسها · العملة الأساسية: {baseCur}
          </div>

          {sbLoading ? (
            <div style={{ fontSize: 12, marginTop: 6, color: "rgba(0,0,0,0.55)", fontWeight: 800 }}>جاري تحميل المحفظات</div>
          ) : sbError ? (
            <div style={{ fontSize: 12, marginTop: 6, color: "rgba(180,0,0,0.85)", fontWeight: 900 }}>{sbError}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/" style={chipStyle()}>
            رجوع
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>نظرة عامة</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, lineHeight: 1.1, color: "#000" }}>{totalAccounts} محفظة</div>
            <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.3, color: "rgba(0,0,0,0.65)" }}>
              العملات المستخدمة: {usedCurrencies.length ? usedCurrencies.join(" · ") : "—"}
            </div>
          </div>

          <button
            onClick={openAddModal}
            style={{
              borderRadius: 18,
              padding: "12px 14px",
              fontWeight: 900,
              border: "none",
              background: "var(--primary)",
              color: "white",
              boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + إضافة
          </button>
        </div>
      </section>

      <section style={{ ...CARD_STYLE, marginTop: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, color: "#000" }}>قائمة المحفظات</div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>({totalAccounts})</div>
        </div>

        {totalAccounts === 0 ? (
          <div style={{ marginTop: 12, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>لا يوجد محفظة بعد. اضغط “إضافة”.</div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {(state.accounts ?? []).map((a) => {
              const cur = normalizeCur(a.currency);
              const bal = r2(balances.get(a.id) || 0);

              return (
                <div
                  key={a.id}
                  style={{
                    background: "white",
                    borderRadius: 18,
                    padding: 14,
                    boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 16,
                          color: "#000",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.name}
                      </div>

                      <div style={{ fontSize: 12, marginTop: 6, color: "#000", fontWeight: 700 }}>العملة: {cur}</div>
                    </div>

                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 900, fontSize: 18, color: "#000" }}>
                        {bal} {cur}
                      </div>

                      <div style={{ fontSize: 12, marginTop: 6, color: "#000", fontWeight: 700 }}>الرصيد</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-start" }}>
                    <button
                      onClick={() => openEditModal(a.id)}
                      style={{
                        borderRadius: 14,
                        padding: "10px 12px",
                        fontWeight: 900,
                        border: "none",
                        background: "rgba(0,0,0,0.08)",
                        color: "#000",
                        cursor: "pointer",
                      }}
                    >
                      تعديل
                    </button>

                    <button
                      onClick={() => deleteAccount(a.id)}
                      style={{
                        borderRadius: 14,
                        padding: "10px 12px",
                        fontWeight: 900,
                        border: "none",
                        background: "rgba(0,0,0,0.08)",
                        color: "#000",
                        cursor: "pointer",
                      }}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={openAdd} title={editId ? "تعديل محفظة" : "إضافة محفظة"} onClose={() => setOpenAdd(false)}>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(0,0,0,0.65)" }}>اسم المحفظة</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: Cash USD"
              style={{
                width: "100%",
                borderRadius: 16,
                padding: "12px 12px",
                border: "1px solid rgba(0,0,0,0.08)",
                outline: "none",
                fontWeight: 800,
                color: "#000",
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(0,0,0,0.65)" }}>العملة</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {currencyOptions.map((c) => {
                const active = normalizeCur(currency) === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    style={{
                      borderRadius: 999,
                      padding: "10px 12px",
                      fontWeight: 900,
                      border: "none",
                      cursor: "pointer",
                      background: active ? "rgba(50,194,182,0.18)" : "rgba(0,0,0,0.06)",
                      color: active ? "var(--primary)" : "#000",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12, marginTop: 10, color: "rgba(0,0,0,0.65)" }}>إذا عملتك مو موجودة: اكتبها هون (3 أحرف)</div>

            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="مثال: USD"
              maxLength={6}
              style={{
                width: "100%",
                borderRadius: 16,
                padding: "12px 12px",
                border: "1px solid rgba(0,0,0,0.08)",
                outline: "none",
                fontWeight: 800,
                color: "#000",
                marginTop: 6,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              onClick={saveAccount}
              style={{
                flex: 1,
                borderRadius: 16,
                padding: "12px 12px",
                fontWeight: 900,
                border: "none",
                background: "var(--primary)",
                color: "white",
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
              }}
            >
              حفظ
            </button>

            <button
              onClick={() => setOpenAdd(false)}
              style={{
                flex: 1,
                borderRadius: 16,
                padding: "12px 12px",
                fontWeight: 900,
                border: "none",
                background: "rgba(0,0,0,0.06)",
                color: "#000",
                cursor: "pointer",
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      <BottomNav />
    </main>
  );
}
