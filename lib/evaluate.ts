import { addDays } from "./dates";
import { dailyBalance, forecast } from "./forecast";
import type { EvalMetrics, Invoice, Transaction } from "./types";

function booksAsOf(
  transactions: Transaction[],
  invoices: Invoice[],
  origin: string,
): { transactions: Transaction[]; invoices: Invoice[] } {
  return {
    transactions: transactions.filter((row) => row.date <= origin),
    invoices: invoices
      .filter((invoice) => invoice.issue_date <= origin)
      .map((invoice) => ({
        ...invoice,
        paid_date: invoice.paid_date && invoice.paid_date > origin ? null : invoice.paid_date,
      })),
  };
}

function leadDays(
  transactions: Transaction[],
  invoices: Invoice[],
  opening: number,
  historyStart: string,
  origins: string[],
  event: string,
  horizon: number,
  useBaseline: boolean,
): number | null {
  for (const origin of origins) {
    if (origin >= event) break;
    const books = booksAsOf(transactions, invoices, origin);
    const result = forecast({
      transactions: books.transactions,
      invoices: books.invoices,
      opening,
      historyStart,
      asOf: origin,
      horizon,
      nSims: 0,
    });
    const path = useBaseline ? result.baseline : result.balance;
    const flagged = result.dates.some(
      (day, index) => day > origin && day <= event && path[index] < 0,
    );
    if (flagged) {
      return (Date.parse(`${event}T00:00:00Z`) - Date.parse(`${origin}T00:00:00Z`)) / 86_400_000;
    }
  }
  return null;
}

export function evaluate(
  transactions: Transaction[],
  invoices: Invoice[],
  opening: number,
  historyStart: string,
  asOf: string,
  holdoutDays = 60,
  horizon = 21,
): EvalMetrics {
  const holdoutStart = addDays(asOf, -holdoutDays);
  const actual = dailyBalance(transactions, opening, historyStart, asOf);
  const actualAt = new Map(actual.dates.map((day, index) => [day, actual.values[index]]));
  const origins: string[] = [];
  let origin = holdoutStart;
  while (addDays(origin, horizon) <= asOf) {
    origins.push(origin);
    origin = addDays(origin, 7);
  }
  if (origins.length === 0) throw new Error("holdout is shorter than the forecast horizon");

  const modelErrors: number[] = [];
  const baselineErrors: number[] = [];
  for (const day of origins) {
    const books = booksAsOf(transactions, invoices, day);
    const result = forecast({
      transactions: books.transactions,
      invoices: books.invoices,
      opening,
      historyStart,
      asOf: day,
      horizon,
      nSims: 0,
    });
    result.dates.forEach((forecastDay, index) => {
      if (forecastDay <= day || forecastDay > asOf || !actualAt.has(forecastDay)) return;
      const actualBalance = actualAt.get(forecastDay) ?? 0;
      modelErrors.push(Math.abs(result.balance[index] - actualBalance));
      baselineErrors.push(Math.abs(result.baseline[index] - actualBalance));
    });
  }

  let event: string | null = null;
  for (let index = 0; index < actual.dates.length; index += 1) {
    const day = actual.dates[index];
    if (day > holdoutStart && day <= asOf && actual.values[index] < 0) {
      event = day;
      break;
    }
  }

  const modelMae = modelErrors.reduce((sum, value) => sum + value, 0) / modelErrors.length;
  const baselineMae = baselineErrors.reduce((sum, value) => sum + value, 0) / baselineErrors.length;
  return {
    holdoutStart,
    holdoutEnd: asOf,
    origins: origins.length,
    horizonDays: horizon,
    modelMae,
    baselineMae,
    modelImprovesMae: modelMae < baselineMae,
    shortfallEvent: event,
    modelLeadDays: event
      ? leadDays(transactions, invoices, opening, historyStart, origins, event, horizon, false)
      : null,
    baselineLeadDays: event
      ? leadDays(transactions, invoices, opening, historyStart, origins, event, horizon, true)
      : null,
  };
}
