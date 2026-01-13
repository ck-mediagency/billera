// lib/migrate.ts
import { loadState } from "@/lib/storage";
import { normalizeCur } from "@/lib/fx";
import { listAccounts, createAccount } from "@/lib/db";

type LocalAccount = { id: string; name: string; currency: string };

export async function migrateAccountsFromLocalIfNeeded() {
  // إذا Supabase فيه حسابات خلاص ما منعمل شي
  const sb = await listAccounts();
  if (sb.length > 0) return { migrated: false, reason: "supabase_has_data" as const };

  // إذا localStorage فاضي
  const local = loadState() as any;
  const localAccounts: LocalAccount[] = Array.isArray(local?.accounts) ? local.accounts : [];
  if (localAccounts.length === 0) return { migrated: false, reason: "local_empty" as const };

  // ارفع الحسابات (بدون الاعتماد على id القديم)
  for (const a of localAccounts) {
    const name = String(a?.name ?? "").trim();
    const currency = normalizeCur(String(a?.currency ?? "USD"));
    if (!name) continue;
    await createAccount({ name, currency });
  }

  return { migrated: true, reason: "migrated" as const, count: localAccounts.length };
}
