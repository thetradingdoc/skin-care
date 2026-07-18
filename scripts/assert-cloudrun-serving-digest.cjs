'use strict';

/**
 * APP-01 — Fail if Cloud Run traffic is still on a prior revision / image digest.
 *
 * Modes:
 *   1) Digest match (image deploys):
 *        --built-digest sha256:…   OR   --built-image gcr.io/…:tag
 *   2) Latest-created must serve 100% (ad hoc services update / secrets / env):
 *        --require-latest-serving
 *
 * Wrapper for (2): scripts/gcloud-run-with-serving-assert.sh
 */

const { execFileSync } = require('child_process');

function normalizeDigest(d) {
  const s = String(d || '').trim();
  if (!s) return '';
  if (s.startsWith('sha256:')) return s;
  return `sha256:${s}`;
}

/**
 * Pure compare used by tests + CLI.
 * @returns {{ ok: boolean, reason: string, servingDigest?: string, builtDigest?: string, servingRevision?: string }}
 */
function assertServingMatchesBuilt({ builtDigest, servingDigest, servingRevision, trafficPercent }) {
  const built = normalizeDigest(builtDigest);
  const serving = normalizeDigest(servingDigest);
  if (!built) {
    return { ok: false, reason: 'BUILT_DIGEST_MISSING' };
  }
  if (!serving) {
    return { ok: false, reason: 'SERVING_DIGEST_MISSING', builtDigest: built, servingRevision };
  }
  if (trafficPercent != null && Number(trafficPercent) !== 100) {
    return {
      ok: false,
      reason: 'SERVING_TRAFFIC_NOT_100',
      builtDigest: built,
      servingDigest: serving,
      servingRevision,
      trafficPercent: Number(trafficPercent),
    };
  }
  if (built !== serving) {
    return {
      ok: false,
      reason: 'SERVING_DIGEST_MISMATCH',
      builtDigest: built,
      servingDigest: serving,
      servingRevision,
    };
  }
  return {
    ok: true,
    reason: 'MATCH',
    builtDigest: built,
    servingDigest: serving,
    servingRevision,
  };
}

/**
 * Ad hoc config updates create a new revision but often leave 100% traffic on the prior one.
 * Fail unless latestCreatedRevisionName === the revision receiving 100% traffic.
 */
