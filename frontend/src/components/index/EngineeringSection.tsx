// The night band: engineering decisions on the fixed deep-navy surface that
// stays constant across light and dark themes. Every claim maps to a real
// dependency in the codebase.

const DECISIONS = [
  {
    tag: "Auth",
    title: "Four doors, one session",
    detail:
      "Password, email-OTP and Google sign-in with optional two-factor; short-lived JWTs behind rotating refresh tokens, and role-based access for customers, agents, and admins.",
  },
  {
    tag: "Money",
    title: "Integer pesewas only",
    detail:
      "Every amount is an integer in minor units from database to API. No floats near money. One formatter renders GH₵ at the edge; Paystack collects, webhook-verified.",
  },
  {
    tag: "Data",
    title: "PostgreSQL + Prisma",
    detail:
      "A relational schema built for booking integrity: flights, hotels, rooms, tours, and payments in one typed model, with soft deletes auto-scoped out of every read.",
  },
  {
    tag: "Queues",
    title: "BullMQ + Redis",
    detail:
      "Scheduled background workers expire unpaid bookings and keep flight and tour statuses current.",
  },
  {
    tag: "Validation",
    title: "Zod at both doors",
    detail:
      "Every request body, query, and param passes a Zod schema behind rate-limited endpoints; React Hook Form and Zod validate again before anything leaves the client.",
  },
  {
    tag: "Testing",
    title: "450+ tests in CI",
    detail:
      "Over 340 integration tests exercise every endpoint against a real Postgres, plus a frontend suite. Lint, types, tests, and build gate every merge.",
  },
];

const EngineeringSection = () => (
  <section
    id="engineering"
    className="scroll-mt-20 bg-night text-night-foreground"
  >
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[oklch(0.75_0.13_230)]">
            02 · Under the hood
          </p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[42px]">
            Engineering decisions that carry the product.
          </h2>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-night-foreground/60">
          Not a demo. Validation, queues, payments, access control: every layer
          is built the way a production team would ship it.
        </p>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
        {DECISIONS.map((decision) => (
          <li key={decision.tag} className="bg-night p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[oklch(0.75_0.13_230)]">
              {decision.tag}
            </p>
            <h3 className="mt-2 text-xl font-semibold sm:text-2xl">
              {decision.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-night-foreground/65">
              {decision.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default EngineeringSection;
