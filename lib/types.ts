export type TxKind = "income" | "expense";

export type Account = {
  id: string;
  name: string;
  currency: string; // مثل USD/EUR/TRY
};

export type Tx = {
  id: string;
  kind: TxKind;
  amount: number;
  currency: string;
  accountId: string;
  dateISO: string; // YYYY-MM-DD
  note?: string;

  // ✅ جديد: الصندوق (Category/Bucket)
  bucketId?: string;

  // ✅ جديد: تثبيت التحويل وقت الإدخال (اختياري حتى لا تنكسر البيانات القديمة)
  baseAmount?: number; // قيمة العملية محسوبة على baseCurrency وقت الإدخال
  baseCurrencySnapshot?: string; // مثل USD/EUR (نفس baseCurrency وقت الإدخال)
};

export type AppState = {
  baseCurrency: string; // افتراضي USD
  accounts: Account[];
  txs: Tx[];
};

export type RatesResponse = {
  base: string;
  timeUnix: number;
  rates: Record<string, number>; // 1 base = rates[CUR] من CUR
};
