// The stack as a cargo manifest: dotted-leader rows that say what each tool
// actually does in this system, instead of a wall of pill badges.

const MANIFEST: { group: string; items: [name: string, role: string][] }[] = [
  {
    group: "Frontend",
    items: [
      ["Next.js", "app framework"],
      ["TypeScript", "typed UI code"],
      ["Redux Toolkit", "state & data layer"],
      ["React Hook Form", "forms"],
      ["Zod", "client validation"],
      ["TanStack Table", "data tables"],
      ["shadcn/ui", "interface kit"],
      ["Framer Motion", "motion"],
    ],
  },
  {
    group: "Backend",
    items: [
      ["Express 5", "API server"],
      ["Prisma", "ORM & migrations"],
      ["PostgreSQL", "system of record"],
      ["Redis", "queue store"],
      ["BullMQ", "background jobs"],
      ["Paystack", "payment gateway"],
      ["Cloudinary", "media storage"],
      ["Pino", "structured logging"],
    ],
  },
];

const ManifestSection = () => (
  <section id="stack" className="scroll-mt-20 bg-background">
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            03 · Cargo manifest
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl lg:text-[42px]">
            Typed from database to browser.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            100% TypeScript, with Zod validation shared across client and
            server.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 min-[480px]:grid-cols-2 lg:gap-10">
          {MANIFEST.map((section) => (
            <div key={section.group}>
              <h3 className="border-b border-foreground/15 pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-muted-foreground">
                {section.group}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {section.items.map(([name, role]) => (
                  <li key={name} className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium whitespace-nowrap">
                      {name}
                    </span>
                    <span
                      aria-hidden
                      className="min-w-4 flex-1 border-b border-dotted border-foreground/30"
                    />
                    <span className="font-mono text-xs text-muted-foreground text-right">
                      {role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default ManifestSection;
