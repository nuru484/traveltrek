// src/components/settings/ContactSettings.tsx
//
// Settings -> Contact: the account's login identifiers. Email and phone can
// no longer be edited on the profile forms (self-service) - each card shows
// the current value read-only and expands its verified change form inline
// (like the password tab) instead of opening a dialog. Only one form is
// open at a time so small screens never stack two flows.
"use client";
import * as React from "react";
import { useSelector } from "react-redux";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RootState } from "@/redux/store";
import { ChangeEmailForm, ChangePhoneForm } from "./contact-change-forms";

function ContactCard({
  icon,
  label,
  value,
  actionLabel,
  open,
  onOpen,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  actionLabel: string;
  open: boolean;
  onOpen: () => void;
  /** The inline change form, shown while the card is open. */
  children: React.ReactNode;
}) {
  return (
    <Card className="py-4">
      <CardContent className="px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border text-muted-foreground">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <p
              className={`mt-0.5 text-sm font-medium break-all ${
                value ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {value || "Not set"}
            </p>
          </div>
          {!open && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpen}
              className="flex-none cursor-pointer"
            >
              {actionLabel}
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-4 border-t border-dashed border-foreground/20 pt-4">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContactSettings() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [openForm, setOpenForm] = React.useState<"email" | "phone" | null>(
    null
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You sign in with these, so changes must be confirmed from the new
        contact.
      </p>

      <ContactCard
        icon={<Mail className="h-4 w-4" aria-hidden />}
        label="Email address"
        value={user?.email}
        actionLabel={user?.email ? "Change" : "Add"}
        open={openForm === "email"}
        onOpen={() => setOpenForm("email")}
      >
        <ChangeEmailForm onClose={() => setOpenForm(null)} />
      </ContactCard>

      <ContactCard
        icon={<Phone className="h-4 w-4" aria-hidden />}
        label="Phone number"
        value={user?.phone}
        actionLabel={user?.phone ? "Change" : "Add"}
        open={openForm === "phone"}
        onOpen={() => setOpenForm("phone")}
      >
        <ChangePhoneForm onClose={() => setOpenForm(null)} />
      </ContactCard>
    </div>
  );
}
