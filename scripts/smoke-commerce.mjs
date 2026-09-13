// A real local HTTP/D1 test. Creates no email or actual financial transaction.
// create -> restart local server -> finish (refund and remove its own fixtures).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink, access } from 'node:fs/promises';
const [phase,address='http://localhost:3001'] = process.argv.slice(2);
const base = new URL(address);
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname));
assert.ok(['create','finish'].includes(phase));
const root = new URL('../',import.meta.url);
const receipt = new URL('.wrangler/commerce-smoke.json',root);
const admin = (await readFile(new URL('.dev.vars',root),'utf8')).match(/^ADMIN_TOKEN=([a-f0-9]{64})$/m)?.[1];
assert.ok(admin);
const request = (path,method='GET',body,cookie,operator=false) => fetch(new URL(path,base),{method,headers:{'content-type':'application/json',origin:base.origin,...(cookie?{cookie}:{}),...(operator?{authorization:`Bearer ${admin}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
if(phase==='create') {
  await assert.rejects(access(receipt),'Finish existing smoke check first');
  const catalogResponse = await request('/api/catalog');assert.equal(catalogResponse.status,200);
  const {lessons} = await catalogResponse.json();assert.equal(lessons.length,7);
  for(const lesson of lessons) assert.equal((await request(`/api/lessons/${lesson.slug}`)).status,lesson.number===1?200:403);
  const created = await request('/api/commerce/orders','POST',{consent:true,idempotencyKey:randomUUID()});assert.equal(created.status,200);
  const cookie = created.headers.get('set-cookie').split(';')[0];
  const {order} = await created.json();
  await writeFile(receipt,JSON.stringify({id:order.id,cookie,origin:base.origin}),{flag:'wx',mode:0o600});
  const payPath=`/api/commerce/orders/${order.id}/pay`;
  assert.equal((await request(payPath,'POST',{outcome:'failure'},cookie)).status,402);
  assert.equal((await request('/api/lessons/boundaries','GET',undefined,cookie)).status,403);
  assert.equal((await request(payPath,'POST',{outcome:'success'},cookie)).status,200);
  for(const lesson of lessons) assert.equal((await request(`/api/lessons/${lesson.slug}`,'GET',undefined,cookie)).status,200);
  assert.equal((await request('/api/lessons/boundaries')).status,403);
  console.log('COMMERCE_CREATE_OK: 7 courses, failed payment denies access, simulated success grants all, isolated browser still denied. Restart server then finish.');
} else {
  const saved=JSON.parse(await readFile(receipt,'utf8'));assert.equal(saved.origin,base.origin);
  const meResponse=await request('/api/commerce/me','GET',undefined,saved.cookie);assert.equal(meResponse.status,200);
  const me=await meResponse.json();assert.equal(me.access,true);assert.equal(me.orders.find(order=>order.id===saved.id).status,'simulated_paid');
  assert.equal((await request(`/api/commerce/orders/${saved.id}/refund`,'POST',{},saved.cookie)).status,200);
  assert.equal((await request('/api/lessons/boundaries','GET',undefined,saved.cookie)).status,200);
  assert.equal((await request(`/api/admin/commerce/${saved.id}/refund`,'POST',{},undefined,true)).status,200);
  assert.equal((await request('/api/lessons/boundaries','GET',undefined,saved.cookie)).status,403);
  assert.equal((await request(`/api/admin/commerce/${saved.id}/delete`,'POST',{},undefined,true)).status,200);
  const after=await (await request('/api/commerce/me','GET',undefined,saved.cookie)).json();assert.equal(after.access,false);assert.equal(after.orders.length,0);
  await unlink(receipt);
  console.log('COMMERCE_RESTART_REFUND_OK: real service retained entitlement across restart; operator refund revoked access; synthetic order and receipt removed.');
}
