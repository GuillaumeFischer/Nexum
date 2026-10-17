import {quickbarSlot} from './quickbar-controls.js';
import {isFieldItem} from './agriculture.js';
import {createMineSessions} from './mine-sessions.js';
import {createMineMenu} from './mine-menu.js';
import {menuShortcut} from './ui-controls.js';
import {isPlaceable} from './placement.js';
import {createBaseUI} from './base-ui.js';
import {createColonyUI} from './colony-ui.js';
import {loadAssets,createRenderer} from './renderer.js';
import {applyState,createNetcode} from './netcode.js';
import {displaySize,createEffectQuality} from './display.js';
import {createMusic} from './music.js';
import {createSoundPlayer} from './sound-player.js';
import {createSoundDirector} from './sound-events.js';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),hudCanvas=$('hud'),hudContext=hudCanvas.getContext('2d');
const desktop=window.DEEP_MINERS_DESKTOP;if(desktop?.reconnectKey)localStorage.setItem('dm-miner-key',desktop.reconnectKey);
const mineSessions=createMineSessions(localStorage,sessionStorage);
const music=createMusic(new Audio('assets/deep-miners-intro.mp3'),localStorage,[$('music'),$('fullscreenMusic')]);
document.addEventListener('pointerdown',music.start,{capture:true});
document.addEventListener('keydown',music.start,{capture:true});
function soundStatus({enabled,volume,available}){for(const button of [$('sounds'),$('fullscreenSounds')]){button.textContent=available?(enabled?'Sons : oui':'Sons : non'):'Sons indisponibles';button.setAttribute('aria-pressed',String(enabled));button.disabled=!available;}$('soundVolume').value=Math.round(volume*100);$('soundVolumeValue').textContent=Math.round(volume*100)+' %';}
const soundPlayer=createSoundPlayer({onStatus:soundStatus}),soundDirector=createSoundDirector(soundPlayer);
let focused=true,reconnectAttempts=0,lastRadioAt=0,renderFailures=0,connectionTimer=null;
document.addEventListener('pointerdown',()=>void soundPlayer.start(),{capture:true});
document.addEventListener('keydown',()=>void soundPlayer.start(),{capture:true});
document.addEventListener('click',e=>{if(e.target.closest('button'))soundPlayer.play('ui');});
for(const button of [$('sounds'),$('fullscreenSounds')])button.onclick=()=>{soundPlayer.setEnabled(!soundPlayer.enabled);button.blur();};
$('soundVolume').oninput=e=>soundPlayer.setVolume(Number(e.target.value)/100);
addEventListener('blur',()=>{focused=false;soundDirector.pause();});addEventListener('focus',()=>{focused=true;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)soundDirector.pause();});
const effects=createEffectQuality();
let session=null,state=null,socket=null,connected=false,keys={},renderer=null,reconnectTimer=null,nextRequest=0,inputSequence=0,uiSignature='',syncPending=false;
const netcode=createNetcode(),heldCodes=new Set();
const pending=new Map(),base=()=>($('server').value.trim()||location.origin).replace(/\/$/,'');
$('server').value=window.DEEP_MINERS_CLOUD?location.origin:window.DEEP_MINERS_SERVER||localStorage.getItem('dm-server')||location.origin;
const hostedServerMissing=()=>!window.DEEP_MINERS_CLOUD&&window.DEEP_MINERS_HOSTED&&(!window.DEEP_MINERS_SERVER&&base()===location.origin||!/^https:\/\//i.test(base()));
function updateHostingStatus(){
 if(!window.DEEP_MINERS_HOSTED)return;
 let message=$('hostingMessage');
 if(!message){message=document.createElement('p');message.id='hostingMessage';message.setAttribute('role','status');$('practice').after(message);}
 const missing=hostedServerMissing();
 message.textContent=missing?'Le site est en ligne. Les salons et l’entraînement seront disponibles dès que le serveur du jeu sera connecté.':'';
 for(const id of ['create','join','practice'])$(id).disabled=missing;
 if(missing)status('Serveur du jeu à connecter');
 else if(!session)status('Prêt à descendre');
}
$('server').addEventListener('input',updateHostingStatus);
updateHostingStatus();
$('name').value=localStorage.getItem('dm-name')||'';
const settings={brightness:0.6,quality:localStorage.getItem('dm-quality')||'auto',resolution:localStorage.getItem('dm-resolution')||'screen',zoom:Number(localStorage.getItem('dm-zoom'))||1.1};
$('quality').value=settings.quality;$('zoom').value=settings.zoom;
$('resolution').value=settings.resolution;
$('resolution').onchange=e=>{settings.resolution=e.target.value;localStorage.setItem('dm-resolution',settings.resolution);};
$('quality').onchange=e=>{settings.quality=e.target.value;localStorage.setItem('dm-quality',settings.quality);};
$('zoom').oninput=e=>{settings.zoom=Number(e.target.value);localStorage.setItem('dm-zoom',settings.zoom);$('zoomValue').textContent=Math.round(settings.zoom*100)+' %';};
$('zoomValue').textContent=Math.round(settings.zoom*100)+' %';
const notice=message=>{ $('notice').textContent=message;$('gameNotice').textContent=message; };
const baseUI=createBaseUI({command,releaseKeys,notify:notice,closeColony:()=>colonyUI.close()});
const colonyUI=createColonyUI({command,releaseKeys,selectionChanged:refreshKeys,notify:notice,closeWorkshop:()=>baseUI.close(),openWorkshop:()=>baseUI.open()});
const mineMenu=createMineMenu({root:$('mineMenu'),registry:mineSessions,server:base,onResume:resumeMine,onChange:updateSavedMines,notify:notice,onOpen:()=>{releaseKeys();baseUI.close();colonyUI.close();},onDeleted:(code,origin)=>{if(session?.code===code&&base()===origin)reset();}});
$('openMineMenu').onclick=()=>mineMenu.open();
loadAssets().then(assets=>{renderer=createRenderer(assets);$('loading').hidden=true;}).catch(e=>{notice(e.message+' Rechargez la page.');$('loading').textContent='Chargement des graphismes interrompu.';});
function status(text,color='#dcb16d'){$('connection').textContent=text;$('lamp').style.background=color;}
function updateSavedMines(){
 const mines=mineSessions.list();$('resume').hidden=!mines.length;$('resume').textContent=mines.length?'Reprendre ma mine '+mines[0].code+' →':'Reprendre ma mine →';
 const list=$('savedMines');list.hidden=mines.length<2;list.replaceChildren();
 if(mines.length>1){const heading=document.createElement('p');heading.textContent='Autres mines sauvegardées';list.append(heading);for(const mine of mines.slice(1)){const button=document.createElement('button');button.type='button';button.className='saved-mine';button.textContent='Reprendre '+mine.code+(mine.name?' · '+mine.name:'');button.onclick=()=>resumeMine(mine);list.append(button);}}
}
function save(){if(session){try{mineSessions.remember({...session,server:base()},{name:state?.players.find(p=>p.id===session.id)?.name||$('name').value});updateSavedMines();}catch{notice('La mine est sauvegardée sur le serveur, mais sa connexion ne peut pas être mémorisée dans ce navigateur.');}}}
function reset(){reconnectAttempts=0;renderFailures=0;clearTimeout(connectionTimer);clearTimeout(reconnectTimer);const old=socket;socket=null;old?.close();session=null;state=null;connected=false;keys={};heldCodes.clear();netcode.reset();soundDirector.reset();inputSequence=0;uiSignature='';syncPending=false;baseUI.close();colonyUI.close();mineSessions.clearActive();updateSavedMines();$('session').hidden=true;$('welcome').hidden=false;status('Prêt à descendre');}
function resumeMine(saved){
 if(!saved)return;reset();session={code:saved.code,token:saved.token,id:saved.id};$('server').value=saved.server;if(saved.name)$('name').value=saved.name;$('welcome').hidden=true;$('session').hidden=false;$('roomCode').textContent=saved.code;$('overlay').hidden=false;$('resultTitle').textContent='Reprise de la mine '+saved.code;$('resultText').textContent='Connexion à ta sauvegarde…';$('teamList').replaceChildren();notice('Reprise de la mine '+saved.code+'…');connect();
}
function connect(){
 let reconnectKey;try{reconnectKey=mineSessions.reconnectKey();}catch{notice('Autorise le stockage du navigateur pour conserver ton personnage, puis reprends cette mine.');status('Connexion du personnage à mémoriser');return;}
 if(!session)return;clearTimeout(connectionTimer);clearTimeout(reconnectTimer);const wsURL=new URL(window.DEEP_MINERS_CLOUD?'/api/cloud':'/ws',base());wsURL.protocol=wsURL.protocol==='https:'?'wss:':'ws:';
 const ws=new WebSocket(wsURL);socket=ws;lastRadioAt=performance.now();status('Connexion à la radio…');
 const credentials={...session,reconnectKey};ws.onopen=()=>{if(socket===ws){try{ws.send(JSON.stringify({type:'auth',...credentials}));}catch{recoverRadio(ws);}}};
 connectionTimer=setTimeout(()=>{if(socket===ws&&!connected){recoverRadio(ws);try{ws.close();}catch{}}},10000);
 ws.onmessage=e=>{if(socket!==ws)return;let msg;try{msg=JSON.parse(e.data);if(!msg||typeof msg.type!=='string')return;}catch{return;}lastRadioAt=performance.now();if(msg.type==='state'&&(!msg.state||!Array.isArray(msg.state.players))){try{ws.send(JSON.stringify({type:'sync'}));}catch{ws.close();}return;}
  if(msg.type==='ready'){clearTimeout(connectionTimer);reconnectAttempts=0;connected=true;status('Radio connectée','#70cfd2');save();notice('');sendInput();}
  else if(msg.type==='state'){if(msg.state.code!==session.code){reset();notice('La radio a répondu pour une autre mine. Reprends la mine avec son code.');return;}try{state=applyState(state,msg.state);syncPending=false;inputSequence=Math.max(inputSequence,state.players.find(p=>p.id===session.id)?.ackSeq||0);netcode.receive(state,session.id,performance.now());renderUI();}catch{if(!syncPending){syncPending=true;ws.send(JSON.stringify({type:'sync'}));}}}
  else if(msg.type==='sounds'&&msg.code===state?.code&&msg.round===state.round&&focused&&!document.hidden){soundDirector.notify(msg.events,state,session.id);}
  else if(msg.type==='pong'){netcode.setRTT(performance.now()-msg.sent);}
  else if(msg.type==='error'){const req=pending.get(msg.requestId);if(req){clearTimeout(req.timer);pending.delete(msg.requestId);req.reject(Error(msg.error));}else if(!connected){reset();notice(msg.error);}else notice(msg.error);}
  else if(msg.type==='ack'){const req=pending.get(msg.requestId);if(req){clearTimeout(req.timer);pending.delete(msg.requestId);req.resolve();}}
 };
 ws.onerror=()=>{if(socket===ws)status('Radio indisponible','#e5a46a');};
 ws.onclose=event=>recoverRadio(ws,event);
}
function recoverRadio(ws,event){if(socket!==ws)return;clearTimeout(connectionTimer);socket=null;connected=false;keys={};heldCodes.clear();netcode.reset();soundDirector.pause();status('Reconnexion automatique…','#e5a46a');for(const req of pending.values()){clearTimeout(req.timer);req.reject(Error('Connexion interrompue.'));}pending.clear();if(session)reconnectTimer=setTimeout(connect,event?.code===1012?150:Math.min(8000,500*2**Math.min(reconnectAttempts++,4)));}

async function enter(type,practice=false){
 if(hostedServerMissing()){notice('Connecte une adresse HTTPS de serveur pour jouer.');return;}
 if(type==='join'){const mine=mineSessions.find($('code').value.trim().toUpperCase(),base());if(mine){resumeMine(mine);return;}}
 const button=type==='join'?$('join'):practice?$('practice'):$('create');button.disabled=true;
 try{const reconnectKey=mineSessions.reconnectKey();const response=await fetch(base()+'/api/'+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('name').value,code:$('code').value.trim().toUpperCase(),practice,reconnectKey})});const data=await response.json();if(!response.ok)throw Error(data.error);session=data;localStorage.setItem('dm-server',base());localStorage.setItem('dm-name',$('name').value);save();$('welcome').hidden=true;$('session').hidden=false;connect();notice('');}catch(e){notice('Connexion impossible : '+e.message);}finally{button.disabled=false;}
}
function command(type,details={}){return new Promise((resolve,reject)=>{if(!connected||socket?.readyState!==WebSocket.OPEN)return reject(Error('Attendez la reconnexion.'));const requestId=++nextRequest,timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Le serveur ne répond pas.'));},10000);pending.set(requestId,{resolve,reject,timer});try{socket.send(JSON.stringify({type,...details,requestId}));}catch{clearTimeout(timer);pending.delete(requestId);reject(Error('Connexion interrompue.'));}});}
$('create').onclick=()=>enter('create');$('join').onclick=()=>enter('join');$('practice').onclick=()=>enter('create',true);
$('start').onclick=()=>command('start').catch(e=>notice(e.message));$('escape').onclick=()=>command('escape').catch(e=>notice(e.message));
$('leave').onclick=()=>{if(desktop){window.close();return;}const code=session?.code;save();reset();notice('Mine '+code+' conservée. Reprends-la avec le bouton portant ce code.');};
$('resume').onclick=()=>resumeMine(mineSessions.list()[0]);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen();}catch{notice('Le plein écran n’est pas disponible dans ce navigateur.');}};
$('fullscreenExit').onclick=()=>document.exitFullscreen().catch(()=>{});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Réduire l’écran':'Plein écran';});
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(session.code);notice('Code copié : '+session.code);}catch{notice('Code à partager : '+session.code);}};
$('openWagonCargo').onclick=()=>{const me=state?.players.find(p=>p.id===session?.id),wagon=state?.installations.filter(w=>w.kind==='wagon'&&Math.hypot(w.x-me.x,w.y-me.y)<=1.35).sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y))[0];if(wagon)colonyUI.open('storage',wagon.id);};
$('leaveWagon').onclick=()=>command('wagon',{id:state?.players.find(p=>p.id===session?.id)?.vehicleId,action:'exit'}).catch(e=>notice(e.message));
$('saveMine').onclick=()=>command('save').then(()=>notice('Mine sauvegardée : position, inventaire et constructions.')).catch(e=>notice(e.message));
function renderUI(){
 const me=state.players.find(p=>p.id===session.id);if(!me){reset();notice('Session expirée. Rejoignez un salon.');return;}
 baseUI.render(state,me);
 colonyUI.render(state,me);
 const signature=JSON.stringify([state.code,state.phase,state.host,state.practice,state.bank,state.target,me.alive,me.escaped,me.vehicleId,Math.hypot(me.x-17.5,me.y-3.5)<2.6,state.players.map(p=>[p.id,p.name,p.color])]);
 if(signature===uiSignature)return;uiSignature=signature;
 $('roomCode').textContent=state.code;$('mode').textContent=desktop?(desktop.host?'HÉBERGÉ SUR TON PC':'PARTIE HÉBERGÉE PAR TON AMI'):state.practice?'EXPLORATION SOLO':'MINE PRIVÉE · EXPLORATION LIBRE';
 $('start').hidden=state.host!==session.id||state.phase==='running';$('start').textContent=state.phase==='lobby'?'Ouvrir la mine':'Rejouer';$('start').disabled=!state.practice&&state.players.length<(desktop?1:3);
 $('leaveWagon').hidden=!me.vehicleId||!me.alive;$('openWagonCargo').hidden=!me.alive||!state.installations?.some(w=>w.kind==='wagon'&&Math.hypot(w.x-me.x,w.y-me.y)<=1.35);
 $('escape').hidden=state.phase!=='running'||!me.alive;$('escape').disabled=Math.hypot(me.x-17.5,me.y-3.5)>=2.6;
 const overlay=$('overlay');overlay.hidden=state.phase==='running';if(!overlay.hidden){$('resultTitle').textContent=state.phase==='lobby'?'L’équipe se rassemble.':state.phase==='won'?'Contrat rempli.':'La mine a gagné.';$('resultText').textContent=state.phase==='lobby'?`${state.players.length} / 6 mineurs · ${state.practice?'Tu peux ouvrir la mine.':desktop?'Partage l’invitation depuis le launcher. Les amis peuvent rejoindre ensuite.':'Partagez le code. Ouverture à partir de 3 joueurs ; les amis peuvent rejoindre ensuite.'}`:`${state.bank} / ${state.target} crédits sécurisés. ${state.host===session.id?'Vous pouvez relancer une expédition.':'Le chef peut relancer une expédition.'}`;}
 $('teamList').replaceChildren(...state.players.map(p=>{const li=document.createElement('span');li.style.color=p.color;li.textContent=`● ${p.name}${p.id===session.id?' (vous)':''}`;return li;}));
}
const canUseQuickbar=()=>connected&&state?.mode==='free'&&state.phase==='running'&&state.players.find(p=>p.id===session?.id)?.alive&&!state.players.find(p=>p.id===session?.id)?.vehicleId&&!baseUI.opened&&!colonyUI.opened;
let placementPointer=null;
function updatePointer(e){const rect=canvas.getBoundingClientRect();placementPointer={u:(e.clientX-rect.left)/rect.width,v:(e.clientY-rect.top)/rect.height};}
canvas.addEventListener('pointermove',updatePointer);
canvas.addEventListener('pointerleave',()=>{placementPointer=null;});
addEventListener('blur',()=>{placementPointer=null;});
canvas.addEventListener('click',e=>{if(e.button!==0||!canUseQuickbar())return;if(isPlaceable(colonyUI.selected)||isFieldItem(colonyUI.selected)||!colonyUI.selected){updatePointer(e);const target=renderer?.pointerTile(placementPointer.u*canvas.clientWidth,placementPointer.v*canvas.clientHeight);if(!target)return;colonyUI.placeSelected(target);}else colonyUI.placeSelected();});
let wheelAt=-Infinity,wheelLastEvent=-Infinity,wheelDelta=0;
$('viewport').addEventListener('wheel',e=>{
 if(!canUseQuickbar()||e.ctrlKey||!e.deltaY)return;
 e.preventDefault();const now=performance.now();
 if(now-wheelLastEvent>250)wheelDelta=0;wheelLastEvent=now;
 wheelDelta+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?200:1);
 if(Math.abs(wheelDelta)<24||now-wheelAt<100)return;
 colonyUI.cycleSlot(wheelDelta);wheelDelta=0;wheelAt=now;
},{passive:false});
addEventListener('keydown',e=>{if(e.code==='KeyR'&&canUseQuickbar()&&colonyUI.selected==='wall'&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat)colonyUI.rotateSelected();}});
const keymap={KeyW:'up',KeyA:'left',KeyS:'down',KeyD:'right',Space:'mine',KeyE:'use',ShiftLeft:'sprint',ShiftRight:'sprint'};
addEventListener('keydown',e=>{if(!session||baseUI.opened||e.ctrlKey||e.altKey||e.metaKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(/^(Digit|Numpad)[0-9]$/.test(e.code)){e.preventDefault();if(!e.repeat)colonyUI.selectSlot(quickbarSlot(Number(e.code.at(-1))));}});
addEventListener('keydown',e=>{
 if(!session||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.code==='Escape'&&colonyUI.opened){e.preventDefault();colonyUI.close();return;}
 const next=menuShortcut(e);
 if(next){e.preventDefault();if(!e.repeat){if(colonyUI.opened&&colonyUI.activeTab===next)colonyUI.close();else colonyUI.open(next);}return;}
 if(e.code==='KeyB'&&colonyUI.opened)colonyUI.close();
 if(e.code==='KeyE'&&!e.repeat&&!baseUI.opened){const me=state?.players.find(p=>p.id===session.id);if(me?.alive&&(me.vehicleId||!colonyUI.opened)&&colonyUI.nearMachine()){e.preventDefault();e.stopImmediatePropagation();}}
});
function sendInput(){if(connected&&socket?.readyState===WebSocket.OPEN&&(socket.bufferedAmount||0)<65536){const sequence=++inputSequence;netcode.recordInput(sequence,keys,performance.now());try{socket.send(JSON.stringify({type:'input',sequence,input:keys}));}catch{socket.close();}}}
function refreshKeys(){keys={};for(const code of heldCodes)keys[keymap[code]]=true;if(state?.mode==='free'&&colonyUI.selected!=='pick')keys.mine=false;sendInput();}
addEventListener('keydown',e=>{if(e.defaultPrevented)return;if(session&&e.code==='Escape'&&baseUI.opened){e.preventDefault();baseUI.close();return;}if(session&&e.code==='KeyB'&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat){baseUI.opened?baseUI.close():baseUI.open();}return;}if(baseUI.opened||colonyUI.opened)return;if(session&&e.code==='KeyX'&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat)baseUI.dismantle();return;}if(session&&!(e.code==='KeyR'&&colonyUI.selected==='wall')&&['KeyF','KeyR','KeyG'].includes(e.code)&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat)colonyUI.selectItem({KeyF:'lamp',KeyR:'air',KeyG:'drill'}[e.code]);return;}if(session&&e.code==='KeyE'&&!e.repeat&&state?.mode==='free'){const me=state.players.find(p=>p.id===session.id);if(me?.alive&&Math.hypot(me.x-17.5,me.y-3.5)<2.6){e.preventDefault();command('escape').then(()=>baseUI.open()).catch(error=>notice(error.message));return;}}if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||!session)return;if(e.code==='Space'&&canUseQuickbar()&&isFieldItem(colonyUI.selected)){e.preventDefault();if(!e.repeat)colonyUI.placeSelected();return;}if(keymap[e.code]){e.preventDefault();if(!e.repeat&&!heldCodes.has(e.code)){heldCodes.add(e.code);refreshKeys();}}});
addEventListener('keyup',e=>{if(keymap[e.code]){heldCodes.delete(e.code);refreshKeys();if(session)e.preventDefault();}});
function releaseKeys(){heldCodes.clear();keys={};sendInput();}
addEventListener('blur',releaseKeys);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseKeys();});setInterval(sendInput,100);
setInterval(()=>{if(!session||!socket||socket.readyState!==WebSocket.OPEN||document.hidden)return;if(performance.now()-lastRadioAt>12000){socket.close();return;}try{socket.send(JSON.stringify({type:'ping',sent:performance.now()}));}catch{socket.close();}},2000);
let fpsSince=0,fpsCount=0;
function draw(now){requestAnimationFrame(draw);if(renderFailures>=3)return;try{drawFrame(now);renderFailures=0;}catch{renderFailures++;keys={};heldCodes.clear();ctx.reset?.();hudContext.reset?.();netcode.reset();if(renderFailures>=3){notice('Affichage interrompu. Recharge la page pour reprendre ta mine sauvegardée.');soundDirector.pause();}else if(connected&&socket?.readyState===WebSocket.OPEN){try{socket.send(JSON.stringify({type:'sync'}));}catch{socket.close();}}}}
function drawFrame(now){if(!renderer||!state||!session||$('session').hidden||document.hidden){fpsSince=0;fpsCount=0;return;}
 const scene=netcode.scene(now,keys,connected)||state,me=scene.players.find(p=>p.id===session.id);if(!me)return;
 if(scene.mode==='free')me.heldItem=colonyUI.selected&&((me.items?.[colonyUI.selected]||me.cargo?.[colonyUI.selected]||colonyUI.selected==='pick')>0)?colonyUI.selected:null;
 soundDirector.update(scene,session.id,now/1000,connected&&focused);
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(w<1||h<1)return;
 const size=displaySize(w,h,devicePixelRatio||1,settings.resolution);
 if(canvas.width!==size.worldWidth||canvas.height!==size.worldHeight){canvas.width=size.worldWidth;canvas.height=size.worldHeight;}
 if(hudCanvas.width!==size.hudWidth||hudCanvas.height!==size.hudHeight){hudCanvas.width=size.hudWidth;hudCanvas.height=size.hudHeight;}
 const renderSettings={...settings,quality:effects.current(settings.quality),pixelRatio:size.worldRatio,separateHUD:true,placement:canUseQuickbar()&&placementPointer&&(isPlaceable(colonyUI.selected)||isFieldItem(colonyUI.selected))?{kind:colonyUI.selected,rotation:colonyUI.rotation,pointer:{x:placementPointer.u*w,y:placementPointer.v*h}}:null};
 ctx.setTransform(size.worldRatio,0,0,size.worldRatio,0,0);renderer.draw(ctx,w,h,scene,me,now/1000,renderSettings);
 hudContext.setTransform(size.hudRatio,0,0,size.hudRatio,0,0);renderer.drawHUD(hudContext,w,h,scene,me,now/1000,renderSettings);
 if(!fpsSince)fpsSince=now;fpsCount++;if(now-fpsSince>=2000){const fps=Math.round(fpsCount*1000/(now-fpsSince));$('smoothness').textContent=`Fluidité : ${fps} images/s`;effects.observe(fps);fpsSince=now;fpsCount=0;}
}
requestAnimationFrame(draw);
updateSavedMines();
const activeMine=mineSessions.active();if(desktop){$('openMineMenu').hidden=true;$('name').value=desktop.name;$('leave').textContent='Quitter la partie';resumeMine({...desktop,server:location.origin});}else if(activeMine?.server===base())resumeMine(activeMine);

