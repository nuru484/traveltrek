// src/components/reports/PrintButton.tsx
"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printReport } from "@/utils/print-report";

/** Prints just the active tab's `.report-print-area` (print CSS in globals). */
export function PrintButton() {
  return (
    <Button
      variant="outline"
      className="h-10 w-10 shrink-0 cursor-pointer p-0 sm:w-auto sm:px-4"
      onClick={printReport}
      aria-label="Print report"
    >
      <Printer className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Print</span>
    </Button>
  );
}
