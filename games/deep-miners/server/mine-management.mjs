import {findMinerSession} from './miner-session.mjs';
export function mineOwner(room){return room.owner||room.host;}
export function mineInfo(room,player,updatedAt){return {code:room.code,title:room.mineName||'Mine '+room.code,practice:room.practice,phase:room.phase,players:room.players.size,updatedAt,canManage:mineOwner(room)===player.id,token:player.id,id:player.id.slice(0,8)};}
export function managedMiner(room,body){const player=findMinerSession(room,body);if(!player)throw Error('Accès à cette mine refusé.');return player;}
export function manageMine(room,body){
 const player=managedMiner(room,body);if(mineOwner(room)!==player.id)throw Error('Seul le créateur peut gérer cette mine.');
 if(body.action==='rename'){
  if(typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>40||/[\x00-\x1f]/.test(body.title))throw Error('Choisis un nom de mine de 1 à 40 caractères.');
  room.mineName=body.title.trim();return {ok:true};
 }
 if(body.action==='delete'){if(body.confirm!==room.code)throw Error('Confirme la suppression de cette mine.');return {ok:true};}
 throw Error('Action de gestion inconnue.');
}
export function listMines(rows,body){
 if(!Array.isArray(body.credentials)||body.credentials.length>100)throw Error('Liste des mines invalide.');
 // Validate the browser key even if there are no rooms to inspect.
 findMinerSession({code:'000000',players:new Map()}, {reconnectKey:body.reconnectKey});
 const known=new Map();for(const credential of body.credentials){if(!credential||!/^[A-F0-9]{6}$/.test(credential.code)||!/^[a-f0-9]{36}$/.test(credential.token))throw Error('Connexion à la mine invalide.');known.set(credential.code,credential.token);}
 const mines=[],codes=new Set();for(const {room,updatedAt} of rows){codes.add(room.code);let player;
  const token=known.get(room.code);if(token&&room.players.has(token))player=room.players.get(token);
  else player=findMinerSession(room,{reconnectKey:body.reconnectKey});
  if(player)mines.push(mineInfo(room,player,updatedAt));
 }
 mines.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));return {mines,missing:[...known.keys()].filter(code=>!codes.has(code))};
}
