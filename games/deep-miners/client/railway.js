export const RAIL_DIRECTIONS=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
export const WAGON_CAPACITY=160;
export const WAGON_SEATS=6;
export const ridersOf=w=>Array.isArray(w.riderIds)?w.riderIds:w.riderId?[w.riderId]:[];
export const railwayKey=(x,y)=>Math.floor(x)+','+Math.floor(y);
export function railIndex(world){return new Map((world.railMap?world.railMap.map(([id,x,y])=>({id,kind:'rail',x:x+.5,y:y+.5})):world.installations||[]).filter(s=>s.kind==='rail').map(s=>[railwayKey(s.x,s.y),s]));}
export function railMask(tracks,x,y){return RAIL_DIRECTIONS.reduce((mask,d,i)=>tracks.has(railwayKey(x+d.x,y+d.y))?mask|(1<<i):mask,0);}
export function railUsesCell(wagon,x,y){return Math.hypot(wagon.x-x-.5,wagon.y-y-.5)<.75||[wagon.railFrom,wagon.railTo].some(t=>t&&t.x===x&&t.y===y);}
const same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y;
const direction=input=>{const dx=Number(!!input.right)-Number(!!input.left),dy=Number(!!input.down)-Number(!!input.up);return dx||dy?Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)}:null;};

export function railStops(world){const tracks=railIndex(world);return [...tracks.values()].filter(r=>RAIL_DIRECTIONS.filter(d=>tracks.has(railwayKey(r.x+d.x,r.y+d.y))).length<=1).map(r=>({id:r.id,x:Math.floor(r.x)+.5,y:Math.floor(r.y)+.5}));}
export function findRailRoute(world,wagon,destination){
 const tracks=railIndex(world),end=railwayKey(destination.x,destination.y),start=wagon.railTo?railwayKey(wagon.railTo.x,wagon.railTo.y):railwayKey(Math.round(wagon.x-.5),Math.round(wagon.y-.5));
 if(!tracks.has(start)||!tracks.has(end))return null;
 const queue=[start],parents=new Map([[start,null]]);for(let i=0;i<queue.length&&!parents.has(end);i++){
  const [x,y]=queue[i].split(',').map(Number);for(const d of RAIL_DIRECTIONS){const key=railwayKey(x+d.x,y+d.y);if(tracks.has(key)&&!parents.has(key)){parents.set(key,queue[i]);queue.push(key);}}
 }
 if(!parents.has(end))return null;const route=[];for(let key=end;key!==null;key=parents.get(key)){const [x,y]=key.split(',').map(Number);route.push({x,y});}return route.reverse();
}

// Shared by server wagons and the local rider prediction. Never changes track
// cells, cargo or other vehicles. Movement stays on cardinal rail segments.
export function advanceRailVehicle(world,vehicle,input={},dt=0,automatic=false,tracks=railIndex(world)){
 const requested=direction(input),id=vehicle.vehicleId??vehicle.id;vehicle.moving=false;
 if(!automatic&&!requested)return vehicle;
 if(automatic&&vehicle.waitSeconds>0){vehicle.waitSeconds=Math.max(0,vehicle.waitSeconds-dt);return vehicle;}
 let remaining=Math.max(0,Math.min(.25,dt))*(input.sprint?6:4.8),from=vehicle.railFrom,to=vehicle.railTo,progress=vehicle.railProgress||0;
 if(from&&to&&requested&&same(requested,{x:from.x-to.x,y:from.y-to.y})){[from,to]=[to,from];progress=1-progress;}
 for(let step=0;step<8&&remaining>1e-8;step++){
  if(!from||!to){
   from={x:Math.round(vehicle.x-.5),y:Math.round(vehicle.y-.5)};
   if(!tracks.has(railwayKey(from.x,from.y)))break;
   const options=RAIL_DIRECTIONS.filter(d=>tracks.has(railwayKey(from.x+d.x,from.y+d.y))&&world.tiles[from.y+d.y]?.[from.x+d.x]===0);
   const face=vehicle.face||{x:0,y:1},back={x:-face.x,y:-face.y};
   while(vehicle.route?.length&&same(vehicle.route[0],from))vehicle.route.shift();
   if(automatic&&vehicle.destination&&!vehicle.route?.length){vehicle.automatic=false;vehicle.destination=null;vehicle.arrived=true;break;}
   const waypoint=automatic&&vehicle.destination?vehicle.route?.[0]:null;
   const forward=options.find(d=>same(d,face)),choice=waypoint?options.find(d=>same(d,{x:waypoint.x-from.x,y:waypoint.y-from.y})):options.find(d=>same(d,requested))||forward||options.find(d=>!same(d,back))||(automatic?options[0]:null);
   if(!choice)break;
   if(automatic&&!vehicle.destination&&!forward&&options.length===1&&same(choice,back)){vehicle.face=choice;vehicle.waitSeconds=2;break;}
   to={x:from.x+choice.x,y:from.y+choice.y};progress=0;
  }
  if(!tracks.has(railwayKey(from.x,from.y))||!tracks.has(railwayKey(to.x,to.y))||world.tiles[to.y]?.[to.x]!==0)break;
  const travel=Math.min(remaining,1-progress),next=progress+travel,x=from.x+.5+(to.x-from.x)*next,y=from.y+.5+(to.y-from.y)*next;
  if((world.installations||[]).some(w=>w.kind==='wagon'&&w.id!==id&&Math.hypot(w.x-x,w.y-y)<.8))break;
  vehicle.face={x:to.x-from.x,y:to.y-from.y};vehicle.x=x;vehicle.y=y;vehicle.moving=true;progress=next;remaining-=travel;
  if(progress>=1-1e-8){from=to;to=null;progress=0;if(automatic&&vehicle.destination&&same(from,vehicle.destination)){vehicle.automatic=false;vehicle.destination=null;vehicle.route=[];vehicle.arrived=true;remaining=0;}}
 }
 vehicle.railFrom=from;vehicle.railTo=to;vehicle.railProgress=progress;return vehicle;
}
