import { addDays } from "./dates";
import { money, oneDecimal } from "./format";
import { populationStd } from "./stats";
import type { ForecastResult, Story, Transaction } from "./types";

const USUAL_EXPENSES = new Set(["opening", "rent", "payroll", "loan"]);

export function crossingItem(result: ForecastResult): Story["crossing"] {
  if (!result.shortfallDate || result.scheduled.length === 0) return null;
  const frame = [...result.scheduled].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const future = result.dates.slice(1);
  const variableByDay = new Map(future.map((day, index) => [day, result.variableDaily[index] ?? 0]));
  let running = result.cashToday;
  let previous = result.asOf;
  const last = result.dates[result.dates.length - 1];
  let culprit: Story["crossing"] = null;
  for (const row of frame) {
    if (row.date <= result.asOf) continue;
    let cursor = addDays(previous, 1);
    while (cursor <= row.date && cursor <= last) {
      const skipVariable = cursor === row.date && row.category !== "client_payment";
      if (variableByDay.has(cursor) && !skipVariable) {
        running -= variableByDay.get(cursor) ?? 0;
      }
      if (cursor === row.date) break;
      cursor = addDays(cursor, 1);
    }
    const before = running;
    running += row.amount;
    if (culprit === null && before >= 0 && running < 0) {
      culprit = {
        date: row.date,
        amount: row.amount,
        category: row.category,
        counterparty: row.counterparty,
        balanceAfter: running,
      };
    }
    previous = row.date;
  }
  return culprit;
}

export type SpendSpike = { category: string; recent: number; mean: number; score: number | null };

export function spendSpikes(transactions: Transaction[], asOf: string): SpendSpike[] {
  const rows = transactions.filter((row) => row.amount < 0 && !USUAL_EXPENSES.has(row.category));
  const byCategory = new Map<string, Transaction[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }
  const spikes: SpendSpike[] = [];
  for (const category of [...byCategory.keys()].sort()) {
    const group = byCategory.get(category) ?? [];
    const windowTotal = (end: string) => {
      const start = addDays(end, -29);
      let total = 0;
      for (const row of group) {
        if (row.date >= start && row.date <= end) total += Math.abs(row.amount);
      }
      return total;
    };
    const recent = windowTotal(asOf);
    const prior = [];
    for (let shift = 30; shift < 180; shift += 30) {
      const value = windowTotal(addDays(asOf, -shift));
      if (value > 0) prior.push(value);
    }
    if (prior.length < 3 || recent === 0) continue;
    const spread = populationStd(prior);
    const mean = prior.reduce((sum, value) => sum + value, 0) / prior.length;
    if (spread === 0) {
      if (recent <= mean * 1.5) continue;
      spikes.push({ category, recent, mean, score: null });
      continue;
    }
    const score = (recent - mean) / spread;
    if (score > 2) spikes.push({ category, recent, mean, score });
  }
  return spikes;
}

export function unusualExpenses(transactions: Transaction[], asOf: string): string[] {
  return spendSpikes(transactions, asOf).map((spike) =>
    spike.score === null
      ? `${spike.category} spending over the last 30 days is ${money(spike.recent)}, ` +
        `against a prior 30-day average of ${money(spike.mean)} that did not vary.`
      : `${spike.category} spending over the last 30 days is ${money(spike.recent)}, ` +
        `which is ${oneDecimal(spike.score)} standard deviations above the prior 30-day average ` +
        `of ${money(spike.mean)}.`,
  );
}

export function explain(result: ForecastResult, transactions: Transaction[]): Story {
  const horizonEnd = addDays(result.asOf, 30);
  const window = result.scheduled.filter((row) => row.date > result.asOf && row.date <= horizonEnd);
  const inflowTotals = new Map<string, number>();
  const outflowTotals = new Map<string, number>();
  for (const row of window) {
    if (row.amount > 0) inflowTotals.set(row.counterparty, (inflowTotals.get(row.counterparty) ?? 0) + row.amount);
    if (row.amount < 0) outflowTotals.set(row.category, (outflowTotals.get(row.category) ?? 0) + row.amount);
  }
  const inflows = [...inflowTotals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
  const outflows = [...outflowTotals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => a.amount - b.amount);
  const crossing = crossingItem(result);
  const bullets: string[] = [];
  if (!result.shortfallDate) {
    const minimum = Math.min(...result.balance);
    bullets.push(
      `The base path stays non-negative over ${result.dates.length - 1} days. ` +
        `The lowest projected balance is ${money(minimum)}.`,
    );
  } else {
    const daysOut = (Date.parse(`${result.shortfallDate}T00:00:00Z`) - Date.parse(`${result.asOf}T00:00:00Z`)) / 86_400_000;
    bullets.push(
      `The base path drops below zero on ${result.shortfallDate} (${daysOut} days out).`,
    );
  }
  if (crossing) {
    bullets.push(
      `${crossing.counterparty} (${crossing.category}) of ${money(crossing.amount)} ` +
        `on ${crossing.date} is the scheduled item that takes cash through zero, ` +
        `to ${money(crossing.balanceAfter)}.`,
    );
  }
  bullets.push(...result.delayNotes);
  bullets.push(...unusualExpenses(transactions, result.asOf));
  return {
    inflows,
    outflows,
    crossing,
    bullets,
    assumptions: result.assumptions,
    min30: Math.min(...result.balance.slice(0, 31)),
    min90: Math.min(...result.balance),
  };
}