function assertLatestCreatedIsServing({ latestCreated, servingRevision, trafficPercent }) {
  if (!latestCreated) {
    return { ok: false, reason: 'LATEST_CREATED_MISSING' };
  }
  if (!servingRevision) {
    return { ok: false, reason: 'SERVING_REVISION_MISSING', latestCreated };
  }
  if (trafficPercent != null && Number(trafficPercent) !== 100) {
    return {
      ok: false,
      reason: 'SERVING_TRAFFIC_NOT_100',
      latestCreated,
      servingRevision,
      trafficPercent: Number(trafficPercent),
    };
  }
  if (String(latestCreated) !== String(servingRevision)) {
    return {
      ok: false,
      reason: 'LATEST_CREATED_NOT_SERVING',
      latestCreated,
      servingRevision,
      hint: 'Run: gcloud run services update-traffic SERVICE --to-revisions=LATEST=100 then re-assert',
    };
  }
  return {
    ok: true,
    reason: 'LATEST_CREATED_SERVING',
    latestCreated,
    servingRevision,
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') out.project = argv[++i];
    else if (a === '--region') out.region = argv[++i];
    else if (a === '--service') out.service = argv[++i];
    else if (a === '--built-digest') out.builtDigest = argv[++i];
    else if (a === '--built-image') out.builtImage = argv[++i];
    else if (a === '--require-latest-serving') out.requireLatestServing = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function gcloudDescribe(project, region, service) {
  const raw = execFileSync(
    'gcloud',
    [
      'run',
      'services',
      'describe',
      service,
      `--project=${project}`,
      `--region=${region}`,
      '--format=json',
    ],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  return JSON.parse(raw);
}

function resolveServingFromDescribe(desc) {
  const traffic = (desc && desc.status && desc.status.traffic) || [];
  const primary = traffic.find((t) => Number(t.percent) === 100) || traffic[0] || null;
  const revisionName =
    (primary && primary.revisionName) ||
    (desc && desc.status && desc.status.latestReadyRevisionName) ||
    null;
  const trafficPercent = primary ? Number(primary.percent) : null;
  const latestCreated =
    (desc && desc.status && desc.status.latestCreatedRevisionName) || null;
  const latestReady =
    (desc && desc.status && desc.status.latestReadyRevisionName) || null;

  let servingDigest =
    (primary && (primary.imageDigest || primary.digest)) ||
    (desc && desc.status && desc.status.imageDigest) ||
    null;

  return { revisionName, trafficPercent, servingDigest, traffic, latestCreated, latestReady };
}

function gcloudRevisionDigest(project, region, revisionName) {
  if (!revisionName) return '';
  const raw = execFileSync(
    'gcloud',
    [
      'run',
      'revisions',
      'describe',
      revisionName,
      `--project=${project}`,
      `--region=${region}`,
      '--format=value(status.imageDigest)',
    ],
    { encoding: 'utf8' }
  );
  return String(raw || '').trim();
}

function resolveBuiltDigestFromImage(imageRef) {
  if (!imageRef) return '';
  try {
    const raw = execFileSync(
      'gcloud',
      ['container', 'images', 'describe', imageRef, '--format=value(image_summary.digest)'],
      { encoding: 'utf8' }
    );
    return String(raw || '').trim();
  } catch {
    return '';
  }
}

function printResult(result, args) {
  if (args.json || process.env.ASSERT_DIGEST_JSON === '1') {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`OK: ${result.reason} ${JSON.stringify(result)}`);
  } else {
    console.error(`FAIL: ${result.reason}`);
    console.error(JSON.stringify(result, null, 2));
  }
}

function main(argv = process.argv.slice(2), deps = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(`Usage:
  assert-cloudrun-serving-digest.cjs --project P --region R --service S --built-digest sha256:...
  assert-cloudrun-serving-digest.cjs --project P --region R --service S --require-latest-serving
`);
    return 0;
  }

  const project = args.project || process.env.GCP_PROJECT || process.env.CLOUDRUN_GCP_PROJECT;
  const region = args.region || process.env.GCP_REGION || process.env.CLOUDRUN_REGION;
  const service = args.service || process.env.CLOUDRUN_SERVICE;
  let builtDigest =
    args.builtDigest ||
    process.env.BUILT_IMAGE_DIGEST ||
    process.env.BUILT_DIGEST ||
    '';

  if (!builtDigest && (args.builtImage || process.env.ARTIFACT_IMAGE || process.env.DEPLOY_IMAGE)) {
    const img = args.builtImage || process.env.ARTIFACT_IMAGE || process.env.DEPLOY_IMAGE;
    const resolve = deps.resolveBuiltDigestFromImage || resolveBuiltDigestFromImage;
    builtDigest = resolve(img);
  }

  if (!project || !region || !service) {
    console.error('ERROR: --project, --region, and --service (or env) are required');
    return 2;
  }

  const describeFn = deps.gcloudDescribe || gcloudDescribe;
  const revisionDigestFn = deps.gcloudRevisionDigest || gcloudRevisionDigest;

  const desc = describeFn(project, region, service);
  let { revisionName, trafficPercent, servingDigest, latestCreated } = resolveServingFromDescribe(desc);

  const requireLatest =
    args.requireLatestServing ||
    process.env.REQUIRE_LATEST_SERVING === '1' ||
    (!builtDigest && !args.builtImage);

  if (requireLatest) {
    const latestResult = assertLatestCreatedIsServing({
      latestCreated,
      servingRevision: revisionName,
      trafficPercent,
    });
    printResult(latestResult, args);
    if (!latestResult.ok) return 1;
    // If also given a built digest, continue to digest check
    if (!builtDigest) return 0;
  }

  if (!servingDigest && revisionName) {
    servingDigest = revisionDigestFn(project, region, revisionName);
  }

  const result = assertServingMatchesBuilt({
    builtDigest,
    servingDigest,
    servingRevision: revisionName,
    trafficPercent,
  });

  printResult(result, args);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  assertServingMatchesBuilt,
  assertLatestCreatedIsServing,
  normalizeDigest,
  resolveServingFromDescribe,
  main,
  parseArgs,
};
