"use client";

import { useMemo, useState } from "react";

import { CashChart } from "@/components/CashChart";
import { addDays, monthDayLabel } from "@/lib/dates";
import { evaluate } from "@/lib/evaluate";
import { explain } from "@/lib/explain";
import {
  applyScenario,
  dailyBalance,
  forecast,
  minSlice,
  openInvoices,
  positionStats,
} from "@/lib/forecast";
import { money, percent, signedMoney } from "@/lib/format";
import type { Books } from "@/lib/types";

const EXPENSE_CHOICES = ["marketing", "contractor", "software"] as const;

export function Dashboard({ books, note }: { books: Books; note?: string }) {
  const { meta, transactions, invoices } = books;
  const asOf = meta.as_of;
  const open = useMemo(() => openInvoices(invoices, asOf), [invoices, asOf]);
  const openIds = open.map((invoice) => invoice.invoice_id);
  const defaultId = openIds.includes(meta.hero_invoice_id) ? meta.hero_invoice_id : openIds[0];

  const base = useMemo(
    () =>
      forecast({
        transactions,
        invoices,
        opening: meta.opening_cash,
        historyStart: meta.history_start,
        asOf,
        horizon: 90,
        nSims: 200,
      }),
    [transactions, invoices, meta.opening_cash, meta.history_start, asOf],
  );
  const story = useMemo(() => explain(base, transactions), [base, transactions]);
  const position = useMemo(
    () => positionStats(transactions, invoices, asOf),
    [transactions, invoices, asOf],
  );
  const metrics = useMemo(() => {
    try {
      const scored = evaluate(transactions, invoices, meta.opening_cash, meta.history_start, asOf);
      return Number.isFinite(scored.modelMae) ? scored : null;
    } catch {
      return null;
    }
  }, [transactions, invoices, meta.opening_cash, meta.history_start, asOf]);
  const history = useMemo(() => {
    const series = dailyBalance(transactions, meta.opening_cash, meta.history_start, asOf);
    const start = addDays(asOf, -90);
    return series.dates
      .map((date, index) => ({ date, value: series.values[index] }))
      .filter((point) => point.date >= start);
  }, [transactions, meta.opening_cash, meta.history_start, asOf]);

  const expectedByInvoice = useMemo(() => {
    const found = new Map<string, string>();
    for (const item of base.scheduled) {
      if (item.invoiceId) found.set(item.invoiceId, item.date);
    }
    return found;
  }, [base.scheduled]);

  const [invoiceId, setInvoiceId] = useState(defaultId ?? "");
  const [expectedDate, setExpectedDate] = useState(
    (defaultId && expectedByInvoice.get(defaultId)) || addDays(asOf, 1),
  );
  const [category, setCategory] = useState<(typeof EXPENSE_CHOICES)[number]>(
    EXPENSE_CHOICES.includes(meta.discretionary_category as (typeof EXPENSE_CHOICES)[number])
      ? (meta.discretionary_category as (typeof EXPENSE_CHOICES)[number])
      : "marketing",
  );
  const [reduction, setReduction] = useState(0);

  const minDate = addDays(asOf, 1);
  const maxDate = addDays(asOf, 90);

  const scenario = useMemo(
    () =>
      applyScenario({
        transactions,
        invoices,
        opening: meta.opening_cash,
        historyStart: meta.history_start,
        asOf,
        horizon: 90,
        nSims: 0,
        invoiceId,
        expectedDate,
        category,
        reductionPct: reduction / 100,
      }),
    [
      transactions,
      invoices,
      meta.opening_cash,
      meta.history_start,
      asOf,
      invoiceId,
      expectedDate,
      category,
      reduction,
    ],
  );
  const scenarioStory = useMemo(() => explain(scenario, transactions), [scenario, transactions]);
  const scenarioMin30 = minSlice(scenario.balance, 31);
  const basePoints = base.dates.map((date, index) => ({ date, value: base.balance[index] }));
  const lowPoints = base.dates.map((date, index) => ({ date, value: base.low[index] }));
  const highPoints = base.dates.map((date, index) => ({ date, value: base.high[index] }));
  const baselinePoints = base.dates.map((date, index) => ({ date, value: base.baseline[index] }));
  const scenarioPoints = scenario.dates.map((date, index) => ({ date, value: scenario.balance[index] }));

  function chooseInvoice(nextId: string) {
    setInvoiceId(nextId);
    setExpectedDate(expectedByInvoice.get(nextId) || minDate);
  }

  const modelLead =
    !metrics || metrics.modelLeadDays === null
      ? "did not flag it"
      : `flagged it ${metrics.modelLeadDays} days ahead`;
  const baselineLead =
    !metrics || metrics.baselineLeadDays === null
      ? "did not flag it"
      : `flagged it ${metrics.baselineLeadDays} days ahead`;

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="kicker">FinSight AI</p>
          <h1>Cash, before it runs out</h1>
          <p className="lede">
            {meta.company} can look busy on recent invoices and still miss payroll when a large
            customer pays late. This forecast puts bills on their calendar days and open invoices
            on each customer&apos;s usual collection lag.
          </p>
        </div>
        <p className="asof">
          <span>Books through</span>
          <strong>{monthDayLabel(asOf)}</strong>
          <span>Synthetic data. Scenarios are calculations, not guarantees.</span>
        </p>
      </header>

      <section>
        <h2>Position</h2>
        <div className="metrics">
          <Metric label="Cash today" value={money(base.cashToday)} />
          <Metric label="Invoiced, 90 days" value={money(position.invoiced)} />
          <Metric label="Collected, 90 days" value={money(position.collected)} />
          <Metric label="Expenses, 90 days" value={money(position.expenses)} />
          <Metric label="Lowest cash, 30 days" value={money(story.min30)} />
          <Metric label="Lowest cash, 90 days" value={money(story.min90)} />
          <Metric label="Shortfall date" value={base.shortfallDate ?? "None in 90 days"} />
          <Metric label="Paths below zero within 30 days" value={percent(base.shortfallProb30)} />
        </div>
        {position.invoiced > position.expenses && base.shortfallDate ? (
          <p className="banner info">
            Invoices over the last 90 days ({money(position.invoiced)}) exceed expenses (
            {money(position.expenses)}), but the base cash path still crosses zero on{" "}
            {base.shortfallDate}.
          </p>
        ) : null}
        {base.delayNotes.map((note) => (
          <p className="banner warn" key={note}>
            {note}
          </p>
        ))}
      </section>

      <section>
        <h2>Forecast</h2>
        <CashChart
          ariaLabel={`Cash history and 90-day forecast. The schedule-aware path crosses zero on ${base.shortfallDate ?? "no date in the horizon"}.`}
          band={{ name: "10th–90th percentile", color: "rgba(37, 99, 235, 0.16)", low: lowPoints, high: highPoints }}
          marker={base.shortfallDate ? { date: base.shortfallDate, label: "Shortfall" } : null}
          series={[
            { id: "history", name: "History", color: "#334155", points: history },
            { id: "model", name: "Schedule-aware", color: "#2563eb", width: 2.75, points: basePoints },
            {
              id: "baseline",
              name: "Trailing-average baseline",
              color: "#b45309",
              dash: true,
              points: baselinePoints,
            },
          ]}
        />
        <p className="caption">
          The baseline extends the last 30 days of average daily net cash and ignores payroll, rent,
          and open invoices. The band resamples historical payment delays and variable-spend
          residuals. Drag across the chart to read a day.
        </p>
      </section>

      <section>
        <h2>Why</h2>
        <div className="split">
          <div className="panel">
            <h3>Inflows in the next 30 days</h3>
            {story.inflows.length === 0 ? (
              <p>No collections land in the next 30 days under the base assumptions.</p>
            ) : (
              <MoneyTable label="Counterparty" rows={story.inflows} />
            )}
          </div>
          <div className="panel">
            <h3>Scheduled outflows in the next 30 days</h3>
            {story.outflows.length === 0 ? (
              <p>No scheduled bills land in the next 30 days.</p>
            ) : (
              <MoneyTable label="Category" rows={story.outflows} />
            )}
          </div>
        </div>
        <ul className="bullets">
          {story.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <details className="assumptions">
          <summary>Assumptions</summary>
          <ul>
            {story.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </section>

      <section>
        <h2>What-if</h2>
        <p className="caption">
          Change one collection date or reduce one expense. The chart uses the same cash engine as
          the base forecast.
        </p>
        {openIds.length === 0 ? (
          <p className="banner info">No open invoices, so only an expense cut can move the path.</p>
        ) : null}
        <div className="controls">
          {openIds.length > 0 ? (
            <>
              <label className="field">
                Open invoice
                <select value={invoiceId} onChange={(event) => chooseInvoice(event.target.value)}>
                  {open.map((invoice) => (
                    <option key={invoice.invoice_id} value={invoice.invoice_id}>
                      {invoice.invoice_id} · {invoice.customer} · {money(invoice.amount)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Expected collection date
                <input
                  type="date"
                  value={expectedDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(event) => {
                    if (event.target.value) setExpectedDate(event.target.value);
                  }}
                />
              </label>
            </>
          ) : null}
          <label className="field">
            Expense to reduce
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof EXPENSE_CHOICES)[number])}
            >
              {EXPENSE_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Reduction ({reduction}%)
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={reduction}
              aria-valuetext={`${reduction} percent`}
              onChange={(event) => setReduction(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="caption">
          {category === "marketing"
            ? "Marketing is on the recurring calendar, so a reduction lands on its usual day."
            : "Contractor and software sit in variable daily spending. A calendar cut does not move them."}
        </p>
        <div className="metrics three">
          <Metric
            label="Scenario shortfall"
            value={scenario.shortfallDate ?? "None in 90 days"}
          />
          <Metric label="Scenario lowest cash, 30 days" value={money(scenarioMin30)} />
          <Metric
            label="Change in 30-day low vs base"
            value={signedMoney(scenarioMin30 - story.min30)}
            tone={scenarioMin30 - story.min30 > 0 ? "good" : scenarioMin30 - story.min30 < 0 ? "bad" : undefined}
          />
        </div>
        <CashChart
          ariaLabel="Base forecast compared with the selected scenario."
          series={[
            { id: "base", name: "Base", color: "#2563eb", points: basePoints },
            { id: "scenario", name: "Scenario", color: "#059669", points: scenarioPoints },
          ]}
        />
        <ul className="bullets">
          {scenarioStory.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Evaluation</h2>
        {metrics ? null : (
          <p className="banner info">
            This history is too short for a holdout score. The forecast above still uses every row
            in the file.
          </p>
        )}
        {metrics ? (
          <>
        <p className="caption">
          Weekly origins in the 60 days before the as-of date each forecast the next 21 days. Error
          is the mean absolute difference from the actual daily cash balance. Lead time is how far
          ahead a method first projected a below-zero balance on or before the holdout shortfall.
        </p>
        <div className="metrics">
          <Metric label="Schedule-aware MAE" value={money(metrics.modelMae)} />
          <Metric label="Baseline MAE" value={money(metrics.baselineMae)} />
          <Metric
            label="Model lead time"
            value={metrics.modelLeadDays === null ? "—" : `${metrics.modelLeadDays} days`}
          />
          <Metric
            label="Baseline lead time"
            value={metrics.baselineLeadDays === null ? "—" : `${metrics.baselineLeadDays} days`}
          />
        </div>
        {metrics.modelImprovesMae ? (
          <p className="banner good">
            On this holdout the schedule-aware forecast MAE is {money(metrics.modelMae)}, compared
            with {money(metrics.baselineMae)} for the trailing average.
          </p>
        ) : (
          <p className="banner warn">
            On this holdout the trailing-average baseline has the lower cash-balance error.
          </p>
        )}
        {metrics.shortfallEvent ? (
          <p>
            The holdout cash balance first closed below zero on {metrics.shortfallEvent}. The
            schedule-aware forecast {modelLead}; the baseline {baselineLead}.
          </p>
        ) : (
          <p>Cash did not close below zero during the holdout, so lead time is not defined.</p>
        )}
          </>
        ) : null}
      </section>

      <footer>
        <p>
          {note ??
            `${meta.company} · synthetic books · no chatbot. Scenario results are calculations under the stated assumptions.`}
        </p>
      </footer>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <article className={tone ? `metric ${tone}` : "metric"}>
      <h3>{label}</h3>
      <p>{value}</p>
    </article>
  );
}

function MoneyTable({ label, rows }: { label: string; rows: { label: string; amount: number }[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>{label}</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{money(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
