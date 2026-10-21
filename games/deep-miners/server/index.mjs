import {fileStorage} from './persistence.mjs';
import http from 'node:http';
import {SOUND_ASSETS} from '../client/sound-catalog.js';
const soundFiles=new Set(Object.values(SOUND_ASSETS).map(s=>s.file));
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRuntime} from './runtime.mjs';
import {acceptKey,connectSocket} from './websocket.mjs';
export function createServer({mode='free',storagePath=null,launcher=false}={}){
 const game=createRuntime({mode,minimumPlayers:launcher?1:3,storage:storagePath?fileStorage(storagePath):null}),sockets=new Set(),limits=new Map();
 const origins=(process.env.ALLOWED_ORIGINS||'http://localhost:3001,http://127.0.0.1:3001').split(',').map(s=>s.trim());
 const allowed=origin=>!origin||origins.includes(origin)||launcher&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
 function rate(ip,max=100){const now=Date.now();let l=limits.get(ip);if(!l||now-l.time>1000){l={time:now,n:0};limits.set(ip,l);}return ++l.n<=max;}
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),origin=req.headers.origin;
  const json=(status,b)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(b));};
  if(!allowed(origin))return json(403,{error:'Origine non autorisée.'});if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  try{
   if(req.method==='GET'&&url.pathname==='/health')return json(200,{ok:true,rooms:game.rooms.size});
   if(req.method==='POST'&&['/api/create','/api/join','/api/mines'].includes(url.pathname)){if(!rate(req.socket.remoteAddress,12))return json(429,{error:'Patientez avant de créer un autre salon.'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>(url.pathname==='/api/mines'?16384:2048))return json(413,{error:'Message trop volumineux.'});}return json(200,url.pathname==='/api/mines'?game.manage(JSON.parse(raw)):game.enter(url.pathname.slice(5),JSON.parse(raw)));}
   if(req.method==='GET'){
    const p=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(p.includes('..')||!/^([a-z0-9-]+\.js|index\.html|style\.css|assets\/[a-zA-Z0-9_./-]+\.(png|webp|mp3|wav|ico))$/.test(p))return json(404,{error:'Introuvable.'});
    const data=await readFile(new URL(`../client/${p}`,import.meta.url));res.writeHead(200,{'Content-Type':p.endsWith('.wav')?'audio/wav':p.endsWith('.mp3')?'audio/mpeg':p.endsWith('.webp')?'image/webp':p.endsWith('.png')?'image/png':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.css')?'text/css':'text/javascript','Cache-Control':/\.(png|mp3|wav)$/.test(p)?'public, max-age=3600':'no-cache'});return res.end(data);
   }return json(404,{error:'Introuvable.'});
  }catch(e){json(400,{error:e instanceof SyntaxError?'Message invalide.':e.message});}
 });
 server.on('upgrade',(req,socket,head)=>{
  const key=req.headers['sec-websocket-key'];
  if(req.url!=='/ws'||!allowed(req.headers.origin)||req.headers['sec-websocket-version']!=='13'||!key||!/^[A-Za-z0-9+/]{22}==$/.test(key)||!rate(req.socket.remoteAddress,100)||sockets.size>=600){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`);socket.setNoDelay(true);sockets.add(socket);
  let joined=null,count=0,windowStart=Date.now(),peer;
  const timeout=setTimeout(()=>{if(!joined)peer.close(1008);},5000);timeout.unref();
  peer=connectSocket(socket,head,msg=>{
   const now=Date.now();if(now-windowStart>1000){windowStart=now;count=0;}if(++count>60){peer.close(1008);return;}
   try{if(!joined){if(msg.type!=='auth')throw Error('Authentification requise.');joined=game.attach(msg,peer);clearTimeout(timeout);peer.send({type:'ready'});}else if(msg.type==='ping'){peer.send({type:'pong',sent:msg.sent});}else{game.command(joined.room,joined.player,msg);if(msg.type!=='input')peer.send({type:'ack',requestId:msg.requestId});}}catch(e){peer.send({type:'error',error:e.message,requestId:msg.requestId});}
  },()=>{clearTimeout(timeout);sockets.delete(socket);if(joined)game.detach(joined.player,peer);});
 });
 let last=Date.now(),steps=0;const timer=setInterval(()=>{const now=Date.now();game.step(Math.min(.2,(now-last)/1000),now);last=now;if(++steps%300===0){for(const p of game.peers.values())p.ping();for(const [ip,l]of limits)if(now-l.time>60000)limits.delete(ip);}},1000/20);
 server.on('close',()=>clearInterval(timer));
 return {server,rooms:game.rooms,game,close(){try{game.persist();}finally{clearInterval(timer);for(const s of sockets)s.destroy();server.close();server.closeAllConnections();}}};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){const app=createServer({storagePath:process.env.SAVE_FILE||fileURLToPath(new URL('./data/rooms.json',import.meta.url))}),port=Number(process.env.PORT)||3001;app.server.listen(port,'0.0.0.0',()=>console.log(`Deep Miners 0.13.13 — Exploration libre : http://localhost:${port}`));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{app.close();process.exit(0);});}


