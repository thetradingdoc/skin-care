/**
 * @deprecated Middleware-only appointments backflow check (localhost:4000).
 * Consumer auth now lives at /app/sign-in; patient-login.html is a redirect stub on myskinandcare.com.
 * For consumer sign-in E2E, run: npm run test:e2e-consumer-sign-in --prefix middleware-platform
 */
import { chromium } from 'playwright';

console.warn(
  '[deprecated] check-auth-backflow-playwright.mjs targets legacy middleware patient portal only.'
);

const base = process.env.MIDDLEWARE_BASE || 'http://localhost:4000/patients';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.route('**/api/patient/appointments', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, appointments: [] }),
  });
});

try {
  await page.addInitScript(() => {
    localStorage.setItem('patient_session_id', 'pw-session-e2e');
  });

  await page.goto(`${base}/patient-login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const loginUrl = page.url();
  if (loginUrl.includes('/app/sign-in')) {
    console.log(JSON.stringify({ skipped: true, reason: 'patient-login redirects to consumer sign-in', loginUrl }));
    process.exit(0);
  }

  await page.waitForURL('**/patients/appointments.html', { timeout: 15000 });
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
  const directBackUrl = page.url();

  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    window.location.href = '/patients/patient-login.html';
  });
  await page.waitForURL('**/patients/appointments.html', { timeout: 15000 });
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(900);
  const realisticBackUrl = page.url();
  const bouncedBackToAppointments = realisticBackUrl.includes('/patients/appointments.html');

  console.log(JSON.stringify({ directBackUrl, realisticBackUrl, bouncedBackToAppointments }));
} finally {
  await browser.close();
}
