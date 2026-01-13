import { NextResponse } from "next/server";

// مصدر مجاني بدون API key
const OPEN_ACCESS_BASE = "https://open.er-api.com/v6/latest/";

// كاش بسيط في الذاكرة لتقليل الاستدعاءات
const memCache = new Map<string, { timeUnix: number; data: any }>();
const TTL_MS = 30 * 60 * 1000; // 30 دقيقة

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "USD").toUpperCase();

  const cached = memCache.get(base);
  const now = Date.now();
  if (cached && now - cached.timeUnix * 1000 < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const r = await fetch(`${OPEN_ACCESS_BASE}${encodeURIComponent(base)}`, {
    cache: "no-store",
  });

  if (!r.ok) {
    return NextResponse.json({ error: "rates_fetch_failed" }, { status: 500 });
  }

  const json = await r.json();

  const out = {
    base,
    timeUnix: Math.floor(Date.now() / 1000),
    rates: json?.rates ?? {},
  };

  memCache.set(base, { timeUnix: out.timeUnix, data: out });
  return NextResponse.json(out);
}
