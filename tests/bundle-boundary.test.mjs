import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { lessons } from '../content/courses.ts';

test('protected lesson bodies and answers are absent from public client assets', async () => {
  const root = fileURLToPath(new URL('../dist/client',import.meta.url));
  const files = await readdir(root,{recursive:true});
  const javascript = (await Promise.all(files.filter(file => /\.(js|json|map|html)$/.test(file)).map(file => readFile(join(root,file),'utf8')))).join('\n');
  assert.ok(javascript.length > 0);
  for (const lesson of lessons.slice(1)) {
    for (const text of [lesson.learn[0].body,lesson.quiz[0].explanation,lesson.scenario.options[0].feedback]) {
      assert.ok(!javascript.includes(text), `${lesson.slug} protected material must only come from authorized API`);
    }
  }
});
