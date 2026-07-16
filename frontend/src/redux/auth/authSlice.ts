import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IUserRegistrationResponseData } from "@/types/auth";

interface AuthState {
  user: IUserRegistrationResponseData | null;
}

/**
 * First-party presence hint read by src/proxy.ts. The real session cookies
 * are httpOnly on the API origin and never reach the Next proxy in cross-
 * origin deploys, so login/logout mirror the persisted user into this plain
 * cookie. Presence-only — it carries no token and proves nothing; the proxy
 * uses it just to skip sending the dashboard bundle to logged-out visitors.
 */
const HINT_COOKIE = "tt.auth.hint";

const setAuthHint = (on: boolean) => {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = on
    ? `${HINT_COOKIE}=1; path=/; max-age=${String(30 * 24 * 60 * 60)}; samesite=lax${secure}`
    : `${HINT_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
};

const persistUser = (user: IUserRegistrationResponseData | null) => {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
  setAuthHint(Boolean(user));
};

// Load user from localStorage if available
const storedUser =
  typeof window !== "undefined" ? localStorage.getItem("user") : null;

const initialState: AuthState = {
  user: storedUser
    ? (() => {
        try {
          return JSON.parse(storedUser);
        } catch {
          return null;
        }
      })()
    : null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    userRegistration: (
      state,
      action: PayloadAction<{
        user: IUserRegistrationResponseData;
      }>
    ) => {
      state.user = action.payload.user;
      persistUser(action.payload.user);
    },

    userLoggedIn: (
      state,
      action: PayloadAction<{
        user: IUserRegistrationResponseData;
      }>
    ) => {
      state.user = action.payload.user;
      persistUser(action.payload.user);
    },

    userLoggedOut: (state) => {
      state.user = null;
      persistUser(null);
    },
  },
});

export const { userRegistration, userLoggedIn, userLoggedOut } =
  authSlice.actions;

export default authSlice.reducer;
