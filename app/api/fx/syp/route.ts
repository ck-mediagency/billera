import { NextResponse } from "next/server";

export const runtime = "nodejs"; // مهم لضمان وجود process.env

export async function GET() {
  const raw = process.env.SYP_RATE; // تحطها بالـ .env
  const rate = Number(raw);

  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json(
      { error: "SYP_RATE is not configured" },
      { status: 500 }
    );
  }

  // ملاحظة: ما في شي هون بيسمح بالتعديل، فقط قراءة
  return NextResponse.json({ rate });
}
