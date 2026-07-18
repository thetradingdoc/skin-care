'use strict';

const {
  assertServingMatchesBuilt,
  assertLatestCreatedIsServing,
  resolveServingFromDescribe,
  main,
} = require('../../scripts/assert-cloudrun-serving-digest.cjs');

describe('APP-01 Cloud Run serving-digest deploy gate', () => {
  test('adversarial: mismatch fails even when both digests look valid', () => {
    const r = assertServingMatchesBuilt({
      builtDigest: 'sha256:aaa',
      servingDigest: 'sha256:bbb',
      servingRevision: 'rev-old',
      trafficPercent: 100,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('SERVING_DIGEST_MISMATCH');
  });

  test('adversarial: traffic not 100% fails even if digests match', () => {
    const r = assertServingMatchesBuilt({
      builtDigest: 'sha256:aaa',
      servingDigest: 'sha256:aaa',
      servingRevision: 'rev-new',
      trafficPercent: 0,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('SERVING_TRAFFIC_NOT_100');
  });

  test('match with normalized digests', () => {
    const r = assertServingMatchesBuilt({
      builtDigest: 'aaa',
      servingDigest: 'sha256:aaa',
      servingRevision: 'rev-new',
      trafficPercent: 100,
    });
    expect(r.ok).toBe(true);
  });

  test('resolveServingFromDescribe picks 100% traffic revision', () => {
    const { revisionName, trafficPercent } = resolveServingFromDescribe({
      status: {
        traffic: [
          { revisionName: 'old', percent: 0 },
          { revisionName: 'new', percent: 100, imageDigest: 'sha256:new' },
        ],
      },
    });
    expect(revisionName).toBe('new');
    expect(trafficPercent).toBe(100);
  });

  test('CLI main fails on mismatch without calling real gcloud', () => {
    const code = main(
      ['--project', 'p', '--region', 'r', '--service', 's', '--built-digest', 'sha256:built'],
      {
        gcloudDescribe: () => ({
          status: {
            traffic: [{ revisionName: 'old', percent: 100, imageDigest: 'sha256:old' }],
          },
        }),
        gcloudRevisionDigest: () => 'sha256:old',
      }
    );
    expect(code).toBe(1);
  });

  test('CLI main succeeds when digests match', () => {
    const code = main(
      ['--project', 'p', '--region', 'r', '--service', 's', '--built-digest', 'sha256:same'],
      {
        gcloudDescribe: () => ({
          status: {
            latestCreatedRevisionName: 'new',
            traffic: [{ revisionName: 'new', percent: 100, imageDigest: 'sha256:same' }],
          },
        }),
      }
    );
    expect(code).toBe(0);
  });

  test('adversarial: latestCreated not serving fails (ad hoc services update path)', () => {
    const r = assertLatestCreatedIsServing({
      latestCreated: 'somo-middleware-00193-v5p',
      servingRevision: 'somo-middleware-00192-rh9',
      trafficPercent: 100,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LATEST_CREATED_NOT_SERVING');
  });

  test('CLI --require-latest-serving fails when traffic stuck on prior revision', () => {
    const code = main(
      ['--project', 'p', '--region', 'r', '--service', 's', '--require-latest-serving'],
      {
        gcloudDescribe: () => ({
          status: {
            latestCreatedRevisionName: 'rev-new',
            latestReadyRevisionName: 'rev-new',
            traffic: [{ revisionName: 'rev-old', percent: 100 }],
          },
        }),
      }
    );
    expect(code).toBe(1);
  });

  test('wrapper script exists and requires latest-serving assert', () => {
    const fs = require('fs');
    const path = require('path');
    const wrap = fs.readFileSync(
      path.join(__dirname, '../../scripts/gcloud-run-with-serving-assert.sh'),
      'utf8'
    );
    expect(wrap).toMatch(/require-latest-serving/);
    expect(wrap).toMatch(/gcloud run/);
  });
});
