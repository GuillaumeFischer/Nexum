import {BUILDINGS,canMine} from './progression.js';
import {installationSolid} from './physics.js';
import {visibleCell} from './world.js';
import {installationLimitReason} from './installation-limits.js';

export const PLACEMENT_REACH=2.2;
export const isPlaceable=kind=>!!BUILDINGS[kind]||['lamp','air','drill'].includes(kind);
export const facingTarget=p=>({x:Math.floor(p.x)+p.face.x,y:Math.floor(p.y)+p.face.y});
export function pointerTile(view,x,y){
  if(!view||!Number.isFinite(x)||!Number.isFinite(y))return null;
  return {x:Math.floor((x/view.zoom-view.ox)/64),y:Math.floor((y/view.zoom-view.oy)/64)};
}
export function placementFace(p,target){
  const dx=target.x+.5-p.x,dy=target.y+.5-p.y;
  if(Math.hypot(dx,dy)<.01)return {...p.face};
  return Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
}
// The ghost and the authoritative server use exactly the same placement rules.
export function checkPlacement(world,p,kind,target=facingTarget(p),rotation=0){
  const fail=reason=>({ok:false,reason,target});
  if(!target||!Number.isSafeInteger(target.x)||!Number.isSafeInteger(target.y))return fail('Case invalide.');
  if(!isPlaceable(kind))return fail('Construction inconnue.');
  if(kind==='wall'&&rotation!==0&&rotation!==1)return fail('Orientation du mur invalide.');
  if(world.mode!=='free'||world.phase!=='running'||!p.alive)return fail('Action indisponible.');
  if(p.vehicleId)return fail('Descends du wagon avant de construire.');
  if(!(p.items?.[kind]>0))return fail('Cet objet n’est plus dans ton sac.');
  const {x:tx,y:ty}=target,x=tx+.5,y=ty+.5,definition=BUILDINGS[kind],legacy=!definition;
  if(tx<1||ty<1||tx>=(world.world?.width||world.tiles[0].length)-1||ty>=(world.world?.height||world.tiles.length)-1)return fail('Emplacement hors de la mine.');
  if(Math.hypot(x-p.x,y-p.y)>PLACEMENT_REACH)return fail('Approche-toi de cette case.');
  const tile=world.tiles[ty]?.[tx];
  if(tile!==0&&!(definition?.floor&&[10,11].includes(tile)))return fail(legacy?'Installe cet équipement dans une galerie dégagée.':'Creuse cette case avant de construire.');
  if(!visibleCell(world.tiles,Math.floor(p.x),Math.floor(p.y),tx,ty))return fail('Une paroi bloque cet emplacement.');
  if(Math.hypot(x-17.5,y-3.5)<2.6)return fail(legacy?'Installe cet équipement dans une galerie dégagée, loin de l’ascenseur.':'Laisse libre l’accès à l’ascenseur.');
  if((world.structures||[]).some(s=>s.colliders?.some(b=>x+.5>b.x&&x-.5<b.x+b.w&&y+.5>b.y&&y-.5<b.y+b.h)))return fail('Laisse libre l’accès à l’ascenseur et aux portes.');
  const onCell=(world.installations||[]).filter(s=>Math.floor(s.x)===tx&&Math.floor(s.y)===ty);
  if(kind==='wagon'&&!onCell.some(s=>s.kind==='rail'))return fail('Pose le wagon sur des rails.');
  const layer=id=>id==='rail'?'rail':id==='wagon'?'vehicle':BUILDINGS[id]?.floor?'floor':'object';
  if(onCell.some(s=>layer(s.kind)===layer(kind)))return fail('Cette case est déjà équipée.');
  if((kind==='rail'||kind==='wagon')&&onCell.some(s=>installationSolid(s)||s.kind==='soil'))return fail('Laisse la voie libre pour les wagons.');
  if(layer(kind)==='object'&&onCell.some(s=>s.kind==='rail'))return fail('Enlève les rails avant de poser cette installation.');
  const solid=installationSolid({kind}),players=world.players instanceof Map?[...world.players.values()]:world.players;
  if(solid&&(players||[]).some(q=>Math.abs(q.x-x)<.75&&Math.abs(q.y-y)<.75))return fail('Un mineur occupe cette case.');
  const items=world.installations||[];
  if(items.some(s=>s.kind==='soil'&&Math.floor(s.x)===tx&&Math.floor(s.y)===ty))return fail('Enlève la parcelle avec la pelle avant de construire.');
  const limitReason=installationLimitReason(world,kind);if(limitReason)return fail(limitReason);
  const face=placementFace(p,target);
  if(kind==='drill'){const ore=world.tiles[ty+face.y]?.[tx+face.x];if(!canMine(p,ore)||!(ore>=2))return fail('Oriente la foreuse vers un minerai accessible à ta pioche.');}
  return {ok:true,reason:'',target,x,y,tile,face,solid,...(kind==='wall'?{rotation}:{})};
}
