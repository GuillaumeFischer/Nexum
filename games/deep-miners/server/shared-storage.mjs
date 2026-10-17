import {emptyStock} from '../client/progression.js';
// Legacy chest contents move once into the canonical common stock. Chests
// never persist aliases of this stock, so reloads cannot duplicate resources.
export function normalizeSharedStorage(room){
 room.stock??=emptyStock();for(const m of room.installations||[])if(m.kind==='stove')m.buffer??=emptyStock();
 for(const chest of room.installations||[])if(chest.kind==='chest'&&!chest.shared){
  for(const [id,n]of Object.entries(chest.buffer||{}))if(Number.isFinite(n)&&n>0)room.stock[id]=(room.stock[id]||0)+n;
  chest.buffer=emptyStock();chest.shared=true;
 }
 return room.stock;
}
export function storageBuffer(room,machine){return machine.kind==='chest'?normalizeSharedStorage(room):machine.buffer;}
