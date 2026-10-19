import { addDays, dayOfMonth, eachDay, makeDay, weekdayMonday0, yearMonth } from "./dates";
import { money, roundTo } from "./format";
import {
  fitRidge,
  median,
  mulberry32,
  populationStd,
  predictRidge,
  pythonRoundInt,
  quantile,
  sampleStd,
  standardNormal,
  truncTowardZero,
} from "./stats";
import type { ForecastResult, Invoice, ScheduledItem, Transaction } from "./types";

const SCHEDULED_CATEGORIES = ["rent", "payroll", "loan", "marketing"] as const;
const EXCLUDED_FROM_VARIABLE = new Set<string>([...SCHEDULED_CATEGORIES, "client_payment", "opening"]);

const ASSUMPTIONS = [
  "Rent, payroll, loan, and marketing continue on their recent calendar days at the median amount.",
  "Open invoices are collected on the due date plus that customer's median historical delay, unless a scenario sets the date.",
  "Other daily spending is projected with a ridge regression on day-of-week and recent variable outflow.",
  "The band resamples historical payment delays and variable-spend residuals. It is a range of simulated paths, not a guarantee.",
  "Scenario results are calculations under these assumptions.",
];

export type ForecastOptions = {
  transactions: Transaction[];
  invoices: Invoice[];
  opening: number;
  historyStart: string;
  asOf: string;
  horizon?: number;
  nSims?: number;
  collectionOverrides?: Record<string, string>;
  expenseCuts?: Record<string, number>;
  seed?: number;
};

export function dailyBalance(
  transactions: Transaction[],
  opening: number,
  start: string,
  end: string,
): { dates: string[]; values: number[] } {
  if (end < start) throw new Error("end is before start");
  const nets = new Map<string, number>();
  for (const row of transactions) {
    if (row.date < start || row.date > end) continue;
    nets.set(row.date, (nets.get(row.date) ?? 0) + row.amount);
  }
  const dates = eachDay(start, end);
  const values: number[] = [];
  let running = opening;
  for (const day of dates) {
    running += nets.get(day) ?? 0;
    values.push(running);
  }
  return { dates, values };
}

export function cashOn(
  transactions: Transaction[],
  opening: number,
  start: string,
  day: string,
): number {
  const series = dailyBalance(transactions, opening, start, day);
  return series.values[series.values.length - 1];
}

function historyThrough(transactions: Transaction[], asOf: string): Transaction[] {
  return transactions.filter((row) => row.date <= asOf);
}

function recurringEvents(
  transactions: Transaction[],
  asOf: string,
  horizon: number,
): Omit<ScheduledItem, "cut">[] {
  const history = historyThrough(transactions, asOf);
  const end = addDays(asOf, horizon);
  const events: Omit<ScheduledItem, "cut">[] = [];
  for (const category of SCHEDULED_CATEGORIES) {
    const rows = history
      .filter((row) => row.category === category)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (rows.length === 0) continue;
    const rawDay = truncTowardZero(median(rows.map((row) => dayOfMonth(row.date))));
    const scheduledDay = Math.min(Math.max(rawDay, 1), 28);
    const recent = rows.slice(-6).map((row) => row.amount);
    const amount = median(recent);
    const counterparty = rows[rows.length - 1].counterparty;
    let { year, month } = yearMonth(asOf);
    const turns = Math.floor(horizon / 28) + 3;
    for (let step = 0; step < turns; step += 1) {
      const eventDay = makeDay(year, month, scheduledDay);
      if (eventDay > asOf && eventDay <= end) {
        events.push({
          date: eventDay,
          amount,
          category,
          counterparty,
          source: "recurring",
        });
      }
      if (month === 12) {
        year += 1;
        month = 1;
      } else {
        month += 1;
      }
    }
  }
  events.sort((a, b) => (a.date === b.date ? a.category.localeCompare(b.category) : a.date < b.date ? -1 : 1));
  return events;
}

type PaidDelay = { customer: string; delay: number };

