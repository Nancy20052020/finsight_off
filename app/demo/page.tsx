import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Dashboard } from "@/components/Dashboard";
import { booksFromPair } from "@/lib/bank";

export const dynamic = "force-static";

export default function DemoPage() {
  const bank = readFileSync(join(process.cwd(), "public/sample-bank.csv"), "utf8");
  const invoices = readFileSync(join(process.cwd(), "public/sample-invoices.csv"), "utf8");
  const books = booksFromPair(bank, "Harbor and Co.csv", invoices, "Harbor & Co.");
  return <Dashboard books={books} />;
}
