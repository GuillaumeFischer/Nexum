import {biomeAt,seedNumber,randomAt,generateChunk} from './world.js';

// Visual layers only: generator 1 and its saved terrain edits stay compatible.
export const BIOME_TERRAIN_ASSET='assets/biome-terrain.png';
export const BIOME_PROPS_ASSET='assets/biome-props.png';
export const BIOME_PROPS_V2_ASSET='assets/biome-props-v2.png';
export const MATERIALS={dirt:0,gravel:1,grass:2,water:3,mud:4,basalt:5,rock:6,clay:7,roots:8,limestone:9,crystal:10,ruins:11};
export const BIOME_ART={
  rock:{ground:0,patch:1,wall:6,decor:['rocks','stalagmite','debris','ore-cart','timber-bundle','ammonite','rusted-barrel']},
  crystal:{ground:1,patch:0,wall:10,decor:['crystals','geode','stalagmite','rose-quartz','calcite-basin','cyan-crystal-fan','crystal-vein-slab']},
  forest:{ground:2,patch:4,wall:8,decor:['fern','mushrooms','stump','log','cave-shrub','shelf-fungi','root-knot','glowing-buds']},
  ruins:{ground:1,patch:0,wall:11,decor:['pillar','jars','debris','statue-head','rune-stele','fallen-arch','mosaic']},
  water:{ground:4,patch:1,wall:9,decor:['reeds','stalagmite','rocks','cave-coral','driftwood','shell-rock'],waterDecor:['lily-pads']},
  volcano:{ground:5,patch:1,wall:5,decor:['rocks','stalagmite','geode','obsidian-spires','sulphur-vent','lava-tube','cooling-lava']},
  deep:{ground:1,patch:5,wall:10,decor:['geode','crystals','pillar','violet-monolith','fossil-ribs','crystal-flower','cracked-sphere']}
};
const seeds=new Map();
const originalChunks=new Map();
const FLOOR_DECOR={
  rock:['ore-cart','timber-bundle','ammonite','rusted-barrel','debris','rocks'],
  crystal:['rose-quartz','calcite-basin','cyan-crystal-fan','crystal-vein-slab','geode','crystals'],
  ruins:['statue-head','rune-stele','fallen-arch','mosaic','jars','debris'],
  water:['cave-coral','driftwood','shell-rock','reeds'],
  volcano:['obsidian-spires','sulphur-vent','lava-tube','cooling-lava'],
  deep:['violet-monolith','fossil-ribs','crystal-flower','cracked-sphere','geode']
};
const NEIGHBOURS=[[1,0],[-1,0],[0,1],[0,-1]];
function artSeed(world){const key=String(world?.seed??'legacy');if(!seeds.has(key)){if(seeds.size>=8)seeds.delete(seeds.keys().next().value);seeds.set(key,seedNumber(key));}return seeds.get(key);}
function patch(seed,x,y){const gx=Math.floor(x/5),gy=Math.floor(y/5),sx=(x/5-gx),sy=(y/5-gy),fx=sx*sx*(3-2*sx),fy=sy*sy*(3-2*sy);return (randomAt(seed,gx,gy,401)*(1-fx)+randomAt(seed,gx+1,gy,401)*fx)*(1-fy)+(randomAt(seed,gx,gy+1,401)*(1-fx)+randomAt(seed,gx+1,gy+1,401)*fx)*fy;}

export function surfaceLayers(world,x,y,tile){
  if(tile===10)return [{index:MATERIALS.water,alpha:1}];
  if(tile===11)return [{index:MATERIALS.basalt,alpha:1}];
  const art=BIOME_ART[biomeAt(world,x,y).id],layers=[{index:art.ground,alpha:1}];
  const amount=Math.max(0,Math.min(.72,(patch(artSeed(world),x,y)-.38)*2));
  if(amount>0)layers.push({index:art.patch,alpha:amount});
  // Blend a two-cell border rather than drawing abrupt rectangular biome seams.
  const adjacent=new Map();
  for(const [dx,dy]of [[-2,0],[2,0],[0,-2],[0,2]]){const other=BIOME_ART[biomeAt(world,Math.max(1,x+dx),Math.max(1,y+dy)).id].ground;if(other!==art.ground)adjacent.set(other,(adjacent.get(other)||0)+.1);}
  for(const [index,alpha]of adjacent)layers.push({index,alpha});
  return layers;
}
export function wallMaterial(world,x,y){const id=biomeAt(world,x,y).id;return id==='rock'&&patch(artSeed(world),x,y)>.6?MATERIALS.clay:BIOME_ART[id].wall;}

