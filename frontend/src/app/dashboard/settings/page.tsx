// src/app/dashboard/settings/page.tsx
//
// /dashboard/settings has no content of its own — the password surface is
// the default security page.
import { redirect } from "next/navigation";

export default function SettingsIndexPage() {
  redirect("/dashboard/settings/password");
}
