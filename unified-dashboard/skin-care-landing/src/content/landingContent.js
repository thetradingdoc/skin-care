export const HERO = {
  titleLine1: 'Track today.',
  titleLine2: 'Glow tomorrow.',
  subtitle:
    'Your personal skincare tracker to understand your skin, build better habits, and see real results over time.',
  ctaLabel: 'Find your face age',
};

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how' },
  { label: 'Insights', href: '#insights' },
  { label: 'About', href: '/about.html' },
  { label: 'Contact', href: '#contact' },
];

export const FEATURES = [
  {
    id: 'track',
    title: 'Track Your Skin',
    body: 'Log daily, see patterns, understand your skin.',
    icon: 'track',
  },
  {
    id: 'insights',
    title: 'Smart Insights',
    body: 'Get personalized insights and progress over time.',
    icon: 'insights',
  },
  {
    id: 'habits',
    title: 'Build Better Habits',
    body: 'Set routines, get reminders, and stay consistent.',
    icon: 'habits',
  },
];

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
