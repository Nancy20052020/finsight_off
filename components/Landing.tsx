import Link from "next/link";

import { CashChart } from "@/components/CashChart";
import { money } from "@/lib/format";

type Point = { date: string; value: number };

export function Landing({
  history,
  balance,
  low,
  high,
  baseline,
  shortfall,
  cashToday,
  modelMae,
  baselineMae,
  leadDays,
}: {
  history: Point[];
  balance: Point[];
  low: Point[];
  high: Point[];
  baseline: Point[];
  shortfall: string | null;
  cashToday: number;
  modelMae: number;
  baselineMae: number;
  leadDays: number | null;
}) {
  return (
    <div className="landing">
      <div className="nav-wrap">
        <nav className="nav">
          <Link href="/" className="brand">
            FinSight
          </Link>
          <div className="nav-links">
            <a href="#method">Method</a>
            <a href="#preview">Sample</a>
            <Link href="/try" className="button">
              Try the forecast
            </Link>
          </div>
        </nav>
      </div>

      <header className="hero">
        <div>
          <p className="kicker">Cash forecasting for small businesses</p>
          <h1>Know the shortfall before payroll lands.</h1>
          <p className="lede">
            FinSight places recurring bills on their calendar days and open invoices on each
            customer&apos;s usual collection lag. A busy month of invoices can still run out of cash
            when the money arrives late.
          </p>
          <div className="hero-actions">
            <Link href="/try" className="button">
              Try the forecast
            </Link>
            <a href="#preview" className="button ghost">
              See a sample
            </a>
          </div>
          <p className="caption">CSV bank exports. The file stays in your browser.</p>
        </div>
        <figure className="hero-photo">
          <img src="/hero-studio.jpg" alt="Quiet studio desk with a laptop showing a cash chart" />
        </figure>
      </header>

      <section className="steps" id="method">
        <article>
          <p className="step">01</p>
          <h2>Upload the statement</h2>
          <p>Bring a bank CSV with dates and amounts. Add an invoice list if you have one.</p>
        </article>
        <article>
          <p className="step">02</p>
          <h2>Read the timing</h2>
          <p>Rent, payroll, loan, and marketing stay on their usual days. Collections use real delay.</p>
        </article>
        <article>
          <p className="step">03</p>
          <h2>Move one assumption</h2>
          <p>Shift a collection date or cut a discretionary bill and watch the cash path respond.</p>
        </article>
      </section>

      <section className="split feature">
        <figure className="hero-photo quiet">
          <img src="/bank-papers.jpg" alt="Bank statement pages and a folder on a stone desk" />
        </figure>
        <div>
          <p className="kicker">Why a trailing average misleads</p>
          <h2>Last month&apos;s average does not know payroll day.</h2>
          <p>
            A trailing average extends the last 30 days of net cash and ignores the calendar. FinSight
            keeps the bills and the unpaid invoices in the path, then scores both methods on held-out
            days. On the Harbor &amp; Co. sample, the schedule-aware forecast is the one that flags the
            shortfall early.
          </p>
          <ul className="bullets">
            <li>Cash today, the 30-day low, and the first date below zero.</li>
            <li>The bill or collection that takes the path through zero.</li>
            <li>A band from resampled payment delays and spend residuals.</li>
          </ul>
        </div>
      </section>

      <section id="preview">
        <div className="section-head">
          <div>
            <p className="kicker">Harbor &amp; Co. sample</p>
            <h2>The chart is the product.</h2>
          </div>
          <Link href="/try" className="button">
            Try it with your file
          </Link>
        </div>
        <div className="metrics three">
          <article className="metric">
            <h3>Cash today</h3>
            <p>{money(cashToday)}</p>
          </article>
          <article className="metric">
            <h3>Shortfall</h3>
            <p>{shortfall ?? "None in 90 days"}</p>
          </article>
          <article className="metric">
            <h3>Holdout error</h3>
            <p>
              {money(modelMae)} <span className="vs">vs {money(baselineMae)}</span>
            </p>
          </article>
        </div>
        <CashChart
          ariaLabel={`Sample forecast for Harbor and Co. Shortfall on ${shortfall ?? "no date"}.`}
          band={{ name: "10th–90th percentile", color: "rgba(37, 99, 235, 0.16)", low, high }}
          marker={shortfall ? { date: shortfall, label: "Shortfall" } : null}
          series={[
            { id: "history", name: "History", color: "#334155", points: history },
            { id: "model", name: "Schedule-aware", color: "#2563eb", width: 2.75, points: balance },
            { id: "baseline", name: "Trailing average", color: "#b45309", dash: true, points: baseline },
          ]}
        />
        <p className="caption">
          Synthetic books. The schedule-aware path
          {leadDays === null ? " did not flag the holdout shortfall." : ` flagged the holdout shortfall ${leadDays} days ahead.`}
          {" "}The trailing average did not. Drag across the chart to read a day.
        </p>
      </section>

      <section className="close">
        <div>
          <h2>Bring the export you already have.</h2>
          <p>No account. No stored documents. A forecast you can move.</p>
        </div>
        <Link href="/try" className="button">
          Try the forecast
        </Link>
      </section>
    </div>
  );
}
