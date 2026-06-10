(function () {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  if (!form || !status) return;

  function waitlistApiUrl() {
    const baseOverride =
      typeof window.__SKIN_CARE_API_BASE__ === 'string' ? window.__SKIN_CARE_API_BASE__.trim() : '';
    const base = (
      baseOverride ||
      (typeof resolveApiBase === 'function' ? resolveApiBase() : window.location.origin)
    ).replace(/\/$/, '');
    return `${base}/api/public/waitlist`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'sc-form-status';
    status.textContent = 'Sending…';

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const subject = String(data.get('subject') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (!name || !email || !message) {
      status.className = 'sc-form-status is-error';
      status.textContent = 'Please fill in name, email, and message.';
      return;
    }

    try {
      const res = await fetch(waitlistApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          source: 'contact',
          product: [subject && `Subject: ${subject}`, message].filter(Boolean).join('\n\n'),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        throw new Error(json.message || json.error || 'Could not send message');
      }

      status.className = 'sc-form-status is-success';
      status.textContent = 'Thank you — we’ll be in touch soon.';
      form.reset();
    } catch (err) {
      status.className = 'sc-form-status is-error';
      status.textContent = err.message || 'Something went wrong. Please try again.';
    }
  });
})();
