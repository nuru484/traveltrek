import { ImageResponse } from "next/og";

export const alt =
  "Travel Trek — a travel and tour booking platform: flights, hotels, tours, and payments.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Landing palette (globals.css) as hex — Satori doesn't parse oklch.
const PAPER = "#e8edf5";
const CARD = "#ffffff";
const INK = "#1f2937";
const NIGHT = "#16233a";
const NIGHT_TEXT = "#eef2f8";
const MUTED = "#5b6b82";
const ACCENT = "#2aa8a0";

/** Barcode as a flex row of bars — Satori has no repeating gradients. */
const BAR_WIDTHS = [
  3, 2, 5, 2, 3, 6, 2, 4, 2, 6, 3, 2, 5, 3, 2, 4, 6, 2, 3, 5, 2, 4, 2, 6, 3,
  2, 5, 2, 4, 3,
];

/**
 * The share card is the landing page's signature element: the project spec
 * rendered as a boarding pass. Satori supports flexbox only, so everything
 * is flex-based; fonts fall back to the bundled default.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          padding: 56,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: CARD,
            borderRadius: 24,
            border: `2px solid ${INK}33`,
            overflow: "hidden",
          }}
        >
          {/* Strip */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: NIGHT,
              color: NIGHT_TEXT,
              padding: "18px 40px",
              fontSize: 20,
              letterSpacing: 6,
            }}
          >
            <div style={{ display: "flex" }}>TRAVEL TREK ✈ BOARDING PASS</div>
            <div style={{ display: "flex", opacity: 0.7 }}>
              2026
            </div>
          </div>

          {/* Body: main + perforation + stub */}
          <div style={{ display: "flex", flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                flex: 1,
                padding: "40px 44px",
                color: INK,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 56,
                  lineHeight: 1.1,
                  letterSpacing: -1,
                }}
              >
                <div style={{ display: "flex" }}>A travel booking platform,</div>
                <div style={{ display: "flex", fontStyle: "italic" }}>
                  built end-to-end.
                </div>
              </div>

              {/* Conversion line — the card should invite a click */}
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    display: "flex",
                    background: NIGHT,
                    color: NIGHT_TEXT,
                    borderRadius: 999,
                    padding: "14px 30px",
                    fontSize: 21,
                  }}
                >
                  Try the live platform at traveltrek.manuru.dev →
                </div>
              </div>

              <div style={{ display: "flex", gap: 34 }}>
                {[
                  ["PASSENGER", "Nurudeen Abdul-Majeed"],
                  ["ROUTE", "Schema → Screen"],
                  ["STACK", "Next.js · Express · Postgres"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{ display: "flex", flexDirection: "column" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        fontSize: 13,
                        letterSpacing: 3,
                        color: MUTED,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ display: "flex", fontSize: 19, marginTop: 6 }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Perforation */}
            <div
              style={{
                display: "flex",
                width: 0,
                borderLeft: `3px dashed ${INK}40`,
                margin: "18px 0",
              }}
            />

            {/* Stub */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: 250,
                padding: "36px 32px",
                background: "#f2f5fa",
                color: INK,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 15,
                    letterSpacing: 4,
                    color: MUTED,
                  }}
                >
                  FLIGHT
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 30,
                    letterSpacing: 2,
                    marginTop: 6,
                  }}
                >
                  TT-2026
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 12,
                    height: 12,
                    borderRadius: 12,
                    background: ACCENT,
                  }}
                />
                <div style={{ display: "flex" }}>Live & maintained</div>
              </div>

              {/* Barcode */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 3,
                  height: 64,
                }}
              >
                {BAR_WIDTHS.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      width: w,
                      height: "100%",
                      background: INK,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
