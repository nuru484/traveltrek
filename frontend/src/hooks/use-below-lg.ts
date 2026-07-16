import * as React from "react";

// Tailwind's lg breakpoint — below it the report filter panel becomes a sheet.
const BELOW_LG_QUERY = "(max-width: 1023px)";

const subscribe = (onStoreChange: () => void) => {
  const mql = window.matchMedia(BELOW_LG_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
};

export function useIsBelowLg() {
  // useSyncExternalStore avoids setState-in-effect and stays SSR-safe
  // (server snapshot renders the desktop layout).
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(BELOW_LG_QUERY).matches,
    () => false,
  );
}
