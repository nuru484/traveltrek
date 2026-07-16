// src/components/settings/ContactSettings.tsx
//
// Settings → Contact: the account's login identifiers. Email and phone can
// no longer be edited on the profile forms (self-service) — each card opens
// its verified change dialog instead.
"use client";
import * as React from "react";
import { useSelector } from "react-redux";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RootState } from "@/redux/store";
import {
  ChangeEmailDialog,
  ChangePhoneDialog,
} from "./contact-change-dialogs";

function ContactCard({
  icon,
  label,
  value,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
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
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          className="w-full cursor-pointer sm:w-auto"
        >
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ContactSettings() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [emailDialogOpen, setEmailDialogOpen] = React.useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your email and phone number are how you sign in, so changing them
        requires confirming the new contact. Profile forms no longer edit
        them.
      </p>

      <ContactCard
        icon={<Mail className="h-4 w-4" aria-hidden />}
        label="Email address"
        value={user?.email}
        actionLabel={user?.email ? "Change email" : "Add email"}
        onAction={() => setEmailDialogOpen(true)}
      />

      <ContactCard
        icon={<Phone className="h-4 w-4" aria-hidden />}
        label="Phone number"
        value={user?.phone}
        actionLabel={user?.phone ? "Change phone" : "Add phone"}
        onAction={() => setPhoneDialogOpen(true)}
      />

      <ChangeEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
      />
      <ChangePhoneDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
      />
    </div>
  );
}
