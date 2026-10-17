import {SOUND_GROUPS} from './sound-catalog.js';
import {biomeAt} from './world.js';
import {resourceFor} from './progression.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function acousticPosition(state,listener,source){
  const dx=source.x-listener.x,dy=source.y-listener.y,distance=Math.hypot(dx,dy);
  if(distance>8)return {gain:0,pan:0,muffled:false};
  const steps=Math.max(1,Math.ceil(distance*3));let muffled=false;
  for(let i=1;i<steps;i++){const t=i/steps;if(state.tiles?.[Math.floor(listener.y+dy*t)]?.[Math.floor(listener.x+dx*t)]!==0){muffled=true;break;}}
  return {gain:(distance<.3?1:1/(1+distance*.65))*(muffled?.55:1),pan:clamp(dx/6,-.85,.85),muffled};
}

export function createSoundDirector(audio){
  const poses=new Map(),variations=new Map();let code=null,round=null,previousPhase=null,gas=false,lastAir=-Infinity,lastTime=-Infinity,lastSeq=0;
  function variant(group){const choices=SOUND_GROUPS[group],index=(variations.get(group)||0)%choices.length;variations.set(group,index+1);return choices[index];}
  function reset(){poses.clear();variations.clear();code=round=previousPhase=null;gas=false;lastAir=lastTime=-Infinity;lastSeq=0;audio.stopAll();}
  function pause(){poses.clear();audio.setActive(false);}
  function update(state,id,clock,active=true){
    const listener=state.players.find(p=>p.id===id);if(!listener)return;
    if(code!==state.code||round!==state.round){reset();code=state.code;round=state.round;}
    audio.setActive(active);if(!active){pause();return;}
    if(previousPhase==='running'&&state.phase!=='running')audio.play(state.phase==='won'?'win':'lose');previousPhase=state.phase;
    const running=state.phase==='running',alive=listener.alive&&!listener.escaped;
    
    const poisoned=running&&alive&&(state.world?['deep','volcano'].includes(biomeAt(state.world,listener.x,listener.y).id):listener.y>30)&&Math.sin(state.time/12)>0;
    if(poisoned&&!gas)audio.play('gas-enter');gas=poisoned;audio.loop('gas-loop',poisoned);
    audio.loop('breath-loop',running&&alive&&listener.o2<20);
    if(running&&alive&&listener.o2<30&&clock-lastAir>(listener.o2<10?3:6)){audio.play('air-low');lastAir=clock;}
    if(running&&state.mode!=='free'&&state.duration-state.time<=60&&clock-lastTime>15){audio.play('radio');lastTime=clock;}
    const present=new Set();
    for(const p of state.players){
      present.add(p.id);let pose=poses.get(p.id);
      if(!pose){pose={lastHit:-Infinity};poses.set(p.id,pose);}
      const options=p.id===id?{gain:1,pan:0}:acousticPosition(state,listener,p);
      const audible=running&&p.alive&&!p.escaped&&p.connected!==false&&options.gain>.015;
      if(audible&&p.mine>0&&clock-pose.lastHit>=.25){
        const tile=state.tiles[Math.floor(p.y)+p.face.y]?.[Math.floor(p.x)+p.face.x];
        if(resourceFor(tile)){audio.play(variant([2,5,6,7].includes(tile)?'pickMetal':[3,4,12].includes(tile)?'crystal':'rock'),options);pose.lastHit=clock;}
      }
    }
    for(const id of poses.keys())if(!present.has(id))poses.delete(id);
  }
  function notify(events,state,id){
    const listener=state?.players.find(p=>p.id===id);if(!listener)return;
    if(code!==state.code||round!==state.round){reset();code=state.code;round=state.round;}
    for(const event of events){
      if(!Number.isSafeInteger(event.seq)||event.seq<=lastSeq)continue;lastSeq=event.seq;
      const local=event.player===id,global=['start','quota'].includes(event.kind),options=global||local?{gain:1,pan:0}:acousticPosition(state,listener,event);
      if(event.kind==='break')audio.play('rock-break',{...options,gain:options.gain*.8});
      else if(event.kind==='ore')audio.play(event.ore===2?'ore-gold':event.ore===3?'ore-cyan':'ore-violet',options);
      else if(['deposit','refill','rescue','down','start','quota'].includes(event.kind))audio.play(event.kind,options);
      else if(event.kind==='escape')audio.play('lift',options);
    }
  }
  return {update,notify,pause,reset};
}
