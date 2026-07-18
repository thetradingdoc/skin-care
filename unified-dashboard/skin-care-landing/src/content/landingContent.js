export const HERO = {
  eyebrow: 'Touche',
  tagline: 'Be Bold',
  titleLine1: 'Skincare &',
  titleLine2a: 'medical',
  titleLine2b: 'journal.',
  subtitle:
    'One place for your skin, your prescriptions, your bills — whatever you need to keep track of. 20 AI reads free each month; manual entries are always free.',
  ctaLabel: 'Get started',
};

export const NAV_LINKS = [
  { label: 'How It Works', href: '#how' },
  { label: 'About', href: '/about.html' },
  { label: 'Contact', href: '/contact.html' },
  { label: 'Privacy', href: 'https://app.trytouche.com/privacy' },
];

export const JOURNEY_STEPS = {
  items: [
    {
      id: 'capture',
      num: '01',
      title: 'Capture what matters',
      bodyShort: 'Photo or PDF — skin, Rx, bill, mark, lab, or other.',
    },
    {
      id: 'confirm',
      num: '02',
      title: 'Confirm the facts',
      bodyShort: 'AI can draft fields; you always review before they stick.',
    },
    {
      id: 'track',
      num: '03',
      title: 'See it on your timeline',
      bodyShort: 'Calendar, Track, Progress, and Shelf stay in sync.',
    },
  ],
};

export const HOW_IT_WORKS = {
  title: 'A medical journal that includes your skin.',
  subtitle: 'Same story as the app Welcome screen — one place for what you need to keep track of.',
  items: [
    {
      id: 'capture',
      icon: 'camera',
      title: 'Capture with six tags',
      body: 'Skin, bill, prescription, mark, lab, or other — photo or PDF. Manual entry is always free.',
    },
    {
      id: 'ai',
      icon: 'target',
      title: 'Optional AI reads',
      body: 'Twenty AI reads free each month help draft fields. You confirm before anything becomes a lasting fact.',
    },
    {
      id: 'timeline',
      icon: 'trend',
      title: 'History you can use',
      body: 'Calendar and Progress read the same facts store. Shelf checks products against your routine — Rx never gets a Buy button.',
    },
  ],
};

export const CTA_SECTION = {
  title: 'Start your Touche journal',
  subtitle: 'Free to start. Manual entries stay free. Optional AI reads are metered.',
};

export const FOOTER_TAGLINE = 'Touche — skincare & medical journal.';

export const CTAS = {
  scan: 'https://apps.apple.com/app/id6778105762',
  signup: 'https://app.trytouche.com/welcome',
  signin: 'https://app.trytouche.com/sign-in',
  privacy: 'https://app.trytouche.com/privacy',
  terms: 'https://app.trytouche.com/terms',
  waitlist: '/waitlist.html',
};

export function webAppUrl() {
  const url = (import.meta.env.VITE_WEB_APP_URL || '').trim();
  return url || CTAS.signup;
}

export function iosAppUrl() {
  const url = (import.meta.env.VITE_IOS_APP_URL || '').trim();
  return url || CTAS.waitlist;
}

export function androidAppUrl() {
  const url = (import.meta.env.VITE_ANDROID_APP_URL || '').trim();
  return url || CTAS.waitlist;
}

export function isExternalAppUrl(url) {
  return Boolean(url && /^https?:\/\//i.test(url));
}
