import {MACHINE_REACH} from '../client/machine-profile.js';
import {CROPS,SEEDS,COOKING_RECIPES,FOODS,fieldTarget,checkField,fieldActionReason,cropReady} from '../client/agriculture.js';
import {capacity,weight,RESOURCES} from '../client/progression.js';

export function harvest(room,p,target=fieldTarget(p),sound=()=>{}){
 const r=checkField(room,p,target);if(!r.ok)throw Error(r.reason);
 if(!r.plot?.crop)throw Error('Aucune plante à récolter.');
 if(!cropReady(r.plot))throw Error('La plante pousse encore.');
 const c=CROPS[r.plot.crop],added=c.yield*RESOURCES[c.produce].weight+RESOURCES[c.seed].weight;
 if(weight(p.cargo)+added>capacity(p))throw Error('Libère de la place pour la récolte et sa graine.');
 p.cargo[c.produce]=(p.cargo[c.produce]||0)+c.yield;p.cargo[c.seed]=(p.cargo[c.seed]||0)+1;p.bag=weight(p.cargo);
 r.plot.crop=null;r.plot.growth=0;p.actionSeconds=.45;sound(room,'deposit',p);return true;
}
export function agricultureCommand(room,p,msg,event,sound){
 if(msg.type==='harvest')return harvest(room,p,msg.target,sound);
 if(msg.type==='till'||msg.type==='plant'){
  const id=msg.type==='till'?'shovel':msg.seed,target=msg.target??fieldTarget(p);
  if(p.heldItem!==id)throw Error('Sélectionne cet objet dans la barre rapide.');
  const reason=fieldActionReason(room,p,id,target);if(reason)throw Error(reason);
  const {plot}=checkField(room,p,target);
  if(msg.type==='till'){
   if(plot)room.installations=room.installations.filter(s=>s.id!==plot.id);
   else room.installations.push({id:room.nextInstallation++,kind:'soil',x:target.x+.5,y:target.y+.5,solid:false,crop:null,growth:0});
   room.mapVersion++;room.revision++;
  }else {plot.crop=SEEDS[id].crop;plot.growth=0;p.cargo[id]--;p.bag=weight(p.cargo);}
  p.actionSeconds=.45;sound(room,'deposit',p);return;
 }
 if(msg.type==='cook'){
  const stove=room.installations.find(s=>s.id===msg.id&&s.kind==='stove');
  if(!stove||Math.hypot(stove.x-p.x,stove.y-p.y)>MACHINE_REACH)throw Error('Approche-toi de la cuisinière.');
  const recipe=COOKING_RECIPES.find(r=>r.id===msg.recipe);if(!recipe)throw Error('Recette de cuisine inconnue.');
  stove.buffer??={};if(Object.entries(recipe.cost).some(([id,n])=>(p.cargo[id]||0)+(stove.buffer[id]||0)<n))throw Error('Ingrédients manquants dans le sac.');
  const next={...p.cargo},buffer={...stove.buffer};for(const [id,n]of Object.entries(recipe.cost)){const take=Math.min(buffer[id]||0,n);buffer[id]=(buffer[id]||0)-take;next[id]-=n-take;}next[recipe.output]=(next[recipe.output]||0)+1;
  if(weight(next)>capacity(p))throw Error('Sac plein.');stove.buffer=buffer;p.cargo=next;p.bag=weight(next);p.actionSeconds=.45;
  event(room,`${p.name} prépare : ${recipe.name}.`);sound(room,'quota',p);return;
 }
 throw Error('Action agricole inconnue.');
}
export function cropStep(room,dt){for(const plot of room.installations||[])if(plot.kind==='soil'&&CROPS[plot.crop])plot.growth=Math.min(CROPS[plot.crop].seconds,(plot.growth||0)+dt);}
export function removeField(room,p,sound){
 if(p.heldItem!=='shovel'||!(p.items?.shovel>0))return false;
 const r=checkField(room,p);if(!r.ok||!r.plot)return false;
 room.installations=room.installations.filter(s=>s.id!==r.plot.id);room.mapVersion++;room.revision++;p.actionSeconds=.45;sound(room,'deposit',p);return true;
}
export function eatFood(room,p,id='food',sound=()=>{}){
 const food=FOODS[id];if(!food||!(p.cargo[id]>0))throw Error('Aucun aliment de ce type dans le sac.');
 if((p.hunger??100)>=100&&(p.health??100)>=100&&(!food.oxygen||p.o2>=100))throw Error('Tu es déjà rassasié et en pleine santé.');
 p.cargo[id]--;p.bag=weight(p.cargo);p.hunger=Math.min(100,(p.hunger??100)+food.hunger);p.health=Math.min(100,(p.health??100)+food.health);if(food.oxygen)p.o2=Math.min(100,p.o2+food.oxygen);sound(room,'refill',p);
}
