import {capacity,BUILDINGS} from './progression.js';
import {advanceRailVehicle} from './railway.js';
export const PLAYER_RADIUS=.22;
export const strength=t=>t===1?.55:t===12?2.4:t===4||t===7?1.6:t===8?.35:1;

export function installationSolid(s){
  if(s.kind==='lamp'||s.kind==='door'&&s.open)return false;
  return !!(s.solid||BUILDINGS[s.kind]?.solid||['lamp','air','drill','arm','sorter','decor'].includes(s.kind));
}
export function canMove(world,x,y,from=null){
  const r=PLAYER_RADIUS;
  for(const [dx,dy]of [[-r,-r],[r,-r],[-r,r],[r,r]])if(world.tiles[Math.floor(y+dy)]?.[Math.floor(x+dx)]!==0)return false;
  for(const s of world.structures||[])for(const b of s.colliders||[])if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return false;
  for(const s of world.installations||[])if(installationSolid(s)&&x+r>s.x-.5&&x-r<s.x+.5&&y+r>s.y-.5&&y-r<s.y+.5){
    // Old saves could place equipment under a miner. Allow only movement out.
    if(from&&Math.abs(from.x-s.x)<.5+r&&Math.abs(from.y-s.y)<.5+r&&Math.hypot(x-s.x,y-s.y)>Math.hypot(from.x-s.x,from.y-s.y))continue;
    return false;
  }
  return true;
}

// Shared by the authoritative simulation and visual local prediction.
export function movePlayer(world,p,input,dt){
  if(p.vehicleId){if(p.vehicleDriver&&p.vehicleAutomatic&&(input.up||input.down||input.left||input.right)){p.vehicleAutomatic=false;p.destination=null;p.route=[];}if(!p.vehicleDriver&&!p.vehicleAutomatic)return p;return advanceRailVehicle(world,p,p.vehicleAutomatic?{}:input,dt,!!p.vehicleAutomatic);}
  const oldX=p.x,oldY=p.y;
  let dx=Number(!!input.right)-Number(!!input.left),dy=Number(!!input.down)-Number(!!input.up);
  p.moving=false;
  if(!dx&&!dy)return p;
  const norm=Math.hypot(dx,dy);dx/=norm;dy/=norm;
  p.face=Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
  const distance=(input.sprint?4.8:3.1)*(1-p.bag/(capacity(p)*2.5))*Math.max(0,Math.min(.25,dt));
  const steps=Math.max(1,Math.ceil(distance/.1)),step=distance/steps;
  for(let k=0;k<steps;k++){
    if(canMove(world,p.x+dx*step,p.y,p))p.x+=dx*step;
    if(canMove(world,p.x,p.y+dy*step,p))p.y+=dy*step;
  }
  p.moving=p.x!==oldX||p.y!==oldY;return p;
}
