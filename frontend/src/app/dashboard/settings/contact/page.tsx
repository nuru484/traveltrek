// src/app/dashboard/settings/contact/page.tsx
//
// Settings → Contact: verified email/phone changes (both principals). The
// page itself stays a Server Component; the cards/dialogs are the island.
import ContactSettings from "@/components/settings/ContactSettings";

export default function ContactSettingsPage() {
  return <ContactSettings />;
}
