"use client";

import Link from "next/link";
import { useState } from "react";

import { Dashboard } from "@/components/Dashboard";
import { booksFromBankExport, invoicesFromCsv } from "@/lib/bank";
import type { Books } from "@/lib/types";

export function TryApp({ sample }: { sample: Books }) {
  const [books, setBooks] = useState<Books>(sample);
  const [usingSample, setUsingSample] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState("Harbor & Co. sample books");

  async function loadBank(file: File) {
    if (!/\.csv$|\.tsv$|\.txt$/i.test(file.name)) {
      setError("Upload a CSV export. PDF statements are not read.");
      return;
    }
    try {
      const next = booksFromBankExport(await file.text(), file.name);
      setBooks(next);
      setUsingSample(false);
      setFileLabel(file.name);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read that file.");
    }
  }

  async function loadInvoices(file: File) {
    if (!/\.csv$|\.tsv$|\.txt$/i.test(file.name)) {
      setError("Upload invoices as CSV.");
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
      setError(reason instanceof Error ? reason.message : "Could not read invoices.");
    }
  }

  return (
    <div>
      <div className="nav-wrap">
        <nav className="nav">
          <Link href="/">FinSight</Link>
          <span className="nav-meta">{fileLabel}</span>
        </nav>
      </div>
      <section className="try-panel">
        <div>
          <h1>Try it on a statement</h1>
          <p>
            Drop a bank CSV. Date and amount are enough. Debit and credit columns work too. An
            invoice CSV is optional. Files stay in this browser and are not uploaded to a server.
          </p>
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
            Bank CSV
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
            Invoices CSV, optional
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadInvoices(file);
              }}
            />
          </label>
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setBooks(sample);
              setUsingSample(true);
              setFileLabel("Harbor & Co. sample books");
              setError(null);
            }}
          >
            Use sample books
          </button>
        </div>
        {error ? <p className="banner warn">{error}</p> : null}
      </section>
      <Dashboard
        key={`${books.meta.company}-${books.meta.as_of}-${books.transactions.length}-${books.invoices.length}-${books.meta.opening_cash}`}
        books={books}
        note={
          usingSample
            ? `${books.meta.company} · synthetic books · no chatbot. Scenario results are calculations under the stated assumptions.`
            : `${books.meta.company} · read from ${fileLabel} in this browser. Nothing was stored. Scenarios are calculations, not guarantees.`
        }
      />
    </div>
  );
}
