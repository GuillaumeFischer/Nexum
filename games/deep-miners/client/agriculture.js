import {visibleCell} from './world.js';
import {installationLimitReason} from './installation-limits.js';

export const CROPS={
 carrot:{name:'Carotte',seed:'carrotSeed',produce:'carrot',seconds:90,yield:3,row:0,price:4},
 potato:{name:'Pomme de terre',seed:'potatoSeed',produce:'potato',seconds:120,yield:3,row:1,price:5},
 tomato:{name:'Tomate',seed:'tomatoSeed',produce:'tomato',seconds:150,yield:3,row:2,price:6},
 wheat:{name:'Blé',seed:'wheatSeed',produce:'wheat',seconds:180,yield:3,row:3,price:4}
};
export const SEEDS=Object.fromEntries(Object.entries(CROPS).map(([id,c])=>[c.seed,{crop:id,price:c.price,name:'Graines · '+c.name}]));
export const FOODS={food:{hunger:18,health:0,oxygen:15},carrot:{hunger:10,health:1},potato:{hunger:12,health:1},tomato:{hunger:10,health:1},soup:{hunger:45,health:8},stew:{hunger:65,health:12},skillet:{hunger:75,health:15},bread:{hunger:55,health:6}};
export const COOKING_RECIPES=[
 {id:'soup',name:'Soupe du potager',cost:{carrot:2,tomato:1,wood:1},output:'soup'},
 {id:'stew',name:'Ragoût de champignons',cost:{potato:2,food:2,wood:1},output:'stew'},
 {id:'skillet',name:'Poêlée du mineur',cost:{potato:2,tomato:2,food:1,wood:1},output:'skillet'},
 {id:'bread',name:'Pain rustique',cost:{wheat:3,wood:1},output:'bread'}
];
export const cropStage=plot=>{const c=CROPS[plot?.crop];return c?Math.min(3,Math.floor(Math.max(0,plot.growth||0)/c.seconds*4)):0;};
export const cropReady=plot=>!!CROPS[plot?.crop]&&(plot.growth||0)>=CROPS[plot.crop].seconds;
export const fieldAt=(world,target)=>world.installations?.find(s=>s.kind==='soil'&&Math.floor(s.x)===target.x&&Math.floor(s.y)===target.y);
export const fieldTarget=p=>({x:Math.floor(p.x)+p.face.x,y:Math.floor(p.y)+p.face.y});
export const isFieldItem=id=>id==='shovel'||!!SEEDS[id];
export function checkField(world,p,target=fieldTarget(p)){
 const fail=reason=>({ok:false,reason,target});
 if(!target||!Number.isSafeInteger(target.x)||!Number.isSafeInteger(target.y))return fail('Case invalide.');
 if(world.mode!=='free'||world.phase!=='running'||!p.alive)return fail('Action indisponible.');
 const {x,y}=target;
 if(x<1||y<1||x>=(world.world?.width||world.tiles[0].length)-1||y>=(world.world?.height||world.tiles.length)-1)return fail('Emplacement hors de la mine.');
 if(Math.hypot(x+.5-p.x,y+.5-p.y)>2.2)return fail('Approche-toi de cette case.');
 if(world.tiles[y]?.[x]!==0)return fail('Choisis une galerie dégagée.');
 if(!visibleCell(world.tiles,Math.floor(p.x),Math.floor(p.y),x,y))return fail('Une paroi bloque cette case.');
 return {ok:true,reason:'',target,plot:fieldAt(world,target)};
}
export function fieldActionReason(world,p,id,target){
 const result=checkField(world,p,target);if(!result.ok)return result.reason;
 if(id==='shovel'){
  if(!(p.items?.shovel>0))return 'Fabrique une pelle à l’atelier.';
  if(result.plot?.crop)return cropReady(result.plot)?'Récolte la plante avec E avant d’enlever la terre.':'La plante pousse · X retire la parcelle et sa culture.';
  if(result.plot)return '';
  if(Math.hypot(target.x+.5-17.5,target.y+.5-3.5)<2.6)return 'Laisse libre l’accès à l’ascenseur.';
  if((world.installations||[]).some(s=>Math.floor(s.x)===target.x&&Math.floor(s.y)===target.y))return 'Enlève la construction avant de cultiver.';
  if((world.structures||[]).some(s=>s.colliders?.some(b=>target.x+1>b.x&&target.x<b.x+b.w&&target.y+1>b.y&&target.y<b.y+b.h)))return 'Laisse libre l’accès aux installations.';
  const reason=installationLimitReason(world,'soil');if(reason)return reason;
  return '';
 }
 if(SEEDS[id])return !(p.cargo?.[id]>0)?'Aucune graine dans le sac.':!result.plot?'Prépare la terre avec la pelle.':result.plot.crop?'Cette parcelle est déjà plantée.':'';
 return 'Sélectionne la pelle ou des graines.';
}
