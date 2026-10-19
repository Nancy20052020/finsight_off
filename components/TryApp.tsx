"use client";

import Link from "next/link";
import { useState } from "react";

import { Dashboard } from "@/components/Dashboard";
import { DataSheet } from "@/components/DataSheet";
import { ThemeToggle } from "@/components/Theme";
import { booksFromPair } from "@/lib/bank";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import type { Books } from "@/lib/types";

const CSV_NAME = /\.csv$|\.tsv$|\.txt$/i;

export function TryApp() {
  const { t } = useI18n();
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [books, setBooks] = useState<Books | null>(null);
  const [showData, setShowData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function takeBank(file: File | undefined) {
    if (!file) return;
    if (!CSV_NAME.test(file.name)) {
      setError(t("pdfError"));
      return;
    }
    setBankFile(file);
    setError(null);
  }

  function takeInvoices(file: File | undefined) {
    if (!file) return;
    if (!CSV_NAME.test(file.name)) {
      setError(t("pdfError"));
      return;
    }
    setInvoiceFile(file);
    setError(null);
  }

  async function showForecast() {
    if (!bankFile || !invoiceFile) {
      setError(t("needBoth"));
      return;
    }
    try {
      const next = booksFromPair(await bankFile.text(), bankFile.name, await invoiceFile.text());
      setBooks(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("readError"));
    }
  }

  if (books && bankFile && showData) {
    return <DataSheet books={books} kind="upload" onClose={() => setShowData(false)} />;
  }

  if (books && bankFile) {
    return (
      <Dashboard
        key={`${books.meta.as_of}-${books.transactions.length}-${books.invoices.length}`}
        books={books}
        note={t("footerUpload", { company: books.meta.company, file: bankFile.name })}
        onShowData={() => setShowData(true)}
        onChangeFiles={() => {
          setBooks(null);
          setShowData(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="studio">
      <nav className="studio-nav">
        <Link href="/" className="brand">
          <span className="mark">F</span>
          FinSight
        </Link>
        <div className="studio-tools">
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </nav>
      <div className="studio-grid">
        <div className="studio-copy">
          <p className="eyebrow">{t("heroKicker")}</p>
          <h1>{t("tryTitle")}</h1>
          <p>{t("tryBody")}</p>
          <ol className="studio-points">
            <li>
              <span className="num">1</span>
              <span>
                <strong>{t("bankCsv")}. </strong>
                {t("bankHint")}
              </span>
            </li>
            <li>
              <span className="num">2</span>
              <span>
                <strong>{t("invoiceCsv")}. </strong>
                {t("invoiceHint")}
              </span>
            </li>
            <li>
              <span className="num">3</span>
              <span>{t("step2body")}</span>
            </li>
          </ol>
          <Link href="/demo" className="studio-link">
            {t("seeDemo")}
          </Link>
        </div>
        <form
          className="studio-card"
          onSubmit={(event) => {
            event.preventDefault();
            void showForecast();
          }}
        >
          <DropSlot
            title={t("bankCsv")}
            hint={t("bankHint")}
            file={bankFile}
            added={t("added")}
            missing={t("stillNeeded")}
            onFile={takeBank}
          />
          <DropSlot
            title={t("invoiceCsv")}
            hint={t("invoiceHint")}
            file={invoiceFile}
            added={t("added")}
            missing={t("stillNeeded")}
            onFile={takeInvoices}
          />
          {error ? (
            <p className="banner warn" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="button">
            {t("showMine")}
          </button>
        </form>
      </div>
    </div>
  );
}

function DropSlot({
  title,
  hint,
  file,
  added,
  missing,
  onFile,
}: {
  title: string;
  hint: string;
  file: File | null;
  added: string;
  missing: string;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label
      className={file ? "drop ready" : "drop"}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFile(event.dataTransfer.files[0]);
      }}
    >
      <span className="status">{file ? added : missing}</span>
      <strong>{title}</strong>
      <span>{file ? file.name : hint}</span>
      <input
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}
