const registryKey='dm-saved-mines',legacyKey='dm-free-session',activeKey='dm-session';
function read(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}}
function valid(value){
 if(!value||typeof value!=='object'||!/^[A-F0-9]{6}$/.test(value.code)||!/^[a-f0-9]{36}$/.test(value.token)||value.id!==value.token.slice(0,8))return null;
 try{
  const url=new URL(value.server);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  return {code:value.code,token:value.token,id:value.id,server:url.origin,name:typeof value.name==='string'?value.name.slice(0,18):'',updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
 }catch{return null;}
}
const key=mine=>mine.server+'|'+mine.code;
export function createMineSessions(storage,activeStorage){
 let known=[];
 function reconnectKey(){
  let key=storage.getItem('dm-miner-key');
  if(!/^[a-f0-9]{64}$/.test(key||'')){
   key=Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
   storage.setItem('dm-miner-key',key);
  }
  if(storage.getItem('dm-miner-key')!==key)throw Error('Autorise le stockage du navigateur pour conserver ton personnage.');
  return key;
 }
 function list(){
  const saved=read(storage,registryKey),entries=[...known,...(Array.isArray(saved)?saved:[]),read(storage,legacyKey),read(activeStorage,activeKey)],mines=new Map();
  for(const entry of entries){const mine=valid(entry);if(!mine)continue;const previous=mines.get(key(mine));if(!previous||mine.updatedAt>previous.updatedAt)mines.set(key(mine),mine);}
  known=[...mines.values()].sort((a,b)=>b.updatedAt-a.updatedAt);return known.slice();
 }
 function remember(credentials,{name='',now=Date.now()}={}){
  const mine=valid({...credentials,name,updatedAt:now});if(!mine)throw Error('Connexion à la mine invalide.');
  const entries=[mine,...list().filter(previous=>key(previous)!==key(mine))];
  known=entries;
  storage.setItem(registryKey,JSON.stringify(entries));storage.setItem(legacyKey,JSON.stringify(mine));activeStorage.setItem(activeKey,JSON.stringify(mine));return mine;
 }
 function active(){return valid(read(activeStorage,activeKey));}
 function forget(code,server){
  const target=new URL(server).origin+'|'+code,entries=list().filter(mine=>key(mine)!==target);
  storage.setItem(registryKey,JSON.stringify(entries));
  const legacy=valid(read(storage,legacyKey));if(legacy&&key(legacy)===target)storage.removeItem(legacyKey);
  const current=active();if(current&&key(current)===target)clearActive();known=entries;
 }
 function clearActive(){activeStorage.removeItem(activeKey);}
 function find(code,server){try{return list().find(mine=>mine.code===code&&mine.server===new URL(server).origin)||null;}catch{return null;}}
 try{const imported=list();if(imported.length)storage.setItem(registryKey,JSON.stringify(imported));}catch{}
 return {list,remember,active,clearActive,find,reconnectKey,forget};
}
