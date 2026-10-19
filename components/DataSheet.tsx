"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ThemeToggle } from "@/components/Theme";
import { monthDayLabel } from "@/lib/dates";
import { money } from "@/lib/format";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import type { Books } from "@/lib/types";

type Sheet = "pick" | "bank" | "invoices";

export function DataSheet({
  books,
  kind,
  onClose,
}: {
  books: Books;
  kind: "example" | "upload";
  onClose: () => void;
}) {
  const [sheet, setSheet] = useState<Sheet>("pick");
  const { t, cat } = useI18n();
  const openCount = books.invoices.filter((invoice) => !invoice.paid_date).length;
  const lines = useMemo(() => {
    let balance = books.meta.opening_cash;
    return books.transactions.map((row) => {
      balance += row.amount;
      return { ...row, balance };
    });
  }, [books]);
  const kicker = kind === "upload" ? t("yourKicker") : t("dataKicker");
  const title = kind === "upload" ? t("yourTitle") : t("dataTitle");
  const body = kind === "upload" ? t("yourBody") : t("dataBody");

  return (
    <div className="studio data-studio">
      <nav className="studio-nav">
        <Link href="/" className="brand">
          <span className="mark">F</span>
          FinSight
        </Link>
        <div className="studio-tools">
          <button type="button" className="button ghost" onClick={onClose}>
            {t("backForecast")}
          </button>
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </nav>

      {sheet === "pick" ? (
        <div className="data-pick">
          <div className="studio-copy">
            <p className="eyebrow">{kicker}</p>
            <h1>{title}</h1>
            <p>{body}</p>
          </div>
          <div className="data-cards">
            <button type="button" className="data-card" onClick={() => setSheet("bank")}>
              <span className="status">{books.transactions.length}</span>
              <strong>{t("bankCard")}</strong>
              <span>{t("bankCardBody", { n: books.transactions.length })}</span>
            </button>
            <button type="button" className="data-card" onClick={() => setSheet("invoices")}>
              <span className="status">{openCount}</span>
              <strong>{t("invoiceCard")}</strong>
              <span>{t("invoiceCardBody", { n: books.invoices.length, open: openCount })}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="data-sheet">
          <div className="data-sheet-head">
            <div>
              <button type="button" className="text-button" onClick={() => setSheet("pick")}>
                {t("backToFiles")}
              </button>
              <h1>{sheet === "bank" ? t("bankCard") : t("invoiceCard")}</h1>
              <p>
                {sheet === "bank"
                  ? t("bankCardBody", { n: books.transactions.length })
                  : t("invoiceCardBody", { n: books.invoices.length, open: openCount })}
              </p>
            </div>
            <div className="file-actions">
              <button type="button" className={sheet === "bank" ? "button" : "button ghost"} onClick={() => setSheet("bank")}>
                {t("bankCard")}
              </button>
              <button
                type="button"
                className={sheet === "invoices" ? "button" : "button ghost"}
                onClick={() => setSheet("invoices")}
              >
                {t("invoiceCard")}
              </button>
            </div>
          </div>

          {sheet === "bank" ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("when")}</th>
                    <th>{t("what")}</th>
                    <th>{t("kind")}</th>
                    <th>{t("moneyOut")}</th>
                    <th>{t("moneyIn")}</th>
                    <th>{t("balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row, index) => (
                    <tr key={`${row.date}-${index}`}>
                      <td>{monthDayLabel(row.date)}</td>
                      <td>{row.counterparty}</td>
                      <td>{cat(row.category)}</td>
                      <td>{row.amount < 0 ? money(Math.abs(row.amount)) : "—"}</td>
                      <td className="in">{row.amount > 0 ? money(row.amount) : "—"}</td>
                      <td>{money(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("what")}</th>
                    <th>{t("who")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("due")}</th>
                    <th>{t("paidOn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {books.invoices.map((invoice) => (
                    <tr key={invoice.invoice_id} className={invoice.paid_date ? "" : "open-row"}>
                      <td>{invoice.invoice_id}</td>
                      <td>{invoice.customer}</td>
                      <td>{money(invoice.amount)}</td>
                      <td>{monthDayLabel(invoice.due_date)}</td>
                      <td>{invoice.paid_date ? monthDayLabel(invoice.paid_date) : t("stillOpen")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
