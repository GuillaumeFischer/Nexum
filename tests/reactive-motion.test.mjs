import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createAnimator} from '../games/deep-miners/client/animation.js';
import {followCamera} from '../games/deep-miners/client/camera-follow.js';
const player=()=>({id:'p',x:3,y:3,slot:0,face:{x:1,y:0},moving:true,alive:true,bag:0});
test('Premier déplacement : une pose de pas apparaît dès la première image',()=>{
 const a=createAnimator(),p=player();a.update(p,0);p.x+=.04;
 const pose=a.update(p,1/60);assert(pose.walk);assert.equal(pose.column,1);assert(pose.lean>0);
});
test('Arrêt ou obstacle : retour au repos sur la même image, sans pas résiduel',()=>{
 const a=createAnimator(),p=player();a.update(p,0);p.x+=.06;a.update(p,1/60);
 const pose=a.update(p,2/60);
 assert.equal(pose.walk,false);assert.equal(pose.column,0);assert.equal(pose.lift,0);assert.equal(pose.lean,0);assert.equal(pose.sway,0);assert.equal(pose.stretchY,1);
});
test('Demi-tour : orientation et inclinaison changent ensemble sans recommencer la foulée',()=>{
 const a=createAnimator(),p=player();a.update(p,0);p.x+=.06;const before=a.update(p,1/60);
 p.x-=.06;p.face={x:-1,y:0};const after=a.update(p,2/60);
 assert.equal(after.dir,3);assert(after.lean<0);assert(after.phase>before.phase);
});
test('Le corps reste compact en course et parfaitement neutre dans le wagon',()=>{
 const a=createAnimator(),p=player();a.update(p,0);let pose;
 for(let i=1;i<=120;i++){p.x+=.08;pose=a.update(p,i/60);assert(Math.abs(pose.lift)<=.501);assert(Math.abs(pose.lean+pose.sway)<=.0351);assert(pose.stretchY>=.996);}
 assert(pose.run>.99);p.vehicleId='w';p.x+=.08;pose=a.update(p,121/60);
 assert.equal(pose.walk,false);assert.equal(pose.lean,0);assert.equal(pose.sway,0);assert.equal(pose.lift,0);
});
test('Caméra : suivi proche indépendant du débit et resynchronisation après téléportation',()=>{
 for(const fps of [30,60,144]){
  let c={x:0,y:0};for(let i=0;i<fps;i++)c=followCamera(c,{x:1,y:1},1/fps);
  assert(Math.abs(1-c.x)<1e-10);assert(Math.abs(1-c.y)<1e-10);
 }
 const c=followCamera({x:0,y:0},{x:1,y:0},.05);assert(1-c.x<.224);
 assert.deepEqual(followCamera(c,{x:10,y:10},0),{x:10,y:10});
});
test('Vrai dessin : départ et arrêt immédiats pour mains vides, pioche et pelle',async()=>{
 const source=await fs.readFile(new URL('../games/deep-miners/client/renderer.js',import.meta.url),'utf8');
 const start=source.indexOf('  function miner('),end=source.indexOf('  function visibleStructures(',start);
 const frames=prefix=>new Map(Array.from({length:64},(_,i)=>[i,{canvas:{id:prefix+i,width:192,height:160},feet:79}]));
 for(const heldItem of [null,'pick','shovel']){
  const draw=new Function('animator','TILE','TAU','assets','farmerFrames','farmerWalkFrames','walkFrames','frames','return '+source.slice(start,end))(createAnimator(),64,Math.PI*2,{'miner-farming':true,walk:true},frames('idle-'),frames('farmer-step-'),frames('pick-step-'),frames('idle-'));
  const p={...player(),heldItem};let image;
  const c={save(){},restore(){},translate(){},beginPath(){},ellipse(){},fill(){},rotate(){},scale(){},drawImage(i){image=i.id;}};
  draw(c,p,0,0,0);assert(image.startsWith('idle-'));
  p.x+=.04;draw(c,p,1/60,0,0);assert(image.startsWith(heldItem==='pick'?'pick-step-':'farmer-step-'));
  draw(c,p,2/60,0,0);assert(image.startsWith('idle-'));
 }
});
