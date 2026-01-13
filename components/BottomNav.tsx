"use client";

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

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11l8-7 8 7v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconArchive() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 7h18v4H3V7Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11v9h14v-9" stroke="currentColor" strokeWidth="2" />
      <path d="M10 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconAccounts() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16v14H4V6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M7 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconBuckets() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 7v14h12V7" stroke="currentColor" strokeWidth="2" />
      <path d="M9 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15 3h-6l-.9 3.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L4 13a7.9 7.9 0 0 0-.1 1 7.9 7.9 0 0 0 .1 1l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1L9 23h6l.9-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  const is = (p: string) => pathname === p;

  return (
    <div
      data-bottom-nav="1"
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
          alignItems: "center",
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        <Item href="/settings" label="الإعدادات" icon={<IconSettings />} active={is("/settings")} />
        <Item href="/transactions" label="الأرشيف" icon={<IconArchive />} active={is("/transactions")} />
        <Item href="/" label="الرئيسية" icon={<IconHome />} active={is("/")} />
        <Item href="/buckets" label="الصناديق" icon={<IconBuckets />} active={is("/buckets")} />
        <Item href="/accounts" label="الحسابات" icon={<IconAccounts />} active={is("/accounts")} />
      </nav>
    </div>
  );
}
