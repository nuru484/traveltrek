// The four booking modules, laid out as a departures board — the product's
// own vernacular. Codes, details, and statuses are real, not decorative.

const MODULES = [
  {
    code: "TT·01",
    name: "Flight booking",
    detail:
      "Search and reserve flights with real-time availability checks and conflict resolution.",
    status: "Real-time",
  },
  {
    code: "TT·02",
    name: "Hotel reservations",
    detail:
      "Book accommodations with automated confirmation workflows and availability sync.",
    status: "Synced",
  },
  {
    code: "TT·03",
    name: "Tour management",
    detail:
      "Browse and book curated destinations, managed end-to-end from the admin layer.",
    status: "Curated",
  },
  {
    code: "TT·04",
    name: "Payments",
    detail:
      "Secure transaction handling with validation, confirmations, and automated expiry of unpaid bookings.",
    status: "Secured",
  },
  {
    code: "TT·05",
    name: "Admin console",
    detail:
      "Analytics overview, booking, user and review moderation, plus monthly bookings, payments, and top-tours reporting.",
    status: "Staffed",
  },
];

const DeparturesSection = () => (
  <section id="overview" className="scroll-mt-20 bg-background">
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
        01 · Departures
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[42px]">
        Five modules, <span className="italic">one system.</span>
      </h2>

      <div className="mt-10 sm:mt-14">
        {/* Board header — only where the columns actually exist */}
        <div className="hidden md:grid grid-cols-[100px_1.1fr_1.6fr_auto] gap-6 border-b border-foreground/15 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Flt no.</span>
          <span>Module</span>
          <span>Details</span>
          <span className="text-right">Status</span>
        </div>

        <ul>
          {MODULES.map((mod) => (
            <li
              key={mod.code}
              className="border-b border-dashed border-foreground/20 py-5 md:grid md:grid-cols-[100px_1.1fr_1.6fr_auto] md:items-baseline md:gap-6 md:py-6"
            >
              {/* Phones: code + status on one line, then name, then detail */}
              <div className="flex items-center justify-between gap-3 md:contents">
                <span className="font-mono text-xs tracking-wider text-muted-foreground md:text-sm">
                  {mod.code}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/70 md:order-last md:justify-self-end md:whitespace-nowrap">
                  <span
                    className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"
                    aria-hidden
                  />
                  {mod.status}
                </span>
              </div>
              <h3 className="mt-2 text-2xl font-semibold md:mt-0 md:text-[26px]">
                {mod.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground md:mt-0">
                {mod.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

export default DeparturesSection;
