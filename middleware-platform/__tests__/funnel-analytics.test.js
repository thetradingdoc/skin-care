'use strict';

const {
  assertAllowedEventType,
  sanitizeFunnelPayload,
  isPhiKey,
} = require('../lib/funnel-analytics');

describe('funnel-analytics', () => {
  test('assertAllowedEventType accepts page_view', () => {
    expect(assertAllowedEventType('page_view')).toBe('page_view');
  });

  test('assertAllowedEventType rejects unknown', () => {
    expect(() => assertAllowedEventType('email_opened')).toThrow('invalid_event_type');
  });

  test('isPhiKey flags email', () => {
    expect(isPhiKey('patient_email')).toBe(true);
    expect(isPhiKey('pathname')).toBe(false);
  });

  test('sanitizeFunnelPayload strips phi keys', () => {
    const out = sanitizeFunnelPayload({ pathname: '/scan', email: 'x@y.com', ts: '2026-01-01' });
    expect(out.pathname).toBe('/scan');
    expect(out.email).toBeUndefined();
  });
});
