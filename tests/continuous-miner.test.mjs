import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimator} from '../games/deep-miners/client/animation.js';
import {stepPose,minerMotion} from '../games/deep-miners/client/miner-motion.js';
import {createMinerRig,MINER_RIG_ASSETS} from '../games/deep-miners/client/miner-rig.js';
const player=()=>({id:'rig',x:0,y:0,alive:true,moving:true,slot:0,face:{x:1,y:0},heldItem:null,bag:0});
test('La foulée boucle sans saut de pied, de rotation ni d’ombre',()=>{
 for(const run of [0,.5,1])for(const boundary of [.6,1]){
  const a=stepPose(boundary-1e-7,run,1),b=stepPose(boundary+1e-7,run,1);
  for(const key of ['travel','lift','roll','contact'])assert(Math.abs(a[key]-b[key])<.001,`${key}/${run}/${boundary}`);
 }
});
test('Les jambes alternent leurs appuis avec un pied réellement posé pendant chaque soutien',()=>{
 let lifted=0;
 for(let i=0;i<240;i++){
  const phase=i/240,a=stepPose(phase,1,1),b=stepPose(phase+.5,1,1);
  assert(a.contact===1||b.contact===1);if(a.contact===1)assert.equal(a.lift,0);if(a.lift>0)lifted++;
  for(const dir of [0,1,2,3]){const m=minerMotion(player(),{phase,run:1,amount:1,dir,clock:i/60});for(const l of m.legs)for(const p of [l.hip,l.knee,l.ankle,l.foot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));}
 }assert(lifted>60);
});
test('Les transitions de pose ne retardent ni ne modifient le déplacement du joueur',()=>{
 const p=player(),a=createAnimator();a.update(p,0);p.x+=3.1/60;const moving=a.update(p,1/60);assert(moving.amount>.3&&moving.amount<1);
 const stoppedX=p.x;p.moving=false;const stopped=a.update(p,2/60);assert.equal(stopped.walk,false);assert(stopped.amount>0&&stopped.amount<moving.amount);
 for(let i=3;i<=15;i++)a.update(p,i/60);assert.equal(p.x,stoppedX);assert(a.update(p,16/60).amount<.002);
});
test('Marche/course et demi-tour gardent une phase continue, sans bascule de planche',()=>{
 const p=player(),base={dir:1,phase:.33,amount:1,clock:1},a=minerMotion(p,{...base,run:.44}),b=minerMotion(p,{...base,run:.46});
 assert(Math.hypot(a.legs[0].foot.x-b.legs[0].foot.x,a.legs[0].foot.y-b.legs[0].foot.y)<.2);
 const mirrored=minerMotion(p,{...base,dir:3,run:.44});assert.deepEqual(mirrored.legs,a.legs);assert(mirrored.mirror);
 const animator=createAnimator();animator.update(p,0);p.x+=.05;const before=animator.update(p,1/60);p.face={x:-1,y:0};p.x-=.05;const after=animator.update(p,2/60);assert(after.phase>before.phase);assert.equal(after.dir,3);
});
test('La cadence et l’amplitude sont cohérentes à 30, 60 et 144 images/s',()=>{
 const results=[];for(const fps of [30,60,144]){const a=createAnimator(),p=player();a.update(p,0);let pose;for(let i=1;i<=fps;i++){p.x=i*3.1/fps;pose=a.update(p,i/fps);}results.push(pose);}
 for(const pose of results){assert(Math.abs(pose.phase-results[0].phase)<1e-9);assert(Math.abs(pose.amount-results[0].amount)<1e-9);}
});
test('Le vrai dessin produit des transformations différentes entre les anciennes huit poses',()=>{
 const assets=Object.fromEntries(Object.keys(MINER_RIG_ASSETS).map(key=>[key,{key}])),art=createMinerRig(assets,()=>{throw Error('No tint');},{draw(){throw Error('Unexpected seat');}}),p=player(),unique=new Set();
 for(let i=0;i<96;i++){
  const calls=[],c=Object.fromEntries(['save','restore','translate','rotate','scale','drawImage'].map(name=>[name,(...args)=>calls.push([name,...args])]));
  art.draw(c,p,{dir:1,phase:i/96,amount:1,run:.5,clock:i/96},0,0);unique.add(JSON.stringify(calls));
 }assert.equal(unique.size,96);
});
test('Le wagon utilise exactement le dessin assis existant, sans nouvelle oscillation',()=>{
 const p={...player(),vehicleId:'wagon'},pose={dir:1,phase:.3,amount:1,clock:8};let calls=0;
 const seated={draw(c,person,input,x,y){assert.equal(person,p);assert.equal(input,pose);assert.equal(x,12);assert.equal(y,20);calls++;}};
 const art=createMinerRig({},()=>{},seated);art.shadow({},p,pose,12,20);art.draw({},p,pose,12,20);assert.equal(calls,1);
});
test('Un personnage décédé avec une ancienne action utilise uniquement la planche de repos chargée',()=>{
 const p={...player(),alive:false,heldItem:'pick',mine:.9,actionSeconds:.3};let drawn=false;
 const art=createMinerRig({},()=>{},{draw(c,person,pose){assert.equal(person.mine,0);assert.equal(person.actionSeconds,0);assert.equal(person.heldItem,null);assert.equal(pose.walk,false);drawn=true;}});
 art.draw({},p,{dir:1,walk:true},0,0);assert(drawn);
});
