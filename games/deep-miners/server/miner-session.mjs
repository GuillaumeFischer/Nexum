import {createHash} from 'node:crypto';
import {addPlayer} from './game.mjs';

function reconnectHash(room,key){
 if(key===undefined)return null;
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))throw Error('Connexion du personnage invalide.');
 return createHash('sha256').update(room.code+':'+key).digest('hex');
}
export function bindMinerSession(room,player,key){
 const hash=reconnectHash(room,key);if(!hash)return;
 const previous=[...room.players.values()].find(p=>p.reconnectHash===hash);
 if(previous&&previous!==player)throw Error('Ce navigateur possède déjà un personnage dans cette mine. Reprends sa connexion enregistrée.');
 player.reconnectHash=hash;
}
export function findMinerSession(room,body){
 const hash=reconnectHash(room,body.reconnectKey);
 let player;
 if(body.token!==undefined){
  if(typeof body.token!=='string'||!/^[a-f0-9]{36}$/.test(body.token)||!room.players.has(body.token))throw Error('Session du personnage expirée. Aucun nouveau mineur créé.');
  player=room.players.get(body.token);
 }else if(hash)player=[...room.players.values()].find(p=>p.reconnectHash===hash);
 return player||null;
}
export function enterMiner(room,body){
 const hash=reconnectHash(room,body.reconnectKey);let player=findMinerSession(room,body);
 if(!player){player=addPlayer(room,body.name);if(hash)player.reconnectHash=hash;}
 else bindMinerSession(room,player,body.reconnectKey);
 return {code:room.code,token:player.id,id:player.id.slice(0,8)};
}
