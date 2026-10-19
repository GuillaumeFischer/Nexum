import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createAnimator} from '../games/deep-miners/client/animation.js';
function motion(speed,{fps=60,bag=0,capacity=80,seconds=2}={}){
 const animator=createAnimator(),p={id:'p',slot:0,x:2,y:2,face:{x:1,y:0},alive:true,moving:true,bag,capacity};
 animator.update(p,0);let pose;const columns=new Set();
 for(let i=1;i<=Math.round(seconds*fps);i++){p.x=2+speed*i/fps;pose=animator.update(p,i/fps);columns.add(pose.column);}
 return {animator,p,pose,columns};
}
test('Marche et course distinctes, avec les huit images et une inclinaison plus énergique',()=>{
 const walk=motion(3.1),run=motion(4.8);
 assert.equal(walk.columns.size,8);assert.equal(run.columns.size,8);
 assert.equal(walk.pose.run,0);assert(run.pose.run>.99);assert(run.pose.lean>walk.pose.lean*3);
});
test('Cadence stable à 30, 60 et 144 images par seconde',()=>{
 const samples=[30,60,144].map(fps=>motion(4.8,{fps}).pose);
 for(const sample of samples){const delta=Math.abs(sample.phase-samples[0].phase);assert(Math.min(delta,1-delta)<.025);assert(sample.run>.99);}
});
test('Le poids du sac ne confond pas une course chargée avec une marche',()=>{
 const walk=motion(3.1*.6,{bag:80}),run=motion(4.8*.6,{bag:80});
 assert.equal(walk.pose.run,0);assert(run.pose.run>.99);
});
test('Contre un mur : le mouvement cesse, même si la touche reste enfoncée',()=>{
 const {animator,p}=motion(4.8);let pose;
 for(let i=1;i<=15;i++)pose=animator.update(p,2+i/60);
 assert.equal(pose.walk,false);assert.equal(pose.lean,0);assert.equal(pose.sway,0);assert.equal(pose.stretchX,1);assert.equal(pose.stretchY,1);assert(pose.lift===0);
});
test('Changement de direction réactif et posture entièrement neutre dans le wagon',()=>{
 const {animator,p}=motion(4.8);p.face={x:-1,y:0};let pose;
 for(let i=1;i<=12;i++){p.x-=4.8/60;pose=animator.update(p,2+i/60);assert.equal(pose.dir,3);}
 assert(pose.lean<0);p.vehicleId='wagon';p.x+=.1;pose=animator.update(p,2.22);
 assert.equal(pose.walk,false);assert.equal(pose.phase,0);assert.equal(pose.lean,0);assert.equal(pose.sway,0);assert.equal(pose.stretchX,1);assert.equal(pose.stretchY,1);assert(pose.lift===0);
});
test('Le vrai dessin applique la nouvelle gestuelle aux mains vides, à la pioche et à la pelle',async()=>{
 const source=await fs.readFile(new URL('../games/deep-miners/client/renderer.js',import.meta.url),'utf8');
 const start=source.indexOf('  function miner('),end=source.indexOf('  function visibleStructures(',start);
 const frames=prefix=>new Map(Array.from({length:64},(_,i)=>[i,{canvas:{id:prefix+i,width:192,height:160},feet:79}]));
 for(const heldItem of [null,'pick','shovel']){
  const draw=new Function('animator','TILE','TAU','assets','farmerFrames','farmerWalkFrames','walkFrames','frames','return '+source.slice(start,end))(createAnimator(),64,Math.PI*2,{'miner-farming':true,walk:true},frames('idle'),frames('farmerWalk'),frames('pickWalk'),frames('miner'));
  const p={id:'p',x:2,y:2,slot:0,face:{x:1,y:0},alive:true,moving:true,heldItem};
  let rotation=0,scales=[],image;
  const c={save(){},restore(){},translate(){},beginPath(){},ellipse(){},fill(){},rotate(a){rotation=a;},scale(x,y){scales.push([x,y]);},drawImage(i){image=i.id;}};
  draw(c,p,0,0,0);
  for(let i=1;i<=40;i++){p.x+=4.8/60;draw(c,p,i/60,0,0);}
  assert(rotation>.02);assert(scales.length>0);assert(scales.every(([x,y])=>x>=1&&x<1.011&&y<=1&&y>.979));
  assert(image.startsWith(heldItem==='pick'?'pickWalk':'farmerWalk'));
 }
});
