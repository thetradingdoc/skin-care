'use strict';

/**
 * P3.07 — Billing OCR field parser from extracted text.
 * Heuristic + regex (no extra GPT). Returns needs_review when low confidence.
 */

function parseAmountCents(text) {
  const patterns = [
    /(?:total|amount\s*due|balance|owed|pay)\s*[:$]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /\$\s*([\d,]+\.\d{2})/,
    /([\d,]+\.\d{2})\s*(?:USD|usd)/,
  ];
  for (const re of patterns) {
    const m = String(text || '').match(re);
    if (m) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (Number.isFinite(n)) return Math.round(n * 100);
    }
  }
  return null;
}

function parseServiceDate(text) {
  const iso = String(text || '').match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const us = String(text || '').match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/);
  if (us) {
    const mm = String(us[1]).padStart(2, '0');
    const dd = String(us[2]).padStart(2, '0');
    return `${us[3]}-${mm}-${dd}`;
  }
  return null;
}

function parseProviderName(text, fileName) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (/clinic|hospital|medical|dermat|health|pharmacy|dr\.|md\b/i.test(line) && line.length < 120) {
      return line.slice(0, 160);
    }
  }
  if (fileName) {
    const base = String(fileName).replace(/\.[a-z0-9]+$/i, '').trim();
    if (base) return base.slice(0, 160);
  }
  return lines[0] ? lines[0].slice(0, 160) : null;
}

function inferDocumentType(text, mimeType, fileName) {
  const blob = `${text || ''} ${fileName || ''} ${mimeType || ''}`.toLowerCase();
  if (blob.includes('eob') || blob.includes('explanation of benefits')) return 'eob';
  if (blob.includes('invoice') || blob.includes('statement')) return 'invoice';
  if (String(mimeType || '').includes('pdf')) return 'eob';
  return 'receipt';
}

/**
 * @param {{ text?: string, mimeType?: string, fileName?: string }} opts
 */
function parseBillingFieldsFromText(opts = {}) {
  const text = String(opts.text || '').trim();
  const mimeType = opts.mimeType || null;
  const fileName = opts.fileName || null;

  if (!text || /^no text found$/i.test(text)) {
    return {
      provider_name: fileName ? String(fileName).replace(/\.[a-z0-9]+$/i, '').slice(0, 160) : null,
      service_date: null,
      amount_cents: null,
      document_type: inferDocumentType('', mimeType, fileName),
      confidence_score: 0.1,
      status: 'needs_review',
      raw_excerpt: null,
    };
  }

  const amount_cents = parseAmountCents(text);
  const service_date = parseServiceDate(text);
  const provider_name = parseProviderName(text, fileName);
  const document_type = inferDocumentType(text, mimeType, fileName);

  let confidence = 0.35;
  if (amount_cents != null) confidence += 0.25;
  if (service_date) confidence += 0.2;
  if (provider_name) confidence += 0.1;
  confidence = Math.min(0.95, confidence);

  return {
    provider_name,
    service_date,
    amount_cents,
    document_type,
    confidence_score: Math.round(confidence * 100) / 100,
    status: confidence >= 0.55 ? 'ready' : 'needs_review',
    raw_excerpt: text.slice(0, 500),
  };
}

module.exports = {
  parseBillingFieldsFromText,
  parseAmountCents,
  parseServiceDate,
};
