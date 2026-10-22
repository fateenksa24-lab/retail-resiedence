#!/usr/bin/env node
// After each deploy: tell Bing, Yandex and the other IndexNow engines about every URL in the live sitemap.
//   node scripts/indexnow.mjs [--site=https://retalresidence.com]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.argv.find((a) => a.startsWith('--site='))?.split('=')[1] ?? 'https://retalresidence.com').replace(/\/$/, '');

const config = await readFile(path.join(ROOT, 'src/content/tracking.ts'), 'utf8');
const key = config.match(/indexNowKey:\s*'([^']+)'/)?.[1];
if (!key) throw new Error('No indexNowKey in src/content/tracking.ts');

const keyRes = await fetch(`${SITE}/${key}.txt`);
if (!keyRes.ok || (await keyRes.text()).trim() !== key) throw new Error(`${SITE}/${key}.txt is not live yet; deploy first.`);

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${key}.txt`, urlList }),
});
console.log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${res.status}${res.status === 200 || res.status === 202 ? ' (accepted)' : ` ${await res.text()}`}`);
