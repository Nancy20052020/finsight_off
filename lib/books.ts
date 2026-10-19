import fs from "fs";
import path from "path";

import type { Books, Invoice, Meta, Transaction } from "./types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((record) => record.some((value) => value.length > 0));
}

function records(file: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(file);
  return body.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name] = cells[index] ?? "";
    });
    return record;
  });
}

export function loadBooks(directory = path.join(process.cwd(), "data")): Books {
  const meta = JSON.parse(fs.readFileSync(path.join(directory, "meta.json"), "utf8")) as Meta;
  const transactions: Transaction[] = records(
    fs.readFileSync(path.join(directory, "transactions.csv"), "utf8"),
  ).map((row) => ({
    date: row.date.slice(0, 10),
    amount: Number(row.amount),
    category: row.category,
    counterparty: row.counterparty,
  }));
  const invoices: Invoice[] = records(
    fs.readFileSync(path.join(directory, "invoices.csv"), "utf8"),
  ).map((row) => ({
    invoice_id: row.invoice_id,
    customer: row.customer,
    amount: Number(row.amount),
    issue_date: row.issue_date.slice(0, 10),
    due_date: row.due_date.slice(0, 10),
    paid_date: row.paid_date ? row.paid_date.slice(0, 10) : null,
  }));
  return { transactions, invoices, meta };
}
