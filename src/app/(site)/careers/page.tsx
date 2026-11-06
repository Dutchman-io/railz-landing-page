/* eslint-disable @next/next/no-html-link-for-pages -- marketing pages link with plain <a> on purpose: home.css and doc.css reuse selectors, so each page must arrive on a full load with only its own stylesheet (see site.css). */
import type { Metadata } from "next";
import { DocHeader } from "@/components/site/DocHeader";
import "../doc.css";
import "./careers.css";

export const metadata: Metadata = {
  title: "Careers",
  description: "Work on ZemFi: open roles and how to apply.",
};

export default function CareersPage() {
  return (
    <>
      <DocHeader tile={false} />

      <main className="wrap">
        <article className="page">
          <p className="label">Careers</p>
          <h1>Work on ZemFi</h1>
          <p className="intro">ZemFi helps people hold stablecoins, fund and withdraw in their own currency, and send money
            across borders from their phone. If you want to build that with us, this is where we list the roles we
            are hiring for.</p>

          <section id="roles">
            <h2>Open roles</h2>
            {/*
              One <li className="role"> per open role. Keep the mailto subject naming
              the role, so applications sort themselves:

              <li className="role">
                <h3>Role title</h3>
                <p className="facts">Full-time &middot; Lagos or remote</p>
                <p>Two or three sentences on what the person will own.</p>
                <a className="apply" href="mailto:careers@zemfi.ng?subject=Application%3A%20Role%20title">Apply</a>
              </li>

              With no roles listed, keep the .empty paragraph and drop the list.
            */}
            <ul className="roles">
              <li className="role">
                <h3>Community Manager</h3>
                <p>Build and look after the ZemFi community: answer questions where our users gather, run the conversations and events that bring new people in, and carry what users tell you back to the team.</p>
                <a className="apply" href="mailto:careers@zemfi.ng?subject=Application%3A%20Community%20Manager">Apply</a>
              </li>
              <li className="role">
                <h3>Sales</h3>
                <p>Bring ZemFi to the people and businesses who move money across borders: find them, show them how ZemFi works for them, and see them through to their first transactions.</p>
                <a className="apply" href="mailto:careers@zemfi.ng?subject=Application%3A%20Sales">Apply</a>
              </li>
              <li className="role">
                <h3>Content Creator</h3>
                <p>Make the videos, posts and guides that explain stablecoins, payments and ZemFi simply, and grow our audience on the platforms our users spend their time on.</p>
                <a className="apply" href="mailto:careers@zemfi.ng?subject=Application%3A%20Content%20Creator">Apply</a>
              </li>
            </ul>
          </section>

          <section id="apply">
            <h2>How to apply</h2>
            <p>Email <a href="mailto:careers@zemfi.ng">careers@zemfi.ng</a> with the role in the subject line. Include:</p>
            <ul>
              <li>your CV, or a link to your work (GitHub, portfolio, writing);</li>
              <li>a few lines on what you would want to work on at ZemFi, and why.</li>
            </ul>
            <p>We read every application and reply to each one, including when it is a no.</p>
          </section>

          <section id="open">
            <h2>Don&rsquo;t see your role?</h2>
            <p>Write anyway. If you think you could make ZemFi better, tell us how at{" "}
              <a href="mailto:careers@zemfi.ng?subject=Open%20application">careers@zemfi.ng</a>.</p>
          </section>
        </article>
      </main>

      <div className="wrap">
        <footer>
          <span>ZemFi &mdash; cross-border payments and stablecoins.</span>
          <span><a href="/terms">Terms of Service</a> &middot; <a href="/privacy">Privacy Policy</a> &middot; <a href="/">Home</a></span>
        </footer>
      </div>
    </>
  );
}
