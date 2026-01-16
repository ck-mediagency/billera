"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type MsgState = { type: "success" | "warn" | "error"; text: string } | null;

export default function SetupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<MsgState>(null);

  const [hasAccounts, setHasAccounts] = useState(false);
  const [hasCats, setHasCats] = useState(false);

  async function refresh() {
    setLoading(true);
    setMsg(null);

    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;

    if (!uid) {
      setMsg({ type: "error", text: "لا يوجد جلسة دخول. ارجع وسجّل دخول." });
      setLoading(false);
      return;
    }

    // ✅ جيب فقط Counts (أسرع وأوضح)
    const [accRes, catRes] = await Promise.all([
      supabase.from("accounts").select("id", { count: "exact", head: true }),
      supabase.from("buckets").select("id", { count: "exact", head: true }),
    ]);

    if (accRes.error) setMsg({ type: "error", text: accRes.error.message });
    if (catRes.error) setMsg({ type: "error", text: catRes.error.message });

    setHasAccounts((accRes.count ?? 0) > 0);
    setHasCats((catRes.count ?? 0) > 0);

    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // ✅ تحديث تلقائي عند الرجوع للصفحة
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = useMemo(() => hasAccounts && hasCats, [hasAccounts, hasCats]);

  async function finish() {
    // ✅ إذا بدك “علم” onboarding على Supabase:
    // نكتفي حالياً بالتوجيه، لأن AuthGate يعتمد على وجود accounts+buckets
    router.replace("/");
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F2F5F7 0%, #EEF2F5 70%, #EEF2F5 100%)",
        padding: 16,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <section
          style={{
            borderRadius: 22,
            background: "white",
            boxShadow: "0 14px 34px rgba(0,0,0,0.08)",
            padding: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0B0F12" }}>إعداد التطبيق</div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
               يرجى تجهيز البيانات الأساسية
              </div>
            </div>

            
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <CheckRow done={hasAccounts} title="المحفظات" desc="أضف محفظة (كاش/بنك/بطاقة…)" />
            <CheckRow done={hasCats} title="التصنيفات" desc="أضف تصنيفات للدخل والصرف (أكل، مواصلات…)" />

            <div
              style={{
                padding: "10px 12px",
                borderRadius: 16,
                background: ready ? "rgba(34,197,94,0.10)" : "rgba(0,0,0,0.03)",
                border: ready ? "1px solid rgba(34,197,94,0.20)" : "1px solid rgba(0,0,0,0.06)",
                fontWeight: 900,
                color: ready ? "rgba(22,101,52,1)" : "rgba(0,0,0,0.55)",
                textAlign: "center",
              }}
            >
              {ready ? " جاهز — اضغط (ابدأ الاستخدام)" : "أكمل الخطوات  لتبدأ استخدام التطبيق"}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <a href="/accounts" style={actionBtnStyle(false)}>
                إضافة محفظة
              </a>
              <a href="/buckets" style={actionBtnStyle(false)}>
                إضافة تصنيف
              </a>
            </div>

            <button
              type="button"
              onClick={finish}
              disabled={!ready}
              style={{
                width: "100%",
                padding: "14px 14px",
                borderRadius: 18,
                border: "1px solid transparent",
                background: ready ? "var(--primary)" : "#D1D5DB",
                color: "white",
                fontWeight: 900,
                fontSize: 14,
                cursor: ready ? "pointer" : "not-allowed",
                boxShadow: ready ? "0 14px 30px rgba(0,0,0,0.16)" : "none",
              }}
            >
              ابدأ الاستخدام
            </button>

            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)", textAlign: "center" }}>
              {ready ? "هيك صار التطبيق جاهز." : "لم يتم إضافة محفظات وتصنيفات بعد."}
            </div>
          </div>

          {msg && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 900,
                background: msg.type === "error" ? "rgba(239,68,68,0.10)" : "rgba(245,158,11,0.12)",
                border: msg.type === "error" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(245,158,11,0.28)",
                color: msg.type === "error" ? "rgba(127,29,29,1)" : "rgba(120,53,15,1)",
              }}
            >
              {msg.text}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CheckRow({ done, title, desc }: { done: boolean; title: string; desc: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 12px",
        borderRadius: 18,
        background: done ? "rgba(34,197,94,0.10)" : "rgba(0,0,0,0.03)",
        border: done ? "1px solid rgba(34,197,94,0.20)" : "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: done ? "rgba(34,197,94,0.16)" : "rgba(0,0,0,0.05)",
          fontWeight: 900,
        }}
        aria-hidden
      >
        {done ? "✓" : "•"}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, color: "#0B0F12" }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)", lineHeight: 1.5 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function actionBtnStyle(_outlined: boolean) {
  return {
    flex: 1,
    textAlign: "center" as const,
    padding: "12px 12px",
    borderRadius: 16,
    textDecoration: "none",
    fontWeight: 900,
    border: "1px solid transparent",
    background: "rgba(0,0,0,0.04)",
    color: "rgba(0,0,0,0.82)",
  };
}
