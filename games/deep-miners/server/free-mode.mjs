import {forestStep} from './forest.mjs';
import {dropFor} from '../client/minerals.js';
import {normalizeSharedStorage} from './shared-storage.mjs';
import {COMMON_STOCK_CAPACITY} from '../client/machine-profile.js';
import {headlampRevealsCell} from '../client/headlamp.js';
import {railwayStep,releaseRider} from './railway.mjs';
import {movePlayer,strength} from '../client/physics.js';
import {acknowledgeInput} from './input-clock.mjs';
import {checkPlacement} from '../client/placement.js';
import {RECIPES,RESOURCES,emptyStock,weight,capacity,resourceFor,canMine,miningRate,recipeReason,requiredPick} from '../client/progression.js';
import {interactColony,dismantleBuild,machineStep} from './colony.mjs';
import {biomeAt,visibleCell} from '../client/world.js';
import {refreshScenery} from './world.mjs';
import {CROPS,SEEDS,FOODS} from '../client/agriculture.js';
import {cropStep} from './agriculture.mjs';
import {normalizeMiner,survivalStep} from './survival.mjs';
const SPAWN={x:17.5,y:3.5};
export const nearBase=p=>Math.hypot(p.x-SPAWN.x,p.y-SPAWN.y)<2.6;
export function initWorld(room){room.stock=emptyStock();room.base={foundry:false};room.installations=[];room.nextInstallation=1;room.totalDeposited=0;room.coins=24;}
export function initMiner(p){p.cargo=emptyStock();p.pickTier=0;p.capacity=80;p.tank=false;p.items={lamp:0,air:0,drill:0};p.blockedMine=null;p.health=100;p.hunger=100;p.selectedSlot=0;p.heldItem='pick';}
export function freeStart(room,event,sound){room.round++;room.phase='running';room.time=0;room.target=0;room.duration=null;event(room,'Mine ouverte : explorez, rapportez des ressources et développez la base.');sound(room,'start',SPAWN);}
function give(p,id,count){const available=Math.floor((capacity(p)-weight(p.cargo))/RESOURCES[id].weight),take=Math.max(0,Math.min(count||0,available));p.cargo[id]=(p.cargo[id]||0)+take;p.bag=weight(p.cargo);return take;}
export function freeInteract(room,p,event,sound){
 if(room.phase!=='running'||!p.alive)return;normalizeSharedStorage(room);
 if(interactColony(room,p,event,sound))return;
 if(nearBase(p)){
  const ids=Object.keys(RESOURCES).filter(id=>!FOODS[id]&&!SEEDS[id]&&!Object.values(CROPS).some(c=>c.produce===id)),amount=ids.reduce((sum,id)=>sum+(p.cargo[id]||0),0);let deposited=0;
  if(amount){for(const id of ids){const count=Math.max(0,Math.min(p.cargo[id]||0,Math.floor((COMMON_STOCK_CAPACITY-weight(room.stock))/RESOURCES[id].weight)));room.stock[id]=(room.stock[id]||0)+count;p.cargo[id]-=count;deposited+=count;}room.totalDeposited+=deposited;room.bank=room.totalDeposited;p.bag=weight(p.cargo);event(room,`${p.name} dépose ${deposited} ressources dans le stock commun.`);sound(room,'deposit',p,{amount:deposited});}
  if(p.o2<99.5)sound(room,'refill',p);p.o2=100;return;
 }
 if(room.world)return;
 let collected=0;
 for(const machine of room.installations)if(machine.kind==='drill'&&Math.hypot(p.x-machine.x,p.y-machine.y)<1.8){for(const id of Object.keys(RESOURCES)){const count=give(p,id,machine.buffer[id]);machine.buffer[id]-=count;collected+=count;}}
 if(collected){sound(room,'deposit',p,{amount:collected});event(room,`${p.name} récupère ${collected} ressources de la foreuse.`);}
}
export function craft(room,p,id,event,sound){
 if(room.mode!=='free'||room.phase!=='running'||!nearBase(p)&&!room.installations.some(s=>s.kind==='bench'&&Math.hypot(s.x-p.x,s.y-p.y)<2.2))throw Error('Rejoins la base ou un établi pour fabriquer.');
 normalizeSharedStorage(room);const recipe=RECIPES.find(r=>r.id===id),reason=recipeReason(recipe,room,p);if(reason)throw Error(reason);
 for(const [resource,count]of Object.entries(recipe.cost))room.stock[resource]-=count;
 if(recipe.pick)p.pickTier=recipe.pick;
 if(recipe.foundry)room.base.foundry=true;
 if(recipe.upgrade==='pack')p.capacity=120;
 if(recipe.upgrade==='tank')p.tank=true;
 if(recipe.item)p.items[recipe.item]=(p.items[recipe.item]||0)+recipe.count;
 event(room,`${p.name} fabrique : ${recipe.name}.`);sound(room,'quota',p);
}
export function place(room,p,kind,event,sound,target){
 if(!['lamp','air','drill'].includes(kind))throw Error('Installation impossible.');
 const result=checkPlacement(room,p,kind,target);if(!result.ok)throw Error(result.reason);
 const {x,y,face}=result;
 p.items[kind]--;
 room.installations.push({id:room.nextInstallation++,kind,x,y,solid:kind!=='lamp',...(kind==='drill'?{tier:p.pickTier,face,progress:0,buffer:emptyStock(),status:'working'}:{})});
 event(room,`${p.name} installe ${kind==='lamp'?'une lampe':kind==='air'?'un relais d’air':'une foreuse'}.`);sound(room,kind==='air'?'refill':'deposit',p);
}
export function recover(room,p,event,sound){
 if(room.mode!=='free'||room.phase!=='running'||p.alive)throw Error('Le retour de secours est disponible lorsque tu es à terre.');
 if(p.vehicleId)releaseRider(room,p,true);
 Object.assign(p,SPAWN,{alive:true,o2:100,health:100,hunger:70,escaped:false,cargo:emptyStock(),bag:0,input:{},mine:0,revive:0,revealCell:null,moving:false});
 event(room,`${p.name} revient à la base. Son chargement a été perdu, son équipement est conservé.`);sound(room,'rescue',p);
}
export function dismantle(room,p,event,sound){
 if(room.mode!=='free'||room.phase!=='running'||!p.alive)throw Error('Récupération impossible.');
 if(dismantleBuild(room,p,event,sound))return;
 const item=room.installations.filter(s=>['lamp','air','drill'].includes(s.kind)&&Math.hypot(p.x-s.x,p.y-s.y)<1.6).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
 if(!item)throw Error('Approche-toi d’une installation pour la récupérer.');
 if((p.items[item.kind]||0)>=20)throw Error('Équipement transporté au maximum.');
 if(item.kind==='drill'&&weight(p.cargo)+weight(item.buffer)>capacity(p))throw Error('Vide le sac ou la caisse de la foreuse avant de la récupérer.');
 if(item.buffer)for(const [id,count]of Object.entries(item.buffer))give(p,id,count);
 p.items[item.kind]=(p.items[item.kind]||0)+1;room.installations=room.installations.filter(s=>s.id!==item.id);event(room,`${p.name} récupère une installation pour la déplacer.`);sound(room,'deposit',p);
}
function drillStep(room,dt,sound){
 for(const machine of room.installations)if(machine.kind==='drill'){
  if(room.world&&!machine.powered){machine.status='power';continue;}
  if(Object.values(machine.buffer).reduce((a,b)=>a+b,0)>10){machine.status='full';continue;}
  // A machine cuts the adjacent seam in its facing direction; it never reaches through stone.
  const candidates=[[machine.face.x,machine.face.y],[machine.face.y,-machine.face.x],[-machine.face.y,machine.face.x],[-machine.face.x,-machine.face.y]];
  const target=candidates.map(([dx,dy])=>({x:Math.floor(machine.x)+dx,y:Math.floor(machine.y)+dy})).find(t=>room.tiles[t.y]?.[t.x]>=2&&canMine({pickTier:machine.tier},room.tiles[t.y][t.x])&&!room.installations.some(s=>s.kind==='wall'&&Math.floor(s.x)===t.x&&Math.floor(s.y)===t.y));
  if(!target){machine.progress=0;machine.target=null;machine.status='empty';continue;}
  const targetDrop=dropFor(room.tiles[target.y][target.x]);if(room.world&&weight(machine.buffer)+targetDrop.count*RESOURCES[targetDrop.resource].weight>40){machine.status='full';continue;}
  const key=`${target.x},${target.y}`;if(machine.target!==key){machine.target=key;machine.progress=0;}
  machine.status='working';machine.progress+=dt/6;
  if(machine.progress>=1){const tile=room.tiles[target.y][target.x];room.tiles[target.y][target.x]=0;room.damage.delete(key);room.mapVersion++;room.revision++;const drop=dropFor(tile);machine.buffer[drop.resource]=(machine.buffer[drop.resource]||0)+drop.count;machine.progress=0;sound(room,'break',{x:target.x+.5,y:target.y+.5},{ore:tile});}
 }
}
export function freeTick(room,dt,now,event,sound){
 const active=[...room.players.values()].filter(p=>p.connected);if(!active.length)return;
 room.time+=dt;forestStep(room,now);cropStep(room,dt);railwayStep(room,dt,now);if(room.world){refreshScenery(room);machineStep(room,dt);}drillStep(room,dt,sound);const helpers=[];
 for(const p of active){
  normalizeMiner(p);p.mine=0;p.using=false;p.moving=false;p.blockedMine=null;if(!p.alive)continue;
  const input=now-p.lastSeen<600?p.input:{};if(!p.vehicleId)movePlayer(room,p,input,dt);else p.moving=!!room.installations.find(w=>w.id===p.vehicleId)?.moving;acknowledgeInput(p,dt);
  const depth=Math.min(room.world?80:1000,Math.max(0,p.y-5)),gas=(room.world?['volcano','deep'].includes(biomeAt(room.world,p.x,p.y).id):depth>25)&&Math.sin(room.time/12)>0;
  const air=room.installations.some(s=>s.kind==='air'&&Math.hypot(p.x-s.x,p.y-s.y)<1.6);
  p.o2=nearBase(p)||air?Math.min(100,p.o2+dt*15):p.o2-dt*(.12+depth*.006+(input.sprint?.15:0)+(gas?.42:0))*(p.tank?.65:1);
  p.o2=Math.max(0,p.o2);survivalStep(p,input,dt);
  if(p.health<=0){p.health=0;p.alive=false;p.input={};event(room,`${p.name} est à terre : E pour le secourir, ou retour de secours à la base.`);sound(room,'down',p);continue;}
  const x=Math.floor(p.x)+p.face.x,y=Math.floor(p.y)+p.face.y,tile=room.tiles[y]?.[x],drop=dropFor(tile),key=`${x},${y}`;
  if(!p.vehicleId&&input.mine&&p.heldItem==='pick'&&resourceFor(tile)){
   if(room.installations.some(s=>s.kind==='wall'&&Math.floor(s.x)===x&&Math.floor(s.y)===y))p.blockedMine='X : récupère ce mur';
   else if(!canMine(p,tile))p.blockedMine=requiredPick(tile)===3?'Pioche en acier requise':requiredPick(tile)===2?'Pioche de profondeur requise':'Pioche renforcée requise';
   else if(weight(p.cargo)+RESOURCES[drop.resource].weight*drop.count>capacity(p))p.blockedMine='Sac plein : dépose les ressources';
   else {const damage=(room.damage.get(key)||0)+dt*miningRate(p);room.damage.set(key,damage);p.mine=damage/strength(tile);
    if(p.mine>=1){room.tiles[y][x]=0;room.damage.delete(key);room.revision++;room.mapVersion++;give(p,drop.resource,drop.count);sound(room,'break',{x:x+.5,y:y+.5,id:p.id},{ore:tile});if(tile>1)sound(room,'ore',p,{ore:tile});}
   }
  }
  if(input.use){if(!p.wasUsing)freeInteract(room,p,event,sound);helpers.push(p);}p.wasUsing=!!input.use;
  const cell=`${Math.floor(p.x)},${Math.floor(p.y)}${room.world?':'+room.revision:''}:lamp2`;
  if(cell!==p.revealCell){p.revealCell=cell;let revealed=false;const cx=Math.floor(p.x),cy=Math.floor(p.y);
   for(let yy=Math.max(0,cy-6);yy<Math.min(room.tiles.length,cy+7);yy++)for(let xx=Math.max(0,cx-6);xx<Math.min(room.tiles[0].length,cx+7);xx++)if((xx-cx)**2+(yy-cy)**2<36&&!room.seen[yy][xx]&&(!room.world||visibleCell(room.tiles,cx,cy,xx,yy)||headlampRevealsCell(room.tiles,cx,cy,xx,yy))){room.seen[yy][xx]=true;revealed=true;}
   if(revealed)room.mapVersion++;
  }
 }
 for(const q of room.players.values())if(!q.alive){const p=helpers.find(p=>p.o2>25&&Math.hypot(q.x-p.x,q.y-p.y)<1.7);if(p){p.using=true;q.revive+=dt;if(q.revive>=3){q.alive=true;q.o2=35;q.health=35;q.hunger=Math.max(20,q.hunger||0);q.revive=0;p.o2-=15;event(room,`${p.name} a secouru ${q.name}.`);sound(room,'rescue',q);}}else q.revive=0;}
}
