// test/setup.ts
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// --- jsdom gaps that Radix UI primitives rely on -------------------------
// jsdom doesn't implement these; provide minimal stubs so components that use
// Radix Select/Dialog/Popover can render in component tests.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof globalThis.matchMedia;
}

if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView =
    Element.prototype.scrollIntoView || vi.fn();
  // Radix Select uses pointer-capture APIs jsdom doesn't implement.
  Element.prototype.hasPointerCapture =
    Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture =
    Element.prototype.setPointerCapture || vi.fn();
  Element.prototype.releasePointerCapture =
    Element.prototype.releasePointerCapture || vi.fn();
}
