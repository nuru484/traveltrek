// test/helpers/render.tsx
//
// Renders a component tree inside a fresh RTK store (auth + the shared
// apiSlice, matching the real app store). Used for components whose subtree
// touches RTK Query hooks. Queries that aren't skipped simply resolve to an
// error in the test env, which is fine when their results are unused.
import * as React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "@/redux/apiSlice";
import authReducer from "@/redux/auth/authSlice";

export function makeTestStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (gdm) => gdm().concat(apiSlice.middleware),
  });
}

export function renderWithStore(ui: React.ReactElement) {
  const store = makeTestStore();
  return {
    store,
    ...render(<Provider store={store}>{ui}</Provider>),
  };
}
