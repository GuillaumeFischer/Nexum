import test from 'node:test';import assert from 'node:assert/strict';
import {industrialMinerFrame,createIndustrialMinerArt,INDUSTRIAL_MINER_ASSETS} from '../games/deep-miners/client/industrial-miner.js';
const player={alive:true,heldItem:null,face:{x:0,y:1},slot:0};
test('Le D utilise une marche courte, retrouve le repos immédiatement et reflète le profil gauche',()=>{
 for(let dir=0;dir<4;dir++){for(let i=0;i<4;i++)assert.equal(industrialMinerFrame(player,{dir,phase:i/4,walk:true}).column,i+1);assert.equal(industrialMinerFrame(player,{dir,walk:false,amount:1,phase:.7}).column,0);}
 const f=industrialMinerFrame(player,{dir:3});assert.equal(f.row,1);assert(f.mirror);
});
test('Les gestes complets remplacent l’outil porté et le wagon garde sa pose assise',()=>{
 for(let i=0;i<3;i++){
  const pick=industrialMinerFrame({...player,heldItem:'pick',mine:(i+.1)/3},{dir:0,walk:true});assert.equal(pick.column,6+i);assert.equal(pick.carry,null);
  const shovel=industrialMinerFrame({...player,heldItem:'shovel',actionSeconds:.45*(1-(i+.1)/3)},{dir:0,walk:true});assert.equal(shovel.column,9+i);assert.equal(shovel.carry,null);
 }
 for(const heldItem of ['pick','shovel']){const s=industrialMinerFrame({...player,vehicleId:'wagon',heldItem,mine:1,actionSeconds:.3},{dir:1,walk:true,phase:.5});assert.equal(s.column,5);assert.equal(s.carry,null);}
 assert.equal(industrialMinerFrame({...player,alive:false,heldItem:'pick',mine:1},{dir:0,walk:true}).column,0);
});
test('Le dessin du D conserve le corps complet et le lissage de son illustration',()=>{
 const assets=Object.fromEntries(Object.keys(INDUSTRIAL_MINER_ASSETS).map(k=>[k,{key:k}])),art=createIndustrialMinerArt(assets,()=>{throw Error('Unexpected tint');});
 for(const heldItem of [null,'pick','shovel']){const calls=[],rotations=[],c=Object.fromEntries(['save','restore','translate','scale'].map(k=>[k,()=>{}]));c.rotate=a=>rotations.push(a);c.drawImage=(...a)=>calls.push(a);art.draw(c,{...player,heldItem},{dir:0,walk:true,phase:.4},0,0);assert(c.imageSmoothingEnabled);assert.equal(calls.length,heldItem?2:1);assert.equal(calls[0][0],assets['miner-industrial']);assert.equal(rotations.length,heldItem?1:0);}
});
