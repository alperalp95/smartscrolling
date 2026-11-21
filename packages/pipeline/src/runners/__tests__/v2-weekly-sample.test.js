import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LABEL,
  createIssue,
  createSampleRepo,
  formatSampleIssue,
  parseArgs,
  pickRandom,
  runWeeklySample,
} from '../v2-weekly-sample.js';

const NOW = new Date('2026-11-23T07:00:00Z');

function cards(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `f${i + 1}`,
    title: `Başlık ${i + 1}`,
    content: `Kart ${i + 1} metni.\nİkinci satır.`,
    category: 'BİLİM',
    source_url: `https://en.wikipedia.org/wiki/Konu_${i + 1}`,
    published_at: '2026-11-20T19:17:00Z',
  }));
}

/** Basit deterministik rastgele (LCG). */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

test('parseArgs: varsayılan dry-run, 10 kart, 7 gün', () => {
  assert.deepEqual(parseArgs([]), { count: 10, days: 7, createIssue: false });
  assert.deepEqual(parseArgs(['--count', '5', '--days=3', '--create-issue']), {
    count: 5,
    days: 3,
    createIssue: true,
  });
  assert.equal(parseArgs(['--create-issue', '--dry-run']).createIssue, false);
  assert.throws(() => parseArgs(['--count', '0']), /pozitif/);
  assert.throws(() => parseArgs(['--x']), /bilinmeyen/);
});

test('pickRandom: k farklı öğe, kaynak dizi değişmez, az öğede hepsi', () => {
  const items = cards(40);
  const picked = pickRandom(items, 10, seeded(7));
  assert.equal(picked.length, 10);
  assert.equal(new Set(picked.map((c) => c.id)).size, 10);
  assert.equal(items[0].id, 'f1');
  assert.equal(pickRandom(items.slice(0, 3), 10, seeded()).length, 3);
  assert.deepEqual(pickRandom([], 10), []);
});

test('formatSampleIssue: 10 kart, her biri checkbox + başlık + metin + kaynak linki', () => {
  const { title, body } = formatSampleIssue(cards(10), { now: NOW, days: 7, totalPublished: 700 });
  assert.equal(title, 'Haftalık kart örneği (2026-11-23): 10 kart');
  const boxes = body.split('\n').filter((l) => l.startsWith('- [ ] '));
  assert.equal(boxes.length, 10);
  assert.match(boxes[0], /^- \[ \] \*\*1\. Başlık 1\*\* · BİLİM$/);
  assert.match(body, /Kart 1 metni\. İkinci satır\./);
  assert.match(body, /Kaynak: <https:\/\/en\.wikipedia\.org\/wiki\/Konu_10>/);
  assert.match(body, /700 karttan rastgele seçilen 10 kart/);
  assert.match(body, /Kötü\*\* bulduğunuz kartın kutusunu işaretleyin/);
});

test('formatSampleIssue: kart yoksa uyarı', () => {
  const { body } = formatSampleIssue([], { now: NOW });
  assert.match(body, /yayınlanmış kart yok/);
  assert.match(body, /pipeline-alarm/);
});

test('runWeeklySample dry-run: son 7 günü sorar, 10 kart basar, Issue açmaz', async () => {
  const asked = [];
  const out = [];
  const repo = {
    async listPublishedSince(iso) {
      asked.push(iso);
      return cards(25);
    },
  };
  const exec = async () => assert.fail('dry-run gh çağırmamalı');
  const r = await runWeeklySample([], {
    repo,
    now: NOW,
    random: seeded(3),
    exec,
    stdout: (s) => out.push(s),
    log: () => {},
  });
  assert.deepEqual(asked, ['2026-11-16T07:00:00.000Z']);
  assert.equal(r.cards.length, 10);
  assert.equal(r.created, null);
  assert.equal(out.length, 1);
  assert.match(out[0], /^# Haftalık kart örneği/);
  assert.equal(out[0].split('\n').filter((l) => l.startsWith('- [ ] ')).length, 10);
});

test('runWeeklySample --create-issue: etiket + gh issue create (metin stdin’den)', async () => {
  const execCalls = [];
  const exec = async (cmd, args, opts) => {
    execCalls.push({ cmd, args, opts });
    return args[0] === 'issue' ? 'https://github.com/o/r/issues/7\n' : '';
  };
  const repo = { listPublishedSince: async () => cards(12) };
  const r = await runWeeklySample(['--create-issue'], {
    repo,
    now: NOW,
    random: seeded(5),
    exec,
    stdout: () => assert.fail('stdout yok'),
    log: () => {},
  });
  assert.equal(r.created, 'https://github.com/o/r/issues/7');
  assert.equal(execCalls.length, 2);
  assert.deepEqual(execCalls[0].args.slice(0, 3), ['label', 'create', LABEL]);
  assert.ok(execCalls[0].args.includes('--force'));
  assert.deepEqual(execCalls[1].args, [
    'issue',
    'create',
    '--title',
    r.issue.title,
    '--label',
    'weekly-sample',
    '--body-file',
    '-',
  ]);
  assert.equal(execCalls[1].opts.input, r.issue.body);
});

test('createIssue: gh hatası yukarı fırlar', async () => {
  await assert.rejects(
    () =>
      createIssue({ title: 't', body: 'b' }, async () => {
        throw new Error('gh yok');
      }),
    /gh yok/,
  );
});

test('createSampleRepo: published + published_at >= since sorgusu', async () => {
  const q = [];
  const builder = {
    select(c) {
      q.push(['select', c]);
      return builder;
    },
    eq(c, v) {
      q.push(['eq', c, v]);
      return builder;
    },
    gte(c, v) {
      q.push(['gte', c, v]);
      return builder;
    },
    order(c, o) {
      q.push(['order', c, o]);
      return builder;
    },
    async limit(n) {
      q.push(['limit', n]);
      return { data: [{ id: 1 }], error: null };
    },
  };
  const repo = createSampleRepo({
    from: (t) => {
      q.push(['from', t]);
      return builder;
    },
  });
  assert.deepEqual(await repo.listPublishedSince('2026-11-16T00:00:00.000Z'), [{ id: 1 }]);
  assert.deepEqual(q[0], ['from', 'facts']);
  assert.ok(q.some((x) => x[0] === 'eq' && x[1] === 'status' && x[2] === 'published'));
  assert.ok(
    q.some((x) => x[0] === 'gte' && x[1] === 'published_at' && x[2] === '2026-11-16T00:00:00.000Z'),
  );
  assert.match(q.find((x) => x[0] === 'select')[1], /source_url/);
});
