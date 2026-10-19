"use client";

import { useState } from "react";

import { Dashboard } from "@/components/Dashboard";
import { booksFromBankExport, invoicesFromCsv } from "@/lib/bank";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import type { Books } from "@/lib/types";

export function TryApp({ sample }: { sample: Books }) {
  const { t } = useI18n();
  const [books, setBooks] = useState<Books>(sample);
  const [usingSample, setUsingSample] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState("sample-bank.csv");

  async function loadBank(file: File) {
    if (!/\.csv$|\.tsv$|\.txt$/i.test(file.name)) {
      setError(t("pdfError"));
      return;
    }
    try {
      const next = booksFromBankExport(await file.text(), file.name);
      setBooks(next);
      setUsingSample(false);
      setFileLabel(file.name);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("readError"));
    }
  }

  async function loadInvoices(file: File) {
    if (!/\.csv$|\.tsv$|\.txt$/i.test(file.name)) {
      setError(t("pdfError"));
      return;
    }
    try {
      const invoices = invoicesFromCsv(await file.text());
      setBooks((current) => {
        const open = invoices.find((invoice) => !invoice.paid_date);
        return {
          ...current,
          invoices,
          meta: {
            ...current.meta,
            hero_invoice_id: open?.invoice_id ?? invoices[0]?.invoice_id ?? "",
            hero_customer: open?.customer ?? invoices[0]?.customer ?? "",
          },
        };
      });
      setUsingSample(false);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("readError"));
    }
  }

  async function loadSampleCsv() {
    try {
      const [bankText, invoiceText] = await Promise.all([
        fetch("/sample-bank.csv").then((response) => response.text()),
        fetch("/sample-invoices.csv").then((response) => response.text()),
      ]);
      const next = booksFromBankExport(bankText, "Harbor and Co.csv");
      const invoices = invoicesFromCsv(invoiceText);
      const open = invoices.find((invoice) => !invoice.paid_date);
      setBooks({
        ...next,
        invoices,
        meta: {
          ...next.meta,
          company: "Harbor & Co.",
          hero_invoice_id: open?.invoice_id ?? invoices[0]?.invoice_id ?? "",
          hero_customer: open?.customer ?? invoices[0]?.customer ?? "",
        },
      });
      setUsingSample(false);
      setFileLabel("sample-bank.csv");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("readError"));
    }
  }

  return (
    <div>
      <section className="try-panel">
        <div className="try-head">
          <div>
            <h1>{t("tryTitle")}</h1>
            <p>{t("tryBody")}</p>
          </div>
          <div className="try-tools">
            <LanguageSwitch />
          </div>
        </div>
        <div className="drops">
          <label
            className="drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) void loadBank(file);
            }}
          >
            {t("bankCsv")}
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadBank(file);
              }}
            />
          </label>
          <label className="drop">
            {t("invoiceCsv")}
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadInvoices(file);
              }}
            />
          </label>
        </div>
        <div className="file-actions">
          <button type="button" className="button" onClick={() => void loadSampleCsv()}>
            {t("loadCsv")}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setBooks(sample);
              setUsingSample(true);
              setFileLabel("sample-bank.csv");
              setError(null);
            }}
          >
            {t("useSample")}
          </button>
          <a className="button ghost" href="/sample-bank.csv" download>
            {t("downloadBank")}
          </a>
          <a className="button ghost" href="/sample-invoices.csv" download>
            {t("downloadInvoices")}
          </a>
        </div>
        {error ? <p className="banner warn">{error}</p> : null}
      </section>
      <Dashboard
        key={`${books.meta.company}-${books.meta.as_of}-${books.transactions.length}-${books.invoices.length}-${books.meta.opening_cash}`}
        books={books}
        note={
          usingSample
            ? t("footerSample", { company: books.meta.company })
            : t("footerUpload", { company: books.meta.company, file: fileLabel })
        }
      />
    </div>
  );
}
