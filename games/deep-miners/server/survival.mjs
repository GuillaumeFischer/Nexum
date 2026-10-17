import {quickbarIds,carriedCount} from '../client/progression.js';
export function normalizeMiner(p){
 p.hunger=Number.isFinite(p.hunger)?Math.max(0,Math.min(100,p.hunger)):100;
 p.health=Number.isFinite(p.health)?Math.max(0,Math.min(100,p.health)):p.alive?100:0;
 p.selectedSlot=Number.isInteger(p.selectedSlot)&&p.selectedSlot>=-1&&p.selectedSlot<9?p.selectedSlot:0;
 const id=quickbarIds(p)[p.selectedSlot];p.heldItem=id&&carriedCount(p,id)>0?id:null;return p;
}
export function survivalStep(p,input,dt){
 p.hunger=Math.max(0,p.hunger-dt*(.025+(p.moving?.025:0)+(input.sprint?.02:0)+(input.mine?.015:0)));
 const damage=(p.hunger<=0?.65:0)+(p.o2<=0?3:0);
 if(damage)p.health=Math.max(0,p.health-damage*dt);
 else if(p.hunger>=70&&p.o2>=25)p.health=Math.min(100,p.health+dt*.3);
 p.actionSeconds=Math.max(0,(p.actionSeconds||0)-dt);
}
