"use client";

import React from "react";
import { usePathname } from "next/navigation";

function Item({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        flex: 1,
        textDecoration: "none",
        color: active ? "var(--primary)" : "rgba(0,0,0,0.55)",
        display: "grid",
        justifyItems: "center",
        gap: 6,
        padding: "10px 6px",
        fontWeight: 900,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          display: "grid",
          placeItems: "center",
          background: active ? "rgba(50,194,182,0.18)" : "transparent",
          boxShadow: active ? "inset 0 0 0 1px rgba(50,194,182,0.28)" : "none",
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 12, fontWeight: 900 }}>{label}</div>
    </a>
  );
}

/* ================= ICONS ================= */

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" stroke="currentColor" strokeWidth="2" />
      <path d="M9 22v-7h6v7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconTransactions() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 6h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.5" fill="currentColor" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconCategories() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconWallets() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7a3 3 0 0 1 3-3h12a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="3" y="7" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.9 3.1a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1L9 21h6l.9-3.1a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7.4 7.4 0 0 0 .1-1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ================= NAV ================= */

export default function BottomNav() {
  const pathname = usePathname();
  const is = (p: string) => pathname === p || pathname.startsWith(p + "/");

  // ✅ أخفي البوتم بهالصفحات فقط
  const HIDE_ON = ["/accounts", "/buckets","/add"];
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 70,
        display: "flex",
        justifyContent: "center",
        padding: "12px 14px 18px",
        pointerEvents: "none",
      }}
    >
      <nav
        style={{
          width: "min(560px, 100%)",
          borderRadius: 22,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
          backdropFilter: "blur(10px)",
          display: "flex",
          pointerEvents: "auto",
        }}
      >
        <Item href="/settings" label="الإعدادات" icon={<IconSettings />} active={is("/settings")} />
        <Item href="/transactions" label="العمليات" icon={<IconTransactions />} active={is("/transactions")} />
        <Item href="/" label="الرئيسية" icon={<IconHome />} active={is("/")} />
        <Item href="/buckets" label="التصنيفات" icon={<IconCategories />} active={is("/buckets")} />
        <Item href="/accounts" label="المحفظات" icon={<IconWallets />} active={is("/accounts")} />
      </nav>
    </div>
  );
}
