import {findMinerSession} from './miner-session.mjs';
import path from 'node:path';import fs from 'node:fs/promises';import {createServer} from './index.mjs';
export async function listMines(saveDir){try{const data=JSON.parse(await fs.readFile(path.join(saveDir,'rooms.json'),'utf8'));return data.rooms.map(r=>({id:r.code,title:r.mineName||'Mine '+r.code,players:r.players.length,solo:r.practice}));}catch(e){if(e.code==='ENOENT')return [];throw Error('La sauvegarde ne peut pas être lue. Elle a été conservée.');}}
export async function host({saveDir,name,identity,mineId,solo}){
 const app=createServer({storagePath:path.join(saveDir,'rooms.json'),launcher:true});
 try{await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});let credentials;
  if(mineId){const room=app.rooms.get(mineId);if(!room)throw Error('Mine sauvegardée introuvable.');const previous=findMinerSession(room,{reconnectKey:identity});if(!previous||room.owner!==previous.id)throw Error('Cette mine appartient à un autre profil.');credentials=app.game.enter('join',{code:mineId,name,reconnectKey:identity});}
  else credentials=app.game.enter('create',{name,practice:solo,reconnectKey:identity});
  const port=app.server.address().port;return {port,mineId:credentials.code,bootstrap:{...credentials,name,reconnectKey:identity},join(guestName,key){const guest=app.game.enter('join',{code:credentials.code,name:guestName,reconnectKey:key});return {...guest,name:guestName,reconnectKey:key};},async close(){app.close();}};
 }catch(e){app.close();throw e;}
}
