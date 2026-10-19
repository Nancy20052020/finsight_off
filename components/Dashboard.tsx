"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CashChart } from "@/components/CashChart";
import { ThemeToggle, useTheme } from "@/components/Theme";
import { addDays, daysBetween, monthDayLabel } from "@/lib/dates";
import { evaluate } from "@/lib/evaluate";
import { explain, spendSpikes } from "@/lib/explain";
import {
  applyScenario,
  dailyBalance,
  forecast,
  minSlice,
  openInvoices,
  positionStats,
} from "@/lib/forecast";
import { money, percent, roundTo, signedMoney } from "@/lib/format";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import type { Books, ForecastResult, Story } from "@/lib/types";

const EXPENSE_CHOICES = ["marketing", "contractor", "software"] as const;

export function Dashboard({
  books,
  note,
  onChangeFiles,
}: {
  books: Books;
  note?: string;
  onChangeFiles?: () => void;
}) {
  const { t, cat } = useI18n();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const forecastColor = dark ? "#22d3ee" : "#0e7490";
  const historyColor = dark ? "#94a3b8" : "#64748b";
  const averageColor = dark ? "#f59e0b" : "#b45309";
  const scenarioColor = dark ? "#34d399" : "#047857";
  const bandColor = dark ? "rgba(34, 211, 238, 0.18)" : "rgba(14, 116, 144, 0.16)";

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
  const spikes = useMemo(() => spendSpikes(transactions, asOf), [transactions, asOf]);
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

  function plainLines(result: ForecastResult, told: Story, includeTiming: boolean) {
    const lines: string[] = [];
    if (!result.shortfallDate) {
      lines.push(t("staysPositive", { amount: money(Math.min(...result.balance)) }));
    } else {
      lines.push(
        t("dropsOn", { date: result.shortfallDate, days: daysBetween(result.asOf, result.shortfallDate) }),
      );
    }
    if (told.crossing) {
      lines.push(
        t("causedBy", {
          name: told.crossing.counterparty,
          kind: cat(told.crossing.category),
          amount: money(Math.abs(told.crossing.amount)),
          date: told.crossing.date,
        }),
      );
      lines.push(t("balanceAfter", { amount: money(told.crossing.balanceAfter) }));
    }
    if (includeTiming) {
      for (const item of result.scheduled) {
        if (!item.invoiceId || item.amount < 5000 || (item.delayStd ?? 0) < 7) continue;
        lines.push(
          t("delayPlain", {
            name: item.counterparty,
            days: roundTo(item.delayDays ?? 0, 0).toFixed(0),
            spread: roundTo(item.delayStd ?? 0, 0).toFixed(0),
            invoice: item.invoiceId,
            amount: money(item.amount),
          }),
        );
      }
      for (const spike of spikes) {
        lines.push(
          t("unusual", {
            kind: cat(spike.category),
            recent: money(spike.recent),
            usual: money(spike.mean),
          }),
        );
      }
    }
    return lines;
  }

  const whyLines = plainLines(base, story, true);
  const scenarioLines = plainLines(scenario, scenarioStory, false);
  const scenarioShift = scenarioMin30 - story.min30;
  const changed = Math.abs(scenarioShift) > 1 || reduction > 0;

  return (
    <div className="shell">
      <aside className="rail">
        <Link href="/" className="brand">
          <span className="mark">F</span>
          FinSight
        </Link>
        <nav>
          <a href="#position">{t("where")}</a>
          <a href="#forecast">{t("next")}</a>
          <a href="#why">{t("why")}</a>
          <a href="#scenario">{t("change")}</a>
          <a href="#score">{t("check")}</a>
        </nav>
        <LanguageSwitch />
        <ThemeToggle />
        {onChangeFiles ? (
          <button type="button" className="button ghost rail-action" onClick={onChangeFiles}>
            {t("changeFiles")}
          </button>
        ) : (
          <Link href="/try" className="button rail-action">
            {t("try")}
          </Link>
        )}
      </aside>
      <div className="shell-main">
        <div className="page">
          <header className="top">
            <div>
              <p className="kicker">FinSight</p>
              <h1>{t("dashTitle")}</h1>
              <p className="lede">{t("dashLede", { company: meta.company })}</p>
            </div>
            <p className="asof">
              <span>{t("booksThrough")}</span>
              <strong>{monthDayLabel(asOf)}</strong>
              <span>{t("a4")}</span>
            </p>
          </header>

          <section id="position">
            <h2>{t("where")}</h2>
            <p className="caption">{t("whereHint")}</p>
            <div className="metrics">
              <Metric label={t("cashToday")} value={money(base.cashToday)} />
              <Metric label={t("invoiced")} value={money(position.invoiced)} />
              <Metric label={t("collected")} value={money(position.collected)} />
              <Metric label={t("expenses")} value={money(position.expenses)} />
              <Metric label={t("low30")} value={money(story.min30)} />
              <Metric label={t("low90")} value={money(story.min90)} />
              <Metric label={t("shortfall")} value={base.shortfallDate ?? t("none")} />
              <Metric label={t("paths")} value={percent(base.shortfallProb30)} />
            </div>
            {position.invoiced > position.expenses && base.shortfallDate ? (
              <p className="banner info">
                {t("invoiceWarn", {
                  invoiced: money(position.invoiced),
                  expenses: money(position.expenses),
                  date: base.shortfallDate,
                })}
              </p>
            ) : null}
          </section>

          <section id="forecast">
            <h2>{t("next")}</h2>
            <p className="caption">{t("nextHint")}</p>
            <CashChart
              ariaLabel={t("nextHint")}
              band={{ name: t("lineBand"), color: bandColor, low: lowPoints, high: highPoints }}
              marker={base.shortfallDate ? { date: base.shortfallDate, label: t("shortfall") } : null}
              series={[
                { id: "history", name: t("lineHistory"), color: historyColor, points: history },
                { id: "model", name: t("lineForecast"), color: forecastColor, width: 3, points: basePoints },
                {
                  id: "baseline",
                  name: t("lineAverage"),
                  color: averageColor,
                  dash: true,
                  points: baselinePoints,
                },
              ]}
            />
            <p className="caption">{t("chartHint")}</p>
          </section>

          <section id="why">
            <h2>{t("why")}</h2>
            <p className="caption">{t("whyHint")}</p>
            <div className="split">
              <div className="panel">
                <h3>{t("inflows")}</h3>
                {story.inflows.length === 0 ? (
                  <p>{t("noInflows")}</p>
                ) : (
                  <MoneyTable who={t("who")} amount={t("amount")} rows={story.inflows} />
                )}
              </div>
              <div className="panel">
                <h3>{t("outflows")}</h3>
                {story.outflows.length === 0 ? (
                  <p>{t("noOutflows")}</p>
                ) : (
                  <MoneyTable
                    who={t("kind")}
                    amount={t("amount")}
                    rows={story.outflows.map((row) => ({ ...row, label: cat(row.label) }))}
                  />
                )}
              </div>
            </div>
            <ul className="bullets">
              {whyLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <details className="assumptions">
              <summary>{t("assumptions")}</summary>
              <ul>
                <li>{t("a1")}</li>
                <li>{t("a2")}</li>
                <li>{t("a3")}</li>
                <li>{t("a4")}</li>
              </ul>
            </details>
          </section>

          <section id="scenario">
            <h2>{t("change")}</h2>
            <p className="caption">{t("changeHint")}</p>
            {openIds.length === 0 ? <p className="banner info">{t("noOpen")}</p> : null}
            <div className="controls">
              {openIds.length > 0 ? (
                <>
                  <label className="field">
                    {t("openInvoice")}
                    <select value={invoiceId} onChange={(event) => chooseInvoice(event.target.value)}>
                      {open.map((invoice) => (
                        <option key={invoice.invoice_id} value={invoice.invoice_id}>
                          {invoice.invoice_id} · {invoice.customer} · {money(invoice.amount)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    {t("expectedDate")}
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
                {t("expense")}
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as (typeof EXPENSE_CHOICES)[number])}
                >
                  {EXPENSE_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {cat(choice)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t("reduction", { n: reduction })}
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={reduction}
                  aria-valuetext={`${reduction}%`}
                  onChange={(event) => setReduction(Number(event.target.value))}
                />
              </label>
            </div>
            <p className="caption">{category === "marketing" ? t("marketingNote") : t("otherNote")}</p>
            <div className="metrics three">
              <Metric label={t("scenarioShort")} value={scenario.shortfallDate ?? t("none")} />
              <Metric label={t("scenarioLow")} value={money(scenarioMin30)} />
              <Metric
                label={t("changeLow")}
                value={signedMoney(scenarioShift)}
                tone={scenarioShift > 0 ? "good" : scenarioShift < 0 ? "bad" : undefined}
              />
            </div>
            <CashChart
              ariaLabel={t("changeHint")}
              series={[
                { id: "base", name: t("lineBase"), color: forecastColor, points: basePoints },
                { id: "scenario", name: t("lineScenario"), color: scenarioColor, points: scenarioPoints },
              ]}
            />
            <ul className="bullets">
              {scenarioLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section id="score">
            <h2>{t("check")}</h2>
            <p className="caption">{t("checkHint")}</p>
            {metrics ? null : <p className="banner info">{t("tooShort")}</p>}
            {metrics ? (
              <>
                <p className="caption">{t("evalIntro")}</p>
                <div className="metrics">
                  <Metric label={t("modelMae")} value={money(metrics.modelMae)} />
                  <Metric label={t("baseMae")} value={money(metrics.baselineMae)} />
                  <Metric
                    label={t("modelLead")}
                    value={metrics.modelLeadDays === null ? "—" : t("days", { n: metrics.modelLeadDays })}
                  />
                  <Metric
                    label={t("baseLead")}
                    value={metrics.baselineLeadDays === null ? "—" : t("days", { n: metrics.baselineLeadDays })}
                  />
                </div>
                {metrics.modelImprovesMae ? (
                  <p className="banner good">
                    {t("compareMae", { model: money(metrics.modelMae), base: money(metrics.baselineMae) })}
                  </p>
                ) : (
                  <p className="banner warn">{t("worse")}</p>
                )}
                {metrics.shortfallEvent ? (
                  metrics.modelLeadDays === null ? (
                    <p>{t("noFlag", { date: metrics.shortfallEvent })}</p>
                  ) : metrics.baselineLeadDays === null ? (
                    <p>{t("flagged", { date: metrics.shortfallEvent, days: metrics.modelLeadDays })}</p>
                  ) : (
                    <p>
                      {t("flaggedBoth", {
                        date: metrics.shortfallEvent,
                        modelDays: metrics.modelLeadDays,
                        baseDays: metrics.baselineLeadDays,
                      })}
                    </p>
                  )
                ) : (
                  <p>{t("noEvent")}</p>
                )}
              </>
            ) : null}
          </section>

          <footer>
            <p>{note ?? t("footerSample", { company: meta.company })}</p>
          </footer>
        </div>
      </div>
      <aside className="insight">
        <p className="eyebrow">{t("live")}</p>
        <h2>{changed ? t("lineScenario") : t("lineBase")}</h2>
        <CashChart
          compact
          ariaLabel={t("sideNote")}
          marker={scenario.shortfallDate ? { date: scenario.shortfallDate, label: t("shortfall") } : null}
          series={[
            { id: "base", name: t("lineBase"), color: forecastColor, points: basePoints },
            { id: "scenario", name: t("lineScenario"), color: scenarioColor, points: scenarioPoints },
          ]}
        />
        <div className="metrics" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
          <article className="metric">
            <h3>{t("shortfall")}</h3>
            <p>{scenario.shortfallDate ?? t("none")}</p>
          </article>
          <article className={`metric ${scenarioShift > 0 ? "good" : scenarioShift < 0 ? "bad" : ""}`}>
            <h3>{t("changeLow")}</h3>
            <p>{signedMoney(scenarioShift)}</p>
          </article>
        </div>
        <p className="insight-note">{t("sideNote")}</p>
      </aside>
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

function MoneyTable({
  who,
  amount,
  rows,
}: {
  who: string;
  amount: string;
  rows: { label: string; amount: number }[];
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>{who}</th>
          <th>{amount}</th>
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
