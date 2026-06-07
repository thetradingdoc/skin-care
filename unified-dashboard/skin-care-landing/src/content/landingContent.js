export const HERO = {
  title: 'Track your skin, every day.',
  subtitle:
    'Skin & Care helps you log daily photos, follow concern-based routines, and see how your skin changes over time.',
};

export const VALUE_BULLETS = [
  {
    id: 'log',
    title: 'Log today’s skin',
    body: 'Capture a quick photo and note how your skin feels — build a timeline you can actually use.',
  },
  {
    id: 'routine',
    title: 'Follow your routine',
    body: 'Pick a concern program — acne, anti-aging, barrier repair, and more — and get guided daily steps.',
  },
  {
    id: 'progress',
    title: 'See real progress',
    body: 'Compare weeks and phases side by side so you know what’s working, not just what you hope is working.',
  },
];

export const CTAS = {
  signup: '/patients/patient-login.html?intent=signup',
  signin: '/patients/patient-login.html',
  privacy: '/patients/legal/privacy.html',
  terms: '/patients/legal/terms.html',
};

export function iosAppUrl() {
  const url = (import.meta.env.VITE_IOS_APP_URL || '').trim();
  return url || null;
}
