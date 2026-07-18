'use strict';

/** LEG-01 — orphan journal components must stay deleted. */
const fs = require('fs');
const path = require('path');

describe('LEG-01 journal component orphans', () => {
  test('patient-app/components/journal directory is gone', () => {
    const dir = path.join(__dirname, '../../patient-app/components/journal');
    expect(fs.existsSync(dir)).toBe(false);
  });
});
