import {dropFor} from './minerals.js';
export const RESOURCES={stone:{name:'Pierre',color:'#b9b4a6',weight:1,value:1},gold:{name:'Or',color:'#e4ac52',weight:2,value:12},crystal:{name:'Turquoise',color:'#65d4d9',weight:3,value:18},amethyst:{name:'Améthyste',color:'#b49aeb',weight:4,value:28},copper:{name:'Cuivre',color:'#dd9871',weight:1,value:4},tin:{name:'Étain',color:'#b4c5d0',weight:1,value:5},iron:{name:'Fer',color:'#93a0ae',weight:2,value:8},wood:{name:'Bois',color:'#a8c57a',weight:1,value:2},rare:{name:'Obsidiane astrale',color:'#db9ffc',weight:4,value:60},steel:{name:'Acier',color:'#d3dee3',weight:2,value:15},food:{name:'Champignon cultivé',color:'#d9bf8a',weight:1,value:5}};
import {CROPS,SEEDS,FOODS} from './agriculture.js';
for(const [id,c]of Object.entries(CROPS)){RESOURCES[c.seed]={name:SEEDS[c.seed].name,color:'#bcca74',weight:1,value:0};RESOURCES[c.produce]={name:c.name,color:['#e7a05e','#d4b481','#e57766','#d7bc68'][c.row],weight:1,value:0};}
for(const [id,name]of Object.entries({soup:'Soupe du potager',stew:'Ragoût de champignons',skillet:'Poêlée du mineur',bread:'Pain rustique'}))RESOURCES[id]={name,color:'#e4b985',weight:1,value:0};
export const TOOLS={shovel:{name:'Pelle agricole'}};
export const emptyStock=()=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,0]));
export const capacity=p=>p.capacity||80;
export const weight=stock=>Object.entries(RESOURCES).reduce((total,[id,r])=>total+(stock?.[id]||0)*r.weight,0);
export const resourceFor=t=>dropFor(t)?.resource;
export const harvestFits=(p,t)=>{const drop=dropFor(t);return !!drop&&weight(p.cargo)+RESOURCES[drop.resource].weight*drop.count<=capacity(p);};
export const requiredPick=t=>t===12?3:t===4?2:t===3||t===7?1:0;
export const canMine=(p,t)=>!!resourceFor(t)&&(p.pickTier||0)>=requiredPick(t);
export const miningRate=p=>[1,1.45,2.1,3.1][p.pickTier||0];
export const biomeFor=y=>y>=34?{name:'FAILLES TOXIQUES',tier:2,color:'#b49aeb'}:y>=20?{name:'VEINES CRISTALLINES',tier:1,color:'#65d4d9'}:{name:'GALERIES ANCIENNES',tier:0,color:'#dfb15e'};
export const RECIPES=[
 {id:'shovel',name:'Pelle agricole',description:'Prépare un sol cultivable et enlève les parcelles. Sélectionne la pelle puis clique sur le sol.',cost:{stone:4,wood:3},item:'shovel',count:1},
 {id:'pick1',name:'Pioche renforcée',description:'Creuse 45 % plus vite et extrait la turquoise.',cost:{stone:12,gold:6},pick:1},
 {id:'foundry',name:'Atelier de forge',description:'Installation commune : débloque la pioche avancée et les foreuses.',cost:{stone:20,gold:10,crystal:6},foundry:true},
 {id:'pick2',name:'Pioche de profondeur',description:'Creuse 2,1 fois plus vite et extrait l’améthyste.',cost:{stone:12,gold:8,crystal:4},pick:2,needsFoundry:true},
 {id:'pack',name:'Sac agrandi',description:'Porte 120 unités de charge au lieu de 80.',cost:{stone:10,gold:4,crystal:3},upgrade:'pack'},
 {id:'tank',name:'Réservoir amélioré',description:'Réduit de 35 % la consommation d’air.',cost:{stone:8,gold:4,crystal:4},upgrade:'tank'},
 {id:'lamp',name:'Deux torches',description:'Pose-les avec F pour éclairer durablement le chemin.',cost:{stone:2,gold:1},item:'lamp',count:2},
 {id:'air',name:'Relais d’oxygène',description:'Pose-le avec R. Recharge l’air à proximité.',cost:{stone:8,gold:2,crystal:2},item:'air',count:1,needsPick:1},
 {id:'drill',name:'Foreuse avec caisse',description:'Pose-la avec G devant un minerai. E récupère sa production.',cost:{stone:12,gold:6,crystal:4},item:'drill',count:1,needsPick:2,needsFoundry:true}
];
export function recipeReason(recipe,world,p){
 if(!recipe)return 'Recette inconnue.';
 if(!p.alive)return 'Reviens à la base après avoir repris connaissance.';
 if(recipe.pick&&(p.pickTier||0)>=recipe.pick)return 'Déjà équipée.';
 if(recipe.pick===2&&(p.pickTier||0)<1)return 'Fabrique d’abord la pioche renforcée.';
 if(recipe.pick===3&&(p.pickTier||0)<2)return 'Fabrique d’abord la pioche de profondeur.';
 if(recipe.foundry&&world.base?.foundry)return 'Déjà construite.';
 if(recipe.upgrade==='pack'&&capacity(p)>80||recipe.upgrade==='tank'&&p.tank)return 'Déjà équipée.';
 if(recipe.needsFoundry&&!world.base?.foundry)return 'Construis l’atelier de forge.';
 if(recipe.needsPick>(p.pickTier||0))return 'Améliore ta pioche.';
 if(recipe.item&&(recipe.item==='rail'?(p.items?.rail||0)+recipe.count>200:(p.items?.[recipe.item]||0)>=20))return 'Équipement transporté au maximum.';
 if(Object.entries(recipe.cost).some(([id,n])=>(world.stock?.[id]||0)<n))return 'Stock commun insuffisant.';
 return '';
}
export const BUILDINGS={
 trash:{name:'Poubelle',cost:{iron:3,wood:2},solid:true},
 rail:{name:'Rails',cost:{iron:2,wood:2},batch:4},wagon:{name:'Wagon',cost:{iron:8,wood:6,copper:4},storage:true},
 stove:{name:'Cuisinière',cost:{stone:8,iron:4,wood:3},solid:true,storage:true},
 wall:{name:'Mur de pierre',cost:{stone:3},solid:true},floor:{name:'Sol pavé',cost:{stone:2},floor:true},bridge:{name:'Pont en bois',cost:{wood:3},floor:true},door:{name:'Porte',cost:{wood:4,copper:2},solid:true},chest:{name:'Coffre',cost:{wood:5,copper:2},solid:true,storage:true},bench:{name:'Établi',cost:{wood:6,stone:4},solid:true},furnace:{name:'Four',cost:{stone:12,copper:4},solid:true,storage:true,machine:true},generator:{name:'Générateur',cost:{iron:6,copper:8},solid:true,storage:true,machine:true},battery:{name:'Batterie',cost:{iron:4,crystal:4},solid:true,machine:true},conveyor:{name:'Convoyeur',cost:{tin:2,copper:1},storage:true,machine:true},arm:{name:'Bras mécanique',cost:{iron:3,copper:2},storage:true,machine:true},sorter:{name:'Trieur',cost:{iron:4,tin:3},storage:true,machine:true},farm:{name:'Culture de champignons',cost:{wood:4,stone:2},machine:true},decor:{name:'Balise décorative',cost:{stone:2,crystal:1}}
};
RECIPES.push({id:'pickCopper',name:'Pioche en cuivre',description:'Alternative à la pioche renforcée : +45 % de vitesse, accès au fer et à la turquoise.',cost:{stone:8,copper:8},pick:1},{id:'pickIron',name:'Pioche en fer',description:'Alternative à la pioche de profondeur : +110 % de vitesse, accès à l’améthyste.',cost:{stone:12,iron:8,copper:4},pick:2,needsFoundry:true},{id:'pick3',name:'Pioche en acier',description:'Creuse 3,1 fois plus vite et extrait l’obsidiane astrale.',cost:{steel:12,amethyst:6,crystal:8},pick:3,needsFoundry:true},...Object.entries(BUILDINGS).map(([id,b])=>({id,name:id==='rail'?'Quatre rails':b.name,description:id==='rail'?'Pose une ligne sur le sol ou les ponts. Virages et intersections se raccordent automatiquement.':id==='wagon'?'160 unités de ressources et six mineurs. E monte ou descend ; la carte choisit un arrêt.':b.floor?'Crée un passage, même au-dessus de l’eau ou de la lave.':b.storage?'Stocke des ressources. E ouvre la gestion de la machine ou du coffre.':'Installation sur grille. Oriente-toi puis pose-la avec la barre rapide.',cost:b.cost,item:id,count:b.batch||1,needsPick:['generator','battery','arm','sorter'].includes(id)?2:0})));
export function inventorySlots(p){const entries=[...Object.entries(p.cargo||{}).filter(([,n])=>n>0).map(([id,count])=>({id,count,type:'resource'})),...Object.entries(p.items||{}).filter(([,n])=>n>0).map(([id,count])=>({id,count,type:TOOLS[id]?'tool':'building'}))],order=p.inventoryOrder||[],slots=Array(72).fill(null);for(let i=0;i<Math.min(order.length,slots.length);i++)slots[i]=entries.find(e=>e.id===order[i])||null;for(const entry of entries)if(!slots.some(s=>s?.id===entry.id)){const i=slots.indexOf(null);if(i>=0)slots[i]=entry;}return slots;}

export const QUICKBAR_DEFAULT=['pick','lamp','wall','floor','air','chest','bridge','food',null];
export const isQuickbarItem=id=>id==='pick'||Object.hasOwn(TOOLS,id)||Object.hasOwn(RESOURCES,id)||Object.hasOwn(BUILDINGS,id)||['lamp','air','drill'].includes(id);
export function quickbarIds(p){return Array.from({length:9},(_,i)=>Array.isArray(p.quickbar)?p.quickbar[i]??null:QUICKBAR_DEFAULT[i]);}
export function carriedCount(p,id){return id==='pick'?1:RESOURCES[id]?p.cargo?.[id]||0:p.items?.[id]||0;}
