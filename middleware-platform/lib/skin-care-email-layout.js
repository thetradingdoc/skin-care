'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Skin & Care transactional email layout — see docs/Brand/SKIN_AND_CARE_GUIDELINES.md
 * Consumer luxury theme: white header, wordmark, Gloock headlines (landing / sign-in parity).
 */

const EMAIL_WORDMARK_CID = 'skin-care-wordmark@brand';

const SITE_URL = (
  process.env.SKIN_CARE_EMAIL_SITE_URL ||
  process.env.TOUCHE_APP_URL ||
  process.env.SOMO_EMAIL_SITE_URL ||
  'https://app.trytouche.com'
).replace(/\/$/, '');

const EMAIL_WORDMARK_URL = `${SITE_URL}/assets/brand/email-wordmark.png`;
const EMAIL_WORDMARK_URL_2X = `${SITE_URL}/assets/brand/email-wordmark@2x.png`;

function getCustomLogoUrl() {
  return (
    process.env.SKIN_CARE_EMAIL_LOGO_URL ||
    process.env.SOMO_EMAIL_LOGO_URL ||
    process.env.SOMO_EMAIL_LOGO ||
    ''
  );
}

const SUPPORT_EMAIL =
  process.env.SKIN_CARE_EMAIL_SUPPORT ||
  process.env.SOMO_EMAIL_SUPPORT ||
  process.env.SMTP_FROM_EMAIL ||
  'info@callsomo.com';

const FOOTER_TAGLINE = 'Track today. Glow tomorrow.';

const TOKENS = {
  brandBlue: '#314db6',
  brandBlueDark: '#283fa0',
  card: '#fffdf9',
  ink: '#1a1a1a',
  text: '#1f2937',
  muted: '#6b7280',
  faint: '#94a3b8',
  border: '#e9e2d6',
  pageBg: '#ffffff',
  white: '#ffffff',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  danger: '#dc2626'
};

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,700;1,700&family=DM+Sans:wght@400;600;700&family=Gloock&display=swap" rel="stylesheet" />';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function footerSupportEmail() {
  return process.env.SKIN_CARE_EMAIL_SUPPORT || process.env.SOMO_EMAIL_SUPPORT || '';
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
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid ${TOKENS.border};
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    }
    .sc-header {
      background: ${TOKENS.white};
      color: ${TOKENS.ink};
      padding: 32px 28px 24px;
      text-align: center;
      border-bottom: 1px solid ${TOKENS.border};
    }
    .sc-header h1 {
      margin: 20px 0 0;
      font-family: 'Gloock', Georgia, 'Times New Roman', serif;
      font-size: 26px;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: ${TOKENS.ink};
    }
    .sc-header p {
      margin: 8px 0 0;
      font-size: 15px;
      color: ${TOKENS.muted};
    }
    .sc-logo {
      display: block;
      margin: 0 auto;
      max-width: 240px;
      width: 240px;
      height: auto;
      border: 0;
    }
    .sc-body { padding: 32px 28px; color: ${TOKENS.muted}; font-size: 16px; }
    .sc-body h2 {
      font-family: 'Gloock', Georgia, 'Times New Roman', serif;
      color: ${TOKENS.ink};
      font-size: 20px;
      font-weight: 400;
      margin: 0 0 12px;
    }
    .sc-body p { margin: 0 0 16px; }
    .sc-body a { color: ${TOKENS.brandBlue}; font-weight: 600; }
    .sc-panel {
      background: ${TOKENS.card};
      border: 1px solid ${TOKENS.border};
      border-radius: 14px;
      padding: 20px;
      margin: 20px 0;
    }
    .sc-panel--warning {
      background: ${TOKENS.warningSoft};
      border-color: #fcd34d;
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
      color: ${TOKENS.ink};
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
    }
    .sc-code-box {
      background: ${TOKENS.card};
      border: 1px solid ${TOKENS.border};
      border-radius: 999px;
      padding: 28px 24px;
      text-align: center;
      margin: 24px 0;
    }
    .sc-btn {
      display: inline-block;
      background: ${TOKENS.brandBlue};
      color: ${TOKENS.white} !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 999px;
      font-weight: 700;
      font-size: 16px;
      margin: 8px 4px;
    }
    .sc-btn:hover { background: ${TOKENS.brandBlueDark}; }
    .sc-btn--secondary {
      background: ${TOKENS.white};
      color: ${TOKENS.brandBlue} !important;
      border: 2px solid ${TOKENS.border};
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
    .sc-footer-tagline {
      font-family: 'Gloock', Georgia, 'Times New Roman', serif;
      font-size: 15px;
      color: ${TOKENS.ink};
      margin: 0 0 12px;
    }
    .sc-tagline { font-size: 12px; color: ${TOKENS.faint}; margin-top: 16px; }
    @media (max-width: 480px) {
      .sc-body, .sc-header, .sc-footer { padding-left: 20px; padding-right: 20px; }
      .sc-code { font-size: 26px; letter-spacing: 6px; }
      .sc-logo { max-width: 200px; width: 200px; }
    }
  `;
}

function hasCustomLogoUrl() {
  return !!getCustomLogoUrl();
}

function resolveEmailWordmarkPath() {
  const candidates = [
    path.join(__dirname, '../public/assets/brand/email-wordmark.png'),
    path.join(__dirname, '../../unified-dashboard/assets/brand/email-wordmark.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function getEmailWordmarkAttachment() {
  if (hasCustomLogoUrl()) return null;
  const filePath = resolveEmailWordmarkPath();
  if (!filePath) return null;
  return {
    filename: 'email-wordmark.png',
    path: filePath,
    cid: EMAIL_WORDMARK_CID,
    contentDisposition: 'inline',
  };
}

const LOGO_IMG_STYLE =
  'display:block;margin:0 auto;max-width:240px;width:240px;height:auto;border:0;';

const WORDMARK_FONT = "'Be Vietnam Pro', Arial, Helvetica, sans-serif";
const WORDMARK_SIZE_PX = 30;

function logoImg(url) {
  const src = url || getCustomLogoUrl();
  return `<img class="sc-logo" src="${escapeHtml(src)}" alt="" width="240" style="${LOGO_IMG_STYLE}" />`;
}

/**
 * HTML wordmark — mirrors landing lockup (skin + tulip + care).
 * Used when no raster attachment is available (Azure-only path).
 */
function emailHtmlWordmark() {
  const tulipUrl = `${SITE_URL}/assets/brand/tulip-mark.png`;
  const font = WORDMARK_FONT;
  const em = WORDMARK_SIZE_PX;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:0;line-height:1;mso-line-height-rule:exactly;">
      <span style="font-family:${font};font-size:${em}px;font-weight:700;font-style:italic;color:#000000;vertical-align:bottom;">skin</span><img src="${escapeHtml(tulipUrl)}" width="34" height="12" alt="" style="display:inline-block;vertical-align:text-bottom;margin:0 3px 1px;border:0;outline:none;text-decoration:none;" /><span style="font-family:${font};font-size:${em}px;font-weight:700;font-style:normal;color:#000000;letter-spacing:-0.03em;vertical-align:bottom;">care</span>
    </td>
  </tr>
</table>`;
}

