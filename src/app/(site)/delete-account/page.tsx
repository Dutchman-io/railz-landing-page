/* eslint-disable @next/next/no-html-link-for-pages -- marketing pages link with plain <a> on purpose: home.css and doc.css reuse selectors, so each page must arrive on a full load with only its own stylesheet (see site.css). */
import type { Metadata } from "next";
import { DocHeader } from "@/components/site/DocHeader";
import "../doc.css";

export const metadata: Metadata = {
  title: "Delete Your Account",
  description: "How to delete your ZemFi account and the data linked to it, with or without the app.",
};

export default function DeleteAccountPage() {
  return (
    <>
      <DocHeader />

      <main className="wrap">
        <div className="doc">
          <nav className="toc" aria-label="On this page">
            <p>On this page</p>
            <ol>
              <li><a href="#in-app">Delete in the app</a></li>
              <li><a href="#by-email">Delete by email</a></li>
              <li><a href="#before">Before you delete</a></li>
              <li><a href="#deleted">What we delete</a></li>
              <li><a href="#kept">What we keep, and for how long</a></li>
            </ol>
          </nav>

          <article>
            <p className="label">Your account</p>
            <h1>Delete your ZemFi account</h1>
            <p className="meta">Last updated 10 October 2026</p>
            <p className="intro">This page explains how to delete your account in the <strong>ZemFi</strong> app, operated by
              ZemFi Technologies Ltd, and the data linked to it. You can delete it in the app, or by email if you no
              longer have the app installed.</p>

            <section id="in-app">
              <h2>1. Delete in the app</h2>
              <ol>
                <li>Open the ZemFi app and sign in.</li>
                <li>Go to <strong>Settings</strong>.</li>
                <li>Tap <strong>Delete account</strong>.</li>
                <li>Read the list of what is deleted and what is kept, type <strong>DELETE</strong> to confirm,
                  and tap <strong>Delete my account</strong>.</li>
              </ol>
              <p>Your account is closed straight away and you are signed out. Deletion can’t be undone.</p>
            </section>

            <section id="by-email">
              <h2>2. Delete by email</h2>
              <p>If you no longer have the app, or can’t sign in, email us and we will delete your account for you.</p>
              <div className="box">
                <p><strong>To:</strong> <a href="mailto:support@zemfi.ng?subject=Delete%20my%20ZemFi%20account">support@zemfi.ng</a><br />
                  <strong>Subject:</strong> Delete my ZemFi account<br />
                  <strong>Send it from:</strong> the email address on your ZemFi account</p>
              </div>
              <p>We may ask you to confirm the request before we act on it, so that nobody else can close your account.
      </p>
            </section>

            <section id="before">
              <h2>3. Before you delete</h2>
              <p>An account can only be deleted when it holds no money and nothing is in flight. Withdraw any balance you
                are still holding, including liquidity you have committed to the pool, and wait for transfers in progress
                to finish. If anything is outstanding, we will tell you what it is.</p>
            </section>

            <section id="deleted">
              <h2>4. What we delete</h2>
              <ul>
                <li>Your name, email address, phone number and home address</li>
                <li>Your password and your two-factor authenticator secret</li>
                <li>Your saved recipients and saved payout bank accounts</li>
                <li>Any API keys issued to you</li>
              </ul>
            </section>

            <section id="kept">
              <h2>5. What we keep, and for how long</h2>
              <p>Anti-money-laundering law requires us and our payments partner to keep records of who we verified and
                what we moved for them after an account closes. These are kept for <strong>five years</strong> from the
                day your account is closed, and are then deleted:</p>
              <ul>
                <li>Verification records: your BVN and NIN, and any ID document you uploaded</li>
                <li>Your transaction, payout and ledger history, including the bank account recorded on each payout</li>
              </ul>
              <p>They are not used for anything else once your account is closed. Stablecoin transfers are recorded on
                public blockchains, which nobody can delete.</p>
              <p>For more detail, see our <a href="/privacy">Privacy Policy</a>.</p>
            </section>
          </article>
        </div>
      </main>

      <div className="wrap">
        <footer>
          <span>ZemFi &mdash; cross-border payments and stablecoins.</span>
          <span><a href="/privacy">Privacy Policy</a> &middot; <a href="/terms">Terms of Service</a> &middot; <a href="/">Home</a></span>
        </footer>
      </div>
    </>
  );
}
