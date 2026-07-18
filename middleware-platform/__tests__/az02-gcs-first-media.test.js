'use strict';

/**
 * AZ-02 — Source assert: patient-record-media tries GCS before Azure legacy.
 */

const fs = require('fs');
const path = require('path');

describe('AZ-02 GCS-first media persist order', () => {
  test('persistToGcs appears before persistToAzureLegacy / azure in patient-record-media.js', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/patient-record-media.js'),
      'utf8',
    );

    const gcsFn = src.indexOf('async function persistToGcs');
    const azureFn = src.indexOf('async function persistToAzureLegacy');
    expect(gcsFn).toBeGreaterThan(-1);
    expect(azureFn).toBeGreaterThan(-1);
    expect(gcsFn).toBeLessThan(azureFn);

    const gcsCall = src.indexOf('await persistToGcs(');
    const azureCall = src.indexOf('await persistToAzureLegacy(');
    expect(gcsCall).toBeGreaterThan(-1);
    expect(azureCall).toBeGreaterThan(-1);
    expect(gcsCall).toBeLessThan(azureCall);

    // Call site must try GCS first; Azure is explicitly legacy fallback.
    const persistBody = src.slice(src.indexOf('async function persistRecordMedia'));
    expect(persistBody).toMatch(/persistToGcs[\s\S]*persistToAzureLegacy/);
    expect(persistBody).toMatch(/Azure is legacy|azure legacy/i);
  });
});
