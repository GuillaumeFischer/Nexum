import test from 'node:test';
import assert from 'node:assert/strict';
import {minerFrame,createNewMinerArt,NEW_MINER_ASSETS} from '../games/deep-miners/client/new-miner.js';
import {MINER_ATLASES,MINER_CELL} from '../games/deep-miners/client/new-miner-layout.js';
import {createAnimator} from '../games/deep-miners/client/animation.js';
const player=()=>({id:'new-miner',x:0,y:0,slot:0,face:{x:0,y:1},alive:true,moving:true,bag:0,heldItem:null});
test('180 nouvelles poses : dimensions et ancrage communs pour les huit planches',()=>{
 assert.equal(Object.keys(NEW_MINER_ASSETS).length,8);
 let count=0;for(const sheet of Object.values(MINER_ATLASES)){
  assert.equal(sheet.width,sheet.columns*MINER_CELL.width);assert.equal(sheet.height,sheet.rows*MINER_CELL.height);
  assert.equal(sheet.rows,3);count+=sheet.rows*sheet.columns;
 }
 assert.equal(count,180);assert(MINER_CELL.anchorY<MINER_CELL.height);
});
test('Marche et course utilisent des images distinctes pour chaque équipement et direction',()=>{
 const faces=[{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}];
 for(const [heldItem,equipment,idleColumn]of [[null,'empty',0],['pick','pick',1],['shovel','shovel',2]])for(const [dir,face]of faces.entries()){
  const p={...player(),heldItem,face};
  assert.equal(minerFrame(p,{walk:false}).column,idleColumn);
  for(let column=0;column<8;column++)for(const run of [0,1]){
   const frame=minerFrame(p,{walk:true,run,column});assert.equal(frame.atlas,equipment+(run?'-run':'-walk'));
   assert.equal(frame.column,column);assert.equal(frame.row,dir===3?1:dir);assert.equal(frame.mirror,dir===3);
  }
 }
});
test('Départ, course, demi-tour et arrêt choisissent immédiatement la pose attendue',()=>{
 const p=player(),a=createAnimator();a.update(p,0);p.x+=.05;
 assert.equal(minerFrame(p,a.update(p,1/60)).atlas,'empty-walk');
 for(let i=2;i<=60;i++){p.x+=.085;a.update(p,i/60);}
 p.x+=.085;p.face={x:-1,y:0};const running=minerFrame(p,a.update(p,61/60));
 assert.equal(running.atlas,'empty-run');assert(running.mirror);
 p.moving=false;assert.equal(minerFrame(p,a.update(p,62/60)).atlas,'idle');
});
test('Les quatre phases de pioche et de pelle remplacent le cycle de marche',()=>{
 for(let i=0;i<4;i++){
  assert.equal(minerFrame({...player(),heldItem:'pick',mine:(i+.1)/4},{walk:true,run:1,column:7}).column,i);
  assert.equal(minerFrame({...player(),heldItem:'shovel',actionSeconds:.45*(1-(i+.1)/4)},{walk:true,run:1,column:7}).column,4+i);
 }
});
test('La posture assise ignore les anciennes actions et ne varie pas avec le temps',()=>{
 const assets=Object.fromEntries(Object.keys(NEW_MINER_ASSETS).map(k=>[k,{name:k}]));
 const art=createNewMinerArt(assets,()=>{throw Error('Aucune recoloration nécessaire');});
 const commands=[],c=Object.fromEntries(['save','restore','translate','scale','rotate','drawImage'].map(k=>[k,(...args)=>commands.push([k,...args])]));
 const p={...player(),vehicleId:'wagon',heldItem:'shovel',mine:.9,actionSeconds:.2};let reference;
 for(let i=0;i<480;i++){
  commands.length=0;const frame=art.draw(c,p,{walk:true,run:i%2,column:i%8},120,160);
  assert.equal(frame.atlas,'idle');assert.equal(frame.column,3);
  if(!reference)reference=commands.slice();else assert.deepEqual(commands,reference);
 }
});
