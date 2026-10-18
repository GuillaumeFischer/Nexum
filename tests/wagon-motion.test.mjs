import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetcode} from '../games/deep-miners/client/netcode.js';
import {blendRailPose} from '../games/deep-miners/client/rail-motion.js';
import {advanceRailVehicle} from '../games/deep-miners/client/railway.js';
import {wagonCommand,railwayStep} from '../games/deep-miners/server/railway.mjs';
const world={tiles:Array.from({length:12},()=>Array(24).fill(0)),installations:[],railMap:Array.from({length:22},(_,x)=>['rail'+x,x+1,2])};
function pose(x,y=2.5){const cell=Math.floor(x-.5);return {x,y,face:{x:1,y:0},railFrom:{x:cell,y:Math.floor(y)},railTo:{x:cell+1,y:Math.floor(y)},railProgress:x-.5-cell};}
function state(x,{driver=true,automatic=false,other=false}={}){
 const p={id:'me',...pose(x),vehicleId:'cart',vehicleDriver:driver,vehicleAutomatic:automatic,alive:true,bag:0,ackSeq:0,moving:true};
 return {...world,round:1,code:'TEST',mode:'free',phase:'running',players:[p,...(other?[{...p,id:'friend',vehicleDriver:!driver}]:[])],installations:[{id:'cart',kind:'wagon',...pose(x)}]};
}
test('Conducteur : les corrections réseau ne produisent plus de sauts ou retours en arrière',()=>{
 const net=createNetcode();net.setRTT(0);net.receive(state(2.5),'me',0);
 let previous=2.5,maxStep=0,minStep=1;
 for(let now=1000/60;now<700;now+=1000/60){
   if(Math.round(now/(1000/60))%3===0){const jitter=Math.round(now/50)%2?.11:-.11;net.receive(state(2.5+4.8*now/1000+jitter),'me',now);}
   const scene=net.scene(now,{right:true},true),p=scene.players[0],dx=p.x-previous;
   maxStep=Math.max(maxStep,dx);minStep=Math.min(minStep,dx);previous=p.x;
   assert.equal(scene.installations[0].x,p.x);
 }
 assert(minStep>0,`Retour en arrière : ${minStep}`);assert(maxStep<.12,`Saut entre images : ${maxStep}`);
});
test('Passager : déplacement continu entre les paquets et occupants alignés au wagon',()=>{
 const net=createNetcode();net.receive(state(2.5,{driver:false,other:true}),'me',0);net.receive(state(2.98,{driver:false,other:true}),'me',100);
 const positions=[100,116,132,148,164,180].map(now=>{
   const scene=net.scene(now,{},true),[me,friend]=scene.players;
   assert.equal(me.x,friend.x);assert.equal(me.x,scene.installations[0].x);return me.x;
 });
 for(let i=1;i<positions.length;i++)assert(positions[i]>positions[i-1],positions.join(','));
});
test('Virage : interpolation sur les rails et reprise de la simulation au bon endroit',()=>{
 const corner={...world,railMap:[['a',2,2],['b',3,2],['c',3,3]]};
 const a={...pose(3.2)},b={x:3.5,y:2.9,face:{x:0,y:1},railFrom:{x:3,y:2},railTo:{x:3,y:3},railProgress:.4};
 for(let f=.05;f<1;f+=.05){const p=blendRailPose(corner,a,b,f);assert(Math.abs(p.y-2.5)<1e-8||Math.abs(p.x-3.5)<1e-8);const old={x:p.x,y:p.y};advanceRailVehicle(corner,p,p.y>2.5?{down:true}:{right:true},.01);assert(Math.hypot(p.x-old.x,p.y-old.y)<.049);}
 const mid=blendRailPose(corner,a,b,.5);assert(Math.abs(mid.x-3.5)<1e-8);assert(Math.abs(mid.y-2.55)<1e-8);
});
test('Wagon automatique sans occupant : les virages ne coupent plus les angles',()=>{
 const net=createNetcode(),a=state(10.5),b=state(10.5);
 for(const s of [a,b]){delete s.players[0].vehicleId;s.railMap=[['a',2,2],['b',3,2],['c',3,3]];}
 a.installations=[{id:'cart',kind:'wagon',...pose(3.2)}];b.installations=[{id:'cart',kind:'wagon',x:3.5,y:2.9,railFrom:{x:3,y:2},railTo:{x:3,y:3},railProgress:.4}];
 net.receive(a,'me',0);net.receive(b,'me',100);const wagon=net.scene(130,{},true).installations[0];
 assert(Math.abs(wagon.x-3.5)<1e-8);assert(Math.abs(wagon.y-2.55)<1e-8);
});
test('Arrêt immédiat du conducteur et descente sans interpolation entre deux véhicules',()=>{
 const net=createNetcode();net.setRTT(0);net.receive(state(2.5),'me',0);net.scene(16,{right:true},true);
 const stopped=net.scene(32,{},true).players[0];assert.equal(stopped.moving,false);
 const foot=state(6.5);delete foot.players[0].vehicleId;net.receive(foot,'me',50);
 assert.equal(net.scene(50,{},true).players[0].x,6.5);
});
test('Le lissage conserve les dernières ressources et la vie des occupants',()=>{
 const net=createNetcode(),a=state(2.5,{driver:false}),b=state(2.5,{driver:false});
 a.players[0].health=20;b.players[0].health=80;b.players[0].bag=12;
 net.receive(a,'me',0);net.receive(b,'me',100);
 for(const now of [100,130,180]){const player=net.scene(now,{},true).players[0];assert.equal(player.health,80);assert.equal(player.bag,12);}
});
test('Simulation autoritaire : deux occupants, conduite, trajet automatique et arrivée',()=>{
 const room={...world,installations:world.railMap.map(([id,x,y])=>({id,kind:'rail',x:x+.5,y:y+.5})),players:new Map()};
 const cart={id:'cart',kind:'wagon',x:2.5,y:2.5,face:{x:1,y:0}};room.installations.push(cart);
 for(const id of ['driver01','guest001']){const p={id,x:2.5,y:2.5,alive:true,connected:true,lastSeen:0,input:{}};room.players.set(id,p);wagonCommand(room,p,{id:'cart',action:'board'});}
 const driver=room.players.get('driver01');driver.input={right:true};
 for(let i=1;i<=6;i++){driver.lastSeen=i*50;railwayStep(room,.05,i*50);for(const p of room.players.values()){assert.equal(p.x,cart.x);assert.equal(p.y,cart.y);}assert(cart.moving);}
 driver.input={};const stopped=cart.x;railwayStep(room,.05,350);assert.equal(cart.x,stopped);
 wagonCommand(room,driver,{id:'cart',action:'route',stopId:'rail21'});
 for(let i=8;i<130;i++)railwayStep(room,.05,i*50);
 assert.equal(cart.x,22.5);assert.equal(cart.y,2.5);assert.equal(cart.arrived,true);
 for(const p of room.players.values())assert.equal(p.x,22.5);
});
