// Terms of service for the TravelTrek portfolio demo. The load-bearing
// sections are 2 (this is a demo, not a travel service), 4 (payments are
// simulated), and 6 (demo data is shared and may be wiped) - keep those
// aligned with reality.
import type { Metadata } from "next";
import LegalPageShell, {
  LegalSection,
  LegalText,
  LegalList,
  LegalStrong,
  LegalLink,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for trying the TravelTrek portfolio demo: simulated bookings, test-mode payments, and shared demo data.",
  alternates: { canonical: "/terms-of-service" },
};

const TermsOfServicePage = () => (
  <LegalPageShell
    title="Terms of Service"
    lastUpdated="July 26, 2026"
    crossLink={{ href: "/privacy-policy", label: "Privacy Policy" }}
  >
    <LegalSection title="1. Acceptance of terms">
      <LegalText>
        By accessing or using TravelTrek you agree to these Terms of Service.
        If you do not agree, do not use the demo.
      </LegalText>
    </LegalSection>

    <LegalSection title="2. What TravelTrek is (and is not)">
      <LegalText>
        TravelTrek is a portfolio demonstration project: a working showcase of
        a travel booking platform, built and operated by Nurudeen
        Abdul-Majeed to demonstrate engineering work. It is{" "}
        <LegalStrong>not a travel agency</LegalStrong>. The tours, hotels,
        rooms, and flights in it are demonstration inventory; a booking made
        here will never result in real travel, accommodation, or
        transportation, and confers no right to any service from anyone.
      </LegalText>
    </LegalSection>

    <LegalSection title="3. Trying the demo">
      <LegalText>
        You may explore through the shared demo sign-ins or by creating your
        own test account. You are responsible for what you enter under your
        account, and you must not enter another person&apos;s personal
        information. How your data is handled, and how to delete it, is
        described in the{" "}
        <LegalLink href="/privacy-policy">Privacy Policy</LegalLink>, which is
        part of these Terms.
      </LegalText>
    </LegalSection>

    <LegalSection title="4. Payments are simulated">
      <LegalText>
        All payments run through Paystack in{" "}
        <LegalStrong>test mode</LegalStrong>. No real money is charged, no
        real purchase occurs, and nothing of value changes hands. Use
        Paystack&apos;s published test cards at checkout; there is no reason
        to enter a real card number. Refund flows in the demo are
        demonstrations of the software only and do not represent any actual
        movement of funds.
      </LegalText>
    </LegalSection>

    <LegalSection title="5. Acceptable use">
      <LegalText>You agree not to:</LegalText>
      <LegalList
        items={[
          "use the demo for any unlawful purpose;",
          "enter another person's personal data or impersonate anyone;",
          "attempt to access, modify, or delete data in ways the app does not offer through its own interface;",
          "disrupt the service, degrade it for other visitors, or subject it to automated load;",
          "upload malicious content or attempt to plant it in the app;",
          "present the demo, its bookings, or its records as a real travel service or as evidence of anything.",
        ]}
      />
      <LegalText>
        Good-faith security research is welcome; if you find a vulnerability,
        please report it by email instead of exploiting it.
      </LegalText>
    </LegalSection>

    <LegalSection title="6. Demo data is shared and impermanent">
      <LegalText>
        The demo&apos;s staff roles are open to visitors through the shared
        demo sign-ins, so anything you enter (account details, bookings,
        reviews) may be viewed, edited, or deleted by other visitors, and the
        developer may reset or wipe the demo database at any time without
        notice. Do not store anything you care about in the demo.
      </LegalText>
    </LegalSection>

    <LegalSection title="7. Reviews and submitted content">
      <LegalText>
        Reviews you write are shown publicly on the demo board with your
        account name. By submitting content you allow it to be displayed
        within the demo; keep it lawful and civil. Content may be moderated
        or removed at any time.
      </LegalText>
    </LegalSection>

    <LegalSection title="8. Intellectual property">
      <LegalText>
        The TravelTrek source code is open source under the MIT License on{" "}
        <LegalLink href="https://github.com/nuru484/traveltrek" external>
          GitHub
        </LegalLink>
        . The TravelTrek name, design, and site content belong to the
        developer. You may not present the demo, or a copy of it, as your own
        work or as a live commercial service.
      </LegalText>
    </LegalSection>

    <LegalSection title="9. Disclaimer of warranties">
      <LegalText>
        The demo is provided &quot;as is&quot; and &quot;as available&quot;,
        without warranties of any kind, express or implied, including fitness
        for a particular purpose. It may be changed, broken, offline, or
        wiped at any time.
      </LegalText>
    </LegalSection>

    <LegalSection title="10. Limitation of liability">
      <LegalText>
        To the maximum extent permitted by law, the developer is not liable
        for any indirect, incidental, or consequential damages arising from
        your use of the demo, including any reliance on a listing, booking,
        or price in it as if it were a real travel offer, and including loss
        of data you chose to store in it. Your sole remedy for
        dissatisfaction with the demo is to stop using it and, if you wish,
        have your data deleted as described in the Privacy Policy.
      </LegalText>
    </LegalSection>

    <LegalSection title="11. Changes to these terms">
      <LegalText>
        These Terms may be revised at any time; the date at the top reflects
        the latest version. Continued use after a change means you accept the
        revised Terms.
      </LegalText>
    </LegalSection>

    <LegalSection title="12. Governing law">
      <LegalText>
        These Terms are governed by the laws of the Republic of Ghana.
      </LegalText>
    </LegalSection>

    <LegalSection title="13. Contact">
      <LegalText>
        Questions about these Terms:{" "}
        <LegalLink href="mailto:abdulmajeednurudeen48@gmail.com" external>
          abdulmajeednurudeen48@gmail.com
        </LegalLink>
        .
      </LegalText>
    </LegalSection>
  </LegalPageShell>
);

export default TermsOfServicePage;
