import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createAnimator} from '../games/deep-miners/client/animation.js';
const source=await fs.readFile(new URL('../games/deep-miners/client/renderer.js',import.meta.url),'utf8');
// Execute the actual miner drawing function with a recording Canvas context.
// This verifies sprite selection and its complete transform without a window.
const start=source.indexOf('  function miner('),end=source.indexOf('  function visibleStructures(',start);
assert(start>=0&&end>start);
function renderer(){
 const frame=id=>({canvas:{id,width:192,height:160},feet:79}),frames=new Map(),farmer=new Map(),walk=new Map(),farmerWalk=new Map();
 for(let slot=0;slot<6;slot++){
  for(let i=0;i<20;i++)frames.set(slot*20+i,frame('miner-'+slot+'-'+i));
  for(let i=0;i<32;i++){farmer.set(slot*32+i,frame('farmer-'+slot+'-'+i));walk.set(slot*32+i,frame('walk-'+slot+'-'+i));}
  for(let i=0;i<64;i++)farmerWalk.set(slot*64+i,frame('farmer-walk-'+slot+'-'+i));
 }
 return new Function('animator','TILE','TAU','assets','farmerFrames','farmerWalkFrames','walkFrames','frames','return '+source.slice(start,end))(createAnimator(),64,Math.PI*2,{'miner-farming':true,walk:true},farmer,farmerWalk,walk,frames);
}
function context(){
 let matrix=[1,0,0,1,0,0];const stack=[],draws=[];
 return {draws,save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
  translate(x,y){matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y;},
  scale(x,y){matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;},
  rotate(a){const [x,y,z,w]=matrix,c=Math.cos(a),s=Math.sin(a);matrix[0]=x*c+z*s;matrix[1]=y*c+w*s;matrix[2]=z*c-x*s;matrix[3]=w*c-y*s;},
  beginPath(){},ellipse(){},fill(){},drawImage(image,...args){draws.push({image:image.id,args,matrix:[...matrix]});}};
}
const faces=[{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}];
test('Wagon arrêté : aucun mouvement périodique pendant huit secondes, pour six places et quatre directions',()=>{
 const draw=renderer();
 for(let slot=0;slot<6;slot++)for(const face of faces){
  const p={id:'p'+slot,x:4.5,y:3.5,slot,face,vehicleId:'w',alive:true,moving:false};let reference;
  for(let i=0;i<=480;i++){
   const c=context();draw(c,p,i/60,0,0,{x:slot*4,y:-12});
   const sample=c.draws[0];assert(sample);if(!reference)reference=sample;else assert.deepEqual(sample,reference);
  }
 }
});
test('Wagon en marche : ancrage constant dans le siège, sans marche ni ancienne action d’outil',()=>{
 const draw=renderer();
 for(let slot=0;slot<6;slot++){
  const p={id:'p'+slot,x:2.5,y:3.5,slot,face:{x:1,y:0},vehicleId:'w',alive:true,moving:true};let reference;
  for(let i=0;i<=480;i++){
   p.x=2.5+i/60*4.8;p.using=i%80<40;p.mine=i%60<30?.6:0;p.actionSeconds=i%120<60?1:0;
   const c=context();draw(c,p,i/60,0,0,{x:0,y:-12});const sample=c.draws[0];
   sample.matrix[4]=Math.round((sample.matrix[4]-p.x*64)*1e9)/1e9;
   sample.matrix[5]=Math.round((sample.matrix[5]-p.y*64)*1e9)/1e9;
   if(!reference)reference=sample;else assert.deepEqual(sample,reference);
  }
 }
});
test('Descendre du wagon permet de retrouver l’animation de marche normale',()=>{
 const animator=createAnimator(),p={id:'p',x:2.5,y:2.5,slot:0,face:{x:1,y:0},vehicleId:'w',alive:true,moving:true};
 animator.update(p,0);p.x+=.08;const seated=animator.update(p,1/60);
 assert.equal(seated.walk,false);assert.equal(seated.phase,0);assert(seated.lift===0);
 delete p.vehicleId;
 for(let i=2;i<=10;i++){p.x+=.06;const pose=animator.update(p,i/60);if(i===10){assert(pose.walk);assert(pose.phase>0);}}
});
