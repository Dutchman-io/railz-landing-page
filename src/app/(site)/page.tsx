import type { Metadata } from "next";
import { Globe } from "@/components/site/Globe";
import { ScreenCarousel } from "@/components/site/ScreenCarousel";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import "./home.css";

export const metadata: Metadata = {
  description:
    "ZemFi runs your cross-border payments on USDT and USDC. Pay bank accounts in other countries, get paid by clients abroad, and hold a dollar-pegged balance in between.",
  openGraph: {
    title: "ZemFi",
    description: "Pay across borders, settled in stablecoins. Stablecoin-backed payments from one app.",
    type: "website",
  },
};

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.dutchmannetwork.railz";

/*
 * Elements with the `rv` class fade in on scroll (see ScrollReveal). They are
 * the old script's targets: each section's direct children (except the grid
 * containers), the items inside those grids, .stage, .reach-copy and .close.
 */

function PlayIcon() {
  return (
    <svg width="21" height="23" viewBox="0 0 24 26" fill="none" aria-hidden="true">
      <path d="M1.6 1.2 14.3 13 1.6 24.8A2 2 0 0 1 1 23.4V2.6a2 2 0 0 1 .6-1.4Z" fill="currentColor" opacity=".95" />
      <path d="M17.4 9.9 3.6.3 15.8 7.5l1.6 2.4Z" fill="currentColor" opacity=".72" />
      <path d="M17.4 16.1 15.8 18.5 3.6 25.7l13.8-9.6Z" fill="currentColor" opacity=".72" />
      <path d="m17.4 9.9 4.3 2.4a1.4 1.4 0 0 1 0 2.4l-4.3 2.4L14.3 13l3.1-3.1Z" fill="currentColor" opacity=".88" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="23" viewBox="0 0 20 24" fill="none" aria-hidden="true">
      <path
        d="M16.4 12.7c0-2.8 2.3-4.2 2.4-4.2-1.3-1.9-3.3-2.2-4-2.2-1.7-.2-3.3 1-4.2 1-.8 0-2.2-1-3.6-1-1.9 0-3.6 1.1-4.5 2.8-1.9 3.3-.5 8.3 1.4 11 .9 1.3 2 2.8 3.4 2.7 1.4-.05 1.9-.9 3.5-.9s2.1.9 3.6.85c1.5 0 2.4-1.3 3.3-2.7 1-1.5 1.5-3 1.5-3.1 0 0-2.8-1.1-2.8-4.25Z"
        fill="currentColor"
      />
      <path
        d="M13.8 4.4c.75-.9 1.25-2.2 1.1-3.4-1.1.05-2.4.7-3.2 1.6-.7.8-1.3 2.1-1.15 3.3 1.2.1 2.45-.6 3.25-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 9h19M6 6.5h.01M8.5 6.5h.01" />
    </svg>
  );
}

