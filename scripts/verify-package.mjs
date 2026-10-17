import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';

const resources=path.resolve('release/win-unpacked/resources'),appRoot=path.join(resources,'app');
const {GameInstaller}=await import(pathToFileURL(path.join(appRoot,'packages/core/installer.mjs')));
const {profileAt}=await import(pathToFileURL(path.join(appRoot,'packages/core/config.mjs')));
await fs.mkdir('test-output',{recursive:true});
const scratch=await fs.mkdtemp(path.resolve('test-output','package-'));
let child;
try {
  const catalog=JSON.parse(await fs.readFile(path.join(appRoot,'catalog/catalog.json'),'utf8'));
  const game=catalog.games.find(g=>g.id==='deep-miners');assert(game);
  const installer=new GameInstaller(path.join(scratch,'games'));
  await installer.install(game,process.argv.includes('--download')?{}:{localArchive:path.resolve('artifacts',`${game.id}-${game.version}-win-x64.zip`)});
  const gameRoot=await installer.gameRoot(game.id),profile=await profileAt(scratch);
  child=fork(path.join(appRoot,'packages/worker/index.mjs'),[],{execPath:path.join(resources,'runtime/node.exe'),cwd:scratch,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
  let sequence=0;const pending=new Map();
  child.stderr.on('data',data=>process.stderr.write(data));
  child.on('message',message=>{pending.get(message.id)?.(message);pending.delete(message.id);});
  function request(method,args={}){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Le processus distribué ne répond pas.')),40000);pending.set(id,message=>{clearTimeout(timer);message.error?reject(Error(message.error)):resolve(message.result);});child.send({id,method,args});});}
  const args={gameRoot,saveRoot:path.join(scratch,'saves'),profile};
  const session=await request(process.argv.includes('--internet')?'host':'solo',args);
  assert.equal(session.gameId,'deep-miners');
  if(process.argv.includes('--internet'))assert.match(session.invite,/^AJ1-/);
  const home=await fetch(session.url);assert(home.ok);
  assert((await home.text()).includes(game.version));
  for(const asset of ['app.js','assets/mineral-iron.webp','assets/sfx/rock-break.wav','assets/fonts/font-1.ttf'])assert((await fetch(session.url+'/'+asset)).ok,asset);
  await request('stop');
  assert.equal((await request('mines',args)).length,1);
  const done=once(child,'exit');child.disconnect();await done;
  console.log('Paquet Windows vérifié : installation, runtime inclus, serveur, ressources et sauvegarde.');
} finally {
  if(child&&child.exitCode===null){const done=once(child,'exit');if(child.connected)child.disconnect();else child.kill();await done;}
  await fs.rm(scratch,{recursive:true,force:true});
}
