"use client";

import { useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "white",
        border: "none",
        borderRadius: 20,
        boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </section>
  );
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

const MONTHS = [
  { key: "01", label: "JAN" },
  { key: "02", label: "FEB" },
  { key: "03", label: "MAR" },
  { key: "04", label: "APR" },
  { key: "05", label: "MAY" },
  { key: "06", label: "JUN" },
  { key: "07", label: "JUL" },
  { key: "08", label: "AUG" },
  { key: "09", label: "SEP" },
  { key: "10", label: "OCT" },
  { key: "11", label: "NOV" },
  { key: "12", label: "DEC" },
];

export default function IncomeBreakdownIndexPage() {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);

  const title = useMemo(() => `Income breakdown ${year}`, [year]);

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
          <div style={{ fontSize: 12, marginTop: 4, color: "rgba(0,0,0,0.65)" }}>
            اختر الشهر لفتح صفحة التقسيم
          </div>
        </div>

        <a href="/settings" style={topLinkStyle()}>
          رجوع
        </a>
      </header>

      <div style={{ height: 14 }} />

      <Card>
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "#000" }}>السنة</div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 14,
                  padding: "10px 12px",
                  fontWeight: 900,
                  background: "rgba(0,0,0,0.06)",
                  color: "#000",
                }}
              >
                −
              </button>

              <div
                style={{
                  minWidth: 90,
                  textAlign: "center",
                  fontWeight: 900,
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: "rgba(50,194,182,0.14)",
                  boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.26)",
                }}
              >
                {year}
              </div>

              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 14,
                  padding: "10px 12px",
                  fontWeight: 900,
                  background: "rgba(0,0,0,0.06)",
                  color: "#000",
                }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {MONTHS.map((m) => (
              <a
                key={m.key}
                href={`/income-breakdown/${year}/${m.key}`}
                style={{
                  borderRadius: 18,
                  padding: "14px 12px",
                  textDecoration: "none",
                  color: "#000",
                  background: "rgba(255,255,255,0.94)",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06), 0 10px 22px rgba(0,0,0,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  fontWeight: 900,
                }}
              >
                <span>{m.label}</span>
                <span style={{ opacity: 0.5 }}>›</span>
              </a>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
            ملاحظة: هذه الميزة نظرية فقط ولا تغيّر الحسابات أو العمليات.
          </div>
        </div>
      </Card>

      <BottomNav />
    </main>
  );
}
