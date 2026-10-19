import Link from "next/link";

import { CashChart } from "@/components/CashChart";
import { ThemeToggle } from "@/components/Theme";
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
      <header className="stage">
        <img className="stage-photo" src="/hero-mist.jpg" alt="" />
        <div className="stage-shade" />
        <nav className="topnav">
          <Link href="/" className="brand">
            <span className="mark">F</span>
            FinSight
          </Link>
          <div className="nav-links">
            <a href="#product">Product</a>
            <a href="#preview">Forecast</a>
            <ThemeToggle />
            <Link href="/try" className="button">
              Try the forecast
            </Link>
          </div>
        </nav>
        <div className="stage-grid">
          <div className="stage-copy">
            <p className="eyebrow">Cash intelligence for operators</p>
            <h1>Smarter cash decisions, before payroll day.</h1>
            <p>
              FinSight puts bills on the calendar and open invoices on each customer&apos;s real
              collection lag. A strong invoicing month can still miss cash when the money arrives late.
            </p>
            <div className="hero-actions">
              <Link href="/try" className="button">
                Try the forecast
              </Link>
              <a href="#preview" className="button ghost light">
                See the sample path
              </a>
            </div>
          </div>
          <article className="product-card">
            <div className="product-top">
              <div>
                <p className="product-kicker">Harbor &amp; Co.</p>
                <p className="product-label">Cash today</p>
                <p className="product-value">{money(cashToday)}</p>
              </div>
              <span className="pill">{shortfall ? "Shortfall ahead" : "Clear 90 days"}</span>
            </div>
            <CashChart
              compact
              ariaLabel="Sample cash path for Harbor and Co."
              series={[{ id: "model", name: "Schedule-aware", color: "#0891b2", width: 2.6, points: balance }]}
            />
            <div className="product-rows">
              <div>
                <span>Shortfall</span>
                <strong>{shortfall ?? "None"}</strong>
              </div>
              <div>
                <span>Holdout error</span>
                <strong>{money(modelMae)}</strong>
              </div>
              <div>
                <span>Lead time</span>
                <strong>{leadDays === null ? "—" : `${leadDays} days`}</strong>
              </div>
            </div>
          </article>
        </div>
      </header>

      <section className="strip" id="product">
        <article>
          <p>90 days</p>
          <span>Forward cash path</span>
        </article>
        <article>
          <p>{money(modelMae)}</p>
          <span>Schedule-aware holdout error</span>
        </article>
        <article>
          <p>{money(baselineMae)}</p>
          <span>Trailing-average error</span>
        </article>
        <article>
          <p>{leadDays === null ? "—" : `${leadDays}d`}</p>
          <span>Earlier shortfall warning</span>
        </article>
      </section>

      <section className="bento">
        <article className="bento-wide">
          <p className="eyebrow">Why averages fail</p>
          <h2>Last month does not know when payroll hits.</h2>
          <p>
            A trailing average just extends recent net cash. FinSight keeps rent, payroll, loan, and
            marketing on their usual days, then collects each open invoice when that customer usually pays.
          </p>
        </article>
        <article>
          <h3>Upload a statement</h3>
          <p>Bank CSV with dates and amounts. Add invoices if you have them. The file never leaves the browser.</p>
        </article>
        <article>
          <h3>See the crossing</h3>
          <p>The path names the bill or collection that takes cash through zero, not a generic risk score.</p>
        </article>
        <article>
          <h3>Move one assumption</h3>
          <p>Shift a collection date or cut a discretionary bill. The side chart updates with the same engine.</p>
        </article>
      </section>

      <section className="preview" id="preview">
        <div className="section-head">
          <div>
            <p className="eyebrow">Harbor &amp; Co. sample</p>
            <h2>A path you can read, not a static picture.</h2>
          </div>
          <Link href="/try" className="button">
            Open the workspace
          </Link>
        </div>
        <CashChart
          ariaLabel={`Sample forecast. Shortfall on ${shortfall ?? "no date"}.`}
          band={{ name: "10th–90th percentile", color: "rgba(34, 211, 238, 0.16)", low, high }}
          marker={shortfall ? { date: shortfall, label: "Shortfall" } : null}
          series={[
            { id: "history", name: "History", color: "#94a3b8", points: history },
            { id: "model", name: "Schedule-aware", color: "#22d3ee", width: 3, points: balance },
            { id: "baseline", name: "Trailing average", color: "#f59e0b", dash: true, points: baseline },
          ]}
        />
        <p className="caption">
          Drag across the chart. The schedule-aware forecast
          {leadDays === null ? " did not flag the holdout shortfall." : ` flagged the holdout shortfall ${leadDays} days ahead.`}
          {" "}The trailing average did not. Synthetic books, calculations only.
        </p>
      </section>

      <section className="close-band">
        <div>
          <h2>Bring the export you already download.</h2>
          <p>No account. No stored documents. A forecast that moves when you do.</p>
        </div>
        <Link href="/try" className="button">
          Try the forecast
        </Link>
      </section>
    </div>
  );
}
