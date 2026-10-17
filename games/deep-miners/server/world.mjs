import {woodRegrowthFor,scheduleWood} from './forest.mjs';
import {randomBytes} from 'node:crypto';
import {gridView,generateChunk,landmark,chunkKey,chunkKeysAround,biomeAt,WORLD_SIZE} from '../client/world.js';
export function newWorld(seed=randomBytes(8).toString('hex')){return {generator:1,seed,width:WORLD_SIZE,height:WORLD_SIZE,size:16,atlas:{}};}
export function attachWorld(room,saved=[]){
 if(!room.world)return;
 const chunks=new Map(),dirty=new Set();Object.defineProperty(room,'_world',{value:{chunks,dirty},writable:true,configurable:true,enumerable:false});
 for(const [key,data]of saved)loadChunk(room,key,data);
 room.tiles=gridView(room.world.width,room.world.height,(x,y)=>{const c=ensureChunk(room,chunkKey(x,y));return c.tiles[(y%16)*16+x%16];},(x,y,t)=>{const key=chunkKey(x,y),c=ensureChunk(room,key),i=(y%16)*16+x%16;if(c.tiles[i]===t)return;if(c.tiles[i]===8&&t===0)scheduleWood(room,c,i,x,y);c.tiles[i]=t;c.edits[i]=t;c.version++;dirty.add(key);});
 room.seen=gridView(room.world.width,room.world.height,(x,y)=>ensureChunk(room,chunkKey(x,y)).seen.has((y%16)*16+x%16),(x,y,value)=>{if(!value)return;const key=chunkKey(x,y),c=ensureChunk(room,key),i=(y%16)*16+x%16;if(c.seen.has(i))return;c.seen.add(i);c.version++;dirty.add(key);if(!room.world.atlas[key])room.world.atlas[key]={biome:biomeAt(room.world,x,y).id};});
}
export function loadChunk(room,key,data={}){const [cx,cy]=key.split(',').map(Number),original=generateChunk(room.world,cx,cy),tiles=[...original];for(const [i,t]of Object.entries(data.edits||{}))tiles[Number(i)]=t;const woodRegrowth=woodRegrowthFor(room.world,key,data,original);if(JSON.stringify(woodRegrowth)!==JSON.stringify(data.woodRegrowth||{}))room._world.dirty.add(key);const c={tiles,woodRegrowth,edits:data.edits||{},seen:new Set(data.seen||[]),claimed:data.claimed||false,version:data.version||0};room._world.chunks.set(key,c);return c;}
export function ensureChunk(room,key){return room._world.chunks.get(key)||loadChunk(room,key);}
export function chunkData(c){return {edits:c.edits,woodRegrowth:c.woodRegrowth,seen:[...c.seen],claimed:c.claimed,version:c.version};}
export function savedChunks(room){return room._world?[...room._world.chunks].filter(([k,c])=>c.seen.size||Object.keys(c.edits).length||c.claimed).map(([k,c])=>[k,chunkData(c)]):[];}
export function activeKeys(room){const keys=new Set();for(const p of room.players.values())for(const key of chunkKeysAround(room.world,p))keys.add(key);for(const s of room.installations||[])if(s.kind==='drill'||s.kind==='wagon'&&s.automatic)for(const key of chunkKeysAround(room.world,s,1))keys.add(key);return [...keys];}
export function refreshScenery(room){if(!room.world)return;const structures=room.structures.filter(s=>s.kind==='lift');for(const key of activeKeys(room)){const [cx,cy]=key.split(',').map(Number),f=landmark(room.world,cx,cy);if(f?.kind!=='ruin')continue;const x=Math.floor(f.x),y=Math.floor(f.y)-1;structures.push({id:`ruin-arch-${key}`,kind:'arch',anchor:{x,y},x:x-1.3,y:y-.9,w:3.6,h:2.3,depth:y+1.23,colliders:[{x:x-.88,y:y+.7,w:.4,h:.62},{x:x+1.25,y:y+.7,w:.4,h:.62}]},{id:`ruin-pipe-${key}`,kind:'pipe',anchor:{x:x+2,y},x:x+1.7,y:y-.2,w:1.2,h:1.6,depth:y+1.3,colliders:[]});}room.structures=structures;}
export function worldSnapshot(room,player){
 refreshScenery(room);
 const keys=player?chunkKeysAround(room.world,player):activeKeys(room),chunks=[],landmarks=[];
 for(const key of keys){const c=ensureChunk(room,key),[cx,cy]=key.split(',').map(Number);chunks.push({key,version:c.version,tiles:c.tiles.map((t,i)=>c.seen.has(i)?t:-1)});const f=landmark(room.world,cx,cy);if(f&&!c.claimed&&c.seen.has((Math.floor(f.y)%16)*16+Math.floor(f.x)%16))landmarks.push(f);}
 return {world:room.world,chunks,landmarks,structures:room.structures.filter(s=>room.seen[s.anchor.y]?.[s.anchor.x])};
}
export function claimTreasure(room,p){const key=chunkKey(p.x,p.y),[cx,cy]=key.split(',').map(Number),f=landmark(room.world,cx,cy);if(!f||Math.hypot(p.x-f.x,p.y-f.y)>1.7)return null;const c=ensureChunk(room,key);if(c.claimed)return null;c.claimed=true;c.version++;room._world.dirty.add(key);room.coins=(room.coins||0)+40+biomeAt(room.world,p.x,p.y).tier*30;return f;}
export function chunkPacket(state,previous,player){
 const keys=new Set(chunkKeysAround(state.world,player)),chunks=state.chunks.filter(c=>keys.has(c.key)),updates=chunks.filter(c=>previous?.get(c.key)!==c.version);
 const installations=state.installations?.filter(s=>keys.has(chunkKey(s.x,s.y))||s.id===player.vehicleId);
 const {railMap,baseMap,...rest}=state,cursor=new Map(chunks.map(c=>[c.key,c.version]));cursor.set('@rails',state.railVersion);
 return {packet:{...rest,...(previous?.get('@rails')!==state.railVersion?{railMap,baseMap}:{}),...(installations?{installations}:{}),chunks:updates,activeChunks:chunks.map(c=>c.key)},cursor};
}

