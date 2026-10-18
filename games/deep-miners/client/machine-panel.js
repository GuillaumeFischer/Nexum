import {drawTransferQuantity,transferCount} from './transfer-quantity.js';
import {MACHINE_PROFILES,COMMON_STOCK_CAPACITY,acceptsResource} from './machine-profile.js';
import {RESOURCES,capacity,weight} from './progression.js';
import {itemIcon,itemName,itemDescription} from './item-ui.js';
import {COOKING_RECIPES} from './agriculture.js';
import {ridersOf,WAGON_SEATS,WAGON_CAPACITY} from './railway.js';
const statuses={working:'En marche',riding:'Mineurs à bord',arrived:'Arrivée à destination',power:'Énergie manquante',fuel:'Bois manquant',materials:'Ingrédients manquants',full:'Stockage plein',idle:'Prêt',growing:'En croissance',charged:'Chargée',empty:'Épuisé'};
export function drawMachinePanel({state,me,machine,node,button,content,act,openMap,openWorkshop,draft={values:new Map()},refresh=()=>{}}){
 const profile=MACHINE_PROFILES[machine.kind]||{title:itemName(machine.kind,me)},buffer=machine.kind==='chest'?state.stock:machine.buffer||{},cap=machine.kind==='chest'?COMMON_STOCK_CAPACITY:machine.kind==='wagon'?WAGON_CAPACITY:['arm','conveyor','sorter'].includes(machine.kind)?8:40;
 const panel=node('article',undefined,'machine-panel '+machine.kind+'-panel'),hero=node('div',undefined,'machine-hero'),image=itemIcon(machine.kind,me,'machine-portrait'),intro=node('div');intro.append(node('h2',profile.title),node('p',profile.help,'muted'),node('strong',statuses[machine.status]||'Prêt','machine-status'));hero.append(image,intro);panel.append(hero);content.append(panel);
 if(machine.kind==='battery'){panel.append(node('p',`${Math.round(machine.energy||0)} / 60 énergie`));const meter=node('meter');meter.min=0;meter.max=60;meter.value=machine.energy||0;meter.setAttribute('aria-label','Énergie stockée');panel.append(meter);return;}
 if(machine.kind==='bench'){panel.append(button('Ouvrir l’atelier',openWorkshop));return;}
 if(machine.kind==='air')return;
 if(machine.kind==='wagon'){
  const riders=ridersOf(machine),onboard=me.vehicleId===machine.id,controls=node('div',undefined,'wagon-controls');
  controls.append(button(onboard?'Descendre · E':'Monter · E',()=>act('wagon',{id:machine.id,action:onboard?'exit':'board'}),!onboard&&(riders.length>=WAGON_SEATS||!!me.vehicleId)),button('Choisir la destination sur la carte',openMap,!onboard),button(machine.automatic?'Arrêter le trajet':'Navette automatique',()=>act('wagon',{id:machine.id,action:machine.automatic?'stop':'start'}),riders.length>0&&!onboard));panel.append(controls,node('p',`${riders.length} / ${WAGON_SEATS} mineurs · ${onboard?me.vehicleDriver?'Vous conduisez':'Vous êtes passager':'Places disponibles'}`));
  const crew=node('div',undefined,'wagon-crew');for(const id of riders){const p=state.players.find(p=>p.id===id);if(p){const badge=node('span',p.name+(id===machine.riderId?' · Conducteur':''),'stock-chip');badge.style.color=p.color;crew.append(badge);}}panel.append(crew);
 }
 if(!machine.buffer&&machine.kind!=='chest'&&machine.kind!=='stove')return;
 panel.append(node('p',`${weight(buffer)} / ${cap} unités${machine.kind==='chest'?' · partagé avec tous les coffres et l’atelier':''}`,'machine-capacity'));
 const space=Math.max(0,cap-weight(buffer)),usable=Object.keys(RESOURCES).filter(id=>acceptsResource(machine,id));
 const controls=node('div',undefined,'machine-actions');controls.append(button('Tout déposer',()=>act('transfer',{id:machine.id,direction:'deposit',all:true}),!usable.some(id=>me.cargo[id]>0&&space>=RESOURCES[id].weight)));panel.append(controls);
 function slot(id,output=false){
  const r=RESOURCES[id],tile=node('article',undefined,'machine-slot'+(output?' output-slot':'')),inBag=me.cargo[id]||0,stored=buffer[id]||0,maxDeposit=Math.min(inBag,Math.floor(space/r.weight)),maxTake=Math.min(stored,Math.floor(Math.max(0,capacity(me)-weight(me.cargo))/r.weight)),accepted=acceptsResource(machine,id);tile.append(itemIcon(id,me,'machine-slot-art'),node('strong',r.name),node('span',`${stored} ici · ${inBag} dans le sac`));
  const row=node('div',undefined,'slot-actions');
  const quantity=(direction,available)=>drawTransferQuantity({machine,resource:id,name:r.name,direction,available,draft,node,button,act,refresh});
  if(accepted){row.append(quantity('deposit',maxDeposit));tile.ondragover=e=>e.preventDefault();tile.ondrop=e=>{e.preventDefault();const dropped=e.dataTransfer?.getData('text/plain');if(dropped===id&&maxDeposit>0)void act('transfer',{id:machine.id,direction:'deposit',resource:id,count:transferCount(draft,machine.id+'-'+id+'-deposit',maxDeposit)});};}
  row.append(quantity('withdraw',maxTake));tile.append(row);return tile;
 }
 const workspace=node('div',undefined,'machine-workspace');panel.append(workspace);
 const inputs=profile.inputs===undefined?Object.keys(RESOURCES).filter(id=>buffer[id]>0||me.cargo[id]>0):profile.inputs,outputs=profile.outputs||[],grid=node('div',undefined,'machine-slot-grid');
 if(inputs.length){const section=node('section',undefined,'machine-input-section');section.append(node('h3',machine.kind==='chest'?'Ressources communes':'Cases d’entrée'));for(const id of inputs)grid.append(slot(id));section.append(grid);workspace.append(section);}
 if(outputs.length){const section=node('section',undefined,'machine-output-section');section.append(node('h3','Production'));const out=node('div',undefined,'machine-slot-grid');for(const id of outputs)if(machine.kind==='furnace'||buffer[id]>0)out.append(slot(id,true));if(!out.children.length)out.append(node('p','Aucune ressource produite pour le moment.','muted'));section.append(out);workspace.append(section);}
 const legacy=Object.keys(RESOURCES).filter(id=>buffer[id]>0&&!inputs.includes(id)&&!outputs.includes(id));if(legacy.length){panel.append(node('h3','Contenu conservé'));const out=node('div',undefined,'machine-slot-grid');for(const id of legacy)out.append(slot(id,true));panel.append(out);}
 if(machine.kind==='furnace'){panel.append(node('p','2 fers + 1 bois → 1 acier · 3 secondes'));const meter=node('meter');meter.min=0;meter.max=3;meter.value=machine.progress||0;meter.setAttribute('aria-label','Progression de la fonte');panel.append(meter);}
 if(machine.kind==='sorter'){const label=node('label','Ressource filtrée'),select=node('select');select.setAttribute('aria-label','Ressource filtrée');for(const [id,r]of Object.entries(RESOURCES)){const option=node('option',r.name);option.value=id;select.append(option);}select.value=machine.filter;select.onchange=()=>act('configure',{id:machine.id,resource:select.value});label.append(select);panel.append(label);}
 if(machine.kind==='stove'){
  panel.append(node('h3','Recettes'));const recipes=node('div',undefined,'cooking-recipes');for(const recipe of COOKING_RECIPES){const dish=node('article',undefined,'cooking-recipe');dish.append(itemIcon(recipe.output,me,'recipe-art'),node('h3',recipe.name),node('p',itemDescription(recipe.output,me)));for(const [id,n]of Object.entries(recipe.cost)){const row=node('div',undefined,'ingredient');row.append(itemIcon(id,me),node('span',`${itemName(id,me)} ${(buffer[id]||0)+(me.cargo[id]||0)} / ${n}`));dish.append(row);}dish.append(button('Préparer',()=>act('cook',{id:machine.id,recipe:recipe.id}),Object.entries(recipe.cost).some(([id,n])=>(buffer[id]||0)+(me.cargo[id]||0)<n)));recipes.append(dish);}panel.append(recipes);
 }
}
