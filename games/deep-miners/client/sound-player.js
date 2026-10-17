import {SOUND_ASSETS} from './sound-catalog.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createSoundPlayer({Context=globalThis.AudioContext||globalThis.webkitAudioContext,fetcher=globalThis.fetch,storage=globalThis.localStorage,onStatus=()=>{}}={}){
  let context=null,master=null,ready=false,loading=null,enabled=true,volume=.6,muted=false;
  try{enabled=storage.getItem('dm-sounds')!=='off';const saved=storage.getItem('dm-sound-volume');if(saved!=null&&Number.isFinite(Number(saved)))volume=clamp(Number(saved),0,1);}catch{}
  const buffers=new Map(),voices=new Set(),loops=new Map();
  const status=()=>onStatus({enabled,volume,ready,available:!!Context,loading:!!loading&&!ready});
  function gain(){if(master){const t=context.currentTime;master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(enabled&&!muted?volume:0,t,.025);}}
  function drop(voice){if(!voices.delete(voice))return;for(const node of voice.nodes)node.disconnect();}
  function stop(voice,fade=.04){if(voice.stopping)return;voice.stopping=true;const at=context.currentTime;voice.level.gain.cancelScheduledValues(at);voice.level.gain.setTargetAtTime(0,at,.01);try{voice.source.stop(at+fade);}catch{drop(voice);}}
  function stopAll(){for(const voice of voices)stop(voice);loops.clear();}
  async function start(){
    if(!enabled||!Context)return;
    try{
      if(!context){context=new Context();master=context.createGain();const compressor=context.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=.004;compressor.release.value=.18;master.connect(compressor);compressor.connect(context.destination);gain();}
      if(context.state!=='running')await context.resume();
      if(!loading)loading=Promise.all(Object.entries(SOUND_ASSETS).map(async([id,asset])=>{try{const response=await fetcher(asset.file);if(!response.ok)throw Error('Audio indisponible');const buffer=await context.decodeAudioData(await response.arrayBuffer());buffers.set(id,buffer);}catch{}})).then(()=>{ready=buffers.size>0;status();});
      status();await loading;
    }catch{status();}
  }
  function spawn(id,{gain:amount=1,pan=0,rate=1,muffled=false}={},loop=false){
    const asset=SOUND_ASSETS[id],buffer=buffers.get(id);
    if(!ready||!enabled||muted||!volume||context?.state!=='running'||!asset||!buffer||amount<.015)return null;
    if(voices.size>=24){if(loop)return null;const oldest=[...voices].find(v=>!v.loop&&!v.stopping);if(!oldest)return null;stop(oldest);}
    const source=context.createBufferSource(),level=context.createGain(),nodes=[source,level];source.buffer=buffer;source.loop=loop;source.playbackRate.value=clamp(rate,.82,1.18);
    level.gain.value=asset.gain*clamp(amount,0,1);source.connect(level);let tail=level;
    if(muffled){const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;filter.Q.value=.5;tail.connect(filter);tail=filter;nodes.push(filter);}
    if(context.createStereoPanner){const stereo=context.createStereoPanner();stereo.pan.value=clamp(pan,-1,1);tail.connect(stereo);tail=stereo;nodes.push(stereo);}
    tail.connect(master);const voice={source,level,nodes,loop,stopping:false};voices.add(voice);source.onended=()=>drop(voice);source.start();return voice;
  }
  function play(id,options){return spawn(id,options);}
  function loop(id,wanted,options={}){
    const previous=loops.get(id);
    if(!wanted||!enabled||muted){if(previous){stop(previous);loops.delete(id);}return;}
    if(previous&&!previous.stopping)return;
    const voice=spawn(id,options,true);if(voice)loops.set(id,voice);
  }
  function setEnabled(value){enabled=!!value;try{storage.setItem('dm-sounds',enabled?'on':'off');}catch{}if(!enabled)stopAll();gain();status();if(enabled)void start();}
  function setVolume(value){volume=clamp(Number(value)||0,0,1);try{storage.setItem('dm-sound-volume',String(volume));}catch{}if(!volume)stopAll();gain();status();}
  function setActive(value){if(muted===!value)return;muted=!value;if(muted)stopAll();gain();}
  status();return {start,play,loop,stopAll,setEnabled,setVolume,setActive,get enabled(){return enabled;},get ready(){return ready;},get volume(){return volume;}};
}
