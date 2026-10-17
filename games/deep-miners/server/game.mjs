import {normalizeSharedStorage} from './shared-storage.mjs';
import {railStops,ridersOf} from '../client/railway.js';
import {countInstallations} from '../client/installation-limits.js';
import {initWorld,initMiner,freeStart,freeInteract,freeTick,craft,place,recover,dismantle} from './free-mode.mjs';
export const craftItem=(room,p,id)=>craft(room,p,id,event,sound);
export const placeItem=(room,p,id,target)=>place(room,p,id,event,sound,target);
export const dismantleItem=(room,p)=>dismantle(room,p,event,sound);
export const recoverMiner=(room,p)=>recover(room,p,event,sound);
import {randomBytes} from 'node:crypto';
import {movePlayer,strength} from '../client/physics.js';
import {acknowledgeInput} from './input-clock.mjs';
import {createStructures} from '../client/structures.js';
import {newWorld,attachWorld,worldSnapshot} from './world.mjs';
import {colonyCommand} from './colony.mjs';
export const manageColony=(room,p,msg)=>colonyCommand(room,p,msg,event,sound);
export const W=35,H=55,SPAWN={x:17.5,y:3.5},COLORS=['#f5bd62','#64ded0','#b79aff','#fc8295','#78b8ff','#c6e279'];
export {strength};
export function makeRoom(code,practice=false,mode='free',seed=null){
 const tiles=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>x===0||x===W-1||y===0||y===H-1?9:1));
 const carve=(cx,cy,rx,ry)=>{for(let y=Math.max(1,Math.floor(cy-ry));y<Math.min(H-1,cy+ry+1);y++)for(let x=Math.max(1,Math.floor(cx-rx));x<Math.min(W-1,cx+rx+1);x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<1)tiles[y][x]=0;};
 for(let y=1;y<H-1;y++)for(let x=16;x<=18;x++)tiles[y][x]=0;
 for(let y=8;y<H-3;y+=8){const bend=Math.random()*Math.PI*2;for(let x=3;x<W-3;x++)carve(x,y+Math.sin(x*.24+bend)*2,1.7,1.6);for(const x of [7,14,24,29])carve(x,y+Math.sin(x*.24+bend)*2,2.3+Math.random()*1.5,2+Math.random());}
 carve(17,3,5,3);
 for(let y=6;y<H-1;y++)for(let x=1;x<W-1;x++)if(tiles[y][x]===1){const n=Math.random();tiles[y][x]=mode==='free'?(n<.15?2:y>=20&&n<.22?3:y>=34&&n<.3?4:1):(n<.12?2:n<.17?3:n<.21&&y>25?4:1);}
 tiles[7][19]=2;tiles[9][15]=3;
 const seen=tiles.map(row=>row.map(()=>false));
 const room={code,practice,mode,tiles,seen,structures:createStructures(tiles),mapVersion:0,round:0,players:new Map(),phase:'lobby',host:null,bank:0,target:0,time:0,duration:360,events:[],audioEvents:[],audioSeq:0,revision:0,damage:new Map(),created:Date.now()};if(mode==='free'){initWorld(room);room.duration=null;if(seed){room.world=newWorld(seed);room.structures=room.structures.filter(s=>s.kind==='lift');attachWorld(room);}}return room;
}
export function addPlayer(room,name){
 if(room.players.size>=6)throw Error('Le salon est complet (6 joueurs).');
 if(room.phase==='running'&&room.mode!=='free')throw Error('Expédition en cours : attendez la prochaine.');
 const id=randomBytes(18).toString('hex'),slot=COLORS.findIndex(c=>![...room.players.values()].some(p=>p.color===c));
 const p={id,name:name.trim().slice(0,18),color:COLORS[slot],slot,...SPAWN,o2:100,bag:0,alive:true,escaped:false,connected:false,lastSeen:Date.now(),input:{},inputSeq:0,ackSeq:0,revealCell:null,face:{x:0,y:1},mine:0,revive:0,using:false,moving:false};
 if(room.mode==='free')initMiner(p);if(room.world)Object.assign(p.items,{lamp:2,wall:4,floor:4});room.players.set(id,p);room.host??=id;return p;
}
export function start(room,id){
 if(id!==room.host)throw Error('Seul le chef peut démarrer.');
 if(room.phase==='running')throw Error('Expédition déjà lancée.');
 if(room.players.size<(room.minimumPlayers||3)&&!room.practice)throw Error('Il faut au moins 3 joueurs.');
 if(room.mode==='free'){freeStart(room,event,sound);return;}
 const fresh=makeRoom(room.code,room.practice,'expedition');room.tiles=fresh.tiles;room.seen=fresh.seen;room.structures=fresh.structures;room.damage.clear();room.revision++;room.mapVersion++;room.round++;
 room.bank=0;room.target=room.players.size*100;room.time=0;room.phase='running';room.events=[];
 for(const p of room.players.values())Object.assign(p,SPAWN,{o2:100,bag:0,alive:true,escaped:false,input:{},revealCell:null,mine:0,revive:0,using:false,moving:false,face:{x:0,y:1}});
 event(room,'Ascenseur opérationnel. Six minutes pour remplir le contrat et remonter.');
 room.audioEvents=[];sound(room,'start',SPAWN);
}
function event(room,message){room.events.unshift(message);room.events=room.events.slice(0,5);}
function sound(room,kind,p,extra={}){room.audioEvents.push({seq:++room.audioSeq,kind,x:p.x,y:p.y,...(typeof p.id==='string'?{player:p.id.slice(0,8)}:{}),...extra});if(room.audioEvents.length>32)room.audioEvents.shift();}
export function atBase(p){return Math.hypot(p.x-SPAWN.x,p.y-SPAWN.y)<2.6;}
export function interact(room,p){if(room.mode==='free')return freeInteract(room,p,event,sound);if(room.phase!=='running'||!p.alive||p.escaped)return;if(atBase(p)){if(p.bag){const before=room.bank;room.bank+=p.bag;event(room,`${p.name} dépose ${p.bag} crédits.`);sound(room,'deposit',p,{amount:p.bag});p.bag=0;if(before<room.target&&room.bank>=room.target)sound(room,'quota',p);}if(p.o2<99.5)sound(room,'refill',p);p.o2=100;}}
export function escape(room,p){if(room.mode==='free'){if(!atBase(p))throw Error('Rejoins la base pour déposer.');interact(room,p);return;}if(room.phase!=='running'||!p.alive||p.escaped||!atBase(p))throw Error('Rejoignez l’ascenseur pour remonter.');interact(room,p);p.escaped=true;p.input={};event(room,`${p.name} est à l’abri.`);sound(room,'escape',p);finish(room);}
function finish(room){if([...room.players.values()].every(p=>p.escaped||!p.alive))room.phase=room.bank>=room.target&&[...room.players.values()].some(p=>p.escaped)?'won':'lost';}
export function tick(room,dt,now=Date.now()){
 if(room.phase!=='running')return;if(room.mode==='free')return freeTick(room,dt,now,event,sound);room.time+=dt;
 const helpers=[];
 for(const p of room.players.values()){
  p.mine=0;p.using=false;p.moving=false;if(!p.alive||p.escaped)continue;
  const i=now-p.lastSeen<600&&p.connected?p.input:{};
  movePlayer(room,p,i,dt);acknowledgeInput(p,dt);
  const depth=Math.max(0,p.y-5),gas=depth>25&&Math.sin(room.time/12)>0;
  p.o2=atBase(p)?Math.min(100,p.o2+dt*15):p.o2-dt*(.25+depth*.012+(i.sprint?.4:0)+(gas?.55:0));
  if(p.o2<=0){p.o2=0;p.alive=false;p.input={};event(room,`${p.name} est à terre. Maintenez E près de lui pour le secourir.`);sound(room,'down',p);continue;}
  const tx=Math.floor(p.x)+p.face.x,ty=Math.floor(p.y)+p.face.y,tile=room.tiles[ty]?.[tx],key=`${tx},${ty}`;
  if(i.mine&&tile>0&&tile<9&&p.bag<80){const damage=(room.damage.get(key)||0)+dt;room.damage.set(key,damage);p.mine=damage/strength(tile);if(p.mine>=1){room.tiles[ty][tx]=0;room.damage.delete(key);room.revision++;room.mapVersion++;p.bag=Math.min(80,p.bag+({2:8,3:16,4:30}[tile]||0));sound(room,'break',{x:tx+.5,y:ty+.5,id:p.id},{ore:tile});if(tile>1&&tile<5)sound(room,'ore',p,{ore:tile});}}
  if(i.use){interact(room,p);helpers.push(p);}
  const cell=`${Math.floor(p.x)},${Math.floor(p.y)}`;
  if(cell!==p.revealCell){p.revealCell=cell;let revealed=false;const cx=Math.floor(p.x),cy=Math.floor(p.y);
   for(let y=Math.max(0,cy-6);y<Math.min(H,cy+7);y++)for(let x=Math.max(0,cx-6);x<Math.min(W,cx+7);x++)if((x-cx)**2+(y-cy)**2<36&&!room.seen[y][x]){room.seen[y][x]=true;revealed=true;}
   if(revealed)room.mapVersion++;
  }
 }
 for(const q of room.players.values())if(!q.alive&&!q.escaped){const p=helpers.find(p=>p.o2>25&&Math.hypot(q.x-p.x,q.y-p.y)<1.7);if(p){p.using=true;q.revive+=dt;if(q.revive>=3){q.alive=true;q.o2=35;q.revive=0;p.o2-=15;event(room,`${p.name} a secouru ${q.name}.`);sound(room,'rescue',q);}}else q.revive=0;}
 if(room.time>=room.duration){for(const p of room.players.values())if(!p.escaped){p.alive=false;p.bag=0;}event(room,'L’ascenseur a fermé.');}finish(room);
}
export function snapshot(room,full=true,player=null){if(room.mode==='free')normalizeSharedStorage(room);return {inputClock:1,code:room.code,practice:room.practice,mode:room.mode,...(room.mode==='free'?{stock:room.stock,base:room.base,coins:room.coins||0,installationCounts:countInstallations(room.installations),railVersion:room.railVersion||0,baseMap:room.installations.filter(s=>s.kind==='bench').map(s=>[s.id,s.x,s.y]),railMap:room.installations.filter(s=>s.kind==='rail').map(s=>[s.id,Math.floor(s.x),Math.floor(s.y)]),installations:room.installations.filter(s=>room.seen[Math.floor(s.y)]?.[Math.floor(s.x)]).map(({riderId,riderIds,route,...s})=>({...s,...(s.kind==='chest'?{buffer:room.stock}:{}),...(s.kind==='wagon'?{riderIds:ridersOf({riderId,riderIds}).map(id=>id.slice(0,8)),...(riderId?{riderId:riderId.slice(0,8)}:{})}:{} )})),totalDeposited:room.totalDeposited}:{}),phase:room.phase,bank:room.bank,target:room.target,time:room.time,duration:room.duration,events:room.events,revision:room.revision,round:room.round,mapVersion:room.mapVersion,...(room.world?(full?worldSnapshot(room,player):{world:room.world}):full?{tiles:room.tiles.map((row,y)=>row.map((v,x)=>room.seen[y][x]?v:-1)),structures:room.structures.filter(s=>room.seen[s.anchor.y]?.[s.anchor.x])}:{}),players:[...room.players.values()].map(({input,lastSeen,inputSeq,revealCell,reconnectHash,...p})=>({...p,id:p.id.slice(0,8)})),host:room.host?.slice(0,8)};}

