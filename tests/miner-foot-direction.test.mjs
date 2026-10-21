import test from 'node:test';import assert from 'node:assert/strict';
import {minerMotion,stepPose} from '../games/deep-miners/client/miner-motion.js';

test('La foulée de face et de dos ne transforme pas le déroulé du pied en torsion latérale',()=>{
 for(const dir of [0,2])for(const run of [0,1])for(let i=0;i<96;i++){
  const m=minerMotion({heldItem:null},{dir,phase:i/96,amount:1,run,clock:i/60});
  assert(m.legs[0].foot.x*m.legs[1].foot.x<0,'Each foot stays on its own side');
  for(const leg of m.legs){assert.equal(leg.roll,0);assert.equal(leg.ankle.x,leg.foot.x);assert.equal(leg.ankle.y,leg.foot.y-6.5);}
 }
});

test('Le profil conserve le déroulé talon-pointe pendant toute la foulée',()=>{
 for(const dir of [1,3])for(let i=0;i<96;i++){
  const m=minerMotion({heldItem:null},{dir,phase:i/96,amount:1,run:1,clock:i/60});
  for(let j=0;j<2;j++){const step=stepPose(i/96+j*.5,1,1),leg=m.legs[j];assert.equal(leg.roll,step.roll);assert(Math.abs(leg.ankle.x-leg.foot.x+2.8-Math.sin(step.roll)*6)<1e-9);}
 }
});
