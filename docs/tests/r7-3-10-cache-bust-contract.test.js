import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('Home_Studio.html', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');

const CACHE_TOKEN = 'r7310-multipage-webgl-v9';

test('R7-3.10 runtime resources share the current cache-bust token', () => {
  assert.match(html, new RegExp(`js/InitCommon\\.js\\?v=${CACHE_TOKEN}`));
  assert.match(html, new RegExp(`js/Home_Studio\\.js\\?v=${CACHE_TOKEN}`));
  assert.match(homeStudio, new RegExp(`Home_Studio_Fragment\\.glsl\\?v=${CACHE_TOKEN}`));
  assert.match(initCommon, new RegExp(`r7-3-10-xatlas-param-table\\.generated\\.json\\?v=${CACHE_TOKEN}`));
});
