import assert from 'node:assert/strict';
import test from 'node:test';
import { readProgress, rememberProgress, markComplete } from '../lib/learning-progress.ts';

test('on-device completion records are opt-in, deduplicated, deletable and never include answers', context => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis,'window');
  const values = new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
  context.after(() => {if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else delete globalThis.window;});
  assert.deepEqual(readProgress(),{remember:false,completed:[]});
  assert.equal(markComplete('expression'),false);assert.equal(values.size,0);
  assert.equal(rememberProgress(true),true);assert.equal(markComplete('expression'),true);markComplete('expression');markComplete('boundaries');
  assert.deepEqual(readProgress(),{remember:true,completed:['expression','boundaries']});
  assert.deepEqual(Object.keys(JSON.parse([...values.values()][0])).sort(),['completed','remember']);
  assert.equal(rememberProgress(false),true);assert.equal(values.size,0);
  assert.deepEqual(readProgress(),{remember:false,completed:[]});
});
