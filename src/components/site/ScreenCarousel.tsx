"use client";

import { useEffect, useState } from "react";

const SHOTS = [
  {
    src: "/screens/dashboard.jpg",
    alt: "The ZemFi dashboard, showing a Naira balance and live USDT buy and sell rates",
  },
  {
    src: "/screens/currencies.jpg",
    alt: "The ZemFi currency picker, listing Naira, USDT, USDC and cNGN balances",
  },
  { src: "/screens/signup.jpg", alt: "The ZemFi sign-up screen, with personal and business accounts" },
];

/* The phone in the "Inside the app" section: real app screens that cross-fade
   every 3.6s. With reduced motion it stays on the first screen. */
export function ScreenCarousel() {
  const [on, setOn] = useState(0);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setOn((i) => (i + 1) % SHOTS.length), 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="phone">
        <div className="screen">
          {SHOTS.map((s, n) => (
            // eslint-disable-next-line @next/next/no-img-element -- stacked, cross-faded screens styled by .screen img; plain <img> keeps the old markup
            <img key={s.src} id={`sc${n}`} className={n === on ? "on" : undefined} src={s.src} alt={s.alt} />
          ))}
        </div>
      </div>
      <div className="dots" id="dots" aria-hidden="true">
        {SHOTS.map((s, n) => (
          <span key={s.src} className={n === on ? "dot on" : "dot"} />
        ))}
      </div>
    </div>
  );
}
