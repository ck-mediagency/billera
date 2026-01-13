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
} from "@/lib/fx";
import { supabase } from "@/lib/supabaseClient";

type Bucket = { id: string; name: string };

type ExtendedState = AppState & {
  incomeBuckets?: Bucket[];
  expenseBuckets?: Bucket[];
  [k: string]: any;
};

function defaultState(): ExtendedState {
  return {
    baseCurrency: "USD",
    accounts: [],
    txs: [],
    incomeBuckets: [],
    expenseBuckets: [],
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

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return { y, m, d };
}

function fmtDateNice(iso: string) {
  try {
    const { y, m, d } = parseISO(iso);
    if (!y || !m || !d) return "";
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  } catch {
    return "";
  }
}

function daysInMonth(y: number, m1: number) {
  return new Date(y, m1, 0).getDate();
}

function weekdayMon0(date: Date) {
  const js = date.getDay(); // Sun=0..Sat=6
  return (js + 6) % 7; // Mon=0..Sun=6
}

const CARD: React.CSSProperties = {
  background: "white",
  border: "none",
  borderRadius: 20,
  boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
};

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

function segBtn(active: boolean) {
  return {
    flex: 1,
    borderRadius: 16,
    padding: "12px 12px",
    fontWeight: 900 as const,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--primary)" : "rgba(0,0,0,0.06)",
    color: active ? "white" : "#000",
  };
}

function labelStyle() {
  return {
    fontSize: 12,
    color: "rgba(0,0,0,0.65)",
    fontWeight: 800 as const,
    marginBottom: 6,
  };
}

function inputStyle() {
  return {
    width: "100%",
    borderRadius: 16,
    padding: "12px 12px",
    border: "1px solid rgba(0,0,0,0.08)",
    outline: "none",
    fontWeight: 900 as const,
    color: "#000",
    background: "white",
  } as React.CSSProperties;
}

function subtleNote() {
  return { fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 800 as const };
}

function ChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar(props: { size?: number }) {
  const s = props.size ?? 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3v3M17 3v3M4.5 9.5h15"
        stroke="rgba(0,0,0,0.65)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.5 6h11A3.5 3.5 0 0 1 21 9.5v9A3.5 3.5 0 0 1 17.5 22h-11A3.5 3.5 0 0 1 3 18.5v-9A3.5 3.5 0 0 1 6.5 6Z"
        stroke="rgba(0,0,0,0.65)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.5 6.5 9 12l5.5 5.5"
        stroke="#000"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 6.5 15 12l-5.5 5.5"
        stroke="#000"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type PickOption = { value: string; label: string; sub?: string };

function PickerField({
  label,
  value,
  onChange,
  options,
  placeholder,
  emptyText,
  rightLink,
  rightLinkHref,
  requiredBadge,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: PickOption[];
  placeholder?: string;
  emptyText?: string;
  rightLink?: string;
  rightLinkHref?: string;
  requiredBadge?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = options.find((o) => o.value === value);

  function calcPos() {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 10, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    calcPos();

    const onResize = () => calcPos();
    const onScroll = () => calcPos();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={labelStyle()}>
          {label}{" "}
          {requiredBadge ? (
            <span
              style={{
                marginInlineStart: 6,
                fontSize: 11,
                fontWeight: 900,
                color: "rgba(0,0,0,0.65)",
                background: "rgba(0,0,0,0.06)",
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              إلزامي
            </span>
          ) : null}
        </div>

        {rightLink && rightLinkHref ? (
          <a href={rightLinkHref} style={{ fontSize: 12, fontWeight: 900, color: "var(--primary)", textDecoration: "none" }}>
            {rightLink}
          </a>
        ) : null}
      </div>

      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          borderRadius: 16,
          padding: "12px 44px 12px 12px",
          border: "none",
          background: "rgba(255,255,255,0.95)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
          textAlign: "right",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <div style={{ fontWeight: 900, color: selected ? "#000" : "rgba(0,0,0,0.55)" }}>
          {selected?.label ?? placeholder ?? "اختر"}
        </div>
        {selected?.sub ? (
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>{selected.sub}</div>
        ) : null}

        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.95 }}>
          <ChevronDown />
        </div>
      </button>

      {open && pos ? (
        <>
          <div style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 9998 }} />

          <div
            ref={panelRef}
            style={{
              position: "fixed",
              zIndex: 9999,
              top: pos.top,
              left: pos.left,
              width: pos.width,
              borderRadius: 18,
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)",
              boxShadow: "0 26px 70px rgba(0,0,0,0.18)",
              overflow: "hidden",
              maxHeight: "40vh",
            }}
          >
            <div style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(0,0,0,0.8)" }}>{label}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: 12,
                  padding: "6px 10px",
                  fontWeight: 900,
                  cursor: "pointer",
                  color: "#000",
                }}
              >
                إغلاق
              </button>
            </div>

            <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />

            <div style={{ padding: 10, overflow: "auto", maxHeight: "calc(40vh - 52px)" }}>
              {options.length === 0 ? (
                <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)", fontWeight: 900, color: "rgba(0,0,0,0.6)" }}>
                  {emptyText ?? "لا يوجد خيارات"}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {options.map((o) => {
                    const active = o.value === value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        style={{
                          border: "none",
                          textAlign: "right",
                          borderRadius: 16,
                          padding: "10px 10px",
                          cursor: "pointer",
                          background: active ? "rgba(50,194,182,0.14)" : "rgba(0,0,0,0.04)",
                          boxShadow: active ? "inset 0 0 0 1px rgba(50,194,182,0.35)" : "none",
                        }}
                      >
                        <div style={{ fontWeight: 900, color: "#000" }}>{o.label}</div>
                        {o.sub ? <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>{o.sub}</div> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** ✅ Date Picker */
function DatePickerField({ label, valueISO, onChangeISO }: { label: string; valueISO: string; onChangeISO: (iso: string) => void }) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const nowISO = todayISO();
  const nice = valueISO ? fmtDateNice(valueISO) : "";

  const init = (() => {
    const base = valueISO || nowISO;
    const { y, m } = parseISO(base);
    return { y: y || new Date().getFullYear(), m1: m || new Date().getMonth() + 1 };
  })();

  const [viewY, setViewY] = useState<number>(init.y);
  const [viewM1, setViewM1] = useState<number>(init.m1);

  useEffect(() => {
    if (!open) return;
    const base = valueISO || nowISO;
    const { y, m } = parseISO(base);
    if (y && m) {
      setViewY(y);
      setViewM1(m);
    }
  }, [open, valueISO]);

  function calcPos() {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    const vw = window.innerWidth;
    const margin = 12;

    const desiredW = Math.min(300, Math.max(250, r.width));
    const left = Math.min(vw - desiredW - margin, Math.max(margin, r.left));

    setPos({ top: r.bottom + 8, left, width: desiredW });
  }

  useEffect(() => {
    if (!open) return;
    calcPos();

    const onResize = () => calcPos();
    const onScroll = () => calcPos();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const weekArMon = ["ن", "ث", "ر", "خ", "ج", "س", "ح"];

  const first = new Date(viewY, viewM1 - 1, 1);
  const offset = weekdayMon0(first);
  const dim = daysInMonth(viewY, viewM1);

  const selected = valueISO ? parseISO(valueISO) : null;
  const today = parseISO(nowISO);

  const cells: Array<{ day?: number }> = [];
  for (let i = 0; i < offset; i++) cells.push({});
  for (let d = 1; d <= dim; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({});

  function isoOf(day: number) {
    const y = viewY;
    const m = String(viewM1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function prevMonth() {
    setViewM1((m) => {
      if (m === 1) {
        setViewY((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewM1((m) => {
      if (m === 12) {
        setViewY((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={labelStyle()}>{label}</div>

      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          borderRadius: 16,
          padding: "12px 44px 12px 12px",
          border: "none",
          background: "rgba(255,255,255,0.95)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
          textAlign: "right",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <div style={{ fontWeight: 900, color: nice ? "#000" : "rgba(0,0,0,0.55)" }}>{nice || "اختر تاريخ"}</div>

        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.95 }}>
          <IconCalendar />
        </div>
      </button>

      {open && pos ? (
        <>
          <div style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 9998 }} />

          <div
            ref={panelRef}
            style={{
              position: "fixed",
              zIndex: 9999,
              top: pos.top,
              left: pos.left,
              width: pos.width,
              borderRadius: 18,
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)",
              boxShadow: "0 22px 58px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 13, color: "#000" }}>{label}</div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={prevMonth}
                  style={{
                    width: 32,
                    height: 32,
                    border: "none",
                    background: "rgba(0,0,0,0.10)",
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label="السابق"
                >
                  <ArrowRight />
                </button>

                <button
                  type="button"
                  onClick={nextMonth}
                  style={{
                    width: 32,
                    height: 32,
                    border: "none",
                    background: "rgba(0,0,0,0.10)",
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label="التالي"
                >
                  <ArrowLeft />
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    border: "none",
                    background: "rgba(0,0,0,0.06)",
                    borderRadius: 12,
                    padding: "6px 10px",
                    fontWeight: 900,
                    cursor: "pointer",
                    color: "#000",
                  }}
                >
                  إغلاق
                </button>
              </div>
            </div>

            <div style={{ padding: "0 10px 8px" }}>
              <div style={{ fontWeight: 900, color: "#000", marginBottom: 8, textAlign: "center" }}>
                {monthsAr[viewM1 - 1]} {viewY}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 6 }}>
                {weekArMon.map((w) => (
                  <div key={w} style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,0.55)", textAlign: "center" }}>
                    {w}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, paddingBottom: 8 }}>
                {cells.map((c, idx) => {
                  if (!c.day) return <div key={idx} style={{ height: 30 }} />;

                  const isSel = !!selected && selected.y === viewY && selected.m === viewM1 && selected.d === c.day;
                  const isToday = today.y === viewY && today.m === viewM1 && today.d === c.day;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onChangeISO(isoOf(c.day!));
                        setOpen(false);
                      }}
                      style={{
                        height: 30,
                        borderRadius: 11,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: 12,
                        background: isSel
                          ? "linear-gradient(180deg, rgba(50,194,182,1) 0%, rgba(50,194,182,0.85) 100%)"
                          : isToday
                          ? "rgba(50,194,182,0.16)"
                          : "rgba(0,0,0,0.05)",
                        color: isSel ? "white" : "#000",
                        boxShadow: isSel ? "0 10px 18px rgba(0,0,0,0.14)" : "none",
                      }}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 10, paddingBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    onChangeISO(nowISO);
                    setOpen(false);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    padding: "10px 10px",
                    border: "none",
                    background: "rgba(50,194,182,0.14)",
                    boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.35)",
                    fontWeight: 900,
                    cursor: "pointer",
                    color: "#000",
                  }}
                >
                  اليوم
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    padding: "10px 10px",
                    border: "none",
                    background: "rgba(0,0,0,0.08)",
                    fontWeight: 900,
                    cursor: "pointer",
                    color: "#000",
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AddTxPage() {
  const [state, setState] = useState<ExtendedState>(defaultState());
  const [hydrated, setHydrated] = useState(false);

  // ✅ NEW: localStorage key per-user
  const [localUserId, setLocalUserId] = useState<string | null>(null);

  const [kind, setKind] = useState<"income" | "expense">("income");
  const [accountId, setAccountId] = useState<string>("");
  const [bucketId, setBucketId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [amount, setAmount] = useState<string>("");
  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [paymentDesc, setPaymentDesc] = useState<string>("");

  function refreshFromStorage(uid: string | null) {
    const s = loadState(uid) as ExtendedState | null;
    if (s) {
      const next: ExtendedState = {
        ...defaultState(),
        ...s,
        incomeBuckets: s.incomeBuckets ?? [],
        expenseBuckets: s.expenseBuckets ?? [],
      };

      setState(next);

      const firstAcc = (next.accounts ?? [])[0]?.id || "";
      setAccountId((prev) => prev || firstAcc);

      const base = normalizeCur(next.baseCurrency || "USD");
      setCurrency((prev) => normalizeCur(prev || base));
    } else {
      setState(defaultState());
    }
  }

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id ?? null;
        if (!alive) return;

        setLocalUserId(uid);
        refreshFromStorage(uid);
        setHydrated(true);
      } catch {
        if (!alive) return;
        setLocalUserId(null);
        refreshFromStorage(null);
        setHydrated(true);
      }
    }

    init();

    const onFocus = () => refreshFromStorage(localUserId);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshFromStorage(localUserId);
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

  useEffect(() => {
    if (!hydrated) return;
    refreshFromStorage(localUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localUserId]);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state as any, localUserId);
  }, [state, hydrated, localUserId]);

  const baseCur = normalizeCur(state.baseCurrency || "USD");
  const monthLabel = monthKeyFromISO(dateISO || todayISO()).replace("-", "/");

  const buckets = useMemo(() => {
    return kind === "income" ? state.incomeBuckets ?? [] : state.expenseBuckets ?? [];
  }, [kind, state.incomeBuckets, state.expenseBuckets]);

  useEffect(() => {
    const first = buckets[0]?.id || "";
    setBucketId((prev) => {
      if (!prev) return first;
      const ok = buckets.some((b) => b.id === prev);
      return ok ? prev : first;
    });
  }, [buckets]);

  useEffect(() => {
    const acc = (state.accounts ?? []).find((a: any) => a.id === accountId);
    if (!acc) return;
    setCurrency(normalizeCur(acc.currency || baseCur));
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountOptions: PickOption[] = useMemo(() => {
    return (state.accounts ?? []).map((a: any) => ({
      value: a.id,
      label: `${a.name} (${normalizeCur(a.currency)})`,
      sub: `عملة الحساب: ${normalizeCur(a.currency)}`,
    }));
  }, [state.accounts]);

  const bucketOptions: PickOption[] = useMemo(() => {
    return buckets.map((b) => ({ value: b.id, label: b.name }));
  }, [buckets]);

  const currencyOptions: PickOption[] = useMemo(() => {
    return IMPORTANT_CURRENCIES.map((c) => ({ value: c, label: c }));
  }, []);

  useEffect(() => {
    if (!accountId && accountOptions[0]?.value) setAccountId(accountOptions[0].value);
  }, [accountOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveTx() {
    const a = parseFloat(amount || "0");
    if (!Number.isFinite(a) || a <= 0) {
      alert("أدخل مبلغ صحيح.");
      return;
    }
    if (!accountId) {
      alert("اختر حساب.");
      return;
    }
    if (!bucketId) {
      alert("اختر صندوق.");
      return;
    }
    if (!dateISO) {
      alert("اختر تاريخ.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      alert("سجّل دخول أولاً");
      return;
    }
    const userId = session.user.id;

    const cur = normalizeCur(currency || baseCur);
    const bc = normalizeCur(state.baseCurrency || "USD");

    const accChk = await supabase.from("accounts").select("id").eq("id", accountId).eq("user_id", userId).maybeSingle();
    if (accChk.error) {
      alert(accChk.error.message);
      return;
    }
    if (!accChk.data?.id) {
      alert("الحساب غير موجود على السيرفر. افتح صفحة الحسابات ثم جرّب مرة ثانية.");
      return;
    }

    let safeBucketId: string | null = bucketId;
    try {
      const chk = await supabase.from("buckets").select("id").eq("id", bucketId).eq("user_id", userId).maybeSingle();
      if (chk.error) throw chk.error;
      if (!chk.data?.id) safeBucketId = null;
    } catch {
      safeBucketId = null;
    }

    const rates = ratesFromState(state);
    const baseAmount = roundMoney(
      txValueInBase(
        {
          kind,
          amount: a,
          currency: cur,
          accountId,
          dateISO,
          bucketId: safeBucketId ?? undefined,
        } as any,
        bc,
        rates
      ),
      2
    );

    const txId = crypto.randomUUID();

    const ins = await supabase.from("transactions").insert({
      id: txId,
      user_id: userId,
      kind,
      amount: r2(a),
      currency: cur,
      account_id: accountId,
      date_iso: dateISO,
      note: paymentDesc?.trim() ? paymentDesc.trim() : null,
      bucket_id: safeBucketId,
      base_amount: r2(baseAmount),
      base_currency_snapshot: bc,
      updated_at: new Date().toISOString(),
    });

    if (ins.error) {
      alert(ins.error.message);
      return;
    }

    const tx = {
      id: txId,
      kind,
      amount: r2(a),
      currency: cur,
      accountId,
      dateISO,
      note: paymentDesc?.trim() ? paymentDesc.trim() : undefined,
      bucketId: safeBucketId ?? undefined,
      baseAmount: r2(baseAmount),
      baseCurrencySnapshot: bc,
    };

    setState((prev) => ({ ...prev, txs: [...(prev.txs ?? []), tx] }));

    setAmount("");
    setPaymentDesc("");
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
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2, color: "#000" }}>إضافة عملية</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "rgba(0,0,0,0.65)" }}>
            الشهر: <span style={{ fontWeight: 900, color: "#000" }}>{monthLabel}</span> · العملة الأساسية:{" "}
            <span style={{ fontWeight: 900, color: "var(--primary)" }}>{baseCur}</span>
          </div>
        </div>

        <a href="/" style={topLinkStyle()}>
          رجوع
        </a>
      </header>

      <section
        style={{
          marginTop: 12,
          borderRadius: 24,
          padding: 14,
          background: "linear-gradient(135deg, rgba(50,194,182,0.14) 0%, rgba(50,194,182,0.08) 45%, rgba(255,255,255,0.55) 100%)",
          border: "none",
          boxShadow: "0 14px 34px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setKind("income")} style={segBtn(kind === "income")}>
            دخل
          </button>
          <button type="button" onClick={() => setKind("expense")} style={segBtn(kind === "expense")}>
            صرف
          </button>
        </div>

        <div style={{ marginTop: 10, ...subtleNote() }}>اختر الحساب والصندوق ثم أدخل المبلغ.</div>
      </section>

      <section style={{ ...CARD, marginTop: 12, padding: 14 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <PickerField label="الحساب" value={accountId} onChange={setAccountId} options={accountOptions} placeholder="اختر حساب" emptyText="لا يوجد حسابات" />

          <PickerField
            label="الصندوق"
            requiredBadge
            value={bucketId}
            onChange={setBucketId}
            options={bucketOptions}
            placeholder="اختر صندوق"
            emptyText="لا يوجد صناديق"
            rightLink="إدارة الصناديق"
            rightLinkHref="/buckets"
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
            <div>
              <div style={labelStyle()}>المبلغ</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="مثال: 50" style={inputStyle()} />
            </div>

            <PickerField label="العملة" value={currency} onChange={(v) => setCurrency(normalizeCur(v))} options={currencyOptions} />
          </div>

          <DatePickerField label="التاريخ" valueISO={dateISO} onChangeISO={setDateISO} />

          <div>
            <div style={labelStyle()}>توضيح الدفعة</div>
            <input value={paymentDesc} onChange={(e) => setPaymentDesc(e.target.value)} placeholder="مثال: راتب / فاتورة / مشتريات سوبر ماركت" style={inputStyle()} />
          </div>

          <button
            onClick={saveTx}
            style={{
              marginTop: 2,
              borderRadius: 18,
              padding: "14px 14px",
              fontWeight: 900,
              border: "none",
              background: "linear-gradient(180deg, rgba(50,194,182,1) 0%, rgba(50,194,182,0.85) 100%)",
              color: "white",
              cursor: "pointer",
              boxShadow: "0 14px 30px rgba(0,0,0,0.16)",
            }}
          >
            حفظ العملية
          </button>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
