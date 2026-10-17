import {storageBuffer,normalizeSharedStorage} from './shared-storage.mjs';
import {COMMON_STOCK_CAPACITY,MACHINE_REACH,acceptsResource} from '../client/machine-profile.js';
import {BUILDINGS,RESOURCES,emptyStock,weight,capacity,inventorySlots,isQuickbarItem} from '../client/progression.js';
import {claimTreasure} from './world.mjs';
import {checkPlacement} from '../client/placement.js';
import {SEEDS,fieldTarget,fieldAt,cropReady} from '../client/agriculture.js';
import {agricultureCommand,harvest,removeField,eatFood} from './agriculture.mjs';
import {normalizeMiner} from './survival.mjs';
import {wagonCommand} from './railway.mjs';
import {railUsesCell,WAGON_CAPACITY} from '../client/railway.js';
const nearBase=p=>Math.hypot(p.x-17.5,p.y-3.5)<2.6;
const active=(room,p)=>{if(room.mode!=='free'||room.phase!=='running'||!p.alive)throw Error('Action indisponible.');};
const target=p=>({x:Math.floor(p.x)+p.face.x+.5,y:Math.floor(p.y)+p.face.y+.5});
export function build(room,p,kind,event,sound,target,rotation=0){
 active(room,p);normalizeSharedStorage(room);const definition=BUILDINGS[kind];if(!definition)throw Error('Construction inconnue.');
 const result=checkPlacement(room,p,kind,target,rotation);if(!result.ok)throw Error(result.reason);
 const {x,y,tile,solid,face}=result;
 p.items[kind]--;const item={id:room.nextInstallation++,kind,x,y,face,solid,originalTile:tile,progress:0,status:'idle',...(kind==='wall'?{rotation:result.rotation}:{}),...(definition.storage||kind==='farm'?{buffer:emptyStock()}:{}),...(kind==='door'?{open:false}:{}),...(kind==='battery'?{energy:0}:{}),...(kind==='sorter'?{filter:'iron'}:{})};
 if(kind==='chest')item.shared=true;if(['rail','bench'].includes(kind))room.railVersion=(room.railVersion||0)+1;room.installations.push(item);if(kind==='wall'||definition.floor)room.tiles[Math.floor(y)][Math.floor(x)]=kind==='wall'?1:0;room.mapVersion++;room.revision++;event(room,`${p.name} construit : ${definition.name}.`);sound(room,'deposit',item);
}
export function interactColony(room,p,event,sound){
 const plot=fieldAt(room,fieldTarget(p));if(plot?.crop){if(cropReady(plot)){try{harvest(room,p,fieldTarget(p),sound);}catch(e){event(room,e.message);}}return true;}
 if(room.world){const treasure=claimTreasure(room,p);if(treasure){event(room,`${p.name} découvre un trésor. Des crédits sont ajoutés au comptoir.`);sound(room,'quota',p);return true;}}
 const t=target(p),door=room.installations.find(s=>s.kind==='door'&&Math.hypot(p.x-s.x,p.y-s.y)<1.8&&Math.abs(t.x-s.x)<.6&&Math.abs(t.y-s.y)<.6);
 if(door){if(door.open&&[...room.players.values()].some(q=>Math.abs(q.x-door.x)<.75&&Math.abs(q.y-door.y)<.75))return true;door.open=!door.open;sound(room,'deposit',door);return true;}
 return false;
}
export function dismantleBuild(room,p,event,sound){
 normalizeSharedStorage(room);if(removeField(room,p,sound))return true;
 const t=target(p),item=room.installations.filter(s=>Math.floor(s.x)===Math.floor(t.x)&&Math.floor(s.y)===Math.floor(t.y)&&BUILDINGS[s.kind]).sort((a,b)=>Number(b.kind==='wagon')-Number(a.kind==='wagon')||Number(b.kind==='rail')-Number(a.kind==='rail'))[0];if(!item)return false;
 active(room,p);if(p.vehicleId)throw Error('Descends du wagon avant de récupérer une installation.');if((p.items[item.kind]||0)>=(item.kind==='rail'?200:20))throw Error('Équipement transporté au maximum.');
 if(item.kind==='wagon'&&(item.riderId||item.automatic||item.moving))throw Error('Arrête le wagon et fais descendre son passager avant de le récupérer.');
 if(item.kind==='rail'&&room.installations.some(w=>w.kind==='wagon'&&railUsesCell(w,Math.floor(item.x),Math.floor(item.y))))throw Error('Déplace le wagon avant de retirer ces rails.');
 if(BUILDINGS[item.kind].floor&&room.installations.some(s=>s.kind==='rail'&&s.x===item.x&&s.y===item.y))throw Error('Enlève les rails avant de retirer le sol ou le pont.');
 if(item.kind!=='chest'&&weight(p.cargo)+weight(item.buffer)>capacity(p))throw Error('Vide le coffre et ton sac avant de le déplacer.');
 if(item.originalTile!==0&&[...room.players.values()].some(q=>Math.abs(q.x-item.x)<.75&&Math.abs(q.y-item.y)<.75))throw Error('Un mineur est sur le pont.');
 for(const [id,count]of Object.entries(item.kind==='chest'?{}:item.buffer||{}))p.cargo[id]=(p.cargo[id]||0)+count;p.bag=weight(p.cargo);p.items[item.kind]=(p.items[item.kind]||0)+1;
 if(item.kind==='wall'||BUILDINGS[item.kind].floor)room.tiles[Math.floor(item.y)][Math.floor(item.x)]=item.originalTile;room.installations=room.installations.filter(s=>s.id!==item.id);if(['rail','bench'].includes(item.kind))room.railVersion=(room.railVersion||0)+1;room.mapVersion++;room.revision++;event(room,`${p.name} récupère ${BUILDINGS[item.kind].name}.`);sound(room,'deposit',p);return true;
}
export function colonyCommand(room,p,msg,event,sound){
 active(room,p);
 normalizeMiner(p);normalizeSharedStorage(room);
 if(msg.type==='wagon')return wagonCommand(room,p,msg);
 if(['till','plant','harvest','cook'].includes(msg.type))return agricultureCommand(room,p,msg,event,sound);
 if(msg.type==='equip'){if(!Number.isInteger(msg.slot)||msg.slot<-1||msg.slot>8)throw Error('Emplacement invalide.');p.selectedSlot=msg.slot;normalizeMiner(p);p.input.mine=false;return;}
 if(msg.type==='build')return build(room,p,msg.kind,event,sound,msg.target,msg.rotation);
 if(msg.type==='quickbar'){if(!Array.isArray(msg.slots)||msg.slots.length!==9||msg.slots.some(id=>id!==null&&(typeof id!=='string'||!isQuickbarItem(id)))||new Set(msg.slots.filter(id=>id!==null)).size!==msg.slots.filter(id=>id!==null).length)throw Error('Raccourcis invalides.');p.quickbar=[...msg.slots];normalizeMiner(p);return;}
 if(msg.type==='inventory'){const ids=inventorySlots(p).filter(Boolean).map(s=>s.id);if(!Array.isArray(msg.order)||msg.order.length>72||msg.order.some(id=>id!==null&&!ids.includes(id))||new Set(msg.order.filter(Boolean)).size!==msg.order.filter(Boolean).length)throw Error('Organisation invalide.');p.inventoryOrder=msg.order;return;}
 if(msg.type==='eat')return eatFood(room,p,msg.food,sound);
 if(msg.type==='trade'){
  if(!nearBase(p))throw Error('Rejoins le comptoir à la base.');
  if(msg.action==='buy'){const offer=Object.hasOwn(SEEDS,msg.offer)?SEEDS[msg.offer]:null;if(!offer)throw Error('Le comptoir vend uniquement des graines.');if((room.coins||0)<offer.price)throw Error('Crédits insuffisants.');if(weight(p.cargo)+RESOURCES[msg.offer].weight>capacity(p))throw Error('Sac plein.');room.coins-=offer.price;p.cargo[msg.offer]=(p.cargo[msg.offer]||0)+1;p.bag=weight(p.cargo);}
  else throw Error('Offre inconnue.');event(room,`${p.name} utilise le comptoir. Solde commun : ${room.coins} crédits.`);sound(room,'deposit',p);return;
 }
 const machine=room.installations.find(s=>s.id===msg.id);if(!machine||Math.hypot(p.x-machine.x,p.y-machine.y)>MACHINE_REACH)throw Error('Approche-toi de cette installation.');
 if(msg.type==='discard'){
  if(machine.kind!=='trash'||p.vehicleId)throw Error('Rejoins une poubelle à pied pour jeter des objets.');
  const id=msg.item,count=msg.count;
  if(typeof id!=='string'||id==='pick'||!isQuickbarItem(id)||!Number.isSafeInteger(count)||count<1||count>9999)throw Error('Objet ou quantité invalide.');
  const bag=Object.hasOwn(RESOURCES,id)?p.cargo:p.items;
  if(!Object.hasOwn(bag,id)||!Number.isSafeInteger(bag[id])||bag[id]<count)throw Error('Quantité indisponible.');
  bag[id]-=count;p.bag=weight(p.cargo);normalizeMiner(p);sound(room,'deposit',p);return;
 }
 if(msg.type==='configure'){if(machine.kind!=='sorter'||!RESOURCES[msg.resource])throw Error('Réglage inconnu.');machine.filter=msg.resource;return;}
 if(msg.type==='transfer'){
  const buffer=storageBuffer(room,machine);
  if(msg.all===true){
   if(msg.direction!=='deposit'||!buffer)throw Error('Dépôt indisponible.');
   let space=Math.max(0,bufferCapacity(machine)-weight(buffer)),moved=0;
   // One authoritative command, bounded by storage capacity. Anything that
   // does not fit remains in the bag; retries cannot duplicate this transfer.
   for(const [id,resource]of Object.entries(RESOURCES)){
    if(!acceptsResource(machine,id))continue;
    const count=Math.min(p.cargo[id]||0,Math.floor(space/resource.weight));if(count<=0)continue;
    p.cargo[id]-=count;buffer[id]=(buffer[id]||0)+count;space-=count*resource.weight;moved+=count;
   }
   if(!moved)throw Error(weight(p.cargo)?'Aucune ressource compatible ou stockage plein.':'Ton sac est vide.');
   p.bag=weight(p.cargo);sound(room,'deposit',p);return;
  }
  if(!buffer)throw Error('Cette installation ne stocke pas de ressources.');const resource=RESOURCES[msg.resource],count=msg.count;if(!resource||!Number.isSafeInteger(count)||count<1||count>9999)throw Error('Transfert invalide.');
  if(msg.direction==='deposit'&&!acceptsResource(machine,msg.resource))throw Error('Cet objet ne peut pas être utilisé par cette machine.');
  const source=msg.direction==='deposit'?p.cargo:msg.direction==='withdraw'?buffer:null,dest=msg.direction==='deposit'?buffer:p.cargo;if(!source||!(source[msg.resource]>=count))throw Error('Quantité indisponible.');
  const max=msg.direction==='deposit'?bufferCapacity(machine):capacity(p);if(weight(dest)+resource.weight*count>max)throw Error('Stockage plein.');source[msg.resource]-=count;dest[msg.resource]=(dest[msg.resource]||0)+count;p.bag=weight(p.cargo);sound(room,'deposit',p);return;
 }throw Error('Commande inconnue.');
}
export const bufferCapacity=m=>m.kind==='wagon'?WAGON_CAPACITY:m.kind==='chest'?COMMON_STOCK_CAPACITY:m.kind==='conveyor'||m.kind==='arm'||m.kind==='sorter'?8:40;
export function machineStep(room,dt){
 normalizeSharedStorage(room);
 const machines=room.installations.filter(s=>['drill','generator','battery','conveyor','arm','furnace','sorter','chest','farm','wagon'].includes(s.kind)).map(m=>m.kind==='chest'?{...m,buffer:room.stock}:m),positions=new Map(machines.map(m=>[`${m.x},${m.y}`,m]));
 const adjacent=(m,dx,dy)=>positions.get(`${m.x+dx},${m.y+dy}`),visited=new Set();
 for(const m of machines){m.powered=false;if(!m.buffer&&m.kind!=='battery')m.buffer=emptyStock();}
 for(const start of machines){if(visited.has(start.id)||['farm','wagon'].includes(start.kind))continue;const group=[],queue=[start];visited.add(start.id);while(queue.length){const m=queue.shift();group.push(m);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const n=adjacent(m,dx,dy);if(n&&!['farm','wagon'].includes(n.kind)&&!visited.has(n.id)){visited.add(n.id);queue.push(n);}}}
  let energy=0;for(const m of group)if(m.kind==='generator'){m.fuelSeconds=m.fuelSeconds||0;if(m.fuelSeconds<=0&&m.buffer.wood>0){m.buffer.wood--;m.fuelSeconds=20;}if(m.fuelSeconds>0){energy+=8*dt;m.fuelSeconds=Math.max(0,m.fuelSeconds-dt);m.status='working';}else m.status='fuel';}
  const batteries=group.filter(m=>m.kind==='battery'),consumers=group.filter(m=>['drill','furnace','arm','sorter'].includes(m.kind));for(const m of consumers){const need=(m.kind==='drill'?3:m.kind==='furnace'?2:1)*dt;if(energy<need)for(const b of batteries){const take=Math.min(b.energy||0,need-energy);b.energy-=take;energy+=take;}if(energy+1e-9>=need){energy-=need;m.powered=true;}else m.status='power';}
  for(const b of batteries){const stored=Math.min(60-(b.energy||0),energy);b.energy=(b.energy||0)+stored;energy-=stored;b.status=b.energy>0?'charged':'empty';}
 }
 // Fixed cadence prevents fast machines from producing more on high frame rates.
 room.machineClock=(room.machineClock||0)+dt;const steps=Math.floor((room.machineClock+1e-8)/.5);room.machineClock-=steps*.5;
 for(const m of machines){if(m.kind==='farm'){m.progress=(m.progress||0)+dt;if(m.progress>=20&&m.buffer.food<10){m.progress-=20;m.buffer.food++;}m.status=m.buffer.food>=10?'full':'growing';}
  if(m.kind==='furnace'&&m.powered){if(m.buffer.iron>=2&&m.buffer.wood>=1){m.progress+=dt;if(m.progress>=3){m.progress-=3;m.buffer.iron-=2;m.buffer.wood--;m.buffer.steel=(m.buffer.steel||0)+1;}m.status='working';}else{m.progress=0;m.status='materials';}}
 }
 for(let step=0;step<Math.min(4,steps);step++){
  const transfers=[];for(const m of machines){if(!['conveyor','arm','sorter'].includes(m.kind)||m.kind!=='conveyor'&&!m.powered)continue;const {x:dx,y:dy}=m.face||{x:0,y:1},source=m.kind==='arm'?adjacent(m,-dx,-dy):m,dest=adjacent(m,dx,dy);if(!source?.buffer||!dest?.buffer)continue;const resource=Object.keys(RESOURCES).find(id=>source.buffer[id]>0&&(m.kind!=='sorter'||m.filter===id));if(resource)transfers.push({source,dest,resource});}
  // Drills discharge behind the cutting head; furnaces discharge in front.
  for(const m of machines)if(['drill','furnace'].includes(m.kind)){const {x:dx,y:dy}=m.face||{x:0,y:1},sign=m.kind==='drill'?-1:1,dest=adjacent(m,dx*sign,dy*sign);const resource=Object.keys(RESOURCES).find(id=>m.buffer[id]>0&&(m.kind!=='furnace'||id==='steel'));if(dest?.kind==='conveyor'&&resource)transfers.push({source:m,dest,resource});}
  for(const {source,dest,resource}of transfers)if(source.buffer!==dest.buffer&&acceptsResource(dest,resource)&&source.buffer[resource]>0&&weight(dest.buffer)+RESOURCES[resource].weight<=bufferCapacity(dest)){source.buffer[resource]--;dest.buffer[resource]=(dest.buffer[resource]||0)+1;}
 }
}
