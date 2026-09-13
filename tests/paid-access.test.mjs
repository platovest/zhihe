import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase } from './sqlite-database.mjs';

const { default: worker } = await import('../dist/server/index.js');
function api(database, path, {body,cookie,simulation,headers={}}={}) {
  return worker.fetch(new Request(`http://localhost${path}`, {
    method:body?'POST':'GET',headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...headers},
    ...(body?{body:JSON.stringify(body)}:{}),
  }),{DB:database,...(simulation===undefined?{}:{ENABLE_COMMERCE_SIMULATION:simulation})},{waitUntil(){},passThroughOnException(){}});
}

test('normal product exposes exactly one free lesson and denies all six paid bodies',async () => {
  const catalog = await (await api(undefined,'/api/catalog')).json();
  assert.equal(catalog.mode,'paid_courses');
  assert.equal(catalog.lessons.length,7);
  let free=0;
  for(const lesson of catalog.lessons) {
    const response=await api(undefined,`/api/lessons/${lesson.slug}`);
    if(lesson.number===1) {assert.equal(response.status,200);free++;}
    else {assert.equal(response.status,403);const body=await response.json();assert.equal(body.error,'purchase_required');assert.ok(!body.lesson);assert.equal(response.headers.get('cache-control'),'no-store');}
  }
  assert.equal(free,1);
});

test('public requests cannot turn simulation on or create, pay or refund orders',async () => {
  const database={prepare(){assert.fail('public payment actions must not touch the database');}};
  const id=crypto.randomUUID();
  for(const path of ['/api/commerce/orders',`/api/commerce/orders/${id}/pay`,`/api/commerce/orders/${id}/refund`]) {
    const response=await api(database,path+'?ENABLE_COMMERCE_SIMULATION=true',{body:{consent:true,idempotencyKey:id,outcome:'success',ENABLE_COMMERCE_SIMULATION:'true'},headers:{'x-enable-commerce-simulation':'true'}});
    assert.equal(response.status,503);assert.equal((await response.json()).error,'payment_unavailable');
  }
});

test('previously successful simulation orders never grant normal paid-course access',async context => {
  const database=openDatabase(':memory:');context.after(()=>database.close());
  const created=await api(database,'/api/commerce/orders',{body:{consent:true,idempotencyKey:crypto.randomUUID()},simulation:'true'});
  assert.equal(created.status,200);
  const cookie=created.headers.get('set-cookie').split(';')[0];
  const {order}=await created.json();
  assert.equal((await api(database,`/api/commerce/orders/${order.id}/pay`,{body:{outcome:'success'},cookie,simulation:'true'})).status,200);
  assert.equal((await api(database,'/api/lessons/boundaries',{cookie,simulation:'true'})).status,200);
  for(const simulation of [undefined,'false','1']) {
    assert.equal((await api(database,'/api/lessons/boundaries',{cookie,simulation})).status,403);
    const me=await (await api(database,'/api/commerce/me',{cookie,simulation})).json();
    assert.equal(me.access,false);assert.equal(me.paymentAvailable,false);assert.deepEqual(me.orders,[]);
  }
  assert.equal(database.sqlite.prepare('SELECT status FROM simulation_orders WHERE id=?').get(order.id).status,'simulated_paid');
});

test('customer purchase and catalog pages contain no simulation controls or false checkout',async () => {
  for(const path of ['/checkout','/learn','/terms']) {
    const response=await api(undefined,path);assert.equal(response.status,200);
    const html=await response.text();assert.doesNotMatch(html,/模拟支付|演练订单|演练开通|本地内测 · 不收取任何费用/);
    assert.match(html,/付费/);
    if(path==='/checkout') {assert.match(html,/<button[^>]*disabled[^>]*>暂未开放购买<\/button>/);assert.doesNotMatch(html,/¥199|实际扣款/);}
  }
});
