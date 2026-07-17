// src/components/settings/contact-change-dialogs.tsx
//
// Barrel for the secure contact-change dialogs (Settings → Contact). Email and
// phone are LOGIN IDENTIFIERS, so both flows re-authenticate first — with the
// current password, or (for passwordless accounts) a code sent to the CURRENT
// contact — then prove possession of the NEW contact. The implementation is
// split under ./contact-change: the shared MethodToggle, SendCodeButton, and
// ReauthFields, plus one file per dialog. Re-exporting here keeps every
// "@/components/settings/contact-change-dialogs" import working unchanged.
export { ChangeEmailDialog } from "./contact-change/ChangeEmailDialog";
export { ChangePhoneDialog } from "./contact-change/ChangePhoneDialog";
