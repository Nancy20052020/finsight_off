import { TryApp } from "@/components/TryApp";
import { loadBooks } from "@/lib/books";

export const dynamic = "force-static";

export default function TryPage() {
  return <TryApp sample={loadBooks()} />;
}
