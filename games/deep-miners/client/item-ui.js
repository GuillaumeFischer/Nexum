import {MINERALS} from './minerals.js';
import {RESOURCES,BUILDINGS,TOOLS,capacity} from './progression.js';
import {FOODS,SEEDS} from './agriculture.js';
import {FARM_ICONS,AGRICULTURE_LAYOUT,AGRICULTURE_ASSET,AGRICULTURE_SIZE} from './agriculture-layout.js';
import {BUILDING_LAYOUT,BUILDING_ASSET,BUILDING_ATLAS_SIZE} from './building-layout.js';
import {RAIL_ASSET,WAGON_ASSET,RAIL_SIZE,WAGON_SIZE,WAGON_FRAMES,RAIL_BASES} from './railway-layout.js';

// Resource/tool icons keep the original atlas; constructions share the world sprites.
export const ICONS=['stone','gold','crystal','amethyst','copper','tin','iron','wood','rare','steel','food','pick0','pick1','pick2','pick3','pack0','pack','tank0','tank','lamp','air','drill','wall','floor','bridge','door','chest','bench','foundry','generator','battery','conveyor','arm','sorter','farm','decor'];
ICONS.push(...Object.keys(FARM_ICONS));
export const pickName=p=>['Pioche de départ','Pioche renforcée','Pioche de profondeur','Pioche en acier'][p?.pickTier||0];
export const itemName=(id,p)=>id==='pick'?pickName(p):RESOURCES[id]?.name||BUILDINGS[id]?.name||TOOLS[id]?.name||({lamp:'Torche de galerie',air:'Relais d’oxygène',drill:'Foreuse',pack:'Sac agrandi',pack0:'Sac de mineur',tank:'Réservoir amélioré',tank0:'Réservoir standard',foundry:'Atelier de forge'}[id])||id;
export function iconKey(id,p){return id==='pick'?'pick'+(p?.pickTier||0):id==='furnace'?'foundry':id;}
export function itemIcon(id,p,cls=''){
 if(Object.hasOwn(MINERALS,id)){const el=document.createElement('span');el.className='item-icon building-icon '+cls;el.setAttribute('aria-hidden','true');el.innerHTML=`<img src="${MINERALS[id].asset}" alt="" loading="lazy">`;return el;}
 if(id==='trash'){const el=document.createElement('span');el.className='item-icon building-icon '+cls;el.setAttribute('aria-hidden','true');el.innerHTML='<img src="assets/trash.webp" alt="" loading="lazy">';return el;}
 if(id==='lamp'){const el=document.createElement('span');el.className='item-icon building-icon '+cls;el.setAttribute('aria-hidden','true');el.innerHTML='<img src="assets/torch.webp" alt="" loading="lazy">';return el;}
 const el=document.createElement('span'),index=ICONS.indexOf(iconKey(id,p));el.className='item-icon '+cls;el.setAttribute('aria-hidden','true');
 if(id==='rail'||id==='wagon'){
  if(id==='rail'){el.className+=' building-icon';el.innerHTML='<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M4 17h56M4 45h56" stroke="#57452f" stroke-width="7"/><path d="M14 0v64M49 0v64" stroke="#414340" stroke-width="5"/><path d="M13 0v64M48 0v64" stroke="#abaaa1" stroke-width="1.5"/></svg>';return el;}
  const rect=id==='rail'?RAIL_BASES[0]:WAGON_FRAMES[2],asset=id==='rail'?RAIL_ASSET:WAGON_ASSET,atlas=id==='rail'?RAIL_SIZE:WAGON_SIZE,size=Math.max(rect.w,rect.h)+16;
  el.className+=' building-icon';el.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true"><svg x="${(size-rect.w)/2}" y="${(size-rect.h)/2}" width="${rect.w}" height="${rect.h}" viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}" overflow="hidden"><image href="${asset}" width="${atlas.width}" height="${atlas.height}"/></svg></svg>`;return el;
 }
 if(id==='hands'){
  el.className+=' building-icon';el.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="glove" x2=".8" y2="1"><stop stop-color="#eac387"/><stop offset="1" stop-color="#92633d"/></linearGradient></defs><path d="M22 51C18 48 13 40 10 35c-3-6 3-10 7-5l5 7V17c0-6 7-6 7 0v13-19c0-6 8-6 8 0v19-15c0-6 7-6 7 0v17-9c0-6 7-6 7 0v18c0 6-3 9-7 12v6H24v-8Z" fill="url(#glove)" stroke="#372519" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 36c7-3 13-3 19 0M28 42c4-2 9-2 13 0" fill="none" stroke="#815635" stroke-width="2" stroke-linecap="round"/><path d="M23 52h22v8H23Z" fill="#785535" stroke="#372519" stroke-width="2.5"/><path d="M26 55h16" stroke="#dcad70" stroke-width="2"/></svg>';return el;
 }
 if(Object.hasOwn(FARM_ICONS,id)){
  const rect=AGRICULTURE_LAYOUT[FARM_ICONS[id]],size=Math.max(rect.w,rect.h)+12,x=(size-rect.w)/2,y=(size-rect.h)/2;
  el.className+=' building-icon';el.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true"><svg x="${x}" y="${y}" width="${rect.w}" height="${rect.h}" viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}" overflow="hidden"><image href="${AGRICULTURE_ASSET}" width="${AGRICULTURE_SIZE.width}" height="${AGRICULTURE_SIZE.height}"/></svg></svg>`;return el;
 }
 const key=id==='foundry'?'furnace':id,rect=BUILDING_LAYOUT[key];
 if(rect){
  const size=Math.max(rect.w,rect.h)+16,x=(size-rect.w)/2,y=(size-rect.h)/2;
  el.className+=' building-icon';
  el.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false"><svg x="${x}" y="${y}" width="${rect.w}" height="${rect.h}" viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}" overflow="hidden"><image href="${BUILDING_ASSET}" width="${BUILDING_ATLAS_SIZE.width}" height="${BUILDING_ATLAS_SIZE.height}"/></svg></svg>`;
  return el;
 }
 if(index>=0){el.style.setProperty('--icon-x',`${index%6*20}%`);el.style.setProperty('--icon-y',`${Math.floor(index/6)*20}%`);}else el.className+=' icon-unknown';return el;
}
export function itemDescription(id,p){
 if(id==='trash')return 'E : choisir les objets ou ressources du sac à jeter, puis confirmer leur destruction. Fabrication : 3 fers et 2 bois.';
 if(id==='rail')return 'Pose les rails sur un sol dégagé ou un pont. Les lignes, virages et intersections se raccordent automatiquement. Quatre rails par fabrication.';
 if(id==='wagon')return 'À poser sur les rails. Stockage : 160 unités et six mineurs. E : monter ou descendre. M : carte et destination automatique. Le premier mineur à bord conduit avec ZQSD ; Maj accélère.';
 if(id==='pick')return 'Creuse les parois.';
 if(id==='shovel')return 'Clic ou Espace : préparer / enlever la terre vide. X : enlever une parcelle, même plantée. 1 : mains vides.';
 if(id==='stove')return 'E ouvre les recettes de cuisine. Dépose les ingrédients et le bois dans ses cases, ou utilise ceux de ton sac. Le four reste réservé à la métallurgie.';
 if(id==='wheat')return 'Ingrédient de cuisine : 3 blés et 1 bois donnent un pain rustique dans la cuisinière.';
 if(SEEDS[id])return 'Sélectionne ces graines puis clique sur une parcelle préparée avec la pelle. E récolte la plante mûre et rend une graine à replanter.';
 if(FOODS[id])return `Restaure ${FOODS[id].hunger} points de satiété${FOODS[id].health?' et '+FOODS[id].health+' points de vie':''}.`;
 if(RESOURCES[id])return id==='food'?'+15 % d’oxygène.':`${RESOURCES[id].weight} charge · ${RESOURCES[id].value} crédits`;
 return {lamp:'Éclaire les galeries.',air:'Recharge l’oxygène à proximité.',drill:'Extrait le gisement devant elle. Énergie requise.',wall:'Bloque le passage · R pour tourner avant la pose.',floor:'Habille le sol.',bridge:'Traverse l’eau et la lave.',door:'Ouvre et ferme un passage · E.',chest:'Stock commun de 50 000 unités, partagé entre tous les coffres et l’atelier · E.',bench:'Fabrique loin de la base · B.',furnace:'2 fers + 1 bois → 1 acier. Énergie requise.',generator:'Bois → énergie pour les machines voisines.',battery:'Réserve : 60 unités d’énergie.',conveyor:'Transporte les ressources vers sa sortie.',arm:'Transfère les ressources entre machines.',sorter:'Filtre une ressource · E.',farm:'Produit des champignons · E.',decor:'Repère lumineux.',pack:`Capacité : ${capacity(p)}.`,tank:'Consommation d’air −35 %.'}[id]||'';
}
export const recipeIcon=r=>iconKey(r.pick?'pick'+r.pick:r.foundry?'foundry':r.upgrade||r.item);
export const recipeCategory=r=>r.pick||r.upgrade||r.foundry||TOOLS[r.item]?'tools':['lamp','air','decor'].includes(r.item)?'light':['wall','floor','bridge','door','chest','bench','stove','trash'].includes(r.item)?'build':'machines';
export const uiNode=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
