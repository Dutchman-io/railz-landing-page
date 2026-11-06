/* eslint-disable @next/next/no-html-link-for-pages -- marketing pages link with plain <a> on purpose: home.css and doc.css reuse selectors, so each page must arrive on a full load with only its own stylesheet (see site.css). */
import type { Metadata } from "next";
import { DocHeader } from "@/components/site/DocHeader";
import "../doc.css";

// DRAFT FOR LEGAL REVIEW: this Terms of Service text has not yet been reviewed by counsel.
// Do not treat it as final until it has been approved.

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use the ZemFi app and website.",
};

export default function TermsPage() {
  return (
    <>
      <DocHeader />

      <main className="wrap">
        <div className="doc">
          <nav className="toc" aria-label="On this page">
            <p>On this page</p>
            <ol>
              <li><a href="#who">Who we are</a></li>
              <li><a href="#eligibility">Who can use ZemFi</a></li>
              <li><a href="#account">Your account and security</a></li>
              <li><a href="#verification">Verification and limits</a></li>
              <li><a href="#trading">Buying and selling</a></li>
              <li><a href="#funding">Funding and withdrawals</a></li>
              <li><a href="#sending">Sending stablecoins</a></li>
              <li><a href="#payouts">Cross-border payouts</a></li>
              <li><a href="#fees">Fees</a></li>
              <li><a href="#prohibited">Prohibited use</a></li>
              <li><a href="#holds">Holds, freezes and closure</a></li>
              <li><a href="#risks">Stablecoin risks</a></li>
              <li><a href="#availability">Service availability</a></li>
              <li><a href="#partners">Our partners</a></li>
              <li><a href="#liability">Our liability</a></li>
              <li><a href="#delete">Deleting your account</a></li>
              <li><a href="#changes">Changes</a></li>
              <li><a href="#law">Governing law and disputes</a></li>
              <li><a href="#contact">Contact us</a></li>
            </ol>
          </nav>

          <article>
            <p className="label">Legal</p>
            <h1>Terms of Service</h1>
            <p className="meta">Last updated 9 October 2026</p>
            <p className="intro">These terms are the agreement between you and ZemFi when you use the ZemFi app and website.
              Please read them carefully. By creating an account or using ZemFi, you agree to them. If you don’t agree,
              please don’t use ZemFi.</p>

            <section id="who">
              <h2>1. Who we are</h2>
              <p>ZemFi is operated by <strong>ZemFi Technologies Ltd</strong> (“ZemFi”, “we”, “us”). In these terms, “you”
                means the person who holds a ZemFi account.</p>
              <p>ZemFi lets you buy and sell stablecoins such as USDT and USDC with your local currency, hold balances, fund
                your account by bank transfer, withdraw to your own bank account, send stablecoins to a wallet address, and send
                money abroad where we offer it. Payments, balances, stablecoin custody and liquidity are provided by our licensed
                payment and liquidity partners (see <a href="#partners">Our partners</a>).</p>
              <p>How we handle your personal information is explained in our <a href="/privacy">Privacy Policy</a>.</p>
            </section>

            <section id="eligibility">
              <h2>2. Who can use ZemFi</h2>
              <p>To open and use a ZemFi account, you must:</p>
              <ul>
                <li>be at least <strong>18 years old</strong>;</li>
                <li>live in a country we support. Identity verification is available in <strong>Nigeria</strong> today, and
                  other countries are coming soon;</li>
                <li>hold <strong>only one account</strong>, in your own name, and use it only for yourself (or, for a business
                  account, for the business you are authorised to act for);</li>
                <li>give us information that is true, accurate and complete, and keep it up to date.</li>
              </ul>
              <p>We may refuse to open an account, or ask for more information, where we need to in order to meet our legal
                obligations or protect ZemFi and its customers.</p>
            </section>

            <section id="account">
              <h2>3. Your account and security</h2>
              <p>You are responsible for keeping your account secure and for everything done through it. In particular:</p>
              <ul>
                <li>Keep your password private and don’t share your account or your phone with anyone else.</li>
                <li>Keep your phone protected with a passcode. You can turn on the app’s <strong>Face ID or fingerprint
                  lock</strong>, which is handled entirely by your phone.</li>
                <li>We strongly recommend turning on <strong>two-factor authentication</strong> with an authenticator app. Once
                  it is on, we ask for a code when you sign in and before withdrawals. Each code works only once.</li>
                <li>Check your active sessions in the app and sign out of any device you don’t recognise.</li>
              </ul>
              <p>If you think someone else has accessed your account, or your phone is lost or stolen, tell us straight away at{" "}
                <a href="mailto:support@zemfi.ng">support@zemfi.ng</a>. We may restrict the account while we look into it.</p>
            </section>

            <section id="verification">
              <h2>4. Identity verification and limits</h2>
              <p>The law requires us to know who our customers are. Before you can buy, sell or send money, you need to verify
                your identity. Verification happens in tiers, and each tier comes with its own transaction limits:</p>
              <ul>
                <li><strong>Tier 1:</strong> your Bank Verification Number (BVN), personal details and a selfie.</li>
                <li><strong>Tier 2:</strong> your National Identification Number (NIN) and a government ID document.</li>
                <li><strong>Tier 3:</strong> proof of your residential address.</li>
              </ul>
              <p>The app shows the limits that apply to your tier and what you need to raise them. We may ask you for further
                information or documents at any time, and we may decline a verification, or a request to raise your limits,
                where we can’t confirm your information.</p>
            </section>

            <section id="trading">
              <h2>5. Buying and selling</h2>
              <p>When you buy or sell stablecoins, the app shows you a <strong>quote</strong> before you confirm. The quote
                shows the rate, any fee and the amount you will receive.</p>
              <ul>
                <li>The rate already includes our spread (the difference between the price we get and the price we
                  offer you). It is not charged separately.</li>
                <li>A fixed exchange fee applies when you sell. The quote shows it before you confirm.</li>
                <li>Quotes expire after a short time, shown in the app, and each quote can be used only once. If a quote expires,
                  you’ll need a new one, which may be at a different rate.</li>
                <li>Once you confirm a quote, the trade is final. Prices move constantly, and we can’t reverse a trade because
                  the rate changed afterwards.</li>
              </ul>
            </section>

            <section id="funding">
              <h2>6. Funding and withdrawals</h2>
              <h3>Funding</h3>
              <p>You can fund your balance by bank transfer, including to an account number we give you in the app. Send money
                only from a bank account in your own name. Funds can take time to arrive depending on your bank, and we may
                return or hold payments that we can’t match to you or that don’t come from you.</p>
              <h3>Withdrawals</h3>
              <ul>
                <li>You can withdraw to a bank account in your own name that you have added in the app.</li>
                <li>A withdrawal fee applies, made up of a percentage of the amount plus a fixed amount. It is{" "}
                  <strong>deducted from the amount you withdraw</strong>. The app shows the fee and the amount you will receive
                  before you confirm.</li>
                <li>You are responsible for the bank details you give us. Check them carefully: we may not be able to recover
                  money paid to the wrong account because of details you entered.</li>
                <li>Withdrawals are usually processed quickly, but can take longer because of bank delays, checks we must carry
                  out, or public holidays. If a bank rejects a payout, the money returns to your balance.</li>
              </ul>
            </section>

            <section id="sending">
              <h2>7. Sending stablecoins</h2>
              <p>You can send stablecoins from your balance to a wallet address on the network you choose.</p>
              <div className="box">
                <p><strong>Blockchain transfers can’t be reversed.</strong> If you send to the wrong address, or on a network the
                  receiving wallet doesn’t support, the funds will usually be lost for good, and neither we nor our partners can
                  get them back. Always check the address and network before you confirm.</p>
              </div>
            </section>

            <section id="payouts">
              <h2>8. Cross-border payouts</h2>
              <p>Where we offer it, you can send money to bank accounts in other countries. The countries and currencies
                available can change, and the app shows what is available to you.</p>
              <ul>
                <li>Some corridors, such as payouts to China, are reviewed and sent manually. These take longer than automatic
                  payouts.</li>
                <li>Delivery times depend on the destination country, the receiving bank and the checks we and our partners must
                  carry out. Times shown in the app are estimates, not guarantees.</li>
                <li>You are responsible for giving accurate recipient details and for making sure the payment is lawful in both
                  countries.</li>
              </ul>
            </section>

            <section id="fees">
              <h2>9. Fees</h2>
              <p>Our fees are shown in the app before you confirm a transaction. The fee shown when you confirm is the fee you
                pay for that transaction.</p>
              <p>We may change our fees from time to time. Changes apply only to transactions you confirm after the change. Your
                bank or other providers you use may also charge their own fees, which we don’t control.</p>
            </section>

            <section id="prohibited">
              <h2>10. Prohibited use</h2>
              <p>You must not use ZemFi, or let anyone else use your account, to:</p>
              <ul>
                <li>commit fraud, or receive or move the proceeds of fraud or any other crime;</li>
                <li>launder money or finance terrorism;</li>
                <li>deal with any person, country or organisation subject to sanctions, or get around sanctions;</li>
                <li>use someone else’s identity, documents, bank account or card, or give false information;</li>
                <li>open more than one account, or open an account on behalf of someone else without authority;</li>
                <li>pay for illegal goods or services, gambling that is unlawful where you are, or anything else that breaks the
                  law;</li>
                <li>interfere with, reverse-engineer, attack or misuse the app, our systems or other customers’ accounts.</li>
              </ul>
            </section>

            <section id="holds">
              <h2>11. Compliance holds, freezes and closure</h2>
              <p>We, and our partners, are required to monitor transactions and act on suspected fraud, money laundering or
                sanctions breaches. We may, where we reasonably believe it is necessary:</p>
              <ul>
                <li>delay, hold or refuse a transaction while we carry out checks or ask you for information;</li>
                <li>restrict or freeze your account;</li>
                <li>report activity to the relevant authorities, where the law requires it, without telling you;</li>
                <li>close your account if you break these terms or if we are required to by law. Where we can, we’ll give you
                  notice and let you withdraw any balance you are entitled to.</li>
              </ul>
            </section>

            <section id="risks">
              <h2>12. Risks of stablecoins</h2>
              <p>Please make sure you understand these risks before using ZemFi:</p>
              <ul>
                <li>Stablecoins are <strong>not legal tender</strong> and are <strong>not bank deposits</strong>. They are not
                  protected by any deposit insurance scheme.</li>
                <li>A stablecoin is designed to hold a steady value against another currency, such as the US dollar, but it can{" "}
                  <strong>lose its peg</strong> and fall in value, sometimes suddenly.</li>
                <li>Exchange rates between stablecoins and your local currency move all the time, so the value of your balance in
                  your local currency can go up or down.</li>
                <li>Stablecoins depend on their issuers and on blockchain networks, which can fail, be disrupted or change.</li>
                <li>Laws and regulations about digital assets can change and may affect what we can offer.</li>
              </ul>
              <p>Nothing in ZemFi is financial, investment or tax advice. You are responsible for your own decisions and for any
                tax due on your transactions.</p>
            </section>

            <section id="availability">
              <h2>13. Service availability</h2>
              <p>We work to keep ZemFi running smoothly, but we can’t promise it will always be available or free of errors. The
                service may be unavailable during maintenance, because of problems with our partners, banks or blockchain networks,
                or for reasons outside our control. We may change, add or remove features, countries or currencies.</p>
            </section>

            <section id="partners">
              <h2>14. Our partners</h2>
              <p>Payments, balances, stablecoin custody and liquidity are provided by our licensed payment and liquidity partners,
                together with the banks and payment providers they work with. Identity verification is also carried out with our
                partners. Their own terms may also apply to the services they provide to you, and they may need to carry out their
                own checks before completing a transaction.</p>
            </section>

            <section id="liability">
              <h2>15. Our liability</h2>
              <p>We are responsible for providing ZemFi with reasonable care and skill. As far as the law allows:</p>
              <ul>
                <li>we are not responsible for losses caused by your own mistakes, such as wrong bank details, a wrong wallet
                  address or network, or a quote you confirmed;</li>
                <li>we are not responsible for losses caused by someone using your account because you did not keep your
                  password, phone or authenticator secure;</li>
                <li>we are not responsible for changes in the value of stablecoins, or for delays or failures caused by banks,
                  blockchain networks or events outside our reasonable control;</li>
                <li>we are not responsible for indirect losses, such as loss of profit or opportunity.</li>
              </ul>
              <p>Nothing in these terms limits any liability that cannot be limited by law, including liability for our fraud.</p>
            </section>

            <section id="delete">
              <h2>16. Deleting your account</h2>
              <p>You can delete your account at any time in the app under <strong>Settings &rarr; Delete account</strong>, or by
                emailing <a href="mailto:support@zemfi.ng">support@zemfi.ng</a> from the address on your account. Your balance must
                be empty and no transfers can be pending. Some records must be kept for the period the law requires, as explained
                in our <a href="/privacy#delete">Privacy Policy</a>.</p>
            </section>

            <section id="changes">
              <h2>17. Changes to these terms</h2>
              <p>We may update these terms as the service or the law changes. When we make significant changes, we’ll tell you in
                the app or by email before they take effect. If you keep using ZemFi after that, you accept the updated terms. If
                you don’t agree, you can delete your account. The date at the top shows when these terms were last updated.</p>
            </section>

            <section id="law">
              <h2>18. Governing law and disputes</h2>
              <p>These terms are governed by the laws of the <strong>Federal Republic of Nigeria</strong>.</p>
              <p>If you have a complaint, please contact us first so we can try to put things right. If we can’t resolve it
                together, the dispute will be decided by the courts of Nigeria.</p>
            </section>

            <section id="contact">
              <h2>19. Contact us</h2>
              <div className="box">
                <p>Questions or complaints about these terms or your account:<br />
                  <a href="mailto:support@zemfi.ng">support@zemfi.ng</a></p>
              </div>
            </section>
          </article>
        </div>
      </main>

      <div className="wrap">
        <footer>
          <span>ZemFi &mdash; cross-border payments and stablecoins.</span>
          <span><a href="/privacy">Privacy Policy</a> &middot; <a href="/">Home</a></span>
        </footer>
      </div>
    </>
  );
}
