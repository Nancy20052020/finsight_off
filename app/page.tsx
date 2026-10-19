import { Landing } from "@/components/Landing";
import { addDays } from "@/lib/dates";
import { evaluate } from "@/lib/evaluate";
import { dailyBalance, forecast } from "@/lib/forecast";
import { loadBooks } from "@/lib/books";

export const dynamic = "force-static";

export default function Page() {
  const books = loadBooks();
  const { meta, transactions, invoices } = books;
  const result = forecast({
    transactions,
    invoices,
    opening: meta.opening_cash,
    historyStart: meta.history_start,
    asOf: meta.as_of,
    horizon: 90,
    nSims: 160,
  });
  const metrics = evaluate(transactions, invoices, meta.opening_cash, meta.history_start, meta.as_of);
  const historyStart = addDays(meta.as_of, -90);
  const historySeries = dailyBalance(transactions, meta.opening_cash, meta.history_start, meta.as_of);
  const history = historySeries.dates
    .map((date, index) => ({ date, value: historySeries.values[index] }))
    .filter((point) => point.date >= historyStart);
  const point = (dates: string[], values: number[]) => dates.map((date, index) => ({ date, value: values[index] }));

  return (
    <Landing
      history={history}
      balance={point(result.dates, result.balance)}
      low={point(result.dates, result.low)}
      high={point(result.dates, result.high)}
      baseline={point(result.dates, result.baseline)}
      shortfall={result.shortfallDate}
      cashToday={result.cashToday}
      modelMae={metrics.modelMae}
      baselineMae={metrics.baselineMae}
      leadDays={metrics.modelLeadDays}
    />
  );
}
