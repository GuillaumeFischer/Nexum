import {randomBytes} from 'node:crypto';
import {makeRoom,start,tick,snapshot,escape,craftItem,placeItem,recoverMiner,dismantleItem,manageColony} from './game.mjs';
import {chunkPacket} from './world.mjs';
import {COLONY_COMMANDS} from './commands.mjs';
import {enterMiner,bindMinerSession} from './miner-session.mjs';
import {listMines,manageMine} from './mine-management.mjs';

export function createRuntime({mode='free',storage=null,minimumPlayers=3}={}){
  const rooms=new Map(),peers=new Map(),maps=new WeakMap(),sentMaps=new WeakMap(),sentAudio=new WeakMap();
  for(const room of storage?.load()||[]){room.minimumPlayers=minimumPlayers;rooms.set(room.code,room);}
  const persist=()=>storage?.save(rooms);let saveSteps=0;
  const auth=({code,token})=>{const room=rooms.get(code),player=room?.players.get(token);if(!player)throw Error('Session expirée. Rejoignez un salon.');return {room,player};};
  function broadcast(room){
    if(room.world){
      const state=snapshot(room);for(const p of room.players.values()){const peer=peers.get(p.id);if(!peer)continue;const result=chunkPacket(state,sentMaps.get(peer)?.chunks,p);peer.send({type:'state',state:result.packet});sentMaps.set(peer,{chunks:result.cursor});const cursor=sentAudio.get(peer),events=cursor!==undefined?room.audioEvents.filter(e=>e.seq>cursor):[];if(events.length)peer.send({type:'sounds',code:room.code,round:room.round,events});sentAudio.set(peer,room.audioSeq);}return;
    }
    let map=maps.get(room);
    if(!map||map.version!==room.mapVersion||map.round!==room.round){
      const full=snapshot(room),changes=[];
      if(map&&map.round===room.round)for(let y=0;y<full.tiles.length;y++)for(let x=0;x<full.tiles[y].length;x++)if(map.tiles[y][x]!==full.tiles[y][x])changes.push([y*full.tiles[y].length+x,full.tiles[y][x]]);
      map={tiles:full.tiles,structures:full.structures,version:room.mapVersion,round:room.round,base:map?.version,changes};maps.set(room,map);
    }
    const state=snapshot(room,false);
    for(const p of room.players.values()){
      const peer=peers.get(p.id);if(!peer)continue;const sent=sentMaps.get(peer);
      let update={};
      if(!sent||sent.round!==map.round||sent.version!==map.version){
        update=sent&&sent.round===map.round&&sent.version===map.base?{mapBase:map.base,changes:map.changes,structures:map.structures}:{tiles:map.tiles,structures:map.structures};
      }
      peer.send({type:'state',state:{...state,...update}});sentMaps.set(peer,{round:map.round,version:map.version});
      const cursor=sentAudio.get(peer),events=cursor!==undefined?room.audioEvents.filter(e=>e.seq>cursor):[];
      if(events.length)peer.send({type:'sounds',code:room.code,round:room.round,events});
      sentAudio.set(peer,room.audioSeq);
    }
  }
  function enter(type,body){
    if(typeof body.name!=='string'||!body.name.trim())throw Error('Choisissez un pseudo.');let room;
    if(type==='create'){if(rooms.size>=100)throw Error('Serveur plein.');let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));room=makeRoom(code,body.practice===true,mode,mode==='free'?randomBytes(8).toString('hex'):null);room.minimumPlayers=minimumPlayers;rooms.set(code,room);}
    else{room=rooms.get(String(body.code).toUpperCase());if(!room)throw Error('Code de salon inconnu.');}
    const credentials=enterMiner(room,body);if(type==='create')room.owner=credentials.token;persist();broadcast(room);return credentials;
  }
  function attach(credentials,peer){
    const {room,player}=auth(credentials);bindMinerSession(room,player,credentials.reconnectKey);persist();const previous=peers.get(player.id);peers.set(player.id,peer);sentMaps.delete(peer);sentAudio.set(peer,room.audioSeq);previous?.close(1000);
    player.connected=true;player.lastSeen=Date.now();player.input={};player.inputSeq=player.ackSeq;player.ackInputSeconds=0;broadcast(room);return {room,player};
  }
  function detach(player,peer){if(peers.get(player.id)!==peer)return;peers.delete(player.id);sentMaps.delete(peer);player.connected=false;player.input={};player.lastSeen=Date.now();}
  function command(room,player,msg){
    player.lastSeen=Date.now();
    if(msg.type==='input'){
      if(msg.sequence!==undefined){if(!Number.isSafeInteger(msg.sequence)||msg.sequence<0||msg.sequence<=player.inputSeq)return;player.inputSeq=msg.sequence;}
      const i=msg.input||{};player.input=Object.fromEntries(['up','down','left','right','mine','use','sprint'].map(k=>[k,i[k]===true]));
    }else if(msg.type==='start')start(room,player.id);
    else if(msg.type==='escape')escape(room,player);
    else if(msg.type==='craft')craftItem(room,player,msg.recipe);
    else if(msg.type==='place')placeItem(room,player,msg.kind,msg.target);
    else if(msg.type==='dismantle')dismantleItem(room,player);
    else if(msg.type==='recover')recoverMiner(room,player);
    else if(COLONY_COMMANDS.has(msg.type))manageColony(room,player,msg);
    else if(msg.type==='sync'){const peer=peers.get(player.id);if(peer)sentMaps.delete(peer);}
    else if(msg.type==='save'){}
    else if(msg.type==='leave'){const peer=peers.get(player.id);peers.delete(player.id);room.players.delete(player.id);peer?.close();if(room.host===player.id)room.host=room.players.keys().next().value||null;}
    else throw Error('Commande inconnue.');
    if(msg.type!=='input'){persist();broadcast(room);}
  }
  function step(dt,now=Date.now()){
    for(const [code,room]of rooms){
      tick(room,dt,now);
      for(const p of room.players.values()){
        if(p.connected&&now-p.lastSeen>10000)peers.get(p.id)?.close(1001);
        if(room.mode!=='free'&&!p.connected&&now-p.lastSeen>120000){room.players.delete(p.id);if(room.host===p.id)room.host=room.players.keys().next().value||null;}
      }
      if(!room.players.size&&room.mode!=='free')rooms.delete(code);else broadcast(room);
    }
    if(++saveSteps>=100){persist();saveSteps=0;}
  }
  function manage(body){
    if(body.action==='list')return listMines([...rooms.values()].map(room=>({room,updatedAt:new Date(room.created).toISOString()})),body);
    const room=rooms.get(body.code);if(!room)throw Error('Code de salon inconnu.');const result=manageMine(room,body);
    if(body.action==='delete'){rooms.delete(room.code);for(const player of room.players.values()){peers.get(player.id)?.close(1000);peers.delete(player.id);}}
    persist();return result;
  }
  return {rooms,peers,auth,enter,attach,detach,command,step,broadcast,persist,manage};
}
