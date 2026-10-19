"use client";

import Link from "next/link";

import { CashChart } from "@/components/CashChart";
import { ThemeToggle, useTheme } from "@/components/Theme";
import { money } from "@/lib/format";
import { LanguageSwitch, useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const forecast = dark ? "#22d3ee" : "#0e7490";
  const historyColor = dark ? "#94a3b8" : "#64748b";
  const average = dark ? "#f59e0b" : "#b45309";
  const band = dark ? "rgba(34, 211, 238, 0.18)" : "rgba(14, 116, 144, 0.16)";

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
            <a href="#product">{t("product")}</a>
            <a href="#preview">{t("forecastNav")}</a>
            <LanguageSwitch />
            <ThemeToggle />
            <Link href="/try" className="button">
              {t("try")}
            </Link>
          </div>
        </nav>
        <div className="stage-grid">
          <div className="stage-copy">
            <p className="eyebrow">{t("heroKicker")}</p>
            <h1>{t("heroTitle")}</h1>
            <p>{t("heroBody")}</p>
            <div className="hero-actions">
              <Link href="/try" className="button">
                {t("try")}
              </Link>
              <a href="#preview" className="button ghost light">
                {t("seeSample")}
              </a>
            </div>
          </div>
          <article className="product-card">
            <div className="product-top">
              <div>
                <p className="product-kicker">Harbor &amp; Co.</p>
                <p className="product-label">{t("cashToday")}</p>
                <p className="product-value">{money(cashToday)}</p>
              </div>
              <span className="pill">{shortfall ? t("shortfallAhead") : t("clear90")}</span>
            </div>
            <CashChart
              compact
              ariaLabel={t("heroTitle")}
              marker={shortfall ? { date: shortfall, label: t("shortfall") } : null}
              series={[{ id: "model", name: t("lineForecast"), color: forecast, width: 2.6, points: balance }]}
            />
            <div className="product-rows">
              <div>
                <span>{t("shortfall")}</span>
                <strong>{shortfall ?? t("none")}</strong>
              </div>
              <div>
                <span>{t("holdoutError")}</span>
                <strong>{money(modelMae)}</strong>
              </div>
              <div>
                <span>{t("leadTime")}</span>
                <strong>{leadDays === null ? "—" : t("days", { n: leadDays })}</strong>
              </div>
            </div>
          </article>
        </div>
      </header>

      <section className="strip" id="product">
        <article>
          <p>{t("strip90")}</p>
          <span>{t("strip90sub")}</span>
        </article>
        <article>
          <p>{money(modelMae)}</p>
          <span>{t("stripModel")}</span>
        </article>
        <article>
          <p>{money(baselineMae)}</p>
          <span>{t("stripBase")}</span>
        </article>
        <article>
          <p>{leadDays === null ? "—" : t("days", { n: leadDays })}</p>
          <span>{t("stripLead")}</span>
        </article>
      </section>

      <section className="bento">
        <article className="bento-wide">
          <p className="eyebrow">{t("whyKicker")}</p>
          <h2>{t("whyTitle")}</h2>
          <p>{t("whyBody")}</p>
          <div className="read-legend">
            <span>{t("legendBlue")}</span>
            <span>{t("legendGold")}</span>
            <span>{t("legendShade")}</span>
          </div>
        </article>
        <article>
          <h3>{t("step1")}</h3>
          <p>{t("step1body")}</p>
        </article>
        <article>
          <h3>{t("step2")}</h3>
          <p>{t("step2body")}</p>
        </article>
        <article>
          <h3>{t("step3")}</h3>
          <p>{t("step3body")}</p>
        </article>
      </section>

      <section className="preview" id="preview">
        <div className="section-head">
          <div>
            <p className="eyebrow">{t("sampleKicker")}</p>
            <h2>{t("sampleTitle")}</h2>
          </div>
          <Link href="/try" className="button">
            {t("openWorkspace")}
          </Link>
        </div>
        <CashChart
          ariaLabel={t("sampleTitle")}
          band={{ name: t("lineBand"), color: band, low, high }}
          marker={shortfall ? { date: shortfall, label: t("shortfall") } : null}
          series={[
            { id: "history", name: t("lineHistory"), color: historyColor, points: history },
            { id: "model", name: t("lineForecast"), color: forecast, width: 3, points: balance },
            { id: "baseline", name: t("lineAverage"), color: average, dash: true, points: baseline },
          ]}
        />
        <p className="caption">{t("chartHint")}</p>
      </section>

      <section className="close-band">
        <div>
          <h2>{t("closeTitle")}</h2>
          <p>{t("closeBody")}</p>
        </div>
        <div className="file-actions">
          <a className="button ghost" href="/sample-bank.csv" download>
            {t("downloadBank")}
          </a>
          <a className="button ghost" href="/sample-invoices.csv" download>
            {t("downloadInvoices")}
          </a>
          <Link href="/try" className="button">
            {t("try")}
          </Link>
        </div>
      </section>
    </div>
  );
}
