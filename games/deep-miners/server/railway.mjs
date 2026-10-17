import {railIndex,advanceRailVehicle,findRailRoute,railStops,ridersOf,WAGON_SEATS} from '../client/railway.js';
import {canMove} from '../client/physics.js';
import {MACHINE_REACH} from '../client/machine-profile.js';
const fields=['railFrom','railTo','railProgress'];
function normalizeRiders(wagon){wagon.riderIds=[...new Set(ridersOf(wagon))];wagon.riderId=wagon.riderIds[0]||null;return wagon.riderIds;}
function stop(wagon){wagon.automatic=false;wagon.destination=null;wagon.route=[];wagon.waitSeconds=0;wagon.moving=false;}
export function releaseRider(room,p,forced=false){
 const wagon=room.installations.find(w=>w.kind==='wagon'&&w.id===p.vehicleId);
 if(!wagon){delete p.vehicleId;delete p.vehicleDriver;delete p.vehicleAutomatic;for(const key of fields)delete p[key];return;}
 const d=wagon.face||{x:0,y:1},spots=[{x:wagon.x+d.y*.9,y:wagon.y-d.x*.9},{x:wagon.x-d.y*.9,y:wagon.y+d.x*.9},{x:wagon.x-d.x*.9,y:wagon.y-d.y*.9},{x:wagon.x,y:wagon.y}];
 const spot=spots.find(s=>canMove(room,s.x,s.y));if(!spot&&!forced)throw Error('Aucun espace libre pour descendre.');
 Object.assign(p,spot||{x:wagon.x,y:wagon.y},{input:{},moving:false,revealCell:null});delete p.vehicleId;delete p.vehicleDriver;delete p.vehicleAutomatic;delete p.destination;delete p.route;for(const key of fields)delete p[key];wagon.riderIds=normalizeRiders(wagon).filter(id=>id!==p.id);wagon.riderId=wagon.riderIds[0]||null;stop(wagon);wagon.status='idle';
}
export function wagonCommand(room,p,msg){
 const wagon=room.installations.find(w=>w.kind==='wagon'&&w.id===msg.id);if(!wagon||Math.hypot(wagon.x-p.x,wagon.y-p.y)>MACHINE_REACH)throw Error('Approche-toi du wagon.');
 const riders=normalizeRiders(wagon);
 if(msg.action==='board'){
  if(p.vehicleId)throw Error('Descends de ton wagon avant de monter dans un autre.');if(riders.length>=WAGON_SEATS)throw Error('Ce wagon est complet (6 mineurs).');
  stop(wagon);riders.push(p.id);wagon.riderId=riders[0];wagon.status='riding';p.vehicleId=wagon.id;p.vehicleDriver=wagon.riderId===p.id;p.vehicleAutomatic=false;p.x=wagon.x;p.y=wagon.y;p.face={...(wagon.face||p.face)};p.input={};p.moving=false;p.revealCell=null;for(const key of fields)p[key]=wagon[key];return;
 }
 if(msg.action==='exit'){if(p.vehicleId!==wagon.id||!riders.includes(p.id))throw Error('Tu n’es pas à bord de ce wagon.');releaseRider(room,p);return;}
 if(msg.action==='route'){
  if(p.vehicleId!==wagon.id||!riders.includes(p.id))throw Error('Monte dans le wagon pour choisir une destination.');
  const target=room.installations.find(r=>r.kind==='rail'&&r.id===msg.stopId),stops=railStops(room);if(!target||!stops.some(s=>s.id===target.id))throw Error('Cet arrêt n’existe plus.');
  const route=findRailRoute(room,wagon,target);if(!route)throw Error('Cet arrêt n’est pas relié à ton wagon.');
  wagon.route=route;wagon.destination={x:Math.floor(target.x),y:Math.floor(target.y)};wagon.automatic=true;wagon.arrived=false;wagon.waitSeconds=0;for(const id of riders)room.players.get(id).input={};return;
 }
 if(!['start','stop'].includes(msg.action))throw Error('Commande du wagon inconnue.');
 if(riders.length&&p.vehicleId!==wagon.id)throw Error('Monte dans le wagon pour changer son trajet.');stop(wagon);wagon.automatic=msg.action==='start';wagon.arrived=false;wagon.status=wagon.automatic?'working':'idle';
}
export function railwayStep(room,dt,now){
 const tracks=railIndex(room);
 for(const wagon of room.installations.filter(s=>s.kind==='wagon')){
  for(const id of [...normalizeRiders(wagon)]){const p=room.players.get(id);if(!p||!p.alive||p.vehicleId!==wagon.id){if(p&&p.vehicleId===wagon.id)releaseRider(room,p,true);else {wagon.riderIds=wagon.riderIds.filter(r=>r!==id);wagon.riderId=wagon.riderIds[0]||null;}}}
  const current=room.players.get(wagon.riderId);if(!current?.connected)wagon.riderId=wagon.riderIds.find(id=>room.players.get(id)?.connected)||wagon.riderIds[0]||null;
  const driver=room.players.get(wagon.riderId),active=driver?.alive&&driver.connected&&now-driver.lastSeen<600,input=active?driver.input:{};
  if(wagon.automatic&&Object.entries(input||{}).some(([k,v])=>['up','down','left','right'].includes(k)&&v))stop(wagon);
  advanceRailVehicle(room,wagon,input,dt,wagon.automatic,tracks);
  wagon.status=wagon.arrived?'arrived':wagon.automatic?'working':wagon.riderId?'riding':'idle';
  for(const id of wagon.riderIds){const rider=room.players.get(id);rider.x=wagon.x;rider.y=wagon.y;rider.face={...(wagon.face||rider.face)};rider.moving=wagon.moving;rider.vehicleDriver=id===wagon.riderId;rider.vehicleAutomatic=!!wagon.automatic;rider.destination=wagon.destination;rider.route=wagon.route?.slice(0,5);for(const key of fields)rider[key]=wagon[key];}
 }
}
