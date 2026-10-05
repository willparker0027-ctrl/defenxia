import type { SVGProps } from "react";

/**
 * Icon set copied verbatim from the DEFENXIA reference mockup
 * (defenxia.html) — same viewBox, same paths, same strokes.
 */

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "aria-hidden": true,
  ...props,
});

export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconDots = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.6" fill="#f5f3ff" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="#f5f3ff" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="#f5f3ff" stroke="none" />
  </svg>
);

export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 01-3.4 0" />
  </svg>
);

export const IconProfile = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const IconShieldPlain = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
  </svg>
);

export const IconArrow = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSms = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    <path d="M12 7l1.2 2.4 2.6.4-1.9 1.8.4 2.6-2.3-1.2-2.3 1.2.4-2.6-1.9-1.8 2.6-.4z" />
  </svg>
);

export const IconBank = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 21h18M4 18h16M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 3L3 8h18l-9-5z" />
  </svg>
);

export const IconWifi = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.55a11 11 0 0114.08 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
  </svg>
);

export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

export const IconQr = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z" />
  </svg>
);

export const IconAppDoc = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h3" />
    <circle cx="16" cy="16" r="3" />
    <path d="M15 16l1 1 2-2" />
  </svg>
);

export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <rect x="9" y="11" width="6" height="6" rx="1" />
    <path d="M10 11V9a2 2 0 014 0v2" />
  </svg>
);

export const IconShieldWifi = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.55a11 11 0 0114.08 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity=".9" />
  </svg>
);

export const IconFileSearch = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <circle cx="11" cy="14" r="3" />
    <path d="M13.5 16.5L16 19" />
  </svg>
);

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" />
    <path d="M12 6v6l4 2" />
  </svg>
);

export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconShieldCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconActivity = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 20v-6M12 20V6M18 20v-10" />
  </svg>
);

export const IconGear = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

/* Extra icons for the additional ZIP tools (same stroke language) */

export const IconKillSwitch = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2v8" strokeLinecap="round" />
    <path d="M18.36 6.64a9 9 0 11-12.73 0" strokeLinecap="round" />
  </svg>
);

export const IconPhoneShield = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M12 6l4 2v3c0 2.5-1.8 4.2-4 5-2.2-.8-4-2.5-4-5V8l4-2z" />
  </svg>
);

export const IconGlobe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

export const IconKeyRound = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.9 12.1L21 2M15 8l3 3M18 5l2 2" strokeLinecap="round" />
  </svg>
);

export const IconBug = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="7" width="8" height="13" rx="4" />
    <path d="M12 7V4M8 4l4 3 4-3M4 12h4M16 12h4M5 6l3 2M19 6l-3 2M6 19l-2 2M18 19l2 2" strokeLinecap="round" />
  </svg>
);

export const IconFirewall = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 21V10l8-6 8 6v11" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 21v-4h6v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 3v4" strokeLinecap="round" />
  </svg>
);
