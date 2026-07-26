// Privacy policy for the TravelTrek portfolio demo. Every claim mirrors what
// the backend actually does (bcrypt hashes, Paystack test mode, httpOnly
// cookies, admin-only deletion) - if those change, this document must change
// with them.
import type { Metadata } from "next";
import LegalPageShell, {
  LegalSection,
  LegalText,
  LegalList,
  LegalStrong,
  LegalLink,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How the TravelTrek portfolio demo handles your data: what is collected, how it is protected, and how to delete it.",
  alternates: { canonical: "/privacy-policy" },
};

const PrivacyPolicyPage = () => (
  <LegalPageShell
    title="Privacy Policy"
    lastUpdated="July 26, 2026"
    crossLink={{ href: "/terms-of-service", label: "Terms of Service" }}
  >
    <LegalSection title="1. Introduction">
      <LegalText>
        TravelTrek is a portfolio demonstration project built by Nurudeen
        Abdul-Majeed to showcase a full-stack travel booking platform. It is
        not a travel agency and sells no real travel. Because trying the demo
        can involve creating an account, this policy explains plainly what
        data the demo handles, what happens to it, and how to remove it.
      </LegalText>
      <LegalText>
        By using the demo you agree to the practices described here. If you
        would rather not share anything, the public demo board and the shared
        demo sign-ins let you explore without entering personal information at
        all.
      </LegalText>
    </LegalSection>

    <LegalSection title="2. Who runs this project">
      <LegalText>
        This project is built and operated by a single developer:
      </LegalText>
      <LegalList
        items={[
          <>
            <LegalStrong>Developer:</LegalStrong> Nurudeen Abdul-Majeed
          </>,
          <>
            <LegalStrong>Portfolio:</LegalStrong>{" "}
            <LegalLink href="https://manuru.dev" external>
              manuru.dev
            </LegalLink>
          </>,
          <>
            <LegalStrong>Email:</LegalStrong>{" "}
            <LegalLink href="mailto:abdulmajeednurudeen48@gmail.com" external>
              abdulmajeednurudeen48@gmail.com
            </LegalLink>
          </>,
        ]}
      />
    </LegalSection>

    <LegalSection title="3. Ways to try the demo">
      <LegalText>
        You can browse the public demo board without any account. To go
        further you can use the shared one-click demo sign-ins (a demo
        customer and demo staff roles), or create your own test account with
        an email address or phone number, or with Google sign-in. The less
        personal the details you use, the better; a made-up name and a
        throwaway contact are perfectly fine here.
      </LegalText>
    </LegalSection>

    <LegalSection title="4. Information the demo collects">
      <LegalText>
        <LegalStrong>4.1 Account data.</LegalStrong> A name, an email address
        and/or phone number, and an optional address. Passwords are stored
        only as one-way bcrypt hashes; the demo never sees or stores a
        password in readable form. If you use Google sign-in, the demo stores
        the name, email address, and account identifier Google provides, and
        never sees your Google password.
      </LegalText>
      <LegalText>
        <LegalStrong>4.2 Bookings and payments.</LegalStrong> Test bookings
        you make (tours, room stays, flights) are stored against your
        account. Payments run through Paystack in{" "}
        <LegalStrong>test mode</LegalStrong>: no real money is ever charged,
        and card details are entered in Paystack&apos;s own checkout, never on
        this server, which stores only the transaction reference and status.
      </LegalText>
      <LegalText>
        <LegalStrong>4.3 Reviews.</LegalStrong> Reviews you write on completed
        test trips are public and appear with your account name on the demo
        board.
      </LegalText>
      <LegalText>
        <LegalStrong>4.4 Verification codes.</LegalStrong> Two-factor and
        one-time login codes are sent to the email address or phone number you
        provided and expire quickly. Delivery goes through ordinary email and
        SMS providers.
      </LegalText>
      <LegalText>
        <LegalStrong>4.5 Nothing else.</LegalStrong> There are no analytics,
        no advertising trackers, and no profiling of any kind.
      </LegalText>
    </LegalSection>

    <LegalSection title="5. Your test data is visible to other visitors">
      <LegalText>
        This is the most important thing to understand before entering real
        details: the demo&apos;s staff roles (agent and admin) are open to
        visitors through the shared demo sign-ins, and staff can see customer
        records, including names, contact details, bookings, and payment
        history. Treat anything you enter as visible to strangers. Use
        invented details, never reuse a real password, and do not enter
        another person&apos;s information.
      </LegalText>
    </LegalSection>

    <LegalSection title="6. How your data is used">
      <LegalText>
        Data is used for exactly one purpose: making the demo work (your
        account, your test bookings, and the emails or texts the demo sends
        about them). It is never sold, shared, rented, used for advertising,
        or used to train models.
      </LegalText>
    </LegalSection>

    <LegalSection title="7. Deleting your data">
      <LegalText>
        You are encouraged to clean up after trying the demo:
      </LegalText>
      <LegalList
        items={[
          <>
            Sign in with the <LegalStrong>demo admin</LegalStrong> and delete
            the test account you created, along with its bookings.
          </>,
          <>
            Or email{" "}
            <LegalLink href="mailto:abdulmajeednurudeen48@gmail.com" external>
              abdulmajeednurudeen48@gmail.com
            </LegalLink>{" "}
            and I will delete it for you.
          </>,
        ]}
      />
      <LegalText>
        Independently of either, the demo database is test inventory and may
        be reset or wiped at any time, which also removes any data you left
        behind.
      </LegalText>
    </LegalSection>

    <LegalSection title="8. Security">
      <LegalText>
        The demo is built to production security standards: bcrypt password
        hashing, short-lived session tokens in httpOnly cookies with
        refresh-token rotation and replay detection, verified contact
        changes, account lockout, rate limiting, and encrypted connections
        throughout, with the database on a managed provider that encrypts
        storage at rest. Still, no online system is completely secure, and
        this one is a demo run by one person: do not put anything sensitive
        into it.
      </LegalText>
    </LegalSection>

    <LegalSection title="9. Infrastructure and processors">
      <LegalText>
        The demo runs on ordinary cloud infrastructure: a frontend host, an
        API host, a managed PostgreSQL database, Redis for background jobs,
        and Cloudinary for catalog photos. Paystack processes test payments,
        Google handles sign-in only if you choose it, and email/SMS providers
        deliver verification codes and booking notifications. These providers
        process data only to run the application; no third party receives
        your data for its own purposes.
      </LegalText>
    </LegalSection>

    <LegalSection title="10. Cookies">
      <LegalText>
        The app sets only strictly necessary cookies: httpOnly access and
        refresh tokens that keep you signed in. There are no analytics,
        advertising, or cross-site tracking cookies.
      </LegalText>
    </LegalSection>

    <LegalSection title="11. Children">
      <LegalText>
        The demo is not directed at anyone under 18, and no data is knowingly
        collected from minors.
      </LegalText>
    </LegalSection>

    <LegalSection title="12. Changes to this policy">
      <LegalText>
        If the demo&apos;s data practices change, this document will be
        updated with a new date at the top. Continued use after a change
        means you accept the updated policy.
      </LegalText>
    </LegalSection>

    <LegalSection title="13. Contact">
      <LegalText>
        Questions, deletion requests, or security reports:{" "}
        <LegalLink href="mailto:abdulmajeednurudeen48@gmail.com" external>
          abdulmajeednurudeen48@gmail.com
        </LegalLink>
        . See also the{" "}
        <LegalLink href="/terms-of-service">Terms of Service</LegalLink>.
      </LegalText>
    </LegalSection>
  </LegalPageShell>
);

export default PrivacyPolicyPage;