function delayFrame(invoices: Invoice[], asOf: string): PaidDelay[] {
  const paid: PaidDelay[] = [];
  for (const invoice of invoices) {
    if (!invoice.paid_date || invoice.paid_date > asOf) continue;
    const delay = (Date.parse(`${invoice.paid_date}T00:00:00Z`) - Date.parse(`${invoice.due_date}T00:00:00Z`)) / 86_400_000;
    paid.push({ customer: invoice.customer, delay });
  }
  return paid;
}

type DelayStat = { median: number; std: number; n: number };

function delayStats(invoices: Invoice[], asOf: string): Map<string, DelayStat> {
  const grouped = new Map<string, number[]>();
  for (const row of delayFrame(invoices, asOf)) {
    const list = grouped.get(row.customer) ?? [];
    list.push(row.delay);
    grouped.set(row.customer, list);
  }
  const stats = new Map<string, DelayStat>();
  for (const [customer, delays] of grouped) {
    const std = sampleStd(delays);
    stats.set(customer, {
      median: median(delays),
      std: Number.isNaN(std) ? 0 : std,
      n: delays.length,
    });
  }
  return stats;
}

export function openInvoices(invoices: Invoice[], asOf: string): Invoice[] {
  return invoices.filter(
    (invoice) => invoice.issue_date <= asOf && (!invoice.paid_date || invoice.paid_date > asOf),
  );
}

function expectedCollection(
  due: string,
  customer: string,
  stats: Map<string, DelayStat>,
  asOf: string,
): { expected: string; delay: number; spread: number } {
  const stat = stats.get(customer);
  let delay = 10;
  let spread = 5;
  if (stat && stat.n >= 2) {
    delay = stat.median;
    spread = stat.std;
  }
  let expected = addDays(due, Math.max(pythonRoundInt(delay), 0));
  if (expected <= asOf) expected = addDays(asOf, 1);
  return { expected, delay, spread };
}

function variableSpend(
  transactions: Transaction[],
  start: string,
  asOf: string,
): { dates: string[]; values: number[] } {
  const daily = new Map<string, number>();
  for (const row of historyThrough(transactions, asOf)) {
    if (EXCLUDED_FROM_VARIABLE.has(row.category)) continue;
    daily.set(row.date, (daily.get(row.date) ?? 0) + row.amount);
  }
  const dates = eachDay(start, asOf);
  const values = dates.map((day) => Math.max(0, -(daily.get(day) ?? 0)));
  return { dates, values };
}

function fitVariable(dates: string[], values: number[]): {
  coef: number[];
  intercept: number;
  residualStd: number;
} {
  if (values.length < 8) {
    const recent = values.slice(-7);
    const average = recent.reduce((sum, value) => sum + value, 0) / Math.max(recent.length, 1);
    return { coef: Array(9).fill(0), intercept: average, residualStd: 0 };
  }
  const rows: number[][] = [];
  const targets: number[] = [];
  for (let index = 7; index < values.length; index += 1) {
    const features = Array(9).fill(0);
    features[weekdayMonday0(dates[index])] = 1;
    features[7] = values[index - 1];
    features[8] = values[index - 7];
    rows.push(features);
    targets.push(values[index]);
  }
  const model = fitRidge(rows, targets, 1);
  const fitted = rows.map((features) => predictRidge(model, features));
  const residual = targets.map((target, index) => target - fitted[index]);
  return { ...model, residualStd: populationStd(residual) };
}

function predictVariable(
  model: { coef: number[]; intercept: number },
  history: number[],
  future: string[],
): number[] {
  const values = [...history];
  const preds: number[] = [];
  for (const day of future) {
    const features = Array(9).fill(0);
    features[weekdayMonday0(day)] = 1;
    features[7] = values[values.length - 1];
    features[8] = values[values.length - 7];
    const pred = Math.max(0, predictRidge(model, features));
    preds.push(pred);
    values.push(pred);
  }
  return preds;
}