// Natural props occupy existing solid cells, or water for lily pads. They never
// alter terrain, clear a collider, regenerate mined blocks or cover construction.
export function naturalDecoration(world,tiles,x,y){
  const tile=tiles[y]?.[x];if(tile!==1&&tile!==8&&tile!==10)return null;
  if(x>=15&&x<=20&&y<6)return null;
  const biome=biomeAt(world,x,y).id,art=BIOME_ART[biome],seed=artSeed(world);
  if(tile===8){const plants=['stump','log','root-knot'];return plants[Math.floor(randomAt(seed,x,y,405)*plants.length)];}
  if(!NEIGHBOURS.some(([dx,dy])=>tiles[y+dy]?.[x+dx]===0))return null;
  const cluster=patch(seed^9127,x+31,y+17);
  if(tile===10)return art.waterDecor&&randomAt(seed,x,y,406)<.34+cluster*.24?art.waterDecor[0]:null;
  if(randomAt(seed,x,y,403)>(biome==='forest'?.38:.36+cluster*.4))return null;
  const pool=biome==='ruins'?['pillar','jars','debris','statue-head','fallen-arch']:['rocks','stalagmite','ammonite','fossil-ribs'];return pool[Math.floor(randomAt(seed,x,y,404)*pool.length)];
}

function originalTile(world,x,y){
  const cx=Math.floor(x/16),cy=Math.floor(y/16),key=world.seed+':'+world.width+':'+world.height+':'+cx+','+cy;
  let chunk=originalChunks.get(key);
  if(!chunk){chunk=generateChunk(world,cx,cy);if(originalChunks.size>=64)originalChunks.delete(originalChunks.keys().next().value);originalChunks.set(key,chunk);}
  return chunk[(y%16)*16+x%16];
}

// Small, nonblocking scenery in naturally open chambers. Reconstructing only
// the immutable base tile keeps mined galleries free without touching saves.
export function floorDecoration(world,tiles,x,y,occupied=null){
  if(!world||world.generator!==1||tiles[y]?.[x]!==0||occupied?.has(x+','+y))return null;
  if(x>=14&&x<=21&&y<12||x>=16&&x<=18&&y<56)return null;
  const biome=biomeAt(world,x,y).id,pool=FLOOR_DECOR[biome];if(!pool)return null;
  if(originalTile(world,x,y)!==0)return null;
  const open=NEIGHBOURS.filter(([dx,dy])=>tiles[y+dy]?.[x+dx]===0).length;if(open<3)return null;
  const seed=artSeed(world),cluster=patch(seed^9127,x+31,y+17),rank=randomAt(seed,x,y,409);
  // Denser groups flank the chamber; the centre keeps broad open stretches.
  const chance=open===3?.12+cluster*.32:.035+cluster*.16;
  if(rank>chance)return null;
  // Keep adjacent accents apart without a visible repeating grid.
  if(NEIGHBOURS.some(([dx,dy])=>tiles[y+dy]?.[x+dx]===0&&randomAt(seed,x+dx,y+dy,409)<rank))return null;
  const choice=randomAt(seed,x,y,414)<.4?randomAt(seed,Math.floor(x/3),Math.floor(y/3),410):randomAt(seed,x,y,415);
  const kind=pool[Math.floor(choice*pool.length)];
  return {kind,scale:[.55,.63,.71][Math.floor(randomAt(seed,x,y,411)*3)],dx:(randomAt(seed,x,y,412)-.5)*16,dy:(randomAt(seed,x,y,413)-.5)*12};
}

// Optical occupancy is independent of physics. A frame-local cache is shared
// by all rays; fog, bare rock, ore and player-built walls still block light.
export function decorationOcclusion(world,tiles,installations=[]){
  const walls=new Set(installations.filter(s=>s.kind==='wall').map(s=>Math.floor(s.x)+','+Math.floor(s.y))),cache=new Map();
  return (x,y)=>{
    const key=x+','+y;if(cache.has(key))return cache.get(key);
    const tile=tiles[y]?.[x],blocked=walls.has(key)||tile!==0&&!naturalDecoration(world,tiles,x,y);
    cache.set(key,blocked);return blocked;
  };
}
