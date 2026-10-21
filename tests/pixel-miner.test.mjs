import test from 'node:test';import assert from 'node:assert/strict';
import {pixelMinerFrame,createPixelMinerArt,PIXEL_MINER_ASSETS} from '../games/deep-miners/client/pixel-miner.js';import {PIXEL_MINER} from '../games/deep-miners/client/pixel-miner-layout.js';
const player={alive:true,heldItem:null,face:{x:0,y:1},slot:0};
test('Le mineur pixel utilise quatre pas, une pose de repos immédiate et le profil miroir',()=>{
 for(let dir=0;dir<4;dir++){
  for(let step=0;step<4;step++)assert.equal(pixelMinerFrame(player,{dir,phase:step/4,walk:true}).column,step+1);
  assert.equal(pixelMinerFrame(player,{dir,phase:.8,walk:false,amount:1}).column,0);
  assert.equal(pixelMinerFrame(player,{dir,phase:1,walk:true}).column,1);
 }
 assert.equal(pixelMinerFrame(player,{dir:3}).row,1);assert(pixelMinerFrame(player,{dir:3}).mirror);
 for(const row of [0,2]){
  const side=col=>Math.sign(PIXEL_MINER.frames[row*12+col].soles[0].x-PIXEL_MINER.cell.anchorX);
  assert.equal(side(1),side(2));assert.equal(side(3),side(4));assert.equal(side(1),-side(3));
 }
});
test('Pioche et pelle utilisent leur geste complet sans ajouter un deuxième outil',()=>{
 for(const [i,progress]of [.05,.45,.85].entries()){
  const pick=pixelMinerFrame({...player,heldItem:'pick',mine:progress},{dir:0,walk:true});assert.equal(pick.column,6+i);assert.equal(pick.carry,null);
  const shovel=pixelMinerFrame({...player,heldItem:'shovel',actionSeconds:.45*(1-progress)},{dir:0,walk:true});assert.equal(shovel.column,9+i);assert.equal(shovel.carry,null);
 }
 assert.equal(pixelMinerFrame({...player,heldItem:'pick'},{dir:0}).carry,'pick');
 assert.equal(pixelMinerFrame({...player,heldItem:'shovel'},{dir:0}).carry,'shovel');
 assert.equal(pixelMinerFrame({...player,heldItem:'wall'},{dir:0}).carry,null);
});
test('Le wagon garde une pose fixe et le décès retrouve une pose sans outil',()=>{
 for(const phase of [0,.3,.8])for(const heldItem of [null,'pick','shovel']){
  const f=pixelMinerFrame({...player,vehicleId:'wagon',heldItem,mine:.9,actionSeconds:.3},{dir:1,phase,walk:true});assert.equal(f.column,5);assert.equal(f.carry,null);
 }
 const dead=pixelMinerFrame({...player,alive:false,heldItem:'pick',mine:1},{dir:0,walk:true});assert.equal(dead.column,0);assert.equal(dead.carry,null);
});
test('Le vrai dessin utilise une silhouette complète et désactive le lissage des pixels',()=>{
 const assets=Object.fromEntries(Object.keys(PIXEL_MINER_ASSETS).map(key=>[key,{key}])),art=createPixelMinerArt(assets,()=>{throw Error('Unexpected tint');});
 for(const heldItem of [null,'pick','shovel']){
  const calls=[],c=Object.fromEntries(['save','restore','translate','scale','rotate'].map(k=>[k,()=>{}]));c.drawImage=(...args)=>calls.push(args);
  art.draw(c,{...player,heldItem},{dir:0,walk:true,phase:.3},0,0);assert.equal(c.imageSmoothingEnabled,false);assert.equal(calls.length,heldItem?2:1);assert.equal(calls[0][0],assets['miner-pixel']);
 }
});
