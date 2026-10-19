import { Dashboard } from "@/components/Dashboard";
import { loadBooks } from "@/lib/books";

export const dynamic = "force-static";

export default function Page() {
  const books = loadBooks();
  return <Dashboard books={books} />;
}
