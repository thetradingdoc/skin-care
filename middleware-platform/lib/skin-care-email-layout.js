'use strict';

/**
 * Skin & Care transactional email layout — see docs/Brand/SKIN_AND_CARE_GUIDELINES.md
 */

const LOGO_URL =
  process.env.SKIN_CARE_EMAIL_LOGO_URL ||
  process.env.SOMO_EMAIL_LOGO_URL ||
  process.env.SOMO_EMAIL_LOGO ||
  'https://callsomo.com/assets/images/logo-panda.svg';

const SITE_URL = (process.env.SKIN_CARE_EMAIL_SITE_URL || process.env.SOMO_EMAIL_SITE_URL || 'https://callsomo.com').replace(/\/$/, '');

const SUPPORT_EMAIL =
  process.env.SKIN_CARE_EMAIL_SUPPORT ||
  process.env.SOMO_EMAIL_SUPPORT ||
  process.env.SMTP_FROM_EMAIL ||
  'info@callsomo.com';

const TOKENS = {
  brandBlue: '#314db6',
  brandBlueDark: '#283fa0',
  brandSoft: '#eef4ff',
  cream: '#f8f3ea',
  ink: '#1f2937',
  text: '#1f2937',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#e9e2d6',
  pageBg: '#f8f3ea',
  white: '#ffffff',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  danger: '#dc2626'
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseCss() {
  return `
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: ${TOKENS.text};
      margin: 0;
      padding: 0;
      background-color: ${TOKENS.pageBg};
      -webkit-font-smoothing: antialiased;
    }
    .sc-wrap { max-width: 600px; margin: 0 auto; padding: 24px 16px; box-sizing: border-box; }
    .sc-card {
      background: ${TOKENS.white};
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(31, 41, 55, 0.08);
    }
    .sc-header {
      background: linear-gradient(135deg, ${TOKENS.brandBlue} 0%, ${TOKENS.brandBlueDark} 100%);
      color: ${TOKENS.white};
      padding: 32px 28px 28px;
      text-align: center;
    }
    .sc-header h1 {
      margin: 12px 0 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .sc-header p {
      margin: 8px 0 0;
      font-size: 15px;
      opacity: 0.92;
    }
    .sc-logo {
      display: block;
      margin: 0 auto 8px;
      max-width: 180px;
      height: auto;
      border: 0;
    }
    .sc-body { padding: 32px 28px; color: ${TOKENS.muted}; font-size: 16px; }
    .sc-body h2 {
      color: ${TOKENS.text};
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 12px;
    }
    .sc-body p { margin: 0 0 16px; }
    .sc-body a { color: ${TOKENS.brandBlue}; font-weight: 600; }
    .sc-panel {
      background: ${TOKENS.brandSoft};
      border: 1px solid ${TOKENS.border};
      border-left: 4px solid ${TOKENS.brandBlue};
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .sc-panel--warning {
      background: ${TOKENS.warningSoft};
      border-left-color: ${TOKENS.warning};
    }
    .sc-row { padding: 10px 0; border-bottom: 1px solid ${TOKENS.border}; }
    .sc-row:last-child { border-bottom: none; }
    .sc-label { display: block; font-size: 13px; color: ${TOKENS.muted}; font-weight: 600; margin-bottom: 4px; }
    .sc-value { color: ${TOKENS.text}; font-weight: 600; word-break: break-word; }
    .sc-code {
      display: inline-block;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 10px;
      color: ${TOKENS.brandBlue};
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
    }
    .sc-code-box {
      background: ${TOKENS.white};
      border: 2px solid ${TOKENS.brandBlue};
      border-radius: 8px;
      padding: 28px 20px;
      text-align: center;
      margin: 24px 0;
    }
    .sc-btn {
      display: inline-block;
      background: ${TOKENS.brandBlue};
      color: ${TOKENS.white} !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      margin: 8px 4px;
    }
    .sc-btn:hover { background: ${TOKENS.brandBlueDark}; }
    .sc-btn--secondary {
      background: ${TOKENS.white};
      color: ${TOKENS.brandBlue} !important;
      border: 2px solid ${TOKENS.brandBlue};
    }
    .sc-btn--danger { background: ${TOKENS.danger}; }
    .sc-btn--warning { background: ${TOKENS.warning}; }
    .sc-footer {
      background: ${TOKENS.pageBg};
      padding: 24px 28px;
      text-align: center;
      border-top: 1px solid ${TOKENS.border};
      color: ${TOKENS.muted};
      font-size: 13px;
    }
    .sc-footer a { color: ${TOKENS.brandBlue}; text-decoration: none; font-weight: 600; }
    .sc-tagline { font-size: 12px; color: ${TOKENS.faint}; margin-top: 16px; }
    @media (max-width: 480px) {
      .sc-body, .sc-header, .sc-footer { padding-left: 20px; padding-right: 20px; }
      .sc-code { font-size: 26px; letter-spacing: 6px; }
    }
  `;
}

function logoImg() {
  return `<img class="sc-logo" src="${escapeHtml(LOGO_URL)}" alt="Skin &amp; Care" width="180" />`;
}

/**
 * Full HTML email document.
 * @param {{ title: string, subtitle?: string, bodyHtml: string, preheader?: string, footerExtra?: string }} opts
 */
function layout(opts) {
  const title = escapeHtml(opts.title);
  const subtitle = opts.subtitle ? `<p>${escapeHtml(opts.subtitle)}</p>` : '';
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
    : '';
  const footerExtra = opts.footerExtra || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
  <style>${baseCss()}</style>
</head>
<body>
  ${preheader}
  <div class="sc-wrap">
    <div class="sc-card">
      <div class="sc-header">
        ${logoImg()}
        <h1>${title}</h1>
        ${subtitle}
      </div>
      <div class="sc-body">
        ${opts.bodyHtml}
      </div>
      <div class="sc-footer">
        <p>Skin &amp; Care — your skin journal and care companion.</p>
        <p>
          <a href="${escapeHtml(SITE_URL)}">myskinandcare.com</a>
          &nbsp;·&nbsp;
          <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a>
        </p>
        ${footerExtra}
        <p class="sc-tagline">Please do not reply to this automated message.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function codeBox(code) {
  return `<div class="sc-code-box"><p class="sc-code">${escapeHtml(code)}</p></div>`;
}

function button(href, label, variant = 'primary') {
  const cls =
    variant === 'danger'
      ? 'sc-btn sc-btn--danger'
      : variant === 'warning'
        ? 'sc-btn sc-btn--warning'
        : variant === 'secondary'
          ? 'sc-btn sc-btn--secondary'
          : 'sc-btn';
  return `<a href="${escapeHtml(href)}" class="${cls}">${escapeHtml(label)}</a>`;
}

function panel(innerHtml, variant) {
  const cls = variant === 'warning' ? 'sc-panel sc-panel--warning' : 'sc-panel';
  return `<div class="${cls}">${innerHtml}</div>`;
}

function infoRows(rows) {
  const html = rows
    .map(
      (r) =>
        `<div class="sc-row"><span class="sc-label">${escapeHtml(r.label)}</span><span class="sc-value">${r.valueHtml ?? escapeHtml(r.value)}</span></div>`
    )
    .join('');
  return panel(html);
}

module.exports = {
  TOKENS,
  LOGO_URL,
  SITE_URL,
  SUPPORT_EMAIL,
  escapeHtml,
  layout,
  codeBox,
  button,
  panel,
  infoRows,
  logoImg
};
