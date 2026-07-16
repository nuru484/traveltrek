// src/utils/print-report.ts
//
// Print only the report data. A `report-printing` class on <body> scopes the
// print stylesheet (globals.css) so everything except the `.report-print-area`
// is hidden in the print output.
export function printReport(): void {
  const done = () => document.body.classList.remove("report-printing");
  document.body.classList.add("report-printing");
  window.addEventListener("afterprint", done, { once: true });
  window.print();
}
