export const HERO = {
  titleLine1: 'Track today.',
  titleLine2: 'Glow tomorrow.',
  subtitle:
    'Your personal skincare tracker to understand your skin, build better habits, and see real results over time.',
  ctaLabel: 'Facial Age Checker',
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
      title: 'Face scan → skin age',
      bodyShort: 'One photo, seconds — no forms.',
    },
    {
      id: 'track',
      num: '02',
      title: 'Tell us what to track',
      bodyShort: 'Acne, dryness, lines — pick what matters.',
    },
    {
      id: 'daily',
      num: '03',
      title: 'One photo a day',
      bodyShort: 'Timeline shows change over weeks.',
    },
  ],
};

export const HOW_IT_WORKS = {
  title: 'We help you look younger — one photo at a time.',
  subtitle: 'Start with your face age. We’ll guide the rest.',
  items: [
    {
      id: 'check',
      icon: 'camera',
      title: 'Check your face age',
      body: 'One front-camera photo. See your skin age estimate in seconds — no signup, no forms.',
    },
    {
      id: 'plan',
      icon: 'target',
      title: 'We personalize your track',
      body: 'Lines, acne, dryness, redness — tell us what you want to improve and we shape your routine.',
    },
    {
      id: 'timeline',
      icon: 'trend',
      title: 'Watch yourself improve',
      body: 'One photo a day. Same light, same angle — your Timeline shows whether you’re looking fresher over weeks.',
    },
  ],
};

export const CTAS = {
  scan: '/scan',
  signup: '/patients/patient-login.html?intent=signup&from=skin-age-landing',
  signin: '/patients/patient-login.html',
  privacy: '/patients/legal/privacy.html',
  terms: '/patients/legal/terms.html',
  waitlist: '/waitlist',
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
