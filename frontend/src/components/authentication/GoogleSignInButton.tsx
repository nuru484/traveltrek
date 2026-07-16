// src/components/authentication/GoogleSignInButton.tsx
//
// Minimal, self-contained Google Identity Services integration: loads the GIS
// script, renders Google's own button, and exchanges the returned credential
// (an ID token) for a session via POST /auth/google. Renders NOTHING when
// NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured — the backend would reply
// 503 in that case anyway.
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useGoogleSignInMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { loginRedirectPath } from "@/components/authentication/login-redirect-logic";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, unknown>
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdApi;
  }
}

export default function GoogleSignInButton() {
  const router = useRouter();
  const [googleSignIn] = useGoogleSignInMutation();
  const buttonRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        toast.error("Google sign-in did not return a credential");
        return;
      }
      try {
        await googleSignIn({ idToken: response.credential }).unwrap();
        toast.success("Login successful! Redirecting...");
        router.push(loginRedirectPath(window.location.search));
      } catch (err) {
        toast.error(
          extractApiErrorMessage(err).message ||
            "Google sign-in failed. Please try again."
        );
      }
    };

    const init = () => {
      if (cancelled || !window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: buttonRef.current.offsetWidth || 320,
        text: "continue_with",
      });
    };

    if (window.google) {
      init();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", init);
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script.removeEventListener("load", init);
    };
  }, [googleSignIn, router]);

  // Unconfigured deployments simply don't offer Google sign-in.
  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={buttonRef} className="flex min-h-11 justify-center" />;
}
