import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {gateway} from '../packages/worker/gateway.mjs';
const clientRoot=fileURLToPath(new URL('../games/deep-miners/client/',import.meta.url));
test('Ressources locales : polices incluses et bootstrap protégé des sites extérieurs',async t=>{
  const server=await gateway({clientRoot,bootstrap:{token:'confidentiel'},tunnel:async()=>{throw Error('Pas de radio dans ce contrôle.');}});
  t.after(()=>server.close());
  const config=await fetch(server.url+'/config.js');
  assert.equal(config.headers.get('cross-origin-resource-policy'),'same-origin');
  assert.match(await config.text(),/confidentiel/);
  const forbidden=await fetch(server.url+'/config.js',{headers:{Origin:'https://example.com'}});
  assert.equal(forbidden.status,403);assert.doesNotMatch(await forbidden.text(),/confidentiel/);
  const rebound=await new Promise((resolve,reject)=>{http.get(server.url+'/config.js',{headers:{Host:'example.com'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});
  assert.equal(rebound,403);
  const css=await(await fetch(server.url+'/style.css')).text();
  assert.doesNotMatch(css,/@import|https:\/\/fonts\./);
  for(let index=1;index<=7;index++){
    const name='assets/fonts/font-'+index+'.ttf',font=await fetch(server.url+'/'+name);
    assert.equal(font.headers.get('content-type'),'font/ttf');
    assert.deepEqual(Buffer.from(await font.arrayBuffer()),await fs.readFile(path.join(clientRoot,name)));
  }
});
