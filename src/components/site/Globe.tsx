"use client";

import { useEffect, useRef } from "react";
import { display } from "./fonts";
import { HOME, LAND, PLACES } from "./globe-data";

type Vec = [number, number, number];

/*
 * The hero globe: dotted land, a faint arc for every corridor, and the active
 * arc drawn in with a travelling pulse. Arcs run from the reader ("You") to
 * each destination in turn. Drag to spin; the cycle waits a moment after a
 * drag. With reduced motion it draws once (and on drag) without animating.
 * A port of the inline script from the old static page; keep the numbers.
 */
export function Globe() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const font = display.style.fontFamily;
    const reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const D = Math.PI / 180;
    const raw = LAND.split(",");
    const N = raw.length / 2;
    const P = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const lo = (Number(raw[2 * i]) / 10) * D;
      const la = (Number(raw[2 * i + 1]) / 10) * D;
      P[3 * i] = Math.cos(la) * Math.cos(lo);
      P[3 * i + 1] = Math.cos(la) * Math.sin(lo);
      P[3 * i + 2] = Math.sin(la);
    }
    function vec(lat: number, lon: number): Vec {
      lat *= D;
      lon *= D;
      return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    }

    const home = vec(HOME[0], HOME[1]);
    const dests = PLACES.map(([name, lat, lon]) => {
      const b = vec(lat, lon);
      const a = home;
      const w = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const s = Math.sin(w);
      const pts: Vec[] = [];
      for (let k = 0; k <= 72; k++) {
        const t = k / 72;
        const f = (1 + (0.05 + (0.2 * w) / Math.PI) * Math.sin(Math.PI * t)) / s;
        const p = Math.sin((1 - t) * w);
        const q = Math.sin(t * w);
        pts.push([(p * a[0] + q * b[0]) * f, (p * a[1] + q * b[1]) * f, (p * a[2] + q * b[2]) * f]);
      }
      const m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
      const ml = Math.hypot(m[0], m[1], m[2]);
      return {
        v: b,
        pts,
        name,
        lam: Math.atan2(m[1], m[0]),
        phi: Math.max(-0.1, Math.min(0.55, Math.asin(m[2] / ml))),
      };
    });

    let lam = dests[0].lam;
    let phi = 0.3;
    let tLam = lam;
    let tPhi = phi;
    let active = 0;
    let switchT = 0;
    let holdUntil = 0;
    let visible = true;
    let W = 0;
    let H = 0;
    let R = 0;
    let cx = 0;
    let cy = 0;
    let dpr = 1;
    const sp: Vec = [0, 0, 0];

    function project(x: number, y: number, z: number): Vec {
      const cl = Math.cos(lam), sl = Math.sin(lam), cp = Math.cos(phi), s = Math.sin(phi);
      const x1 = x * cl + y * sl, y1 = -x * sl + y * cl;
      sp[0] = cx + y1 * R;
      sp[1] = cy - (-x1 * s + z * cp) * R;
      sp[2] = x1 * cp + z * s;
      return sp;
    }
    function seen(p: Vec) {
      const nx = (p[0] - cx) / R, ny = (p[1] - cy) / R;
      return p[2] >= 0 || nx * nx + ny * ny > 1;
    }

    function size() {
      const r = cv!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv!.width = Math.round(r.width * dpr);
      H = cv!.height = Math.round(r.height * dpr);
      R = Math.min(W, H) * 0.42;
      cx = W / 2;
      cy = H / 2;
      draw(performance.now());
    }

    function setActive(i: number, now: number) {
      active = i;
      switchT = now;
      tLam = dests[i].lam;
      tPhi = dests[i].phi;
    }

    function pill(text: string, x: number, y: number, strong: boolean) {
      ctx!.font = (strong ? "700 " : "600 ") + 12.5 * dpr + "px " + font + ",sans-serif";
      const w = ctx!.measureText(text).width + 16 * dpr, h = 22 * dpr, r = h / 2;
      x = Math.max(4 * dpr, Math.min(W - w - 4 * dpr, x - w / 2));
      y -= h + 10 * dpr;
      ctx!.beginPath();
      ctx!.moveTo(x + r, y);
      ctx!.arcTo(x + w, y, x + w, y + h, r);
      ctx!.arcTo(x + w, y + h, x, y + h, r);
      ctx!.arcTo(x, y + h, x, y, r);
      ctx!.arcTo(x, y, x + w, y, r);
      ctx!.closePath();
      ctx!.fillStyle = strong ? "#0145ce" : "#ffffff";
      ctx!.shadowColor = "rgba(11,20,36,.18)";
      ctx!.shadowBlur = 10 * dpr;
      ctx!.fill();
      ctx!.shadowBlur = 0;
      ctx!.fillStyle = strong ? "#ffffff" : "#0b1424";
      ctx!.textBaseline = "middle";
      ctx!.fillText(text, x + 8 * dpr, y + h / 2 + dpr * 0.5);
    }

    function draw(now: number) {
      if (!W) return;
      const c2 = ctx!;
      c2.clearRect(0, 0, W, H);
      const g = c2.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.65, "#eaf0fd");
      g.addColorStop(1, "#cfdcf7");
      c2.beginPath();
      c2.arc(cx, cy, R, 0, 7);
      c2.fillStyle = g;
      c2.fill();
      c2.lineWidth = dpr;
      c2.strokeStyle = "rgba(1,69,206,.16)";
      c2.stroke();

      // land, in four depth bands so the limb fades without a fill per dot
      const bands: number[][] = [[], [], [], []];
      for (let i = 0; i < N; i++) {
        const p = project(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
        if (p[2] > 0.02) bands[Math.min(3, (p[2] * 4) | 0)].push(p[0], p[1]);
      }
      const dot = Math.max(1.1, R / 150);
      for (let b = 0; b < 4; b++) {
        c2.beginPath();
        const L = bands[b], rr = dot * (0.75 + b * 0.12);
        for (let j = 0; j < L.length; j += 2) {
          c2.moveTo(L[j] + rr, L[j + 1]);
          c2.arc(L[j], L[j + 1], rr, 0, 7);
        }
        c2.fillStyle = "rgba(1,69,206," + (0.2 + b * 0.17) + ")";
        c2.fill();
      }

      // arcs: faint for every corridor, drawn-in plus a travelling pulse for the active one
      const age = now - switchT;
      let grow = reduce ? 1 : Math.min(1, age / 1100);
      grow = 1 - Math.pow(1 - grow, 3);
      c2.lineCap = "round";
      for (let d = 0; d < dests.length; d++) {
        const pts = dests[d].pts, on = d === active, last = on ? Math.round(grow * 72) : 72;
        c2.beginPath();
        let pen = false;
        for (let k = 0; k <= last; k++) {
          const q = project(pts[k][0], pts[k][1], pts[k][2]);
          if (seen(q)) {
            if (pen) c2.lineTo(q[0], q[1]);
            else c2.moveTo(q[0], q[1]);
            pen = true;
          } else pen = false;
        }
        c2.lineWidth = (on ? 2.2 : 1.1) * dpr;
        c2.strokeStyle = on ? "rgba(1,69,206,.9)" : "rgba(1,69,206,.2)";
        c2.stroke();
      }
      if (!reduce && grow >= 1) {
        const pts2 = dests[active].pts, head = (((age - 1100) / 1500) % 1) * 72;
        for (let s = 0; s < 14; s++) {
          const idx = Math.round(head - s * 1.1);
          if (idx < 0) break;
          const c = project(pts2[idx][0], pts2[idx][1], pts2[idx][2]);
          if (!seen(c)) continue;
          c2.beginPath();
          c2.arc(c[0], c[1], (3.2 - s * 0.18) * dpr, 0, 7);
          c2.fillStyle = "rgba(26,99,240," + (0.85 - s * 0.06) + ")";
          c2.fill();
        }
      }

      // pins
      const pulse = reduce ? 0 : (now % 1800) / 1800;
      function pin(v: Vec, color: string, ring: boolean): [number, number] | null {
        const p = project(v[0], v[1], v[2]);
        if (p[2] < 0) return null;
        const x = p[0], y = p[1];
        if (ring) {
          c2.beginPath();
          c2.arc(x, y, (4 + pulse * 14) * dpr, 0, 7);
          c2.strokeStyle = color.replace("1)", 0.55 * (1 - pulse) + ")");
          c2.lineWidth = 1.5 * dpr;
          c2.stroke();
        }
        c2.beginPath();
        c2.arc(x, y, 4 * dpr, 0, 7);
        c2.fillStyle = "#fff";
        c2.fill();
        c2.beginPath();
        c2.arc(x, y, 2.6 * dpr, 0, 7);
        c2.fillStyle = color;
        c2.fill();
        return [x, y];
      }
      for (let e = 0; e < dests.length; e++) if (e !== active) pin(dests[e].v, "rgba(1,69,206,1)", false);
      const hp = pin(home, "rgba(176,111,0,1)", true);
      const ap = pin(dests[active].v, "rgba(1,69,206,1)", true);
      if (hp) pill("You", hp[0], hp[1], false);
      if (ap && grow > 0.6) pill(dests[active].name, ap[0], ap[1], true);
    }

    function ang(a: number) {
      return Math.atan2(Math.sin(a), Math.cos(a));
    }

    // drag to spin; the cycle waits a moment after a drag
    let dragging = false, lx = 0, ly = 0;
    let prev = performance.now(), nextAt = prev + 3400;
    let raf = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!visible || document.hidden) return;
      if (now > holdUntil && !dragging) {
        if (now > nextAt) {
          setActive((active + 1) % dests.length, now);
          nextAt = now + 3400;
        }
        tLam += dt * 0.035;
        const k = 1 - Math.exp(-dt * 2.4);
        lam += ang(tLam - lam) * k;
        phi += (tPhi - phi) * k;
      }
      draw(now);
    }

    function down(e: PointerEvent) {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      cv!.setPointerCapture(e.pointerId);
    }
    function move(e: PointerEvent) {
      if (!dragging) return;
      const r = R / dpr;
      lam -= (e.clientX - lx) / r;
      phi = Math.max(-0.6, Math.min(0.9, phi + (e.clientY - ly) / r));
      lx = e.clientX;
      ly = e.clientY;
      tLam = lam;
      tPhi = phi;
      if (reduce) draw(performance.now());
    }
    function up() {
      if (dragging) {
        dragging = false;
        holdUntil = performance.now() + 4000;
        nextAt = holdUntil + 1200;
      }
    }
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    setActive(0, performance.now());

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(size);
      ro.observe(cv);
    } else window.addEventListener("resize", size);
    size();

    let io: IntersectionObserver | undefined;
    if (!reduce) {
      if (typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver((en) => {
          visible = en[0].isIntersecting;
        });
        io.observe(cv);
      }
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", size);
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div className="globe">
      <canvas id="globe" ref={ref} aria-hidden="true" />
      <p className="globe-hint">Drag to spin</p>
    </div>
  );
}
