import {railIndex,railwayKey,RAIL_DIRECTIONS} from './railway.js';
const center=p=>({x:p.x+.5,y:p.y+.5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const endpoints=p=>p.railFrom&&p.railTo?[p.railFrom,p.railTo]:[{x:Math.round(p.x-.5),y:Math.round(p.y-.5)}];
const pose=p=>({x:p.x,y:p.y,face:p.face,railFrom:p.railFrom,railTo:p.railTo,railProgress:p.railProgress});

// Interpolate along the track, including its corners, rather than cutting
// diagonally through walls. Also used for small prediction corrections.
export function blendRailPose(world,a,b,f,tracks=railIndex(world)){
  if(f<=0)return pose(a);if(f>=1||distance(a,b)>3)return pose(b);
  if(distance(a,b)<1e-8)return pose(b);
  const open=p=>tracks.has(railwayKey(p.x,p.y))&&world.tiles[p.y]?.[p.x]===0;
  let points=null;
  if(Math.abs(a.y-b.y)<1e-7||Math.abs(a.x-b.x)<1e-7){
    const horizontal=Math.abs(a.y-b.y)<1e-7,axis=horizontal?'x':'y',fixed=horizontal?'y':'x';
    let valid=Math.abs(a[fixed]-.5-Math.round(a[fixed]-.5))<1e-7;
    for(let n=Math.floor(Math.min(a[axis],b[axis])-.5+1e-7);valid&&n<=Math.ceil(Math.max(a[axis],b[axis])-.5-1e-7);n++)valid=open({[axis]:n,[fixed]:Math.round(a[fixed]-.5)});
    if(valid)points=[a,b];
  }
  if(!points){
    let best=Infinity;
    for(const start of endpoints(a)){
      if(!open(start))continue;
      const queue=[start],parents=new Map([[railwayKey(start.x,start.y),null]]),depth=new Map([[railwayKey(start.x,start.y),0]]);
      for(let i=0;i<queue.length&&i<100;i++){
        const node=queue[i],key=railwayKey(node.x,node.y),steps=depth.get(key);
        for(const end of endpoints(b))if(node.x===end.x&&node.y===end.y){
          const cost=distance(a,center(start))+steps+distance(center(end),b);
          if(cost<best){const route=[];for(let k=key;k!==null;k=parents.get(k)){const [x,y]=k.split(',').map(Number);route.push(center({x,y}));}best=cost;points=[a,...route.reverse(),b];}
        }
        if(steps>=5)continue;
        for(const d of RAIL_DIRECTIONS){const next={x:node.x+d.x,y:node.y+d.y},k=railwayKey(next.x,next.y);if(!parents.has(k)&&open(next)){parents.set(k,key);depth.set(k,steps+1);queue.push(next);}}
      }
    }
  }
  if(!points)return pose(b);
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  let remaining=lengths.reduce((sum,n)=>sum+n,0)*f;
  for(let i=0;i<lengths.length;i++){
    const length=lengths[i];if(length<1e-8)continue;
    if(remaining>length&&i<lengths.length-1){remaining-=length;continue;}
    const start=points[i],end=points[i+1],ratio=Math.min(1,remaining/length),x=start.x+(end.x-start.x)*ratio,y=start.y+(end.y-start.y)*ratio;
    const horizontal=Math.abs(end.x-start.x)>1e-7,axis=horizontal?'x':'y',fixed=horizontal?'y':'x',value=horizontal?x:y,other=Math.round((horizontal?y:x)-.5),sign=Math.sign(end[axis]-start[axis]);
    const low=Math.floor(value-.5+1e-8),progress=value-.5-low,face={x:horizontal?sign:0,y:horizontal?0:sign};
    if(progress<1e-7)return {x,y,face,railFrom:{[axis]:low,[fixed]:other},railTo:null,railProgress:0};
    return {x,y,face,railFrom:{[axis]:sign>0?low:low+1,[fixed]:other},railTo:{[axis]:sign>0?low+1:low,[fixed]:other},railProgress:sign>0?progress:1-progress};
  }
  return pose(b);
}
