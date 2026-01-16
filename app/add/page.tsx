"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { normalizeCur } from "@/lib/fx";

type AccountRow = {
  id: string;
  name: string;
  currency: string;
};

type BucketRow = {
  id: string;
  name: string;
  kind: "income" | "expense";
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ============ UI styles ============ */
const CARD: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 20,
  background: "rgba(255,255,255,0.95)",
  padding: 14,
  boxShadow: "0 12px 28px rgba(0,0,0,0.06)",
  border: "1px solid rgba(0,0,0,0.05)",
};

const LABEL: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  color: "#0B0F12",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  outline: "none",
  fontSize: 14,
  fontWeight: 800,
  color: "#0B0F12",
  background: "#fff",
};

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  paddingRight: 40,
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, rgba(0,0,0,0.55) 50%), linear-gradient(135deg, rgba(0,0,0,0.55) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 18px) 52%, calc(100% - 12px) 52%",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
};

const TOPLINK: React.CSSProperties = {
  textDecoration: "none",
  fontWeight: 900,
  color: "rgba(0,0,0,0.75)",
  padding: "8px 10px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(0,0,0,0.06)",
};

export default function AddTxPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  // ✅ بيانات من supabase
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [buckets, setBuckets] = useState<BucketRow[]>([]);

  // ✅ فورم
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState<string>("");
const [currency, setCurrency] = useState<string>("USD"); // رح تضل موجودة بس ممنوع تعديلها من UI
  const [accountId, setAccountId] = useState<string>("");
  const [bucketId, setBucketId] = useState<string>("");
  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [note, setNote] = useState<string>("");

  // ✅ فلترة التصنيفات حسب نوع العملية
  const filteredBuckets = useMemo(() => buckets.filter((b) => b.kind === kind), [buckets, kind]);

  // ✅ العملات المتاحة (من المحافظ الموجودة)
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) set.add(normalizeCur(a.currency || "USD"));
    return Array.from(set).sort();
  }, [accounts]);

  // ✅ تحميل البيانات من Supabase
  useEffect(() => {
    let alive = true;

    async function init() {
      setLoading(true);
      setErrorMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const uid = session.user.id;
      if (!alive) return;
      setUserId(uid);

      const [{ data: acc, error: accErr }, { data: bks, error: bksErr }] = await Promise.all([
        supabase.from("accounts").select("id,name,currency").eq("user_id", uid).order("name", { ascending: true }),
        supabase.from("buckets").select("id,name,kind").eq("user_id", uid).order("name", { ascending: true }),
      ]);

      if (accErr) {
        setErrorMsg("في مشكلة بتحميل المحافظ من السيرفر.");
        setLoading(false);
        return;
      }
      if (bksErr) {
        setErrorMsg("في مشكلة بتحميل التصنيفات من السيرفر.");
        setLoading(false);
        return;
      }

      if (!alive) return;

      const accRows = (acc ?? []) as AccountRow[];
      const bucketRows = (bks ?? []) as BucketRow[];

      setAccounts(accRows);
      setBuckets(bucketRows);

      // ✅ قيم افتراضية ذكية بعد التحميل
      if (accRows.length > 0) {
        setAccountId(accRows[0].id);
        setCurrency(normalizeCur(accRows[0].currency || "USD"));
      } else {
        setAccountId("");
      }

      const firstBucket = bucketRows.find((x) => x.kind === kind);
      setBucketId(firstBucket ? firstBucket.id : "");

      setLoading(false);
    }

    init();

    return () => {
      alive = false;
    };
  }, [router]);

  // ✅ إذا تغيّر kind، اختار bucket مناسب تلقائياً
  useEffect(() => {
    const first = buckets.find((b) => b.kind === kind);
    setBucketId(first ? first.id : "");
  }, [kind, buckets]);

  // ✅ إذا غيّرت المحفظة، حدّث العملة تلقائياً
  useEffect(() => {
    const a = accounts.find((x) => x.id === accountId);
    if (a?.currency) setCurrency(normalizeCur(a.currency));
  }, [accountId, accounts]);

  async function handleSave() {
    setErrorMsg(null);

    const nAmount = Number(amount);
    if (!Number.isFinite(nAmount) || nAmount <= 0) {
      setErrorMsg("اكتب مبلغ صحيح أكبر من 0.");
      return;
    }
    if (!accountId) {
      setErrorMsg("اختار محفظة.");
      return;
    }
    if (!bucketId) {
      setErrorMsg("اختار تصنيف.");
      return;
    }
    if (!userId) {
      setErrorMsg("جلسة المستخدم غير جاهزة. جرّب تحديث الصفحة.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: userId,
      kind,
      amount: nAmount,
      currency: normalizeCur(currency),
      account_id: accountId,
      bucket_id: bucketId,
      date_iso: dateISO,
      note: note.trim() || null,
    };

    const { error } = await supabase.from("transactions").insert(payload);

    if (error) {
      setSaving(false);
      setErrorMsg("تعذّر حفظ العملية. تأكد من صلاحيات الجداول (RLS) أو أسماء الأعمدة.");
      return;
    }

    setSaving(false);
    router.replace("/transactions");
  }

  return (
    <main
      dir="rtl"
      style={{
        padding: 16,
        paddingTop: 50,
        paddingRight: 15,
        paddingBottom: 120,
        maxWidth: 560,
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F2F5F7 0%, #EEF2F5 60%, #EEF2F5 100%)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0B0F12" }}>إضافة معاملة</div>
        <a
    href="/transactions"
    style={{
      textDecoration: "none",
      fontWeight: 900,
      color: "rgba(0,0,0,0.75)",
      padding: "8px 12px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.9)",
    }}
  >
    رجوع
  </a>
</header>
<div style={{ height: 14 }} />


      {loading ? (
        <section style={CARD}>جاري تحميل المحافظ والتصنيفات...</section>
      ) : (
        <>
          {errorMsg && (
            <div
              style={{
                borderRadius: 18,
                padding: 12,
                fontWeight: 900,
                background: "rgba(239,68,68,0.10)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "rgba(127,29,29,1)",
              }}
            >
              {errorMsg}
            </div>
          )}

          {(accounts.length === 0 || buckets.length === 0) && (
            <section style={CARD}>
              <div style={{ fontWeight: 900, color: "#0B0F12" }}>قبل ما تضيف معاملة:</div>

              <div style={{ marginTop: 8, color: "rgba(0,0,0,0.70)", fontWeight: 800, fontSize: 13, lineHeight: 1.6 }}>
                {accounts.length === 0 ? "• ما في محافظ. روح على صفحة المحافظ واضف محفظة." : null}
                <br />
                {buckets.length === 0 ? "• ما في تصنيفات. روح على صفحة التصنيفات واضف تصنيف." : null}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <a
                  href="/accounts"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(0,0,0,0.88)",
                    color: "white",
                    fontWeight: 900,
                    textDecoration: "none",
                  }}
                >
                  المحافظ
                </a>
                <a
                  href="/buckets"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(0,0,0,0.88)",
                    color: "white",
                    fontWeight: 900,
                    textDecoration: "none",
                  }}
                >
                  التصنيفات
                </a>
              </div>
            </section>
          )}

          <section style={CARD}>
            {/* النوع */}
            <div>
              <div style={LABEL}>النوع</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setKind("expense")}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: kind === "expense" ? "var(--primary)" : "#fff",
                    color: kind === "expense" ? "#fff" : "#0B0F12",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  صرف
                </button>
                <button
                  type="button"
                  onClick={() => setKind("income")}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: kind === "income" ? "var(--primary)" : "#fff",
                    color: kind === "income" ? "#fff" : "#0B0F12",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  دخل
                </button>
              </div>
            </div>

            <div style={{ height: 12 }} />

            {/* المبلغ */}
            <label style={LABEL}>المبلغ</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="مثال: 25"
              style={INPUT}
            />

            <div style={{ height: 12 }} />

            {/* المحفظة */}
            <label style={LABEL}>المحفظة</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={accounts.length === 0}
              style={SELECT}
            >
              {accounts.length === 0 ? <option value="">لا يوجد محافظ</option> : null}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {normalizeCur(a.currency)}
                </option>
              ))}
            </select>

            <div style={{ height: 12 }} />

            {/* العملة (اختيار) */}
            <label style={LABEL}>العملة</label>