/** Solid black composite PNG — see docs/Brand/WORDMARK_BY_SURFACE.md */
function emailWordmarkImg(opts = {}) {
  const { logoCid } = opts;
  if (logoCid) {
    return `<img class="sc-logo" src="cid:${escapeHtml(logoCid)}" alt="" width="240" height="52" style="${LOGO_IMG_STYLE}" />`;
  }
  return `<img class="sc-logo" src="${escapeHtml(EMAIL_WORDMARK_URL)}" srcset="${escapeHtml(EMAIL_WORDMARK_URL)} 1x, ${escapeHtml(EMAIL_WORDMARK_URL_2X)} 2x" alt="" width="240" height="52" style="${LOGO_IMG_STYLE}" />`;
}

function headerLogo(opts = {}) {
  if (hasCustomLogoUrl()) return logoImg();
  if (opts.logoCid) return emailWordmarkImg(opts);
  if (opts.useHtmlWordmark) return emailHtmlWordmark();
  return emailWordmarkImg(opts);
}

/**
 * Full HTML email document.
 * @param {{ title: string, subtitle?: string, bodyHtml: string, preheader?: string, footerExtra?: string, logoCid?: string }} opts
 */
function layout(opts) {
  const title = escapeHtml(opts.title);
  const subtitle = opts.subtitle ? `<p>${escapeHtml(opts.subtitle)}</p>` : '';
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
    : '';
  const footerExtra = opts.footerExtra || '';
  const footerSupport = footerSupportEmail();
  const footerSupportHtml = footerSupport
    ? `<p><a href="mailto:${escapeHtml(footerSupport)}">${escapeHtml(footerSupport)}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
  ${FONT_LINK}
  <style>${baseCss()}</style>
</head>
<body>
  ${preheader}
  <div class="sc-wrap">
    <div class="sc-card">
      <div class="sc-header">
        ${headerLogo({ logoCid: opts.logoCid, useHtmlWordmark: opts.useHtmlWordmark })}
        <h1>${title}</h1>
        ${subtitle}
      </div>
      <div class="sc-body">
        ${opts.bodyHtml}
      </div>
      <div class="sc-footer">
        <p class="sc-footer-tagline">${escapeHtml(FOOTER_TAGLINE)}</p>
        <p>
          <a href="${escapeHtml(SITE_URL)}">myskinandcare.com</a>
        </p>
        ${footerSupportHtml}
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

function layoutBundle(opts) {
  const attachment = hasCustomLogoUrl() ? null : getEmailWordmarkAttachment();
  const logoCid = attachment?.cid;
  const useHtmlWordmark = !hasCustomLogoUrl() && !attachment;
  const html = layout({ ...opts, logoCid, useHtmlWordmark });
  return {
    html,
    attachments: attachment ? [attachment] : [],
  };
}

module.exports = {
  TOKENS,
  get LOGO_URL() {
    return getCustomLogoUrl();
  },
  getCustomLogoUrl,
  EMAIL_WORDMARK_CID,
  EMAIL_WORDMARK_URL,
  EMAIL_WORDMARK_URL_2X,
  SITE_URL,
  SUPPORT_EMAIL,
  FOOTER_TAGLINE,
  escapeHtml,
  layout,
  layoutBundle,
  resolveEmailWordmarkPath,
  getEmailWordmarkAttachment,
  emailHtmlWordmark,
  codeBox,
  button,
  panel,
  infoRows,
  logoImg,
  emailWordmarkImg,
  headerLogo
};
