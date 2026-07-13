export const HERO = {
  eyebrow: 'Acne & Skin Photo Diary',
  titleLine1: 'The #1',
  titleLine2a: 'Skincare',
  titleLine2b: 'Journal.',
  subtitle:
    'Start with a quick face check. Log one photo a day and see what changes — flares, products, reactions.',
  ctaLabel: 'Check your skin',
};

export const NAV_LINKS = [
  { label: 'How It Works', href: '#how' },
  { label: 'About', href: '/about.html' },
  { label: 'Contact', href: '/contact.html' },
];

export const JOURNEY_STEPS = {
  items: [
    {
      id: 'scan',
      num: '01',
      title: 'Take a face photo',
      bodyShort: 'One selfie — your baseline for the journal.',
    },
    {
      id: 'track',
      num: '02',
      title: 'Tell us what to watch',
      bodyShort: 'Breakouts, redness, dryness — pick what matters.',
    },
    {
      id: 'daily',
      num: '03',
      title: 'See what changed',
      bodyShort: 'One photo a day — your timeline shows the story.',
    },
  ],
};

export const HOW_IT_WORKS = {
  title: 'Skin diary that finds your triggers.',
  subtitle: 'Start with a face check. Your journal builds from there.',
  items: [
    {
      id: 'check',
      icon: 'camera',
      title: 'Take a face photo',
      body: 'One front-camera photo. Your skin, your baseline — no signup to start.',
    },
    {
      id: 'plan',
      icon: 'target',
      title: 'Tell us what to watch',
      body: 'Breakouts, redness, dryness — pick what matters to you. No routine required.',
    },
    {
      id: 'timeline',
      icon: 'trend',
      title: 'See what changed',
      body: 'One photo a day, same angle. Your timeline shows whether your skin is calming down — or reacting.',
    },
  ],
};

export const CTA_SECTION = {
  title: 'Start your skin journal',
  subtitle: 'Create a free account with one photo — no routine or plan required.',
};

export const FOOTER_TAGLINE = 'The #1 Skincare Journal.';

export const CTAS = {
  scan: 'https://apps.apple.com/app/id6778105762',
  signup: '/app/sign-in?intent=signup&from=skin-age-landing',
  signin: '/app/sign-in',
  privacy: '/patients/legal/privacy.html',
  terms: '/patients/legal/terms.html',
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