<div
  style={{
    ...INPUT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(0,0,0,0.03)",
    border: "1px solid rgba(0,0,0,0.08)",
  }}
>
  <span style={{ fontWeight: 900 }}>{normalizeCur(currency || "USD")}</span>
  <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
    تلقائي حسب المحفظة
  </span>
</div>


            <div style={{ height: 12 }} />

            {/* التصنيف */}
            <label style={LABEL}>التصنيف</label>
            <select value={bucketId} onChange={(e) => setBucketId(e.target.value)} disabled={filteredBuckets.length === 0} style={SELECT}>
              {filteredBuckets.length === 0 ? <option value="">لا يوجد تصنيفات لهذا النوع</option> : null}
              {filteredBuckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <div style={{ height: 12 }} />

            {/* التاريخ */}
            <label style={LABEL}>التاريخ</label>
            <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} style={INPUT} />

            <div style={{ height: 12 }} />

            {/* ملاحظة */}
            <label style={LABEL}>ملاحظة (اختياري)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: فواتير / مطعم ..." style={INPUT} />

            <button
              onClick={handleSave}
              disabled={saving || accounts.length === 0 || filteredBuckets.length === 0}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 13,
                borderRadius: 16,
                border: "1px solid transparent",
                background: saving ? "#D1D5DB" : "var(--primary)",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 14px 30px rgba(0,0,0,0.14)",
              }}
            >
              {saving ? "جاري الحفظ..." : "حفظ العملية"}
            </button>
          </section>
        </>
      )}

      <BottomNav />
    </main>
  );
}
