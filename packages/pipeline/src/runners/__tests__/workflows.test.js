// GitHub workflow dosyalarının YAML olarak ayrıştırılabildiğini ve V2-08 kararlarına uyduğunu denetler.
// Bağımlılık eklenmez: `js-yaml` üst node_modules'ta yoksa testler atlanır.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const WORKFLOWS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../.github/workflows',
);

let yaml = null;
try {
  yaml = (await import('js-yaml')).default;
} catch {
  yaml = null;
}
const skip = yaml ? false : 'js-yaml bulunamadı (bağımlılık eklenmedi); YAML denetimi atlandı';

const load = (name) => yaml.load(readFileSync(path.join(WORKFLOWS, name), 'utf8'));
const GATE = "github.event_name == 'workflow_dispatch' || vars.CONTENT_V2_ENABLED == 'true'";

test(
  'content-v2.yml: tetikler, kapı, izinler, süre, eşzamanlılık, secrets, alarm adımı',
  { skip },
  () => {
    const wf = load('content-v2.yml');
    assert.deepEqual(wf.on.schedule, [{ cron: '17 3,11,19 * * *' }]);
    assert.deepEqual(wf.on.workflow_dispatch.inputs.mode.options, ['dry-run', 'apply']);
    assert.equal(wf.on.workflow_dispatch.inputs.mode.default, 'dry-run');
    assert.equal(wf.permissions.issues, 'write');
    assert.equal(wf.concurrency.group, 'content-v2');
    const job = wf.jobs.run;
    assert.equal(job.if, GATE);
    assert.equal(job['timeout-minutes'], 120);
    for (const key of [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GROQ_API_KEY',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'GEMINI_API_KEY',
    ]) {
      assert.equal(job.env[key], `\${{ secrets.${key} }}`);
    }
    const node = job.steps.find((s) => s.uses?.startsWith('actions/setup-node'));
    assert.equal(node.with['node-version'], 20);
    assert.ok(
      job.steps.some((s) => s.run?.includes('npm ci --workspace @smartscrolling/pipeline')),
    );
    const runStep = job.steps.find((s) => s.run?.includes('v2-daily.js'));
    assert.match(runStep.run, /--publish/);
    const alarm = job.steps.at(-1);
    assert.match(alarm.if, /always\(\)/);
    assert.match(alarm.run, /gh issue create/);
    assert.match(alarm.run, /gh issue comment/);
    assert.match(alarm.run, /pipeline-alarm/);
  },
);

test('content-v2-weekly-sample.yml: pazartesi 07:00 UTC, kapı, issues:write', { skip }, () => {
  const wf = load('content-v2-weekly-sample.yml');
  assert.deepEqual(wf.on.schedule, [{ cron: '0 7 * * 1' }]);
  assert.ok('workflow_dispatch' in wf.on);
  assert.equal(wf.permissions.issues, 'write');
  assert.equal(wf.jobs.sample.if, GATE);
  assert.ok(
    wf.jobs.sample.steps.some((s) => s.run?.includes('v2-weekly-sample.js --create-issue')),
  );
});

test(
  'keepalive.yml: ayda bir, actions:write, iki workflow etkinleştirilir, kapı yok',
  { skip },
  () => {
    const wf = load('keepalive.yml');
    assert.deepEqual(wf.on.schedule, [{ cron: '0 6 1 * *' }]);
    assert.equal(wf.permissions.actions, 'write');
    assert.equal(wf.jobs.keepalive.if, undefined);
    const run = wf.jobs.keepalive.steps.map((s) => s.run ?? '').join('\n');
    assert.match(run, /content-v2\.yml/);
    assert.match(run, /content-v2-weekly-sample\.yml/);
    assert.match(
      run,
      /gh api -X PUT "repos\/\$\{\{ github\.repository \}\}\/actions\/workflows\/\$wf\/enable"/,
    );
  },
);

test('facts-ingest.yml: zamanlanmış tetik yok, sadece workflow_dispatch', { skip }, () => {
  const wf = load('facts-ingest.yml');
  assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
  assert.match(
    readFileSync(path.join(WORKFLOWS, 'facts-ingest.yml'), 'utf8').split('\n')[0],
    /v2 ile değiştirildi/,
  );
});
