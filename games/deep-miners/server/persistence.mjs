import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {makeRoom} from './game.mjs';
import {attachWorld,savedChunks} from './world.mjs';
import {normalizeMiner} from './survival.mjs';
export function serializeRooms(rooms){return {version:1,rooms:[...rooms.values()].filter(r=>r.mode==='free').map(r=>{const {tiles,seen,...metadata}=r;return {...metadata,...(r.world?{worldChunks:savedChunks(r)}:{tiles,seen}),players:[...r.players.values()].map(({input,connected,lastSeen,...p})=>({...p,input:{},connected:false,lastSeen:0})),damage:[...r.damage],audioEvents:[]};})};}
export function restoreRooms(data,now=Date.now()){
 if(data.version!==1||!Array.isArray(data.rooms)||data.rooms.length>100)throw Error('Sauvegarde de mine incompatible.');
 return data.rooms.map(saved=>{
  if(!/^[A-F0-9]{6}$/.test(saved.code)||saved.mode!=='free'||(saved.world? saved.world.generator!==1||saved.world.width!==4096||saved.world.height!==4096||!Array.isArray(saved.worldChunks):!Array.isArray(saved.tiles)||saved.tiles.length!==55||saved.tiles.some(row=>!Array.isArray(row)||row.length!==35||row.some(t=>!Number.isInteger(t)||t<0||t>9)))||!Array.isArray(saved.players)||saved.players.length>6)throw Error('Sauvegarde de mine invalide.');
  const room=makeRoom(saved.code,saved.practice,'free');Object.assign(room,saved,{damage:new Map(saved.damage),players:new Map(),audioEvents:[]});
  if(room.world)attachWorld(room,saved.worldChunks);
  for(const p of saved.players){if(!/^[a-f0-9]{36}$/.test(p.id))throw Error('Session sauvegardée invalide.');room.players.set(p.id,normalizeMiner({...p,connected:false,lastSeen:now,input:{},moving:false,mine:0,revealCell:null,inputSeq:p.ackSeq||0}));}
  return room;
 });
}
export function fileStorage(file){
 return {load(){try{return restoreRooms(JSON.parse(readFileSync(file,'utf8')));}catch(e){if(e.code==='ENOENT')return [];throw Error('Impossible de charger la sauvegarde : '+e.message);}},save(rooms){mkdirSync(dirname(file),{recursive:true});const temporary=file+'.tmp';writeFileSync(temporary,JSON.stringify(serializeRooms(rooms)),{mode:0o600});renameSync(temporary,file);}};
}
