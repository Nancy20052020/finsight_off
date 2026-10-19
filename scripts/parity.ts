import { spawnSync } from "node:child_process";

import { addDays } from "../lib/dates";
import { evaluate } from "../lib/evaluate";
import { explain } from "../lib/explain";
import { applyScenario, cashOn, forecast, positionStats } from "../lib/forecast";
import { loadBooks } from "../lib/books";
import type { Invoice, Transaction } from "../lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function close(actual: number, expected: number, tol = 0.05, label = "value"): void {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${label}: ${actual} != ${expected} (tol ${tol})`);
  }
}

function closeList(actual: number[], expected: number[], tol = 0.05, label = "series"): void {
  assert(actual.length === expected.length, `${label} length ${actual.length} != ${expected.length}`);
  let worst = 0;
  let worstIndex = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const gap = Math.abs(actual[index] - expected[index]);
    if (gap > worst) {
      worst = gap;
      worstIndex = index;
    }
  }
  if (worst > tol) {
    throw new Error(
      `${label}[${worstIndex}] ${actual[worstIndex]} != ${expected[worstIndex]} (gap ${worst})`,
    );
  }
}

function tx(rows: Transaction[]): Transaction[] {
  return rows;
}

function inv(rows: Invoice[]): Invoice[] {
  return rows;
}

function payrollHistory(asOf: string, amount = 1500): Transaction[] {
  const [yearText, monthText] = asOf.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  const rows: Transaction[] = [];
  for (let step = 0; step < 5; step += 1) {
    if (month === 1) {
      year -= 1;
      month = 12;
    } else {
      month -= 1;
    }
    const date = `${year}-${String(month).padStart(2, "0")}-23`;
    rows.push({
      date,
      amount: -amount,
      category: "payroll",
      counterparty: "Payroll",
      description: "payroll",
    } as Transaction);
  }
  return rows;
}

