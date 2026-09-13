// Runs against an already-started local server; creates/deletes only its own
// example.com fixture. Run create, restart the server, then run finish.
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const [phase, address = 'http://localhost:3000'] = process.argv.slice(2);
const base = new URL(address);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Only local servers are allowed');
assert.ok(['create', 'finish'].includes(phase), 'Use create or finish');
const root = new URL('../', import.meta.url);
const vars = await readFile(new URL('.dev.vars', root), 'utf8');
const token = vars.match(/^ADMIN_TOKEN=([a-f0-9]{64})$/m)?.[1];
assert.ok(token, 'Run npm run admin:init first');
const receipt = new URL('.wrangler/local-smoke.json', root);
const request = (path, method = 'GET', body, admin = false) => fetch(new URL(path, base), {
  method, headers: { 'content-type': 'application/json', origin: base.origin, ...(admin ? {authorization:`Bearer ${token}`} : {}) },
  ...(body ? {body:JSON.stringify(body)} : {}),
});
async function summary() {
  const response = await request('/api/admin/summary', 'GET', undefined, true);
  assert.equal(response.status, 200, 'Configured admin must work');
  return response.json();
}
if (phase === 'create') {
  await mkdir(new URL('.wrangler/', root), {recursive:true});
  const file = await import('node:fs/promises');
  await assert.rejects(file.access(receipt), 'Finish the previous smoke check before creating another');
  assert.equal((await request('/api/admin/summary')).status, 401);
  const card = await fetch(new URL('/communication-card.txt', base));
  assert.equal(card.status, 200);
  assert.match(await card.text(), /知合/);
  const email = `qa-${randomUUID()}@example.com`;
  const response = await request('/api/interest', 'POST', {email, offerId:'overseas-launch-v2', source:'research', consent:true, website:''});
  assert.equal(response.status, 200);
  const {withdrawalToken} = await response.json();
  assert.match(withdrawalToken, /^[a-f0-9]{64}$/);
  const row = (await summary()).interests.find(item => item.email === email);
  assert.ok(row);
  await writeFile(receipt, JSON.stringify({email, id:row.id, withdrawalToken, origin:base.origin}), {flag:'wx', mode:0o600});
  assert.equal((await request('/api/admin/interest', 'PATCH', {id:row.id, status:'contacted'}, true)).status, 200);
  const csv = await request('/api/admin/export', 'GET', undefined, true);
  assert.equal(csv.status, 200);
  assert.ok((await csv.text()).includes(email));
  console.log('LOCAL_CREATE_OK: authorization, asset, registration, persisted query, status and CSV. Restart this server, then run finish.');
} else {
  const record = JSON.parse(await readFile(receipt, 'utf8'));
  assert.equal(record.origin, base.origin);
  const row = (await summary()).interests.find(item => item.id === record.id);
  assert.equal(row?.email, record.email);
  assert.equal(row.status, 'contacted');
  assert.equal((await request('/api/interest', 'DELETE', {token:record.withdrawalToken})).status, 200);
  assert.ok(!(await summary()).interests.some(item => item.id === record.id));
  await unlink(receipt);
  console.log('LOCAL_RESTART_WITHDRAW_OK: same record survived restart, withdrawal verified; synthetic fixture and temporary receipt removed.');
}
