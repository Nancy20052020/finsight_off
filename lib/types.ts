export type Transaction = {
  date: string;
  amount: number;
  category: string;
  counterparty: string;
};

export type Invoice = {
  invoice_id: string;
  customer: string;
  amount: number;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
};

export type Meta = {
  company: string;
  as_of: string;
  history_start: string;
  opening_cash: number;
  target_cash: number;
  hero_invoice_id: string;
  hero_customer: string;
  discretionary_category: string;
};

export type Books = {
  transactions: Transaction[];
  invoices: Invoice[];
  meta: Meta;
};

export type ScheduledItem = {
  date: string;
  amount: number;
  category: string;
  counterparty: string;
  source: "recurring" | "invoice";
  invoiceId?: string;
  dueDate?: string;
  delayDays?: number;
  delayStd?: number;
  cut: number;
};

export type ForecastResult = {
  dates: string[];
  balance: number[];
  low: number[];
  high: number[];
  baseline: number[];
  shortfallDate: string | null;
  shortfallProb30: number;
  shortfallProb90: number;
  scheduled: ScheduledItem[];
  assumptions: string[];
  cashToday: number;
  asOf: string;
  delayNotes: string[];
  variableDaily: number[];
};

export type Crossing = {
  date: string;
  amount: number;
  category: string;
  counterparty: string;
  balanceAfter: number;
};

export type Story = {
  inflows: { label: string; amount: number }[];
  outflows: { label: string; amount: number }[];
  crossing: Crossing | null;
  bullets: string[];
  assumptions: string[];
  min30: number;
  min90: number;
};

export type EvalMetrics = {
  holdoutStart: string;
  holdoutEnd: string;
  origins: number;
  horizonDays: number;
  modelMae: number;
  baselineMae: number;
  modelImprovesMae: boolean;
  shortfallEvent: string | null;
  modelLeadDays: number | null;
  baselineLeadDays: number | null;
};
