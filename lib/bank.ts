import type { Books, Invoice, Transaction } from "./types";

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
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "," || char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((record) => record.some((value) => value.trim().length > 0));
}

function pad(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return pad(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!local) return null;
  let year = Number(local[3]);
  if (year < 100) year += 2000;
  let month = Number(local[1]);
  let day = Number(local[2]);
  if (month > 12 && day <= 12) {
    month = Number(local[2]);
    day = Number(local[1]);
  }
  return pad(year, month, day);
}

function parseAmount(raw: string): number | null {
  let value = raw.trim();
  if (!value || value === "-" || value === "—") return null;
  let negative = false;
  if (value.endsWith("-")) {
    negative = true;
    value = value.slice(0, -1);
  }
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  }
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/[$,\s]/g, "");
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return negative ? -Math.abs(amount) : amount;
}

function column(header: string[], pattern: RegExp): number {
  return header.findIndex((cell) => pattern.test(cell.trim().toLowerCase()));
}

function categorize(description: string, amount: number, given?: string): string {
  const text = `${given ?? ""} ${description}`.toLowerCase();
  if (/payroll|salary|wage|gusto|adp|paycheck/.test(text)) return "payroll";
  if (/rent|lease|landlord/.test(text)) return "rent";
  if (/loan|mortgage/.test(text)) return "loan";
  if (/marketing|advert|facebook ads|google ads|meta ads/.test(text)) return "marketing";
  if (/software|saas|subscription|adobe|slack|zoom/.test(text)) return "software";
  if (/contractor|freelance|1099/.test(text)) return "contractor";
  if (/utilit|electric|power|water|internet|comcast/.test(text)) return "utilities";
  if (amount > 0) return "client_payment";
  return "supplies";
}

function companyFromFilename(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  return base || "Uploaded books";
}

export function booksFromBankExport(text: string, filename: string): Books {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("The file needs a header row and at least one transaction.");
  const headerIndex = table.findIndex((cells) =>
    /date|posted|amount|debit|description|memo|balance/.test(cells.join(" ").toLowerCase()),
  );
  if (headerIndex < 0) throw new Error("Could not find a header row with a date and an amount.");
  const header = table[headerIndex].map((cell) => cell.trim().toLowerCase());
  const dateCol = column(header, /\bdate\b|posted|posting/);
  const debitCol = column(header, /debit|withdrawal|money out/);
  const creditCol = column(header, /credit|deposit|money in/);
  const amountCol = column(header, /^amount$|transaction amount|\bamount\b/);
  const descriptionCol = column(header, /description|memo|narrative|details|payee|merchant/);
  const categoryCol = column(header, /category|type/);
  const balanceCol = column(header, /balance/);
  if (dateCol < 0 || (amountCol < 0 && debitCol < 0 && creditCol < 0)) {
    throw new Error("Use a bank CSV with Date and Amount columns, or Debit and Credit columns.");
  }

  const transactions: Transaction[] = [];
  let latestBalance: { date: string; balance: number } | null = null;
  for (const cells of table.slice(headerIndex + 1)) {
    const date = parseDate(cells[dateCol] ?? "");
    if (!date) continue;
    let amount: number | null = null;
    if (debitCol >= 0 || creditCol >= 0) {
      const debit = debitCol >= 0 ? parseAmount(cells[debitCol] ?? "") : null;
      const credit = creditCol >= 0 ? parseAmount(cells[creditCol] ?? "") : null;
      if (debit === null && credit === null) amount = amountCol >= 0 ? parseAmount(cells[amountCol] ?? "") : null;
      else amount = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0);
    } else if (amountCol >= 0) {
      amount = parseAmount(cells[amountCol] ?? "");
    }
    if (amount === null || amount === 0) continue;
    const description = descriptionCol >= 0 ? (cells[descriptionCol] ?? "").trim() : "Bank transaction";
    const given = categoryCol >= 0 ? cells[categoryCol] : undefined;
    transactions.push({
      date,
      amount,
      category: categorize(description, amount, given),
      counterparty: description.slice(0, 80) || "Bank",
    });
    if (balanceCol >= 0) {
      const balance = parseAmount(cells[balanceCol] ?? "");
      if (balance !== null && (!latestBalance || date >= latestBalance.date)) {
        latestBalance = { date, balance };
      }
    }
  }
  if (transactions.length < 3) {
    throw new Error("Found fewer than three dated amounts. Export the full statement as CSV.");
  }
  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const historyStart = transactions[0].date;
  const asOf = transactions[transactions.length - 1].date;
  const flow = transactions.reduce((sum, row) => sum + row.amount, 0);
  const opening = latestBalance ? latestBalance.balance - flow : 0;
  return {
    transactions,
    invoices: [],
    meta: {
      company: companyFromFilename(filename),
      as_of: asOf,
      history_start: historyStart,
      opening_cash: opening,
      target_cash: opening + flow,
      hero_invoice_id: "",
      hero_customer: "",
      discretionary_category: "marketing",
    },
  };
}

export function booksFromPair(bankText: string, bankName: string, invoiceText: string, company?: string): Books {
  const next = booksFromBankExport(bankText, bankName);
  const invoices = invoicesFromCsv(invoiceText);
  const open = invoices.find((invoice) => !invoice.paid_date);
  return {
    ...next,
    invoices,
    meta: {
      ...next.meta,
      company: company ?? next.meta.company,
      hero_invoice_id: open?.invoice_id ?? invoices[0]?.invoice_id ?? "",
      hero_customer: open?.customer ?? invoices[0]?.customer ?? "",
    },
  };
}

export function invoicesFromCsv(text: string): Invoice[] {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("The invoice file needs a header and at least one row.");
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const idCol = column(header, /invoice/);
  const customerCol = column(header, /customer|client|name/);
  const amountCol = column(header, /amount|total|balance/);
  const issueCol = column(header, /issue|invoice date|sent/);
  const dueCol = column(header, /due/);
  const paidCol = column(header, /paid|payment date|settled/);
  if (customerCol < 0 || amountCol < 0 || dueCol < 0) {
    throw new Error("Invoice CSV needs customer, amount, and due date columns.");
  }
  const invoices: Invoice[] = [];
  table.slice(1).forEach((cells, index) => {
    const amount = parseAmount(cells[amountCol] ?? "");
    const due = parseDate(cells[dueCol] ?? "");
    if (amount === null || !due) return;
    const issue = issueCol >= 0 ? parseDate(cells[issueCol] ?? "") : due;
    invoices.push({
      invoice_id: (idCol >= 0 ? cells[idCol] : "").trim() || `INV-${index + 1}`,
      customer: (cells[customerCol] ?? "Customer").trim() || "Customer",
      amount: Math.abs(amount),
      issue_date: issue ?? due,
      due_date: due,
      paid_date: paidCol >= 0 ? parseDate(cells[paidCol] ?? "") : null,
    });
  });
  if (invoices.length === 0) throw new Error("No invoice rows could be read.");
  return invoices;
}
