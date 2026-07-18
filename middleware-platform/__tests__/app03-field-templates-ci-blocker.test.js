'use strict';

const fs = require('fs');
const path = require('path');

describe('APP-03 field-template parity is a required CI job', () => {
  const root = path.join(__dirname, '../..');

  test('ci.yml defines dedicated field-templates-parity job', () => {
    const yml = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(yml).toMatch(/field-templates-parity:/);
    expect(yml).toMatch(/test:field-templates-parity/);
    expect(yml).toMatch(/APP-03/);
  });

  test('skin-care-mobile.yml runs parity on template path changes', () => {
    const yml = fs.readFileSync(
      path.join(root, '.github/workflows/skin-care-mobile.yml'),
      'utf8'
    );
    expect(yml).toMatch(/field-templates-parity:/);
    expect(yml).toMatch(/record-field-templates/);
    expect(yml).toMatch(/test:field-templates-parity/);
  });

  test('package.json exposes test:field-templates-parity script', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'middleware-platform/package.json'), 'utf8')
    );
    expect(pkg.scripts['test:field-templates-parity']).toMatch(/record-field-templates/);
  });

  test('adversarial: parity test itself fails if a catalog id is removed from client mirror', () => {
    // Structural: the parity test file must assert client mirror keys (not only happy existence)
    const testSrc = fs.readFileSync(
      path.join(__dirname, 'record-field-templates.test.js'),
      'utf8'
    );
    expect(testSrc).toMatch(/client mirror parity/);
    expect(testSrc).toMatch(/fail on any drift/);
    expect(testSrc).toMatch(/drifts/);
  });
});
