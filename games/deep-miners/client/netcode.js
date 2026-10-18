import {capacity,canMine,miningRate,harvestFits,resourceFor} from './progression.js';
import {movePlayer,canMove,strength} from './physics.js';
import {clientGrid} from './world.js';
import {blendRailPose} from './rail-motion.js';
import {railIndex} from './railway.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const target=p=>`${Math.floor(p.x)+p.face.x},${Math.floor(p.y)+p.face.y}`;
const movingInput=i=>!!i&&(Number(!!i.right)!==Number(!!i.left)||Number(!!i.down)!==Number(!!i.up));

export function applyState(previous,packet){
  if(packet.world){const {chunks:updates=[],activeChunks,...next}=packet;const chunks={...(previous?.world?.seed===packet.world.seed?previous.chunks:{})},changed=[];for(const chunk of updates){const old=chunks[chunk.key];if(old)for(let i=0;i<256;i++)if(old.tiles[i]!==chunk.tiles[i]){const [cx,cy]=chunk.key.split(',').map(Number);changed.push([cx*16+i%16,cy*16+Math.floor(i/16),old.tiles[i],chunk.tiles[i]]);}chunks[chunk.key]=chunk;}if(activeChunks)for(const key of Object.keys(chunks))if(!activeChunks.includes(key))delete chunks[key];const tiles=updates.length||!previous||activeChunks?.some(k=>!previous.chunks?.[k])?clientGrid(packet.world,chunks):previous.tiles;return {...next,railMap:next.railMap??previous?.railMap??[],baseMap:next.baseMap??previous?.baseMap??[],chunks,tiles,changedCells:changed,structures:next.structures||[]};}
  const {changes,mapBase,...next}=packet;
  if(next.tiles)return {...next,structures:next.structures||[]};
  if(!previous||previous.round!==next.round)throw Error('Carte à resynchroniser.');
  let tiles=previous.tiles;
  if(changes){
    if(mapBase!==previous.mapVersion)throw Error('Carte à resynchroniser.');
    tiles=tiles.slice();const copied=new Set(),width=tiles[0].length;
    for(const [index,value]of changes){const y=Math.floor(index/width),x=index%width;if(!copied.has(y)){tiles[y]=tiles[y].slice();copied.add(y);}tiles[y][x]=value;}
  }else if(next.mapVersion!==previous.mapVersion)throw Error('Carte à resynchroniser.');
  return {...next,tiles,structures:next.structures||previous.structures};
}

