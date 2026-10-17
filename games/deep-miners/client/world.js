export const CHUNK_SIZE=16, WORLD_SIZE=4096;
export const BIOMES=[
 {id:'rock',name:'GROTTES ROCHEUSES',color:'#ccb38b',tint:'#92724816',tier:0},
 {id:'crystal',name:'GROTTES CRISTALLINES',color:'#70dce7',tint:'#269ea52b',tier:1},
 {id:'forest',name:'FORÊTS SOUTERRAINES',color:'#b3d989',tint:'#447d382e',tier:1},
 {id:'ruins',name:'RUINES ANCIENNES',color:'#e6c697',tint:'#af8b5530',tier:2},
 {id:'water',name:'CAVERNES ENGLOUTIES',color:'#79bddb',tint:'#22678d35',tier:2},
 {id:'volcano',name:'GROTTES VOLCANIQUES',color:'#efa16d',tint:'#ac3c2435',tier:3},
 {id:'deep',name:'PROFONDEURS MYSTÉRIEUSES',color:'#bba0e4',tint:'#65349b32',tier:3}
];
export function seedNumber(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function randomAt(seed,x,y,k=0){let n=(seed^Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(k,1442695041))>>>0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
const smooth=t=>t*t*(3-2*t);
function noise(seed,x,y,scale,k){x/=scale;y/=scale;const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);const a=randomAt(seed,ix,iy,k)*(1-fx)+randomAt(seed,ix+1,iy,k)*fx,b=randomAt(seed,ix,iy+1,k)*(1-fx)+randomAt(seed,ix+1,iy+1,k)*fx;return a*(1-fy)+b*fy;}
export function biomeAt(world,x,y){if(!world)return BIOMES[y>=34?6:y>=20?1:0];const n=seedNumber(world.seed),depth=y+Math.sin(x/29+n%10)*7+(noise(n,x,y,50,28)-.5)*16;if(y<14&&x<36)return BIOMES[0];return BIOMES[depth<24?0:depth<48?1:depth<78?2:depth<108?3:depth<142?4:depth<184?5:6];}
export function landmark(world,cx,cy){const n=seedNumber(world.seed),r=randomAt(n,cx,cy,91);if(cy<1&&cx<3||r>.22)return null;const x=cx*16+5+Math.floor(randomAt(n,cx,cy,92)*6),y=cy*16+5+Math.floor(randomAt(n,cx,cy,93)*6),biome=biomeAt(world,x,y);return {id:`treasure-${cx}-${cy}`,kind:biome.id==='ruins'?'ruin':'treasure',x:x+.5,y:y+.5,biome:biome.id};}
export function generateChunk(world,cx,cy){
 const n=seedNumber(world.seed),feature=landmark(world,cx,cy),tiles=[];
 for(let ly=0;ly<16;ly++)for(let lx=0;lx<16;lx++){
  const x=cx*16+lx,y=cy*16+ly;let t=1;
  if(x<=0||y<=0||x>=world.width-1||y>=world.height-1){tiles.push(9);continue;}
  const biome=biomeAt(world,x,y),a=noise(n,x,y,9,1),b=noise(n,x,y,22,2),line=Math.abs(Math.sin(x*.09+Math.sin(y*.055)*2+n%17)+Math.sin(y*.105+n%13)*.55);
  if(a>.60||b>.73||line<.13)t=0;
  // A short accessible shaft and winding starter galleries lead into the natural caves.
  if(y<56&&x>=16&&x<=18||((x-17)/5)**2+((y-3)/3)**2<1||y<53&&y>5&&Math.abs((y-8)%10-Math.sin(x*.2+n%7)*2)<1.5)t=0;
  if(feature&&Math.hypot(x+.5-feature.x,y+.5-feature.y)<2.4)t=0;
  const r=randomAt(n,x,y,5);
  if(t===1)t=r<.09?5:r<.15?6:y>32&&r<.23?7:r<.31?2:biome.id==='crystal'&&r<.53?3:biome.id==='deep'&&r<.40?12:biome.tier>=2&&r<.39?4:1;
  else if(biome.id==='forest'&&r<.12)t=8;
  else if(biome.id==='water'&&noise(n,x,y,12,8)>.53)t=10;
  else if(biome.id==='volcano'&&noise(n,x,y,11,8)>.62)t=11;
  if(x===19&&y===7)t=5;if(x===19&&y===17)t=3;
  if(feature&&Math.hypot(x+.5-feature.x,y+.5-feature.y)<1)t=0;
  tiles.push(t);
 }return tiles;
}
// Sparse row views keep the shared movement/lighting code independent of storage.
export function gridView(width,height,get,set){const rows=new Map();return new Proxy({length:height},{get(_,key){if(key==='length')return height;if(typeof key!=='string'||!/^\d+$/.test(key))return undefined;const y=Number(key);if(y>=height)return undefined;if(!rows.has(y)){if(rows.size>128)rows.delete(rows.keys().next().value);rows.set(y,new Proxy({length:width},{get(_,key){if(key==='length')return width;if(typeof key==='string'&&/^\d+$/.test(key)){const x=Number(key);if(x<width)return get(x,y);}return undefined;},set(_,key,value){if(set&&/^\d+$/.test(String(key))){set(Number(key),y,value);return true;}return false;}}));}return rows.get(y);}});}
export const chunkKey=(x,y)=>`${Math.floor(x/16)},${Math.floor(y/16)}`;
export function chunkKeysAround(world,p,radius=1){const cx=Math.floor(p.x/16),cy=Math.floor(p.y/16),result=[];for(let y=Math.max(0,cy-radius);y<=Math.min(world.height/16-1,cy+radius);y++)for(let x=Math.max(0,cx-radius);x<=Math.min(world.width/16-1,cx+radius);x++)result.push(`${x},${y}`);return result;}
export function clientGrid(world,chunks){return gridView(world.width,world.height,(x,y)=>chunks[chunkKey(x,y)]?.tiles[(y%16)*16+x%16]??-1);}
export const walkable=t=>t===0;
export function visibleCell(tiles,cx,cy,x,y){const steps=Math.max(Math.abs(x-cx),Math.abs(y-cy))*2;if(!steps)return true;let lastX=cx,lastY=cy;for(let i=1;i<steps;i++){const xx=Math.floor(cx+.5+(x-cx)*i/steps),yy=Math.floor(cy+.5+(y-cy)*i/steps);if(xx===x&&yy===y)return true;if(xx===lastX&&yy===lastY)continue;if(tiles[yy]?.[xx]!==0)return false;if(xx!==lastX&&yy!==lastY&&(tiles[lastY]?.[xx]!==0||tiles[yy]?.[lastX]!==0))return false;lastX=xx;lastY=yy;}return true;}