function handLedger(): void {
  const asOf = "2026-03-02";
  const start = "2025-10-01";
  const transactions = tx(payrollHistory(asOf, 1500));
  const level = cashOn(transactions, 0, start, asOf);
  const opening = 1000 - level;
  const invoices = inv([
    {
      invoice_id: "NONE",
      customer: "Nobody",
      amount: 1,
      issue_date: start,
      due_date: start,
      paid_date: start,
    },
  ]);
  const result = forecast({
    transactions,
    invoices,
    opening,
    historyStart: start,
    asOf,
    horizon: 30,
    nSims: 0,
  });
  assert(result.shortfallDate === "2026-03-23", `shortfall ${result.shortfallDate}`);
  close(result.cashToday, 1000, 0.01, "cash today");
  const index = (Date.parse("2026-03-23T00:00:00Z") - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000;
  assert(result.balance[index] < 0, "balance on shortfall day is negative");
}

function paymentShift(): void {
  const asOf = "2026-03-02";
  const start = addDays(asOf, -40);
  const amount = 1000;
  const transactions: Transaction[] = [
    { date: start, amount: 5000, category: "opening", counterparty: "Co", description: "opening" } as Transaction,
  ];
  const paidRows: Invoice[] = [];
  [1, 8, 15].forEach((offset, index) => {
    const issued = addDays(start, offset);
    const due = addDays(issued, 5);
    const paid = addDays(due, 5);
    paidRows.push({
      invoice_id: `P-${index}`,
      customer: "Northwind",
      amount: 400,
      issue_date: issued,
      due_date: due,
      paid_date: paid,
    });
    transactions.push({
      date: paid,
      amount: 400,
      category: "client_payment",
      counterparty: "Northwind",
      description: `P-${index}`,
    } as Transaction);
  });
  const openDue = addDays(asOf, 5);
  const invoices = inv([
    ...paidRows,
    {
      invoice_id: "OPEN",
      customer: "Northwind",
      amount,
      issue_date: addDays(asOf, -2),
      due_date: openDue,
      paid_date: null,
    },
  ]);
  const base = forecast({
    transactions,
    invoices,
    opening: 0,
    historyStart: start,
    asOf,
    horizon: 30,
    nSims: 0,
  });
  const shifted = applyScenario({
    transactions,
    invoices,
    opening: 0,
    historyStart: start,
    asOf,
    invoiceId: "OPEN",
    expectedDate: addDays(asOf, 16),
    horizon: 30,
    nSims: 0,
  });
  for (let day = 10; day < 16; day += 1) {
    close(shifted.balance[day], base.balance[day] - amount, 0.02, `shift day ${day}`);
  }
  for (let day = 16; day < 31; day += 1) {
    close(shifted.balance[day], base.balance[day], 0.02, `rejoined day ${day}`);
  }
}

function expenseCut(): void {
  const asOf = "2026-03-02";
  const start = "2025-09-01";
  const rows: Transaction[] = [];
  let cursor = "2025-10-18";
  while (cursor <= asOf) {
    rows.push({
      date: cursor,
      amount: -2000,
      category: "marketing",
      counterparty: "Ads",
      description: "marketing",
    } as Transaction);
    const [yearText, monthText] = cursor.split("-");
    let year = Number(yearText);
    let month = Number(monthText) + 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    cursor = `${year}-${String(month).padStart(2, "0")}-18`;
  }
  const transactions = tx(rows);
  const invoices = inv([
    {
      invoice_id: "NONE",
      customer: "Nobody",
      amount: 1,
      issue_date: start,
      due_date: start,
      paid_date: start,
    },
  ]);
  const opening = 10000 - cashOn(transactions, 0, start, asOf);
  const base = forecast({
    transactions,
    invoices,
    opening,
    historyStart: start,
    asOf,
    horizon: 40,
    nSims: 0,
  });
  const cut = applyScenario({
    transactions,
    invoices,
    opening,
    historyStart: start,
    asOf,
    category: "marketing",
    reductionPct: 0.5,
    horizon: 40,
    nSims: 0,
  });
  const eventIndex =
    (Date.parse("2026-03-18T00:00:00Z") - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000;
  close(cut.balance[eventIndex - 1], base.balance[eventIndex - 1], 0.02, "day before cut");
  close(cut.balance[eventIndex], base.balance[eventIndex] + 1000, 0.02, "cut day");
  close(cut.balance[cut.balance.length - 1], base.balance[base.balance.length - 1] + 1000, 0.02, "final cut");
}

function normalizeBullet(text: string): string {
  return text.replaceAll("$-", "-$");
}

function demoAgainstPython(): void {
  const python = spawnSync(".venv/bin/python", ["scripts/golden.py"], {
    encoding: "utf8",
    env: { ...process.env, PYTHONPATH: "src" },
  });
  if (python.status !== 0) {
    throw new Error(python.stderr || python.stdout || "python golden failed");
  }
  const golden = JSON.parse(python.stdout) as {
    cash_today: number;
    shortfall: string;
    balance: number[];
    baseline: number[];
    variable_daily: number[];
    min_30: number;
    min_90: number;
    bullets: string[];
    inflows: Record<string, number>;
    outflows: Record<string, number>;
    crossing: { date: string; amount: number; balance_after: number };
    scheduled: { date: string; amount: number; category: string; invoice_id: string | null }[];
    invoiced: number;
    collected: number;
    expenses: number;
    metrics: {
      model_mae: number;
      baseline_mae: number;
      model_improves_mae: boolean;
      model_lead_days: number | null;
      baseline_lead_days: number | null;
      shortfall_event: string;
      origins: number;
    };
    scenario_balance: number[];
    scenario_shortfall: string;
    scenario_min_30: number;
  };

  const books = loadBooks();
  const { meta, transactions, invoices } = books;
  const base = forecast({
    transactions,
    invoices,
    opening: meta.opening_cash,
    historyStart: meta.history_start,
    asOf: meta.as_of,
    horizon: 90,
    nSims: 0,
  });
  const story = explain(base, transactions);
  const position = positionStats(transactions, invoices, meta.as_of);
  const metrics = evaluate(transactions, invoices, meta.opening_cash, meta.history_start, meta.as_of);
  const scenario = applyScenario({
    transactions,
    invoices,
    opening: meta.opening_cash,
    historyStart: meta.history_start,
    asOf: meta.as_of,
    invoiceId: meta.hero_invoice_id,
    expectedDate: addDays(meta.as_of, 10),
    category: "marketing",
    reductionPct: 0.5,
    horizon: 90,
    nSims: 0,
  });

  close(base.cashToday, golden.cash_today, 0.02, "cash today");
  assert(base.shortfallDate === golden.shortfall, `shortfall ${base.shortfallDate}`);
  closeList(base.balance, golden.balance, 0.05, "balance");
  closeList(base.baseline, golden.baseline, 0.05, "baseline");
  closeList(base.variableDaily, golden.variable_daily, 0.05, "variable");
  close(story.min30, golden.min_30, 0.05, "min30");
  close(story.min90, golden.min_90, 0.05, "min90");
  close(position.invoiced, golden.invoiced, 0.02, "invoiced");
  close(position.collected, golden.collected, 0.02, "collected");
  close(position.expenses, golden.expenses, 0.02, "expenses");
  assert(story.crossing?.date === golden.crossing.date, "crossing date");
  close(story.crossing?.amount ?? 0, golden.crossing.amount, 0.02, "crossing amount");
  close(story.crossing?.balanceAfter ?? 0, golden.crossing.balance_after, 0.05, "crossing balance");
  assert(story.bullets.length === golden.bullets.length, `bullets ${story.bullets.length}`);
  story.bullets.forEach((bullet, index) => {
    assert(
      bullet === normalizeBullet(golden.bullets[index]),
      `bullet ${index}\n${bullet}\n${normalizeBullet(golden.bullets[index])}`,
    );
  });
  for (const [label, amount] of Object.entries(golden.inflows)) {
    close(story.inflows.find((row) => row.label === label)?.amount ?? NaN, amount, 0.02, label);
  }
  for (const [label, amount] of Object.entries(golden.outflows)) {
    close(story.outflows.find((row) => row.label === label)?.amount ?? NaN, amount, 0.02, label);
  }
  assert(base.scheduled.length === golden.scheduled.length, "scheduled length");
  base.scheduled.forEach((item, index) => {
    const expected = golden.scheduled[index];
    assert(item.date === expected.date, `scheduled date ${item.date} != ${expected.date}`);
    assert(item.category === expected.category, `scheduled category ${item.category}`);
    close(item.amount, expected.amount, 0.02, `scheduled amount ${item.category}`);
    assert((item.invoiceId ?? null) === expected.invoice_id, "invoice id");
  });
  close(metrics.modelMae, golden.metrics.model_mae, 0.05, "model mae");
  close(metrics.baselineMae, golden.metrics.baseline_mae, 0.05, "baseline mae");
  assert(metrics.modelImprovesMae === golden.metrics.model_improves_mae, "improves");
  assert(metrics.modelLeadDays === golden.metrics.model_lead_days, "model lead");
  assert(metrics.baselineLeadDays === golden.metrics.baseline_lead_days, "baseline lead");
  assert(metrics.shortfallEvent === golden.metrics.shortfall_event, "event");
  assert(metrics.origins === golden.metrics.origins, "origins");
  assert(scenario.shortfallDate === golden.scenario_shortfall, `scenario shortfall ${scenario.shortfallDate}`);
  closeList(scenario.balance, golden.scenario_balance, 0.05, "scenario balance");
  close(Math.min(...scenario.balance.slice(0, 31)), golden.scenario_min_30, 0.05, "scenario min30");
  console.log(
    `parity ok · shortfall ${base.shortfallDate} · MAE ${metrics.modelMae.toFixed(0)} vs ${metrics.baselineMae.toFixed(0)} · lead ${metrics.modelLeadDays}d`,
  );
}

handLedger();
paymentShift();
expenseCut();
demoAgainstPython();
