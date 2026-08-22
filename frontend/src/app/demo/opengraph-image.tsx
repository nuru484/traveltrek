import { ImageResponse } from "next/og";

export const alt =
  "Travel Trek live demo: real tours, hotels, flights and reviews from the running system. Now boarding.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Landing palette (globals.css) as hex - Satori doesn't parse oklch.
const NIGHT = "#16233a";
const NIGHT_TEXT = "#eef2f8";
const NIGHT_MUTED = "#8fa0b8";
const BOARD_LINE = "#2b3a55";
const ACCENT = "#2aa8a0";

/** The demo board's rows - statuses only; live counts belong to the page. */
const BOARD_ROWS: [row: string, status: string][] = [
  ["TOURS", "BOARDING"],
  ["DESTINATIONS", "ROUTE MAP"],
  ["HOTELS", "OPEN"],
  ["FLIGHTS", "SCHEDULED"],
  ["PASSENGER LOG", "PUBLISHED"],
];

/**
 * The demo page's share card is its signature element: the flight-information
 * board on the night band (the landing card is the boarding pass; this is the
 * departures hall). Satori supports flexbox only, so everything is flex-based.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: NIGHT,
          color: NIGHT_TEXT,
          padding: "48px 64px",
        }}
      >
        {/* Board caption */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 19,
            letterSpacing: 6,
            color: NIGHT_MUTED,
          }}
        >
          <div style={{ display: "flex" }}>
            TRAVEL TREK · FLIGHT INFORMATION
          </div>
          <div
            style={{
              display: "flex",
              width: 11,
              height: 11,
              borderRadius: 11,
              background: ACCENT,
            }}
          />
          <div style={{ display: "flex" }}>LIVE DEMO</div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 18,
            marginTop: 26,
            fontSize: 84,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          <div style={{ display: "flex" }}>Now</div>
          <div style={{ display: "flex", fontStyle: "italic" }}>boarding.</div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 23,
            color: NIGHT_MUTED,
          }}
        >
          Real rows from the running system, served by its public API. Sign in
          and book any of it.
        </div>

        {/* The board */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginTop: 34,
            border: `2px solid ${BOARD_LINE}`,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {BOARD_ROWS.map(([row, status], index) => (
            <div
              key={row}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flex: 1,
                padding: "0 34px",
                borderTop: index === 0 ? "none" : `2px dashed ${BOARD_LINE}`,
                fontSize: 24,
                letterSpacing: 5,
              }}
            >
              <div style={{ display: "flex" }}>{row}</div>
              <div style={{ display: "flex", color: NIGHT_MUTED }}>
                {status}
              </div>
            </div>
          ))}
        </div>

        {/* Conversion line */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 30,
            fontSize: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              background: NIGHT_TEXT,
              color: NIGHT,
              borderRadius: 999,
              padding: "14px 30px",
            }}
          >
            Enter the demo at traveltrek.manuru.dev/demo →
          </div>
          <div
            style={{
              display: "flex",
              letterSpacing: 5,
              color: NIGHT_MUTED,
              fontSize: 17,
            }}
          >
            GATE TT-26
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