function sampleDelays(paid: PaidDelay[], customer: string): number[] {
  const delays = paid.filter((row) => row.customer === customer).map((row) => row.delay);
  if (delays.length < 2) return [10, 14, 20];
  return delays;
}

export function minSlice(values: number[], count: number): number {
  let lowest = Number.POSITIVE_INFINITY;
  const end = Math.min(count, values.length);
  for (let index = 0; index < end; index += 1) lowest = Math.min(lowest, values[index]);
  return lowest;
}

export function forecast(options: ForecastOptions): ForecastResult {
  const horizon = options.horizon ?? 90;
  const nSims = options.nSims ?? 200;
  const seed = options.seed ?? 7;
  if (horizon < 1) throw new Error("horizon must be positive");
  const cuts = options.expenseCuts ?? {};
  const overrides = options.collectionOverrides ?? {};
  const history = historyThrough(options.transactions, options.asOf);
  const cashToday = cashOn(history, options.opening, options.historyStart, options.asOf);
  const future = eachDay(addDays(options.asOf, 1), addDays(options.asOf, horizon));
  const futureIndex = new Map(future.map((day, index) => [day, index]));
  const stats = delayStats(options.invoices, options.asOf);
  const paid = delayFrame(options.invoices, options.asOf);
  const open = openInvoices(options.invoices, options.asOf);
  const recurring = recurringEvents(history, options.asOf, horizon);
  const nets = Array(horizon).fill(0);
  const scheduled: ScheduledItem[] = [];
  const delayNotes: string[] = [];

  for (const event of recurring) {
    const cut = Math.min(Math.max(cuts[event.category] ?? 0, 0), 1);
    const amount = event.amount * (1 - cut);
    const offset = futureIndex.get(event.date);
    if (offset !== undefined) nets[offset] += amount;
    scheduled.push({ ...event, amount, cut });
  }

  for (const invoice of open) {
    const customer = invoice.customer;
    let { expected, delay, spread } = expectedCollection(invoice.due_date, customer, stats, options.asOf);
    if (overrides[invoice.invoice_id]) {
      expected = overrides[invoice.invoice_id];
      spread = 0;
    }
    const offset = futureIndex.get(expected);
    if (offset !== undefined) nets[offset] += invoice.amount;
    scheduled.push({
      date: expected,
      amount: invoice.amount,
      category: "client_payment",
      counterparty: customer,
      source: "invoice",
      invoiceId: invoice.invoice_id,
      dueDate: invoice.due_date,
      delayDays: delay,
      delayStd: spread,
      cut: 0,
    });
    if (spread >= 7 && invoice.amount >= 5000) {
      delayNotes.push(
        `${customer} invoices have historically cleared about ${roundTo(delay, 0).toFixed(0)} days ` +
          `after the due date, with a spread of ${roundTo(spread, 0).toFixed(0)} days. ` +
          `${invoice.invoice_id} for ${money(invoice.amount)} is large enough that this timing ` +
          "moves the cash forecast.",
      );
    }
  }

  const spend = variableSpend(history, options.historyStart, options.asOf);
  const model = fitVariable(spend.dates, spend.values);
  const variable = predictVariable(model, spend.values, future);
  for (let index = 0; index < variable.length; index += 1) nets[index] -= variable[index];

  const balance = [cashToday];
  for (const value of nets) balance.push(balance[balance.length - 1] + value);

  const windowStart = addDays(options.asOf, -29);
  const dailyNet = new Map<string, number>();
  for (const row of history) {
    if (row.date < windowStart || row.date > options.asOf) continue;
    dailyNet.set(row.date, (dailyNet.get(row.date) ?? 0) + row.amount);
  }
  const windowDays = eachDay(windowStart, options.asOf);
  const trailing =
    windowDays.reduce((sum, day) => sum + (dailyNet.get(day) ?? 0), 0) / windowDays.length;
  const baseline = windowDays.length
    ? Array.from({ length: horizon + 1 }, (_, step) => cashToday + trailing * step)
    : [cashToday];

  const dates = [options.asOf, ...future];
  let low = [...balance];
  let high = [...balance];
  let prob30 = balance.slice(1, 31).some((value) => value < 0) ? 1 : 0;
  let prob90 = balance.slice(1).some((value) => value < 0) ? 1 : 0;

  if (nSims > 0) {
    const rng = mulberry32(seed);
    const paths = Array.from({ length: nSims }, () => Array(horizon + 1).fill(0));
    for (let sim = 0; sim < nSims; sim += 1) {
      const simNets = Array(horizon).fill(0);
      for (const event of recurring) {
        const cut = Math.min(Math.max(cuts[event.category] ?? 0, 0), 1);
        const offset = futureIndex.get(event.date);
        if (offset !== undefined) simNets[offset] += event.amount * (1 - cut);
      }
      for (const invoice of open) {
        let expected: string;
        if (overrides[invoice.invoice_id]) {
          expected = overrides[invoice.invoice_id];
        } else {
          const pool = sampleDelays(paid, invoice.customer);
          const delay = pool[Math.floor(rng() * pool.length)];
          expected = addDays(invoice.due_date, Math.max(pythonRoundInt(delay), 0));
          if (expected <= options.asOf) expected = addDays(options.asOf, 1);
        }
        const offset = futureIndex.get(expected);
        if (offset !== undefined) simNets[offset] += invoice.amount;
      }
      for (let index = 0; index < horizon; index += 1) {
        const noise = standardNormal(rng) * model.residualStd;
        simNets[index] -= Math.max(0, variable[index] + noise);
      }
      paths[sim][0] = cashToday;
      let running = cashToday;
      for (let index = 0; index < horizon; index += 1) {
        running += simNets[index];
        paths[sim][index + 1] = running;
      }
    }
    low = [];
    high = [];
    for (let day = 0; day < horizon + 1; day += 1) {
      const column = paths.map((path) => path[day]).sort((a, b) => a - b);
      low.push(quantile(column, 0.1));
      high.push(quantile(column, 0.9));
    }
    let hit30 = 0;
    let hit90 = 0;
    for (const path of paths) {
      if (path.slice(1, 31).some((value) => value < 0)) hit30 += 1;
      if (path.slice(1).some((value) => value < 0)) hit90 += 1;
    }
    prob30 = hit30 / nSims;
    prob90 = hit90 / nSims;
  }

  const shortfallDate = dates.find((day, index) => day > options.asOf && balance[index] < 0) ?? null;
  return {
    dates,
    balance,
    low,
    high,
    baseline,
    shortfallDate,
    shortfallProb30: prob30,
    shortfallProb90: prob90,
    scheduled,
    assumptions: ASSUMPTIONS,
    cashToday,
    asOf: options.asOf,
    delayNotes,
    variableDaily: variable,
  };
}

export function applyScenario(
  options: ForecastOptions & {
    invoiceId?: string | null;
    expectedDate?: string | null;
    category?: string | null;
    reductionPct?: number;
  },
): ForecastResult {
  const overrides =
    options.invoiceId && options.expectedDate
      ? { [options.invoiceId]: options.expectedDate }
      : undefined;
  const cuts =
    options.category && options.reductionPct
      ? { [options.category]: options.reductionPct }
      : undefined;
  return forecast({
    ...options,
    collectionOverrides: overrides,
    expenseCuts: cuts,
  });
}

export function positionStats(
  transactions: Transaction[],
  invoices: Invoice[],
  asOf: string,
): { invoiced: number; collected: number; expenses: number } {
  const start = addDays(asOf, -90);
  let invoiced = 0;
  let collected = 0;
  let expenses = 0;
  for (const invoice of invoices) {
    if (invoice.issue_date >= start && invoice.issue_date <= asOf) invoiced += invoice.amount;
  }
  for (const row of transactions) {
    if (row.date < start || row.date > asOf) continue;
    if (row.category === "client_payment") collected += row.amount;
    if (row.amount < 0) expenses += -row.amount;
  }
  return { invoiced, collected, expenses };
}
