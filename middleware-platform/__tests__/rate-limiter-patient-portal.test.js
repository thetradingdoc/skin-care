'use strict';

const {
  isPatientPortalPath,
  apiLimiter,
  patientPortalLimiter,
} = require('../middleware/rate-limiter');

describe('patient portal rate limiting', () => {
  test('isPatientPortalPath matches /api/patient routes', () => {
    expect(isPatientPortalPath({ path: '/api/patient/shelf/products' })).toBe(true);
    expect(isPatientPortalPath({ path: '/api/patient/bio-profile' })).toBe(true);
    expect(isPatientPortalPath({ path: '/api/public/products' })).toBe(false);
  });

  test('apiLimiter and patientPortalLimiter are separate instances', () => {
    expect(apiLimiter).not.toBe(patientPortalLimiter);
  });
});
