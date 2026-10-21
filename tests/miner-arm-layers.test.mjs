import test from 'node:test';
import assert from 'node:assert/strict';
import {createMinerRig,MINER_RIG_ASSETS} from '../games/deep-miners/client/miner-rig.js';
import {MINER_RIG} from '../games/deep-miners/client/miner-rig-layout.js';

test('Le bras proche recouvre son emmanchure et le bras éloigné reste derrière le buste',()=>{
 const assets=Object.fromEntries(Object.keys(MINER_RIG_ASSETS).map(key=>[key,{key}])),art=createMinerRig(assets,()=>{throw Error('Unexpected tint');},{});
 for(let dir=0;dir<4;dir++){
  const view=['south','east','north','east'][dir],parts=MINER_RIG[view].parts,draws=[],c=Object.fromEntries(['save','restore','translate','rotate','scale'].map(k=>[k,()=>{}]));
  c.drawImage=(...args)=>draws.push(args);
  art.draw(c,{alive:true,slot:0,heldItem:null},{dir,phase:.3,amount:1,run:1,clock:.4},0,0);
  const index=name=>draws.findIndex(a=>a[1]===parts[name].x&&a[2]===parts[name].y),torso=index('torso');
  assert(index('upperFar')<torso);assert(index('lowerFar')<torso);
  assert(index('upperNear')>torso);assert(index('lowerNear')>torso);assert(index('head')>index('upperNear'));
  const trunk=draws[torso];assert(Math.abs(trunk[7]/trunk[8]-parts.torso.w/parts.torso.h)<1e-9,'The sleeveless trunk must keep its aspect ratio');
 }
});