export function createNetcode(){
  let frames=[],history=[],local=null,latest=null,lastNow=null,rtt=50,mining=null,trackState=null,tracks=null;
  function reset(){frames=[];history=[];local=latest=mining=null;lastNow=null;trackState=tracks=null;}
  function railTracks(state){if(trackState!==state){trackState=state;tracks=railIndex(state);}return tracks;}
  function recordInput(sequence,input,now){
    const previous=history.at(-1)?.input;
    const active=local&&latest&&lastNow!==null&&latest.state.phase==='running'&&latest.p.alive&&!latest.p.escaped&&now-latest.at<600;
    // Integrate the old keys up to the key event, rather than discarding the
    // part of the last frame before a release or a direction change.
    if(active){movePlayer(latest.state,local,previous||{},clamp((now-lastNow)/1000,0,.05),local.vehicleId?railTracks(latest.state):undefined);lastNow=now;}
    history.push({sequence,input:{...input},at:now});if(history.length>80)history.shift();
    if(active&&movingInput(previous)&&!movingInput(input)&&latest.state.inputClock===1&&Number.isFinite(latest.p.ackInputSeconds)){
      const q=expected(now);if(Math.hypot(local.x-q.x,local.y-q.y)<.5&&canMove(latest.state,q.x,q.y)){local.x=q.x;local.y=q.y;}
      local.moving=false;
    }
  }
  function receive(state,id,now){
    const p=state.players.find(q=>q.id===id);if(!p)return;
    if(latest&&(latest.state.round!==state.round||latest.state.code!==state.code))history=[];
    if(!latest||latest.state.round!==state.round||latest.state.code!==state.code||latest.p.vehicleId!==p.vehicleId||now-latest.at>700){frames=[];local={...p,face:{...p.face}};mining=null;lastNow=now;}
    latest={state,p,at:now};frames.push({state,at:now});if(frames.length>12)frames.shift();
    if(state.phase!=='running'||!p.alive||p.escaped){local={...p,face:{...p.face}};mining=null;}
  }
  function expected(now){
    const {state,p,at}=latest,q={...p,face:{...p.face},route:p.route?.map(c=>({...c}))};
    const acknowledged=history.find(e=>e.sequence===p.ackSeq);
    // Replay the unacknowledged part of the input timeline. Packet arrival
    // time includes network, batching and persistence delays, so it cannot
    // identify how much movement the server has already simulated.
    const timed=state.inputClock===1&&acknowledged&&Number.isFinite(p.ackInputSeconds);
    let time=timed?Math.min(now,acknowledged.at+Math.max(0,p.ackInputSeconds)*1000):at-clamp(rtt/2,0,150),end=Math.min(now,time+(timed?500:200));
    let input=acknowledged?.input||{};
    const advance=until=>{while(time<until){const step=Math.min(50,until-time);movePlayer(state,q,input,step/1000,q.vehicleId?railTracks(state):undefined);time+=step;}};
    for(const event of history){
      if(event.sequence<=p.ackSeq)continue;
      const until=clamp(event.at,time,end);advance(until);input=event.input;
    }
    advance(end);return q;
  }
  function scene(now,input,connected){
    if(!latest||!local)return null;
    const {state,p}=latest,dt=clamp((now-(lastNow??now))/1000,0,.05);lastNow=now;
    const active=connected&&state.phase==='running'&&p.alive&&!p.escaped&&now-latest.at<600;
    if(active&&(!p.vehicleId||p.vehicleDriver)){
      Object.assign(local,{vehicleDriver:p.vehicleDriver,vehicleAutomatic:p.vehicleAutomatic,destination:p.destination,route:p.route?.map(c=>({...c}))});
      local.bag=p.bag;local.capacity=p.capacity;
      movePlayer(state,local,input,dt,p.vehicleId?railTracks(state):undefined);
      const q=expected(now),distance=Math.hypot(local.x-q.x,local.y-q.y);
      if(p.vehicleId){
        if(trackState!==state){trackState=state;tracks=railIndex(state);}
        if(p.vehicleDriver){
          const pose=distance>1.2?q:blendRailPose(state,local,q,1-Math.exp(-dt*9),tracks);
          const face=distance>1.2?q.face:local.face;
          Object.assign(local,{x:pose.x,y:pose.y,face,railFrom:pose.railFrom,railTo:pose.railTo,railProgress:pose.railProgress});
        }
      }
      else if(distance>1.2||!canMove(state,local.x,local.y)){local.x=q.x;local.y=q.y;}
      else if(distance>.015){const f=1-Math.exp(-dt*9),x=local.x+(q.x-local.x)*f,y=local.y+(q.y-local.y)*f;if(canMove(state,x,y)){local.x=x;local.y=y;}}
    }else{local.moving=false;if(!connected||!p.alive||p.escaped||state.phase!=='running'){local.x=p.x;local.y=p.y;local.face={...p.face};}}
    let mine=0;
    const key=target(local),x=Math.floor(local.x)+local.face.x,y=Math.floor(local.y)+local.face.y,t=state.tiles[y]?.[x];
    if(active&&!p.vehicleId&&input.mine&&(state.mode!=='free'||p.heldItem===undefined||p.heldItem==='pick')&&(state.mode==='free'?resourceFor(t):t>0&&t<9)&&p.bag<capacity(p)&&(state.mode!=='free'||canMine(p,t)&&harvestFits(p,t))&&!state.installations?.some(s=>s.kind==='wall'&&Math.floor(s.x)===x&&Math.floor(s.y)===y)){
      if(mining?.key!==key)mining={key,progress:0};
      const authoritative=target(p)===key?p.mine:0;
      mining.progress=Math.max(mining.progress,authoritative||0)+dt*(state.mode==='free'?miningRate(p):1)/strength(t);mine=clamp(mining.progress,.001,.98);
    }else mining=null;
    const when=now-80;let a=frames[0],b=frames.at(-1);
    for(let i=0;i<frames.length-1;i++)if(frames[i].at<=when&&frames[i+1].at>=when){a=frames[i];b=frames[i+1];break;}
    const f=clamp((when-a.at)/Math.max(1,b.at-a.at),0,1);
    const players=state.players.map(player=>{
      if(player.id===p.id&&(!p.vehicleId||p.vehicleDriver))return {...player,x:local.x,y:local.y,face:local.face,moving:active&&local.moving,mine};
      const old=a.state.players.find(q=>q.id===player.id),next=b.state.players.find(q=>q.id===player.id);
      if(!old||!next||a.state.round!==b.state.round||old.vehicleId!==next.vehicleId||Math.hypot(next.x-old.x,next.y-old.y)>3)return player;
      if(player.vehicleId){if(trackState!==state){trackState=state;tracks=railIndex(state);}return {...player,...blendRailPose(state,old,next,f,tracks)};}
      return {...player,x:old.x+(next.x-old.x)*f,y:old.y+(next.y-old.y)*f,mine:old.mine>0&&next.mine>0&&target(old)===target(next)?old.mine+(next.mine-old.mine)*f:player.mine};
    });
    for(const wagon of state.installations||[])if(wagon.kind==='wagon'){const occupants=players.filter(p=>p.vehicleId===wagon.id),anchor=occupants.find(p=>p.id===latest.p.id)||occupants.find(p=>p.vehicleDriver)||occupants[0];if(anchor)for(const rider of occupants)Object.assign(rider,{x:anchor.x,y:anchor.y,face:anchor.face});}
    const installations=state.installations?.map(item=>{
      if(item.kind!=='wagon')return item;const rider=players.find(p=>p.vehicleId===item.id);if(rider)return {...item,x:rider.x,y:rider.y,face:rider.face};
      const old=a.state.installations?.find(s=>s.id===item.id),next=b.state.installations?.find(s=>s.id===item.id);if(!old||!next||Math.hypot(next.x-old.x,next.y-old.y)>3)return item;if(trackState!==state){trackState=state;tracks=railIndex(state);}return {...item,...blendRailPose(state,old,next,f,tracks)};
    });
    return {...state,players,installations};
  }
  return {reset,recordInput,receive,scene,setRTT(value){rtt=clamp(value,0,500);}};
}
