// lib/db.ts
import { supabase } from "@/lib/supabaseClient";
import { normalizeCur } from "@/lib/fx";

export type DbAccount = {
  id: string;        // uuid
  user_id: string;   // auth uid
  name: string;
  currency: string;
  created_at?: string;
  updated_at?: string;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("NOT_AUTH");
  return session.user.id;
}

/** ============ ACCOUNTS CRUD ============ */

export async function listAccounts(): Promise<DbAccount[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbAccount[];
}

export async function createAccount(input: { name: string; currency: string }): Promise<DbAccount> {
  const userId = await getUserId();
  const payload = {
    user_id: userId,
    name: input.name.trim(),
    currency: normalizeCur(input.currency),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("accounts").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as DbAccount;
}

export async function updateAccount(id: string, patch: Partial<{ name: string; currency: string }>) {
  const userId = await getUserId();
  const payload: any = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.name === "string") payload.name = patch.name.trim();
  if (typeof patch.currency === "string") payload.currency = normalizeCur(patch.currency);

  const { error } = await supabase
    .from("accounts")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteAccount(id: string) {
  const userId = await getUserId();
  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