/* The store buttons, plus the web app. Shared by the hero and the closing CTA. */
function GetTheApp() {
  return (
    <div className="cta">
      <a className="btn btn-fill" href={PLAY_URL}>
        <PlayIcon />
        <span className="lbl"><small>Get it on</small><strong>Google Play</strong></span>
      </a>
      <span className="btn btn-line btn-soon" aria-disabled="true">
        <AppleIcon />
        <span className="lbl"><small>Coming soon to the</small><strong>App Store</strong></span>
      </span>
      <a className="btn btn-line" href="/register">
        <WebIcon />
        <span className="lbl"><small>Use</small>{" "}<strong>ZemFi on the web</strong></span>
      </a>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <div className="wrap">
        <header className="mast">
          <a className="brand" href="#top">
            <span className="tile tile-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- static 224px brand tile, kept as a plain <img> to match the old page */}
              <img src="/logo.png" alt="" />
            </span>
            <span className="word">Zem<b>Fi</b></span>
          </a>
          <nav className="mast-nav" aria-label="Account">
            <a className="signin" href="/login">Sign in</a>
            <a className="btn btn-fill btn-sm" href="/register">
              <span className="lbl"><strong>Create account</strong></span>
            </a>
          </nav>
        </header>
      </div>

      <main id="top">
        <div className="wrap wrap-full">
          <section className="hero">
            <div>
              <p className="kicker">Stablecoin-backed payments</p>
              <h1><span className="ln"><span>Pay across borders.</span></span><span className="ln"><span><i>Settled in stablecoins.</i></span></span></h1>
              <p className="lede">
                Every ZemFi payment moves on USDT and USDC, so your money keeps its dollar
                value on the way. Pay bank accounts in other countries, get paid by clients
                abroad, and hold a stablecoin balance in between.
              </p>
              <GetTheApp />
              <p className="note">Free to download. Verification is needed before your first transfer.</p>
            </div>

            <Globe />
          </section>
        </div>

        <div className="wrap">
          <div className="reach">
            <div className="stage rv">
              <ScreenCarousel />
            </div>
            <div className="reach-copy rv">
              <p className="label">Inside the app</p>
              <h2>Your stablecoin balance, next to your local one.</h2>
              <p className="sub">See what you hold in USDT, USDC and your local currency side by side, convert at live rates, and pay or get paid from the same balance.</p>
            </div>
          </div>
        </div>

        <div className="wrap">
          <section>
            <p className="label rv">What it does</p>
            <h2 className="rv">Stablecoins underneath every payment, with no trading account required.</h2>
            <div className="caps">
              <div className="cap rv"><h3>Pay anyone abroad</h3><p>Pay a bank account in another country. Your money travels as <em>USDT</em> or <em>USDC</em> and arrives in their bank. The app asks for exactly what that country’s banks need.</p></div>
              <div className="cap rv"><h3>Get paid from abroad</h3><p>Give international clients a foreign account they pay like a local transfer. It settles into your ZemFi balance as stablecoins.</p></div>
              <div className="cap rv"><h3>Hold dollars as stablecoins</h3><p>Buy or sell <em>USDT</em> and <em>USDC</em> with your local currency at live rates, with the rate and the fee shown before you commit.</p></div>
              <div className="cap rv"><h3>Pay any wallet on-chain</h3><p>Send stablecoins to any wallet across <em>Tron</em>, <em>Ethereum</em>, <em>Polygon</em>, <em>Base</em>, <em>Arbitrum</em> and <em>BNB Smart Chain</em>. Scan a QR code instead of typing out a long wallet address.</p></div>
              <div className="cap rv"><h3>Cash out to your bank</h3><p>Turn stablecoins back into local currency in an account in your own name. Save it once and it’s ready next time.</p></div>
            </div>
          </section>
        </div>

        <div className="wrap">
          <section className="rule">
            <p className="label rv">How a payment moves</p>
            <h2 className="rv">Your currency in. Stablecoins across. Their bank out.</h2>
            <ol className="steps">
              <li className="rv"><span className="n">01</span><h3>You pay in your currency</h3><p>Fund the payment from your local or stablecoin balance. The rate and the fee are shown before you confirm.</p></li>
              <li className="rv"><span className="n">02</span><h3>It crosses as a stablecoin</h3><p>The money travels as USDT or USDC, pegged to the US dollar, so its value holds while it’s on the way.</p></li>
              <li className="rv"><span className="n">03</span><h3>It lands in their bank</h3><p>Your recipient gets a normal bank payment. They never need a wallet or to know about crypto.</p></li>
            </ol>
          </section>
        </div>

        <div className="wrap">
          <section className="rule">
            <p className="label rv">Who it’s for</p>
            <h2 className="rv">For anyone who gets paid, or pays, across borders.</h2>
            <div className="who">
              <div className="rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M2 20h20" /></svg></span><h3>Freelancers &amp; remote workers</h3><p>Give clients abroad an account they can pay into, hold what they send as stablecoins, and cash out when you choose.</p></div>
              <div className="rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1Z" /></svg></span><h3>Family &amp; friends abroad</h3><p>Pay someone’s bank account in another country straight from your balance.</p></div>
              <div className="rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1.1 1.6 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2c-1.3 0-2.3-.4-2.8-1.2M12 6.5v1.5M12 16v1.5" /></svg></span><h3>Saving in dollars</h3><p>Keep part of your money in USDT or USDC, and switch back to local currency at a rate you see before you confirm.</p></div>
              <div className="rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg></span><h3>Small businesses</h3><p>Pay suppliers overseas on stablecoin rails, straight into their bank, in the format their country uses.</p></div>
            </div>
          </section>
        </div>

        <div className="wrap">
          <section className="rule">
            <p className="label rv">How money reaches you</p>
            <h2 className="rv">Get paid however suits you.</h2>
            <div className="slots">
              <div className="slot rv"><span className="tag">Local</span><h3>An account in your name</h3><p>A permanent local account for receiving payments in your currency.</p></div>
              <div className="slot rv"><span className="tag">One-off</span><h3>A single payment</h3><p>A one-time account for collecting a single, fixed-amount payment.</p></div>
              <div className="slot rv"><span className="tag">Crypto</span><h3>A wallet address</h3><p>Receive stablecoins from any wallet or exchange.</p></div>
              <div className="slot rv"><span className="tag">Abroad</span><h3>A foreign account</h3><p>Lets clients abroad pay you as easily as they’d pay someone locally.</p></div>
            </div>
          </section>
        </div>

        <div className="wrap">
          <section className="rule">
            <p className="label rv">Before the money moves</p>
            <h2 className="rv">Strong security that stays out of your way.</h2>
            <div className="safe">
              <div className="rv"><h3>CBN-compliant verification</h3><p>Verify once before your first transfer. Checks follow the Central Bank of Nigeria’s tiered KYC framework, with your BVN confirmed against NIBSS records.</p></div>
              <div className="rv"><h3>Two-factor on transfers</h3><p>Every transfer needs a code from your authenticator app before money leaves your balance.</p></div>
              <div className="rv"><h3>Biometric unlock</h3><p>Open the app with Face ID or your fingerprint, so no one else can get in if they pick up your phone.</p></div>
              <div className="rv"><h3>No double payments</h3><p>If your connection drops and you tap again, your money is still only sent once.</p></div>
            </div>
          </section>
        </div>

        <div className="wrap">
          <section className="rule">
            <p className="label rv">Questions</p>
            <h2 className="rv">Good to know before you start.</h2>
            <div className="faq">
              <details className="rv"><summary>What does “stablecoin-backed” mean?</summary><p>When you pay someone abroad or get paid from abroad, the money moves as USDT or USDC, digital dollars that hold a 1:1 value with the US dollar. You and your recipient still see bank payments at each end.</p></details>
              <details className="rv"><summary>Does the person I pay need crypto?</summary><p>No. They receive a regular payment into their bank account. The stablecoin part happens in between.</p></details>
              <details className="rv"><summary>What do I need to get started?</summary><p>The ZemFi app on your phone, or <a href="/register">ZemFi on the web</a>, and a few details to verify who you are. Verification happens once, before your first transfer.</p></details>
              <details className="rv"><summary>Will I know the fee before I send?</summary><p>Yes. The exchange rate and the fee are shown before you confirm, so you know exactly what arrives.</p></details>
              <details className="rv"><summary>Which countries can I send to?</summary><p>The United Kingdom, the Eurozone, Brazil, Mexico, the United States, Canada and China, with more on the way.</p></details>
              <details className="rv"><summary>Which stablecoins does ZemFi support?</summary><p>USDT and USDC, on Tron, Ethereum, Polygon, Base, Arbitrum and BNB Smart Chain.</p></details>
              <details className="rv"><summary>Can I buy stablecoins with local currency?</summary><p>Yes. Buy USDT or USDC from your local balance, with the rate and the fee shown before you confirm.</p></details>
              <details className="rv"><summary>Where do my withdrawals go?</summary><p>To a bank account in your own name. Save it once and it’s ready next time.</p></details>
              <details className="rv"><summary>What if my connection drops mid-transfer?</summary><p>Just try again. ZemFi recognises the retry, so your money is never sent twice.</p></details>
              <details className="rv"><summary>Is ZemFi CBN compliant?</summary><p>Identity checks follow the Central Bank of Nigeria’s tiered KYC framework: your BVN and details are verified against NIBSS records, and higher tiers add your NIN, an ID document and proof of address. Payments, balances and custody are provided by a licensed, regulated payments partner.</p></details>
              <details className="rv"><summary>How is my account protected?</summary><p>Transfers need a code from your authenticator app, and the app opens with Face ID or your fingerprint.</p></details>
            </div>
          </section>
        </div>

        <div className="wrap">
          <div className="close rv">
            <span className="tile tile-lg">
              {/* eslint-disable-next-line @next/next/no-img-element -- static 224px brand tile, kept as a plain <img> to match the old page */}
              <img src="/logo.png" alt="ZemFi" />
            </span>
            <div>
              <p className="label">Get the app</p>
              <h2>Get started in minutes.</h2>
              <GetTheApp />
            </div>
          </div>
        </div>

        <div className="wrap">
          <footer>
            <span>ZemFi &mdash; stablecoin-backed payments across borders.</span>
            <span className="mono">KYC per CBN tiered framework &middot; Available on Android &middot; iOS coming soon</span>
            <span>Support: <a href="mailto:support@zemfi.ng">support@zemfi.ng</a> &middot; <a href="/careers">Careers</a> &middot; <a href="/terms">Terms of Service</a> &middot; <a href="/privacy">Privacy Policy</a></span>
          </footer>
        </div>
      </main>

      <ScrollReveal />
    </>
  );
}
