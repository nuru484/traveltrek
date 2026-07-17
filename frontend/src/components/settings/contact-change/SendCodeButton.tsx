// src/components/settings/contact-change/SendCodeButton.tsx
//
// "Send code" action for the passwordless re-auth path: fires the reauth
// challenge to the user's CURRENT contact. Shared by both dialogs.
"use client";
import * as React from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReauthChallengeMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

/** "Send code" helper for the passwordless re-auth path. */
export function SendCodeButton({ disabled }: { disabled?: boolean }) {
  const [reauthChallenge, { isLoading }] = useReauthChallengeMutation();

  const handleSend = async () => {
    try {
      const result = await reauthChallenge().unwrap();
      toast.success(result.message || "Code sent to your current contact");
    } catch (error) {
      toast.error(
        extractApiErrorMessage(error).message || "Could not send the code"
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={disabled || isLoading}
      className="cursor-pointer"
    >
      {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
      Send code
    </Button>
  );
}
