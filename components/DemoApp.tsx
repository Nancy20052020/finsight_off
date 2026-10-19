"use client";

import { useState } from "react";

import { Dashboard } from "@/components/Dashboard";
import { DataSheet } from "@/components/DataSheet";
import type { Books } from "@/lib/types";

export function DemoApp({ books }: { books: Books }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return <DataSheet books={books} kind="example" onClose={() => setOpen(false)} />;
  }

  return <Dashboard books={books} onShowData={() => setOpen(true)} />;
}
