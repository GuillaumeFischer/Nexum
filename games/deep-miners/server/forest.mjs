import {biomeAt} from '../client/world.js';
export const WOOD_REGROW_MS=10*60*1000;

export function woodRegrowthFor(world,key,data,original,now=Date.now()){
 const pending={},[cx,cy]=key.split(',').map(Number);
 for(const [index,tile]of Object.entries(data.edits||{})){
  const i=Number(index);if(!Number.isInteger(i)||i<0||i>=256||tile===8)continue;
  const saved=data.woodRegrowth?.[i],x=cx*16+i%16,y=cy*16+Math.floor(i/16);
  if((!Number.isFinite(saved)&&(original[i]!==8||tile!==0))||biomeAt(world,x,y).id!=='forest')continue;
  pending[i]=Number.isFinite(saved)&&saved>0?saved:now+WOOD_REGROW_MS;
 }
 return pending;
}

export function scheduleWood(room,chunk,index,x,y,now=Date.now()){
 if(biomeAt(room.world,x,y).id==='forest')chunk.woodRegrowth[index]=now+WOOD_REGROW_MS;
}

export function forestStep(room,now){
 if(!room._world||now<(room.forestCheckAt||0))return;
 room.forestCheckAt=now+1000;
 for(const [key,chunk]of room._world.chunks){
  const [cx,cy]=key.split(',').map(Number);
  for(const [index,due]of Object.entries(chunk.woodRegrowth)){
   if(now<due)continue;const i=Number(index),x=cx*16+i%16,y=cy*16+Math.floor(i/16);
   if(chunk.tiles[i]!==0)continue;
   // A returning tree must never trap a miner or replace a field, route or base.
   if([...room.players.values()].some(p=>p.x+.24>x&&p.x-.24<x+1&&p.y+.24>y&&p.y-.24<y+1))continue;
   if(room.installations.some(s=>Math.abs(s.x-(x+.5))<1&&Math.abs(s.y-(y+.5))<1))continue;
   if(room.structures.some(s=>s.colliders?.some(b=>x+1>b.x&&x<b.x+b.w&&y+1>b.y&&y<b.y+b.h)))continue;
   room.tiles[y][x]=8;delete chunk.woodRegrowth[i];room.damage.delete(`${x},${y}`);room.mapVersion++;room.revision++;
  }
 }
}
