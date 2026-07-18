// src/components/settings/contact-change-forms.tsx
//
// Barrel for the secure contact-change forms (Settings -> Contact). Email and
// phone are LOGIN IDENTIFIERS, so both flows re-authenticate first - with the
// current password, or (for passwordless accounts) a code sent to the CURRENT
// contact - then prove possession of the NEW contact. The implementation is
// split under ./contact-change: the shared MethodToggle, SendCodeButton, and
// ReauthFields, plus one file per form.
export { ChangeEmailForm } from "./contact-change/ChangeEmailForm";
export { ChangePhoneForm } from "./contact-change/ChangePhoneForm";
