/* eslint-disable @next/next/no-html-link-for-pages -- marketing pages link with plain <a> on purpose: home.css and doc.css reuse selectors, so each page must arrive on a full load with only its own stylesheet (see site.css). */
import type { Metadata } from "next";
import { DocHeader } from "@/components/site/DocHeader";
import "../doc.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ZemFi collects, uses, shares and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <DocHeader />

      <main className="wrap">
        <div className="doc">
          <nav className="toc" aria-label="On this page">
            <p>On this page</p>
            <ol>
              <li><a href="#who">Who we are</a></li>
              <li><a href="#collect">What we collect</a></li>
              <li><a href="#use">How we use it</a></li>
              <li><a href="#share">Who we share it with</a></li>
              <li><a href="#device">Device permissions</a></li>
              <li><a href="#keep">How long we keep it</a></li>
              <li><a href="#security">Security</a></li>
              <li><a href="#rights">Your rights</a></li>
              <li><a href="#delete">Deleting your account</a></li>
              <li><a href="#children">Children</a></li>
              <li><a href="#changes">Changes</a></li>
              <li><a href="#contact">Contact us</a></li>
            </ol>
          </nav>

          <article>
            <p className="label">Legal</p>
            <h1>Privacy Policy</h1>
            <p className="meta">Last updated 9 October 2026</p>
            <p className="intro">This policy explains what personal information ZemFi collects when you use the ZemFi
              app and website, why we collect it, who we share it with, and the choices you have. We don’t sell
              your personal information, and the app contains no advertising or third-party analytics trackers.</p>

            <section id="who">
              <h2>1. Who we are</h2>
              <p>ZemFi is operated by <strong>ZemFi Technologies Ltd</strong> (“ZemFi”, “we”, “us”). We are the controller of the personal information described in this policy.</p>
              <p>Payments, balances, stablecoin custody and identity verification are provided by a licensed payments
                partner (“our payments partner”). Our payments partner processes the information needed for those services
                under its own obligations as a regulated provider.</p>
            </section>

            <section id="collect">
              <h2>2. What we collect</h2>
              <h3>Account information</h3>
              <ul>
                <li>Your name, email address, phone number and country.</li>
                <li>Your password, which we store only as a one-way hash.</li>
                <li>Whether you use a personal or business account. For business accounts: the legal and trading name,
                  registration number, business address and website.</li>
              </ul>
              <h3>Identity verification</h3>
              <p>To meet anti-money-laundering and know-your-customer rules, we collect verification information
                and pass it directly to our payments partner. Depending on your verification level, this may include:</p>
              <ul>
                <li>Your Bank Verification Number (BVN), date of birth, occupation and residential address.</li>
                <li>Whether you are a politically exposed person.</li>
                <li>A liveness selfie. Our payments partner compares it with the photo held on official identity records, so it is
                  biometric information.</li>
                <li>Your National Identification Number (NIN), a photo of a government ID (front and back), its type
                  and number, and a recent utility bill.</li>
                <li>For the highest verification level only, we compare your utility bill with the residential address you
                  declared, to confirm where you live.</li>
              </ul>
              <p>We keep a record of your verification status, but your ID numbers, ID documents and selfie are held
                by our payments partner rather than in ZemFi’s own database.</p>
              <h3>Transactions and recipients</h3>
              <ul>
                <li>Details of each transaction: type, amount, currency, fees, status, destination country, blockchain
                  network and transaction hash.</li>
                <li>Recipients you save: account holder name, bank account number, bank code and country, or a wallet
                  address and network.</li>
                <li>Bank accounts you withdraw to, which are stored with our payments partner.</li>
              </ul>
              <h3>Security and device information</h3>
              <ul>
                <li>Sign-in sessions, including the IP address, the device name your phone reports, and when the
                  session was last used.</li>
                <li>Your phone’s platform (iOS or Android), app version and push notification token.</li>
                <li>If you turn on two-factor authentication, the secret that links your authenticator app.
                  We store it encrypted.</li>
              </ul>
              <h3>Support</h3>
              <p>Messages you send us through in-app support or by email, including any transaction reference you include.</p>
            </section>

            <section id="use">
              <h2>3. How we use it</h2>
              <ul>
                <li><strong>To provide the service:</strong> creating your account, buying, selling and sending stablecoins,
                  paying bank accounts abroad, and giving you accounts to receive money. This is necessary to perform our
                  contract with you.</li>
                <li><strong>To meet legal obligations:</strong> verifying your identity, screening and monitoring transactions
                  for fraud, money laundering and sanctions, and keeping records the law requires.</li>
                <li><strong>To keep your account secure:</strong> managing sessions, two-factor authentication, and alerting
                  you to sign-ins and security changes.</li>
                <li><strong>To communicate with you:</strong> transaction updates, verification results, security alerts and
                  replies to support requests, by email and push notification. You can turn off push notifications in
                  your phone’s settings.</li>
              </ul>
            </section>

            <section id="share">
              <h2>4. Who we share it with</h2>
              <p>We share personal information only where needed to run the service or where the law requires it:</p>
              <ul>
                <li><strong>Our payments partner:</strong> identity verification, custody of balances, payments and payouts.
                  When you sign up, we send our payments partner your name, email, phone number and country, along with the verification
                  information described above.</li>
                <li><strong>Banks and payment providers:</strong> when you send money, our payments partner and its licensed payment providers
                  in the destination country receive the recipient details needed to deliver it. Identity records may be checked
                  against official databases, such as Nigeria’s NIBSS for BVN verification.</li>
                <li><strong>Blockchain networks:</strong> stablecoin transfers are recorded on public blockchains. Wallet addresses
                  and amounts are visible to anyone and can’t be deleted.</li>
                <li><strong>Service providers:</strong> companies that deliver our emails, push notifications and app updates
                  on our behalf.</li>
                <li><strong>Authorities:</strong> regulators, law enforcement or courts, when the law requires it.</li>
              </ul>
              <p>Some of these providers may process information outside your country. Where they do, we rely on appropriate
                safeguards as required by applicable data protection law.</p>
            </section>

            <section id="device">
              <h2>5. Device permissions</h2>
              <p>The app asks for these permissions only when a feature needs them. You can change them at any time in your
                phone’s settings:</p>
              <ul>
                <li><strong>Camera and photos:</strong> to capture ID documents and your verification selfie, and to scan wallet QR codes.</li>
                <li><strong>Face ID or fingerprint:</strong> to unlock the app. This is handled entirely by your phone. ZemFi
                  never receives or stores your face or fingerprint data.</li>
                <li><strong>Notifications:</strong> to send transaction and security alerts.</li>
              </ul>
              <p>The app does not ask for or use your location.</p>
            </section>

            <section id="keep">
              <h2>6. How long we keep it</h2>
              <p>We keep your account information for as long as your account is open.</p>
              <p>Anti-money-laundering law requires us and our payments partner to keep certain records for <strong>five years</strong>
                {" "}after your account is closed or a transaction is completed. These records are your BVN, NIN, identity documents,
                and your transaction, payout and ledger history, including the bank accounts used for payouts.</p>
              <p>Records of actions our staff take on accounts are kept for audit purposes.</p>
            </section>

            <section id="security">
              <h2>7. Security</h2>
              <p>We protect your information with encryption in transit, hashed passwords, encrypted two-factor secrets, optional
                biometric app lock and two-factor checks on sensitive actions, and access controls for staff. No system is
                completely secure, so please keep your password and authenticator private and tell us straight away if you
                think your account has been compromised.</p>
            </section>

            <section id="rights">
              <h2>8. Your rights</h2>
              <p>Depending on where you live (for example, under Nigeria’s Data Protection Act 2023), you may have the right to:</p>
              <ul>
                <li>access the personal information we hold about you;</li>
                <li>correct information that is wrong or incomplete;</li>
                <li>ask us to delete it, subject to the records we must keep by law;</li>
                <li>receive a copy in a portable format;</li>
                <li>object to or restrict certain processing, and withdraw consent where we rely on it;</li>
                <li>complain to your data protection authority, such as the Nigeria Data Protection Commission.</li>
              </ul>
              <p>To use any of these rights, contact us using the details below. We may need to verify your identity first.</p>
            </section>

            <section id="delete">
              <h2>9. Deleting your account</h2>
              <p>You can delete your account in the app under <strong>Settings &rarr; Delete account</strong>, or by emailing{" "}
                <a href="mailto:support@zemfi.ng">support@zemfi.ng</a> from the address on your account if you no longer have the app.
                Your balance must be empty and no transfers can be pending. Deletion removes your name, email, phone number, address, password, two-factor
                secret, saved recipients and payout bank accounts. The records described in{" "}
                <a href="#keep">How long we keep it</a> are kept for the period the law requires and then deleted.
                Step-by-step instructions are on our <a href="/delete-account">account deletion page</a>.</p>
            </section>

            <section id="children">
              <h2>10. Children</h2>
              <p>ZemFi is not for anyone under 18, and we don’t knowingly collect information from children.</p>
            </section>

            <section id="changes">
              <h2>11. Changes to this policy</h2>
              <p>We may update this policy as the service changes. When we make significant changes, we’ll tell you in the app or by
                email before they take effect. The date at the top shows when it was last updated.</p>
            </section>

            <section id="contact">
              <h2>12. Contact us</h2>
              <div className="box">
                <p>Questions, requests or complaints about your privacy:<br />
                  <a href="mailto:support@zemfi.ng">support@zemfi.ng</a></p>
              </div>
            </section>
          </article>
        </div>
      </main>

      <div className="wrap">
        <footer>
          <span>ZemFi &mdash; cross-border payments and stablecoins.</span>
          <span><a href="/terms">Terms of Service</a> &middot; <a href="/">Home</a></span>
        </footer>
      </div>
    </>
  );
}
