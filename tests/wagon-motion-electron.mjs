import {app} from 'electron';
import fs from 'node:fs/promises';
import {mkdtempSync} from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gateway} from '../packages/worker/gateway.mjs';
import {createGameWindow} from '../apps/launcher/main/game-window.mjs';
import {createServer} from '../games/deep-miners/server/index.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=mkdtempSync(path.join(root,'test-output','wagon-motion-'));
app.setPath('userData',path.join(scratch,'profile'));
let window,server,bridge;
const checks=[],errors=[];
const js=code=>window.webContents.executeJavaScript(code);
async function wait(check,label){for(let i=0;i<150;i++){if(await check())return;await pause(40);}throw Error(label);}
async function key(code,type){await js(`window.dispatchEvent(new KeyboardEvent(${JSON.stringify(type)},{code:${JSON.stringify(code)},bubbles:true,cancelable:true}))`);}
function checked(label){checks.push(label);console.log('OK · '+label);}
void app.whenReady().then(async()=>{
 let failed;
 try{
  server=createServer({launcher:true,storagePath:path.join(scratch,'saves/rooms.json')});
  await new Promise(resolve=>server.server.listen(0,'127.0.0.1',resolve));
  const credentials=server.game.enter('create',{name:'QA wagon',practice:true,reconnectKey:'d'.repeat(64)});
  bridge=await gateway({clientRoot:path.join(root,'games/deep-miners/client'),bootstrap:{...credentials,name:'QA wagon',reconnectKey:'d'.repeat(64),host:true},tunnel:async()=>{const socket=net.connect(server.server.address().port,'127.0.0.1');await once(socket,'connect');return socket;}});
  window=createGameWindow({id:'wagon-motion-qa',title:'QA wagon',url:bridge.url,show:false});
  window.webContents.on('console-message',(_event,level,message)=>{if(level===3)errors.push(message);});
  await window.loadURL(bridge.url);
  await wait(()=>js("document.getElementById('loading').hidden&&document.getElementById('roomCode').textContent.length===6"),'Chargement du jeu');
  await js("document.getElementById('start').click()");
  const room=server.rooms.get(credentials.code),player=room.players.get(credentials.token);
  await wait(()=>room.phase==='running','Demarrage de la mine');
  for(let y=8;y<=15;y++)for(let x=8;x<=19;x++){room.tiles[y][x]=0;room.seen[y][x]=true;}
  room.installations=room.installations.filter(s=>Math.hypot(s.x-13,s.y-10)>7);
  for(let x=9;x<=17;x++)room.installations.push({id:'qa-rail-'+x,kind:'rail',x:x+.5,y:10.5});
  for(let y=11;y<=14;y++)room.installations.push({id:'qa-turn-'+y,kind:'rail',x:17.5,y:y+.5});
  const wagon={id:'qa-wagon',kind:'wagon',x:10.5,y:10.5,face:{x:1,y:0},buffer:{}};
  room.installations.push(wagon);room.railVersion=(room.railVersion||0)+1;
  Object.assign(player,{x:10.5,y:10.5,face:{x:1,y:0},input:{},revealCell:null});room.mapVersion++;room.revision++;
  server.game.broadcast(room);await pause(180);
  await key('KeyE','keydown');await key('KeyE','keyup');
  await wait(()=>player.vehicleId===wagon.id,'Monter dans le wagon avec E');
  checked('Commande E du client transmise au serveur : conducteur a bord');
  const start=wagon.x;await key('KeyD','keydown');
  await wait(()=>wagon.x>start+.8,'Wagon en mouvement');
  await key('KeyD','keyup');await wait(()=>!player.input.right,'Relachement transmis');
  const stopped=wagon.x;await pause(180);assert(Math.abs(wagon.x-stopped)<.01);
  assert.equal(player.x,wagon.x);assert.equal(player.y,wagon.y);
  checked('Conduite et arret par le vrai client ; personnage solidaire du wagon');
  server.game.command(room,player,{type:'wagon',id:wagon.id,action:'route',stopId:'qa-turn-14'});
  await wait(()=>wagon.y>10.8,'Trajet automatique dans le virage');
  assert.equal(wagon.x,17.5);assert.equal(player.x,wagon.x);assert.equal(player.y,wagon.y);
  await fs.writeFile(path.join(scratch,'wagon-virage.png'),(await window.webContents.capturePage()).toPNG());
  checked('Destination automatique : virage sur les rails et rendu du client capture');
  const stats=await js(`(async()=>{
    const {createNetcode}=await import('/netcode.js');
    const tiles=Array.from({length:10},()=>Array(40).fill(0)),railMap=Array.from({length:35},(_,i)=>['r'+i,i+1,2]);
    const state=(x)=>({code:'QA',round:1,phase:'running',mode:'free',tiles,railMap,installations:[{id:'w',kind:'wagon',x,y:2.5}],players:[{id:'p',vehicleId:'w',vehicleDriver:false,x,y:2.5,face:{x:1,y:0},railFrom:{x:Math.floor(x-.5),y:2},railTo:{x:Math.floor(x-.5)+1,y:2},railProgress:x-.5-Math.floor(x-.5),alive:true,bag:0}]});
    const n=createNetcode();n.receive(state(2.5),'p',0);n.receive(state(2.98),'p',100);
    const samples=[100,116,132,148,164,180].map(t=>n.scene(t,{},true).players[0].x);
    return {samples};
  })()`);
  for(let i=1;i<stats.samples.length;i++)assert(stats.samples[i]>stats.samples[i-1]);
  checked('Module navigateur : le passager avance a chaque image entre deux paquets');
  await key('KeyE','keydown');await key('KeyE','keyup');await wait(()=>!player.vehicleId,'Descendre du wagon');
  assert.equal(await js("document.getElementById('loading').hidden"),true);
  assert.equal(errors.length,0,errors.join('\n'));
  checked('Descente avec E ; aucune erreur du client pendant le trajet');
 }catch(error){failed=error;console.error(error.stack);}
 finally{
  await fs.writeFile(path.join(scratch,'report.json'),JSON.stringify({ok:!failed,checks,errors,error:failed?.stack,historicalSuitesRerun:false},null,2));
  console.log('Rapport : '+path.join(scratch,'report.json'));
  if(window&&!window.isDestroyed())window.destroy();await bridge?.close();server?.close();app.exit(failed?1:0);
 }
});
