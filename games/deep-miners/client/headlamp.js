import {resourceFor} from './progression.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function rayDistance(tiles, x, y, angle, max, blocks=(gx,gy)=>tiles[gy]?.[gx]!==0) {
  // Visit grid boundaries, rather than sampling the same tile dozens of times.
  let gx=Math.floor(x),gy=Math.floor(y);
  if(blocks(gx,gy))return 0;
  const dx=Math.cos(angle),dy=Math.sin(angle),sx=dx>=0?1:-1,sy=dy>=0?1:-1;
  const stepX=Math.abs(dx)<1e-10?Infinity:Math.abs(1/dx),stepY=Math.abs(dy)<1e-10?Infinity:Math.abs(1/dy);
  let nextX=(sx>0?gx+1-x:x-gx)*stepX,nextY=(sy>0?gy+1-y:y-gy)*stepY;
  if(!Number.isFinite(stepX))nextX=Infinity;if(!Number.isFinite(stepY))nextY=Infinity;
  while(Math.min(nextX,nextY)<=max){
    const d=Math.min(nextX,nextY);
    if(Math.abs(nextX-nextY)<1e-9){
      // A diagonal ray must not leak between two touching walls.
      if(blocks(gx+sx,gy)||blocks(gx,gy+sy))return d;
      gx+=sx;gy+=sy;nextX+=stepX;nextY+=stepY;
    }else if(nextX<nextY){gx+=sx;nextX+=stepX;}else{gy+=sy;nextY+=stepY;}
    if(blocks(gx,gy))return d;
  }
  return max;
}

export function headlampRay(tiles,p,angle,max,blocks=(x,y)=>tiles[y]?.[x]!==0,walls=new Set()){
 const hit=rayDistance(tiles,p.x,p.y,angle,max,blocks),dx=Math.cos(angle),dy=Math.sin(angle);
 let end=hit;
 // Count crossed wall cells, rather than adding a fixed distance that could
 // shine through a third layer on diagonals. Fog and map boundaries stay dark.
 for(let layer=0;layer<2&&end<max;layer++){
  const x=Math.floor(p.x+dx*(end+1e-6)),y=Math.floor(p.y+dy*(end+1e-6));
  if(!blocks(x,y)||!(resourceFor(tiles[y]?.[x])||walls.has(x+','+y)))break;
  const exitX=dx>1e-9?(x+1-p.x)/dx:dx<-1e-9?(x-p.x)/dx:Infinity;
  const exitY=dy>1e-9?(y+1-p.y)/dy:dy<-1e-9?(y-p.y)/dy:Infinity;
  end=Math.min(max,exitX,exitY);
 }
 return {hit,end};
}
export function headlampRayDistance(tiles,p,angle,max,blocks,walls){return headlampRay(tiles,p,angle,max,blocks,walls).end;}
export function headlampWallTransmission(depth){const t=clamp(depth,0,1);return 1-t*t*(3-2*t);}

// Discovery supplies the two rock layers to the renderer without revealing an
// open gallery behind a wall. Placement and movement retain their own rules.
export function headlampRevealsCell(tiles,cx,cy,x,y){
 if(!resourceFor(tiles[y]?.[x]))return false;
 const dx=x-cx,dy=y-cy,distance=Math.hypot(dx,dy);
 return headlampRay(tiles,{x:cx+.5,y:cy+.5},Math.atan2(dy,dx),distance+1e-5).end>=distance;
}
