import { useState } from 'react';

// The ONLY element that is always centered, fully visible, uncropped, and
// never animated — per both the prose brief and the measured reference.
//
// Updated 2026-09-11: the owner's real logo file has been supplied
// (a "vendorja" wordmark) and extracted into three flat-colored PNGs —
// public/logo-wordmark-white.png, -red.png, -black.png — one per background
// this component appears on. `variant` picks both the size (default | small)
// and color (white by default, "red" for the white result screen) exactly
// like before; we just point at the real asset per color instead of the
// placeholder /logo.svg + CSS invert-filter hack that used to fake red.
export default function Logo({ variant = '', style, className = '' }) {
  const [broken, setBroken] = useState(false);
  const cls = `logo ${variant} ${className}`.trim();
  // RED ON NAVY FAILS ITS OWN RULE AND ITS OWN CONTRAST.
  // The `red` variant dates from the poster palette, when the result
  // screens were white. They are dark navy now, and measured against the
  // page ground #0d1a35:
  //     red   #e01b1b ->  3.57:1   (below WCAG AA 4.5:1 for text)
  //     white #ffffff -> 17.27:1
  // It also breaks the standing palette rule — red is CTA-only, "almost
  // nothing" — and a wordmark is not a call to action. So on the dark
  // screens the white wordmark is used regardless of the variant asked
  // for; `black` still wins where a genuinely light surface remains.
  // RED IS BACK, because the ground changed and the measurement did too.
  // Owner, 2026-09-17: "accentuate the logo and the RED color a bit more".
  // Earlier today the red wordmark was retired: #e01b1b on the navy ground
  // measured 3.57:1, below WCAG AA. On the new graphite ground #14161a the
  // brighter accent #ff2e2e measures 4.90:1 and PASSES AA for text — so the
  // wordmark can be the accent colour without being hard to read, which was
  // never true on navy. `black` still wins on a genuinely light surface.
  const color = variant.includes('black') ? 'black' : variant.includes('white') ? 'white' : 'red';
  const src = `/logo-wordmark-${color}.png`;

  if (broken) {
    return (
      <span className={cls} style={style} aria-label="vendorja">
        vendorja
      </span>
    );
  }

  return (
    <img
      src={src}
      alt="vendorja"
      className={`${cls} logo-img`}
      style={style}
      onError={() => setBroken(true)}
    />
  );
}
