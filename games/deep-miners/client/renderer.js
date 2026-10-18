import {MINERALS,mineralForTile} from './minerals.js';
import {drawRailTile} from './rail-art.js';
import {rayDistance,headlampRay,headlampWallTransmission} from './headlamp.js';
export {rayDistance,headlampRay,headlampRayDistance,headlampWallTransmission} from './headlamp.js';
import {EQUIPMENT_LAYOUT} from './equipment-layout.js';
import {BUILDING_LAYOUT,BUILDING_ASSET} from './building-layout.js';
import {checkPlacement,pointerTile} from './placement.js';
import {biomeFor,capacity,requiredPick,resourceFor,RESOURCES,BUILDINGS} from './progression.js';
import {biomeAt} from './world.js';
import {createAnimator} from './animation.js';
import {WALK_LAYOUT} from './walk-layout.js';
import {BIOME_TERRAIN_ASSET,BIOME_PROPS_ASSET,BIOME_PROPS_V2_ASSET,surfaceLayers,wallMaterial,naturalDecoration,floorDecoration,decorationOcclusion} from './biome-art.js';
import {BIOME_PROP_LAYOUT} from './biome-layout.js';
import {createMaterialSampler} from './material-texture.js';
import {caveView} from './cave-camera.js';
import {caveEdges,drawCaveWall,drawCaveContact} from './cave-walls.js';
import {CROPS,cropStage,cropReady,isFieldItem,fieldActionReason,fieldAt} from './agriculture.js';
import {AGRICULTURE_LAYOUT,FARMER_LAYOUT} from './agriculture-layout.js';
import {EMPTY_WALK_LAYOUT,SHOVEL_WALK_LAYOUT} from './farming-walk-layout.js';
import {describeFrame,prepareEquippedFrame} from './miner-sprites.js';
import {railIndex,railMask} from './railway.js';
import {RAIL_BASES,WAGON_FRAMES,RAIL_ASSET,WAGON_ASSET} from './railway-layout.js';
export const TILE = 64;
const TAU = Math.PI * 2;
const hash = (x, y, k = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 71.7) * 43758.5453;
  return n - Math.floor(n);
};
const oreColor = {2:'#e4ac52',3:'#65d4d9',4:'#b49aeb',5:'#dd9871',6:'#b4c5d0',7:'#93a0ae',8:'#a8c57a',12:'#db9ffc'};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function loadAssets() {
  return Object.fromEntries(await Promise.all([...Object.keys(MINERALS).map(id=>'mineral-'+id),'trash','torch','railways-v2','wagon','terrain', 'miner', 'walk', 'miner-farming', 'miner-empty-walk', 'miner-shovel-walk', 'agriculture', 'props', 'rims', 'equipment', 'buildings', 'biome-terrain', 'biome-props', 'biome-props-v2'].map(name => new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve([name, im]);
    im.onerror = () => reject(Error(`Impossible de charger assets/${name}.png`));
    im.src = name.startsWith('mineral-')?MINERALS[name.slice(8)].asset:name === 'trash'?'assets/trash.webp':name === 'torch'?'assets/torch.webp':name === 'railways-v2'?RAIL_ASSET:name==='wagon'?WAGON_ASSET:name === 'buildings' ? BUILDING_ASSET : name === 'biome-terrain' ? BIOME_TERRAIN_ASSET : name === 'biome-props' ? BIOME_PROPS_ASSET : name === 'biome-props-v2' ? BIOME_PROPS_V2_ASSET : `assets/${name}.png`;
  }))));
}


function atlas(c, im, index, cols, rows, x, y, w, h) {
  const sw = im.width / cols, sh = im.height / rows;
  c.drawImage(im, (index % cols) * sw, Math.floor(index / cols) * sh, sw, sh, x, y, w, h);
}

function panel(c, x, y, w, h) {
  c.fillStyle = '#070b10d9'; c.strokeStyle = '#796a4845'; c.lineWidth = 1;
  c.beginPath(); c.roundRect(x, y, w, h, 4); c.fill(); c.stroke();
}

function text(c, value, x, y, size = 12, color = '#e8dcc4', weight = 'normal') {
  c.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  c.fillStyle = color; c.textAlign = 'left'; c.fillText(value, x, y);
}

function bar(c, x, y, w, f, color, height = 7) {
  c.fillStyle = '#171d23'; c.beginPath(); c.roundRect(x, y, w, height, 2); c.fill();
  c.strokeStyle = '#877c534f'; c.lineWidth = 1; c.stroke();
  const fill = w * clamp(f, 0, 1);
  if (fill > 0) { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, fill, height, Math.min(2, fill / 2)); c.fill(); }
}

function helmet(c, x, y, color) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, 8, 7, 0, Math.PI, TAU); c.fill();
  c.fillRect(x - 10, y - 1, 20, 3);
  c.fillStyle = '#fff2c7'; c.beginPath(); c.arc(x + 4, y - 4, 2, 0, TAU); c.fill();
}

export function createRenderer(assets, makeCanvas = () => document.createElement('canvas')) {
  const mask = makeCanvas(), headlampLayer=makeCanvas(), sprites = new Map();
  headlampLayer.width=headlampLayer.height=400;
  let m = mask.getContext('2d'),headlampContext=headlampLayer.getContext('2d');
  const chunks = new Map(), previousTiles = new Map(), particles = [], frames = new Map(), propTextures = new Map();
  const walkFrames=new Map(),farmerFrames=new Map(),farmerWalkFrames=new Map(),animator=createAnimator();
  const objectShadows=new Map();
  const chamberPropCache=new Map();
  let terrainTiles=null,terrainVersion=-1,terrainRevision=-1,terrainChunkVersions={};
  const lightTextures = new Map(),fixedLightCache=new Map();
  let lastRevision = -1, lastCode = null, lastGameTime = 0;
  let camera = null, lastClock = null,detailScale=1,view=null;
  let railwayTracks=new Map();
  const railTextures=new Map();
  const materialSampler=createMaterialSampler(makeCanvas,TILE);
  function material(c,im,index,x,y,px,py){materialSampler.draw(c,im,index,4,2,x,y,px,py,detailScale);}
  function biomeMaterial(c,im,index,x,y,px,py){materialSampler.draw(c,im,index,6,2,x,y,px,py,detailScale);}

  // Keep decoded images for chunk painting; repeated sampling of a writable
  // canvas can force costly bitmap snapshots in some Canvas implementations.
  const terrainAtlas=assets.terrain,rimAtlas=assets.rims;

  function pavement(x,y){
    const variant=(x%2)+2*(y%2),size=Math.ceil(TILE*detailScale),key=`pavement:${variant}:${size}`;
    if(propTextures.has(key))return propTextures.get(key);
    const canvas=makeCanvas();canvas.width=canvas.height=size;const t=canvas.getContext('2d');t.scale(detailScale,detailScale);
    // An opaque bed of mortar covers dirt, rubble and the old rails. Bake the
    // textured, bevelled slabs once; laying a floor needs no terrain rebake.
    t.fillStyle='#292c29';t.fillRect(0,0,TILE,TILE);
    for(let row=0;row<2;row++)for(let col=-1;col<2;col++){
      const left=col*32+(row%2?16:0)+1.5,top=row*32+1.5,width=29,height=29;
      if(left+width<=0)continue;
      t.save();t.beginPath();t.roundRect(left,top,width,height,2.5);t.clip();
      material(t,terrainAtlas,2,variant+col+4,row+2,0,0);
      t.fillStyle=`rgba(173,160,132,${.36+hash(variant,row,col+80)*.15})`;t.fillRect(left,top,width,height);
      const shade=t.createLinearGradient(left,top,left+width,top+height);shade.addColorStop(0,'#e8d9b326');shade.addColorStop(1,'#06080755');t.fillStyle=shade;t.fillRect(left,top,width,height);
      t.restore();
      t.lineWidth=1.25;t.strokeStyle='#d4c8a578';t.beginPath();t.moveTo(left+2,top+height-2);t.lineTo(left+2,top+2);t.lineTo(left+width-2,top+2);t.stroke();
      t.strokeStyle='#080b0bab';t.beginPath();t.moveTo(left+width-1,top+2);t.lineTo(left+width-1,top+height-1);t.lineTo(left+2,top+height-1);t.stroke();
      if(hash(variant,row,col+90)<.45){t.strokeStyle='#302f2966';t.lineWidth=.8;t.beginPath();t.moveTo(left+11,top+5);t.lineTo(left+15,top+12);t.lineTo(left+12,top+17);t.stroke();}
    }
    if(propTextures.size>=128)propTextures.delete(propTextures.keys().next().value);
    propTextures.set(key,canvas);return canvas;
  }

  function builtSurfaces(c,state,ox,oy,w,h){
    for(const item of [...(state.installations||[])].sort((a,b)=>Number(a.kind==='rail')-Number(b.kind==='rail'))){
      if(item.kind==='rail'){const px=Math.floor(item.x)*TILE+ox,py=Math.floor(item.y)*TILE+oy;if(px+TILE>0&&py+TILE>0&&px<w&&py<h)railSprite(c,item,ox,oy);continue;}
      if(item.kind==='soil'){const rect=AGRICULTURE_LAYOUT[28],px=(item.x-.5)*TILE+ox,py=(item.y-.5)*TILE+oy;if(assets.agriculture&&px+TILE>0&&py+TILE>0&&px<w&&py<h)c.drawImage(assets.agriculture,rect.x,rect.y,rect.w,rect.h,px+2,py+2,60,60);continue;}
      if(!BUILDINGS[item.kind]?.floor)continue;
      const x=Math.floor(item.x),y=Math.floor(item.y),px=x*TILE+ox,py=y*TILE+oy;
      if(state.tiles[y]?.[x]!==0||px+TILE<0||py+TILE<0||px>w||py>h)continue;
      if(item.kind==='floor'){c.drawImage(pavement(x,y),px,py,TILE,TILE);c.strokeStyle='#d6c7a55c';c.lineWidth=1;c.strokeRect(px+.5,py+.5,TILE-1,TILE-1);}
      else{material(c,terrainAtlas,7,x,y,px,py);}
      buildingSprite(c,item,0,ox,oy);
    }
  }

  function prop(index,w,h,foreground=false){
    w=Math.ceil(w*detailScale);h=Math.ceil(h*detailScale);const key=`${index}:${w}:${h}:${foreground}`;
    if(propTextures.has(key))return propTextures.get(key);
    const canvas=makeCanvas();canvas.width=w;canvas.height=h;const context=canvas.getContext('2d');
    atlas(context,assets.props,index,3,2,0,0,w,h);
    if(foreground){
      // The roof and front metalwork pass in front of an occupant. The opaque
      // rear wall and floor must remain behind the miner.
      context.globalCompositeOperation='destination-in';context.beginPath();
      const polygons=[[[.18,.36],[.62,.24],[.81,.31],[.79,.4],[.53,.47],[.18,.4]],
        [[.16,.64],[.52,.73],[.53,.76],[.16,.69]],[[.52,.73],[.77,.62],[.77,.67],[.53,.77]],
        [[.16,.64],[.22,.66],[.22,.91],[.16,.9]],[[.49,.42],[.55,.43],[.55,.97],[.49,.96]],
        [[.71,.31],[.76,.31],[.76,.87],[.71,.89]],[[.14,.84],[.53,.94],[.77,.83],[.77,.9],[.53,.99],[.14,.91]]];
      for(const polygon of polygons){polygon.forEach(([x,y],i)=>i?context.lineTo(x*w,y*h):context.moveTo(x*w,y*h));context.closePath();}
      context.fill();context.globalCompositeOperation='source-over';
    }
    if(propTextures.size>=128)propTextures.delete(propTextures.keys().next().value);
    propTextures.set(key,canvas);return canvas;
  }

  // Bake gradients once at an identity transform. Drawing textures is cheap and
  // makes the same lighting work at half resolution, zoom and different DPRs.
  function lightTexture(color, kind='glow') {
    const key=color+kind;if(lightTextures.has(key))return lightTextures.get(key);
    const cvs=makeCanvas();cvs.width=cvs.height=256;const t=cvs.getContext('2d');
    const g=t.createRadialGradient(128,128,kind==='halo'?34:0,128,128,128);
    g.addColorStop(0,color);
    if(kind==='halo')g.addColorStop(.5,'rgba(0,0,0,.73)');
    if(kind==='beam'){
      const match=color.match(/rgba\((.+),([^,]+)\)/),rgb=match[1],alpha=Number(match[2]);
      g.addColorStop(.42,`rgba(${rgb},${alpha*.78})`);g.addColorStop(.78,`rgba(${rgb},${alpha*.3})`);
    }
    g.addColorStop(1,'transparent');t.fillStyle=g;t.fillRect(0,0,256,256);
    if(lightTextures.size>=32)lightTextures.delete(lightTextures.keys().next().value);
    lightTextures.set(key,cvs);return cvs;
  }

  function glow(c,x,y,r,color) {
    c.drawImage(lightTexture(color),x-r,y-r,r*2,r*2);
  }

  function spriteSheet(slot,source=assets.miner,kind='legacy') {
    if (!slot) return source;
    const key=kind+slot;if (sprites.has(key)) return sprites.get(key);
    const cvs = makeCanvas(); cvs.width = source.width; cvs.height = source.height;
    const c = cvs.getContext('2d'); c.drawImage(source, 0, 0);
    const data = c.getImageData(0, 0, cvs.width, cvs.height);
    const colors = [[245,189,98],[80,216,220],[168,125,233],[230,96,114],[99,166,239],[183,210,92]], col = colors[slot] || colors[0];
    for (let i = 0; i < data.data.length; i += 4) {
      const d = data.data, r = d[i], g = d[i + 1], b = d[i + 2];
      if (d[i + 3] && r > 125 && g / r > .5 && g / r < .91 && b / r < .48) {
        const v = clamp(r / 215, .25, 1.3);
        d[i] = Math.min(255, col[0] * v); d[i + 1] = Math.min(255, col[1] * v); d[i + 2] = Math.min(255, col[2] * v);
      }
    }
    c.putImageData(data, 0, 0); sprites.set(key, cvs); return cvs;
  }
  function prepareFrame(sheet,index,cols,rows){
    const canvas=makeCanvas();canvas.width=136;canvas.height=160;
    const context=canvas.getContext('2d');context.imageSmoothingQuality='high';atlas(context,sheet,index,cols,rows,0,0,136,160);
    return describeFrame(canvas);
  }
  function prepareWalkFrame(sheet,index,reference){
    const rect=WALK_LAYOUT[index],scale=reference.bodyHeight/rect.bodyHeight,canvas=makeCanvas();canvas.width=136;canvas.height=160;
    const context=canvas.getContext('2d');context.imageSmoothingQuality='high';
    context.drawImage(sheet,rect.x,rect.y,rect.w,rect.h,reference.center-rect.center*scale,158-rect.h*scale,rect.w*scale,rect.h*scale);
    return describeFrame(canvas);
  }
  for(let slot=0;slot<6;slot++){
    const sheet=spriteSheet(slot);
    for(let index=0;index<20;index++)frames.set(slot*20+index,prepareFrame(sheet,index,4,5));
    if(assets.walk){const walk=spriteSheet(slot,assets.walk,'walk');for(let index=0;index<32;index++)walkFrames.set(slot*32+index,prepareWalkFrame(walk,index,frames.get(slot*20+Math.floor(index/8)*4)));}
    if(assets['miner-farming']){const farmer=spriteSheet(slot,assets['miner-farming'],'farmer');for(let index=0;index<32;index++){const dir=Math.floor(index/4)%4,west=dir===3,sourceIndex=west?index-8:index;farmerFrames.set(slot*32+index,prepareEquippedFrame(makeCanvas,farmer,FARMER_LAYOUT[sourceIndex],frames.get(slot*20+dir*4),west,FARMER_LAYOUT[Math.floor(sourceIndex/4)*4].h));}}
    for(const [equipment,name,layout]of [[0,'miner-empty-walk',EMPTY_WALK_LAYOUT],[1,'miner-shovel-walk',SHOVEL_WALK_LAYOUT]]){
      if(!assets[name])continue;const sheet=spriteSheet(slot,assets[name],name);
      for(let dir=0;dir<4;dir++)for(let column=0;column<8;column++)farmerWalkFrames.set(slot*64+equipment*32+dir*8+column,prepareEquippedFrame(makeCanvas,sheet,layout[(dir===3?1:dir)*8+column],frames.get(slot*20+dir*4),dir===3));
    }
    for(const sheet of sprites.values())sheet.width=sheet.height=1;
    sprites.clear();
  }
  // The recolored atlases have been cut into small frames and can be released.
  sprites.clear();

  function stone(c, x, y, radius, seed) {
    c.fillStyle = '#0006'; c.beginPath(); c.ellipse(x+2,y+3,radius*1.05,radius*.65,0,0,TAU); c.fill();
    c.save(); c.beginPath();
    for (let k=0;k<6;k++) { const a=k*TAU/6, r=radius*(.7+hash(seed,k,40)*.3), xx=x+Math.cos(a)*r, yy=y+Math.sin(a)*r*.7; if(!k)c.moveTo(xx,yy);else c.lineTo(xx,yy); }
    c.closePath(); c.clip(); atlas(c,terrainAtlas,2,4,2,x-radius,y-radius,radius*2,radius*2);
    c.restore(); c.strokeStyle='#baab8628'; c.lineWidth=1; c.stroke();
  }

  function naturalProp(c,state,x,y,px,py){
    if(!assets['biome-props'])return;
    const kind=naturalDecoration(state.world,state.tiles,x,y),rect=BIOME_PROP_LAYOUT[kind],asset=assets[rect?.asset||'biome-props'];
    if(rect&&asset){const sprite=shadowedObject(asset,rect,rect.width,rect.height,'nature:'+kind);c.drawImage(sprite.image,px+(TILE-rect.width)/2-sprite.pad,py+(TILE-rect.height)/2-sprite.pad,sprite.width,sprite.height);}
  }

  function chamberProps(c,state,ox,oy,w,h){
    if(!assets['biome-props']||!state.world)return;
    const occupied=new Set((state.installations||[]).map(s=>Math.floor(s.x)+','+Math.floor(s.y)));
    for(const item of state.landmarks||[])occupied.add(Math.floor(item.x)+','+Math.floor(item.y));
    for(const s of state.structures||[])for(let y=Math.floor(s.y);y<Math.ceil(s.y+s.h);y++)for(let x=Math.floor(s.x);x<Math.ceil(s.x+s.w);x++)occupied.add(x+','+y);
    const x0=Math.max(0,Math.floor(-ox/TILE)),x1=Math.min(state.tiles[0].length,Math.ceil((w-ox)/TILE));
    const y0=Math.max(0,Math.floor(-oy/TILE)),y1=Math.min(state.tiles.length,Math.ceil((h-oy)/TILE));
    const version=state.world.seed+':'+state.mapVersion;
    for(let cy=Math.floor(y0/16);cy<=Math.floor((y1-1)/16);cy++)for(let cx=Math.floor(x0/16);cx<=Math.floor((x1-1)/16);cx++){
      const key=cx+','+cy;let cached=chamberPropCache.get(key);
      const stamp=version+':'+[[0,0],[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dy])=>state.chunks?.[(cx+dx)+','+(cy+dy)]?.version??'missing').join(',');
      if(cached?.version!==stamp){
        const entries=[];
        for(let y=cy*16;y<Math.min((cy+1)*16,state.tiles.length);y++)for(let x=cx*16;x<Math.min((cx+1)*16,state.tiles[0].length);x++){
          const detail=floorDecoration(state.world,state.tiles,x,y);if(detail)entries.push({x,y,detail});
        }
        cached={version:stamp,entries};if(chamberPropCache.size>=64)chamberPropCache.delete(chamberPropCache.keys().next().value);chamberPropCache.set(key,cached);
      }
      for(const {x,y,detail}of cached.entries){
        if(x<x0||x>=x1||y<y0||y>=y1||state.tiles[y]?.[x]!==0||occupied.has(x+','+y))continue;
        const rect=BIOME_PROP_LAYOUT[detail.kind],asset=assets[rect.asset||'biome-props'];if(!asset)continue;
        const width=rect.width*detail.scale,height=rect.height*detail.scale,sprite=shadowedObject(asset,rect,width,height,'chamber:'+detail.kind+':'+detail.scale);
        c.drawImage(sprite.image,x*TILE+ox+(TILE-width)/2+detail.dx-sprite.pad,y*TILE+oy+(TILE-height)/2+detail.dy-sprite.pad,sprite.width,sprite.height);
      }
    }
  }

  function terrainRaw(c, state, ox, oy, w, h) {
    const builtWalls=new Set((state.installations||[]).filter(s=>s.kind==='wall').map(s=>Math.floor(s.x)+','+Math.floor(s.y)));
    const s=TILE, x0=Math.max(0,Math.floor(-ox/s)-1), x1=Math.min(state.tiles[0].length,Math.ceil((w-ox)/s)+1);
    const y0=Math.max(0,Math.floor(-oy/s)-1), y1=Math.min(state.tiles.length,Math.ceil((h-oy)/s)+1);
    // A continuous floor lies beneath the relief and the nonblocking scenery.
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
      if(state.tiles[y][x]<0)continue;
      if(assets['biome-terrain']){
        c.save();for(const layer of surfaceLayers(state.world,x,y,state.tiles[y][x])){c.globalAlpha=layer.alpha;biomeMaterial(c,assets['biome-terrain'],layer.index,x,y,x*s+ox,y*s+oy);}c.restore();
      }else material(c,terrainAtlas,0,x,y,x*s+ox,y*s+oy);
      if(state.world){c.fillStyle=biomeAt(state.world,x,y).tint;c.fillRect(x*s+ox,y*s+oy,s,s);}
    }
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
      const t=state.tiles[y][x]; if(t<=0||t===8||t===10||t===11||builtWalls.has(x+','+y))continue;
      const px=x*s+ox,py=y*s+oy;
      drawCaveWall(c,state.tiles,x,y,px,py,()=>{
        if(assets['biome-terrain'])biomeMaterial(c,assets['biome-terrain'],wallMaterial(state.world,x,y),x,y,px,py);
        else material(c,terrainAtlas,2,x,y,px,py);
      });
    }
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const t=state.tiles[y][x];if(t<=0||t===10||t===11||builtWalls.has(x+','+y))continue;const px=x*s+ox,py=y*s+oy;
      for(const [dx,dy,angle]of [[0,-1,Math.PI],[1,0,-Math.PI/2],[0,1,0],[-1,0,Math.PI/2]])if(!assets['biome-terrain']&&state.tiles[y+dy]?.[x+dx]===0){
        c.save();c.translate(px+s/2+dx*(s/2-7),py+s/2+dy*(s/2-7));c.rotate(angle);
        atlas(c,rimAtlas,Math.floor(hash(x,y,dx+dy*4+84)*4),2,2,-43,-35,86,70);c.restore();
      }
      const mineral=mineralForTile(t),image=mineral&&assets['mineral-'+mineral.id];
      if(image&&t!==1){const edge=caveEdges(state.tiles,x,y);c.save();c.translate(px+s*.5,py+(edge.bottom?43:32));c.rotate((hash(x,y,21)-.5)*.12);const size=48+hash(x,y,13)*4;c.drawImage(image,-size/2,-size*.38,size,size*.76);c.restore();}
      if(t===8)naturalProp(c,state,x,y,px,py);
    }
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(state.tiles[y][x]===0){
      const px=x*s+ox,py=y*s+oy;
      drawCaveContact(c,x,y,px,py,(gx,gy)=>{const tile=state.tiles[gy]?.[gx];return tile>0&&tile!==8&&tile!==10&&tile!==11&&!builtWalls.has(gx+','+gy);});
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(state.tiles[y+dy]?.[x+dx]>0&&state.tiles[y+dy]?.[x+dx]!==10&&state.tiles[y+dy]?.[x+dx]!==11&&state.tiles[y+dy]?.[x+dx]!==8&&!builtWalls.has((x+dx)+','+(y+dy))){
        for(let k=0;k<2;k++){if(hash(x,y,k+77)<.4)continue;const f=(k+.15+hash(x,y,k+55)*.7)/2, r=3+hash(x,y,k+61)*5;
          const xx=px+(dx?dx>0?s-4-r:4+r:f*s), yy=py+(dy?dy>0?s-4-r:4+r:f*s);
          stone(c,xx,yy,r,x+y*35+k);
        }
      }

    }
    if(state.tiles[3]?.[17]===0)for(let y=Math.max(1,y0);y<Math.min(5,y1);y++)for(let x=Math.max(15,x0);x<Math.min(20,x1);x++)if(state.tiles[y][x]===0)material(c,terrainAtlas,7,x,y,x*s+ox,y*s+oy);
    // Fade all four borders of discovered terrain, including the rock bevels.
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(state.tiles[y][x]>=0){
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(state.tiles[y+dy]?.[x+dx]===-1){
        const px=x*s+ox,py=y*s+oy,ex=px+(dx>0?s:0),ey=py+(dy>0?s:0);
        const g=c.createLinearGradient(dx?ex-dx*56:px,dy?ey-dy*56:py,dx?ex:px,dy?ey:py);
        g.addColorStop(0,'transparent');g.addColorStop(1,'#02050aff');c.fillStyle=g;c.fillRect(px,py,s,s);
      }
    }
  }

  function terrain(c,state,ox,oy,w,h) {
    const cells=4,size=TILE*cells,pad=2,maxCX=Math.ceil(state.tiles[0].length/cells),maxCY=Math.ceil(state.tiles.length/cells);
    const version=state.mapVersion??state.revision;
    if(terrainTiles!==state.tiles||terrainVersion!==version||terrainRevision!==state.revision){
      if(terrainTiles&&state.world){
        for(const [x,y,old,t]of state.changedCells||[])for(let cy=Math.max(0,Math.floor((y-2)/cells));cy<=Math.floor((y+2)/cells);cy++)for(let cx=Math.max(0,Math.floor((x-2)/cells));cx<=Math.floor((x+2)/cells);cx++){const chunk=chunks.get(cy*maxCX+cx);if(chunk){chunk.dirty=true;if(old>0&&t===0)chunk.urgent=true;}}
        // Repaint cached sectors when returning to a previously unloaded zone.
        for(const [key,data]of Object.entries(state.chunks||{})){if(terrainChunkVersions[key]===data.version)continue;const [cx,cy]=key.split(',').map(Number);for(let dy=-1;dy<=4;dy++)for(let dx=-1;dx<=4;dx++){const gx=cx*4+dx,gy=cy*4+dy;if(gx<0||gy<0||gx>=maxCX||gy>=maxCY)continue;const chunk=chunks.get(gy*maxCX+gx);if(chunk)chunk.dirty=true;}}
      }else if(terrainTiles){
        for(let y=0;y<state.tiles.length;y++){
          if(terrainTiles[y]===state.tiles[y]&&terrainVersion===version&&terrainRevision===state.revision)continue;
          for(let x=0;x<state.tiles[y].length;x++)if(terrainTiles[y]?.[x]!==state.tiles[y][x]){
            for(let cy=Math.max(0,Math.floor((y-2)/cells));cy<=Math.min(maxCY-1,Math.floor((y+2)/cells));cy++)for(let cx=Math.max(0,Math.floor((x-2)/cells));cx<=Math.min(maxCX-1,Math.floor((x+2)/cells));cx++){
              const chunk=chunks.get(cy*maxCX+cx);if(chunk){chunk.dirty=true;if(terrainTiles[y]?.[x]>0&&state.tiles[y][x]===0)chunk.urgent=true;}
            }
          }
        }
      }
      terrainTiles=state.tiles;terrainVersion=version;terrainRevision=state.revision;
      terrainChunkVersions=Object.fromEntries(Object.entries(state.chunks||{}).map(([k,c])=>[k,c.version]));
    }
    const visible=[];
    for(let cy=Math.max(0,Math.floor(-oy/size));cy<Math.min(maxCY,Math.ceil((h-oy)/size));cy++)for(let cx=Math.max(0,Math.floor(-ox/size));cx<Math.min(maxCX,Math.ceil((w-ox)/size));cx++){
      // Undiscovered regions are already covered by the viewport background.
      // They need neither a texture allocation nor transparent draw calls.
      let discovered=false;
      for(let y=cy*cells;y<Math.min(state.tiles.length,(cy+1)*cells)&&!discovered;y++)for(let x=cx*cells;x<Math.min(state.tiles[y].length,(cx+1)*cells);x++)if(state.tiles[y][x]>=0){discovered=true;break;}
      if(!discovered)continue;
      const id=cy*maxCX+cx;let chunk=chunks.get(id);
      if(!chunk){const canvas=makeCanvas();canvas.width=canvas.height=(size+pad*2)*detailScale;chunk={canvas,context:canvas.getContext('2d'),dirty:true};chunks.set(id,chunk);}
      visible.push({chunk,cx,cy});
    }
    // Spread discovery work over frames, closest chunks first. Only regions
    // affected by a broken wall bypass the budget, so extraction appears now.
    let budget=visible.some(v=>v.chunk.urgent)?0:2;
    const middleX=(w/2-ox)/size,middleY=(h/2-oy)/size;
    for(const {chunk,cx,cy}of [...visible].sort((a,b)=>Math.hypot(a.cx+.5-middleX,a.cy+.5-middleY)-Math.hypot(b.cx+.5-middleX,b.cy+.5-middleY))){
      if(chunk.dirty&&(chunk.urgent||budget-->0)){chunk.context.setTransform(detailScale,0,0,detailScale,0,0);chunk.context.clearRect(0,0,size+pad*2,size+pad*2);terrainRaw(chunk.context,state,-cx*size+pad,-cy*size+pad,size+pad*2,size+pad*2);chunk.dirty=false;chunk.urgent=false;}
    }
    const visibleIds=new Set();
    // Bleed the cached edges by two world pixels: fractional camera positions
    // and fullscreen scaling otherwise expose transparent sampling seams.
    for(const {chunk,cx,cy}of visible){const id=cy*maxCX+cx;visibleIds.add(id);chunks.delete(id);chunks.set(id,chunk);c.drawImage(chunk.canvas,cx*size+ox-pad,cy*size+oy-pad,size+pad*2,size+pad*2);}
    if(chunks.size>Math.max(80,visible.length+8))for(const id of chunks.keys())if(!visibleIds.has(id)){chunks.delete(id);if(chunks.size<=Math.max(80,visible.length+8))break;}
  }

  function visibility(tiles,p,range,low,blocks) {
    const points=[];
    for(let a=-Math.PI;a<Math.PI;a+=low?.075:.045){
      const hit=rayDistance(tiles,p.x,p.y,a,range,blocks);
      // A torch also lights the raised face of the first rock cell.
      const d=Math.min(range,hit+.65);points.push([Math.cos(a)*d*TILE,Math.sin(a)*d*TILE]);
    }
    return points;
  }

  function clipLight(c,points,x,y) {
    c.beginPath();points.forEach(([dx,dy],i)=>i?c.lineTo(x+dx,y+dy):c.moveTo(x+dx,y+dy));c.closePath();c.clip();
  }

  function beam(c,x,y,angle,range,alpha,tint) {
    c.save();c.translate(x,y);c.rotate(angle);
    c.drawImage(lightTexture(`rgba(${tint},${alpha})`,'beam'),-range*.1425,-range*.23,range*1.14,range*.46);
    c.restore();
  }

  function headlampShape(tiles,p,range,low,blocks,walls){
    const rays=[],points=[];
    for(let a=-Math.PI;a<Math.PI;a+=low?.075:.045){
      const {hit,end}=headlampRay(tiles,p,a,range,blocks,walls),dx=Math.cos(a)*TILE*.5,dy=Math.sin(a)*TILE*.5;
      rays.push({dx,dy,hit,end});points.push([dx*end,dy*end]);
    }
    return {rays,points,bands:low?12:24};
  }

  function drawHeadlamp(light,alpha,tint,halo=false){
    const c=headlampContext,x=headlampLayer.width*.5,y=headlampLayer.height*.5;
    c.resetTransform();c.clearRect(0,0,headlampLayer.width,headlampLayer.height);c.globalCompositeOperation='source-over';
    c.save();clipLight(c,light.points,x,y);
    if(halo)c.drawImage(lightTexture('rgba(0,0,0,.99)','halo'),x-67.5,y-67.5,135,135);
    beam(c,x,y,light.angle,light.range*TILE*.5,alpha,tint);c.restore();
    c.globalCompositeOperation='destination-out';
    // Disjoint contours fade only after entering rock. The same transmission
    // attenuates both the darkness removal and the warm beam tint.
    for(let band=0;band<light.bands;band++){
      c.beginPath();
      for(const depth of [(band+1)/light.bands,band/light.bands]){
        light.rays.forEach(({dx,dy,hit,end},i)=>{const d=hit+(end-hit)*depth;if(i)c.lineTo(x+dx*d,y+dy*d);else c.moveTo(x+dx*d,y+dy*d);});c.closePath();
      }
      c.fillStyle=`rgba(0,0,0,${1-headlampWallTransmission((band+.5)/light.bands)})`;c.fill('evenodd');
    }
    m.drawImage(headlampLayer,light.x*.5-x,light.y*.5-y);
  }

  function lights(c,w,h,state,me,ox,oy,quality,brightness,clock) {
    if(mask.width!==Math.ceil(w*.5)||mask.height!==Math.ceil(h*.5)){mask.width=Math.ceil(w*.5);mask.height=Math.ceil(h*.5);m=mask.getContext('2d');}
    const scale=.5;
    const blocks=assets['biome-props']?decorationOcclusion(state.world,state.tiles,state.installations):undefined;
    const headlampWalls=new Set((state.installations||[]).filter(s=>s.kind==='wall').map(s=>Math.floor(s.x)+','+Math.floor(s.y)));
    m.resetTransform();m.clearRect(0,0,mask.width,mask.height);m.globalCompositeOperation='source-over';
    m.fillStyle=`rgba(0,1,3,${clamp(.985-brightness*.07,.72,.97)})`;m.fillRect(0,0,mask.width,mask.height);m.globalCompositeOperation='destination-out';
    const sources=[];
    for(const p of state.players){
      if(!p.alive||p.escaped)continue;const x=p.x*TILE+ox,y=p.y*TILE+oy;
      if(x<-420||x>w+420||y<-420||y>h+420)continue;
      const range=6.2,shape=headlampShape(state.tiles,p,range,quality==='low',blocks,headlampWalls);
      const angle=Math.atan2(p.face.y,p.face.x),light={x,y,...shape,angle,range};sources.push(light);
      drawHeadlamp(light,.99,'0,0,0',true);
    }
    const fixed=(state.installations||[]).filter(item=>['lamp','air','decor'].includes(item.kind)&&item.x*TILE+ox>-220&&item.x*TILE+ox<w+220&&item.y*TILE+oy>-220&&item.y*TILE+oy<h+220).sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y)).slice(0,quality==='low'?8:16);
    const present=new Set((state.installations||[]).map(item=>item.id));for(const id of fixedLightCache.keys())if(!present.has(id))fixedLightCache.delete(id);
    const wallKey=(state.installations||[]).filter(s=>s.kind==='wall').map(s=>s.x+','+s.y).join(';');
    function fixedPoints(item){const key=state.mapVersion+','+wallKey+','+quality+','+item.x+','+item.y;let cached=fixedLightCache.get(item.id);if(cached?.key!==key){cached={key,points:visibility(state.tiles,item,3.3,quality==='low',blocks)};fixedLightCache.set(item.id,cached);}return cached.points;}
    for(const item of fixed){const x=item.x*TILE+ox,y=item.y*TILE+oy,points=fixedPoints(item);m.save();clipLight(m,points.map(([dx,dy])=>[dx*scale,dy*scale]),x*scale,y*scale);glow(m,x*scale,y*scale,190*scale,'rgba(0,0,0,.96)');m.restore();}
    if(state.tiles[3]?.[17]===0){
      const p={x:17.5,y:3},points=visibility(state.tiles,p,4.5,quality==='low',blocks);
      m.save();clipLight(m,points.map(([dx,dy])=>[dx*scale,dy*scale]),(p.x*TILE+ox)*scale,(p.y*TILE+oy)*scale);
      glow(m,(p.x*TILE+ox)*scale,(p.y*TILE+oy)*scale,260*scale,'rgba(0,0,0,.97)');m.restore();
    }
    // Composite the soft colored lights into the same low-resolution layer.
    // The world textures and sprites retain their independent screen resolution.
    m.globalCompositeOperation='source-over';
    for(const light of sources){
      drawHeadlamp(light,.14,'255,218,160');
      glow(m,(light.x+Math.cos(light.angle)*10)*scale,(light.y-49)*scale,18*scale,'#fff0bc55');
    }
    if(state.tiles[3]?.[17]===0){
      const flicker=1+Math.sin(clock*8)*.035+Math.sin(clock*17)*.018;
      glow(m,(16.2*TILE+ox)*scale,(2.7*TILE+oy)*scale,125*flicker*scale,'#e7a33c30');glow(m,(18.8*TILE+ox)*scale,(3*TILE+oy)*scale,92*scale,'#56c6bd20');
    }
    for(const item of fixed){const x=item.x*TILE+ox,y=item.y*TILE+oy,points=fixedPoints(item);m.save();clipLight(m,points.map(([dx,dy])=>[dx*scale,dy*scale]),x*scale,y*scale);glow(m,x*scale,y*scale,155*scale,item.kind==='air'?'#65d4d92b':'#ee9b3e50');m.restore();}
    c.drawImage(mask,0,0,w,h);
  }

  function miner(c,p,clock,ox,oy,seat=null) {
    const pose=animator.update(p,clock),dir=pose.dir;if(p.vehicleId){pose.walk=false;pose.lift=0;}
    let index=dir*4+(p.mine>0?(Math.floor(clock*8)%2?3:0):pose.walk?[1,0,2,0][Math.floor(pose.phase*4)%4]:0);
    if(p.using)index=16+dir;
    const x=p.x*TILE+ox+(seat?.x||0),y=p.y*TILE+oy+(seat?.y||0);
    c.fillStyle='#0009';if(!seat){c.beginPath();c.ellipse(x,y+2,20,8,0,0,TAU);c.fill();}
    c.save();c.translate(x,y);if(p.vehicleId){c.translate(Math.sin(clock*5+(p.slot||0))*(p.moving?.45:.1),-5+Math.sin(clock*(p.moving?12:2)+(p.slot||0))*(p.moving?.8:.2));c.rotate(Math.sin(clock*6+(p.slot||0))*(p.moving?.02:0));c.scale(.6,.6);}if(!p.alive)c.rotate(Math.PI/2);
    const breathe=pose.walk?pose.lift:p.moving||p.mine||p.using?0:Math.sin(clock*2+p.slot)*.35;
    const held=p.vehicleId?null:p.heldItem===undefined?'pick':p.heldItem,farmer=held!=='pick'&&assets['miner-farming'];
    const farmerColumn=p.using||(p.actionSeconds||0)>0?3:0;
    const farmerWalk=farmer&&pose.walk&&farmerColumn===0?farmerWalkFrames.get((p.slot||0)*64+(held==='shovel'?32:0)+dir*8+pose.column):null;
    const frame=farmerWalk||(farmer?farmerFrames.get((p.slot||0)*32+(held==='shovel'?16:0)+dir*4+farmerColumn):pose.walk&&assets.walk?walkFrames.get((p.slot||0)*32+dir*8+pose.column):frames.get((p.slot||0)*20+index));
    c.drawImage(frame.canvas,-frame.canvas.width/4,-frame.feet+breathe,frame.canvas.width/2,frame.canvas.height/2);c.restore();
  }

  function visibleStructures(state,ox,oy,w,h){
    return (state.structures||[]).filter(s=>s.x*TILE+ox<w&&(s.x+s.w)*TILE+ox>0&&s.y*TILE+oy<h&&(s.y+s.h)*TILE+oy>0);
  }

  function structure(c,s,ox,oy,foreground=false){
    const index=s.kind==='lift'?0:s.kind==='arch'?1:2;
    c.drawImage(prop(index,s.w*TILE,s.h*TILE,foreground),s.x*TILE+ox,s.y*TILE+oy,s.w*TILE,s.h*TILE);
  }

  // Bake a dark, soft offset silhouette once per sprite and screen density.
  // The original painted edge is untouched; there is no light-colored contour.
  function shadowedObject(image,rect,width,height,key){
    const scale=detailScale,pad=Math.ceil(10*scale),w=Math.ceil(width*scale),h=Math.ceil(height*scale),cacheKey=key+':'+scale;
    if(objectShadows.has(cacheKey))return objectShadows.get(cacheKey);
    const silhouette=makeCanvas();silhouette.width=w;silhouette.height=h;const m=silhouette.getContext('2d');
    m.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,w,h);m.globalCompositeOperation='source-in';m.fillStyle='#00000075';m.fillRect(0,0,w,h);
    const out=makeCanvas();out.width=w+pad*2;out.height=h+pad*2;const t=out.getContext('2d');
    t.filter='blur('+2.5*scale+'px)';t.drawImage(silhouette,pad+3*scale,pad+4*scale);t.filter='none';
    t.drawImage(image,rect.x,rect.y,rect.w,rect.h,pad,pad,w,h);
    const cached={image:out,pad:pad/scale,width:out.width/scale,height:out.height/scale};
    if(objectShadows.size>=80)objectShadows.delete(objectShadows.keys().next().value);
    objectShadows.set(cacheKey,cached);return cached;
  }
  function installation(c,item,clock,ox,oy){
    if(item.kind==='lamp'){const x=item.x*TILE+ox,y=item.y*TILE+oy;if(assets.torch){const h=54+Math.sin(clock*10+(item.id||0))*.6,w=h*assets.torch.width/assets.torch.height;c.drawImage(assets.torch,x-w/2,y+9-h,w,h);glow(c,x,y-39,9+Math.sin(clock*14+(item.id||0))*2,'#ffb94355');}return;}
    if(item.kind==='trash'){if(!assets.trash)return;const height=55,width=height*assets.trash.width/assets.trash.height,x=item.x*TILE+ox,y=item.y*TILE+oy,rect={x:0,y:0,w:assets.trash.width,h:assets.trash.height},sprite=shadowedObject(assets.trash,rect,width,height,'trash');c.drawImage(sprite.image,x-width/2-sprite.pad,y+15-height-sprite.pad,sprite.width,sprite.height);return;}
    if(item.kind==='rail'){railSprite(c,item,ox,oy);return;}
    if(item.kind==='wagon'){wagonSprite(c,item,ox,oy);return;}
    if(item.kind==='soil'||item.kind==='stove'){
      if(!assets.agriculture)return;if(item.kind==='soil'&&!CROPS[item.crop])return;
      const index=item.kind==='stove'?30:CROPS[item.crop].row*4+cropStage(item),rect=AGRICULTURE_LAYOUT[index],height=item.kind==='stove'?58:18+cropStage(item)*12,width=Math.min(item.kind==='stove'?48:52,height*rect.w/rect.h),x=item.x*TILE+ox,y=item.y*TILE+oy;
      const sprite=shadowedObject(assets.agriculture,rect,width,height,'agriculture:'+index);c.drawImage(sprite.image,x-width/2-sprite.pad,y+13-height-sprite.pad,sprite.width,sprite.height);return;
    }
    if(BUILDING_LAYOUT[item.kind]){buildingSprite(c,item,clock,ox,oy);return;}
    if(BUILDINGS[item.kind]){drawBuilding(c,item,clock,ox,oy);return;}
    const index={lamp:0,air:1,drill:2,forge:3}[item.kind],rect=EQUIPMENT_LAYOUT[index],height={lamp:82,air:78,drill:65,forge:123}[item.kind],width=height*rect.w/rect.h;
    const x=item.x*TILE+ox,y=item.y*TILE+oy;c.save();c.translate(x,y);c.fillStyle='#0007';c.beginPath();c.ellipse(0,4,width*.32,8,0,0,TAU);c.fill();
    if(item.kind==='drill'&&item.face?.x<0)c.scale(-1,1);
    const sprite=shadowedObject(assets.equipment,rect,width,height,item.kind);c.drawImage(sprite.image,-width/2-sprite.pad,8-height-sprite.pad,sprite.width,sprite.height);
    if(item.kind==='drill'&&item.status==='working'){c.fillStyle='#e3bc7040';const r=3+Math.sin(clock*18)*1.5;c.beginPath();c.arc(width*.37,-height*.36,r,0,TAU);c.fill();}
    c.restore();
  }
  function buildingSprite(c,item,clock,ox,oy){
    const key=item.kind==='door'&&item.open?'doorOpen':item.kind,rect=BUILDING_LAYOUT[key];if(!rect)return;
    const {width,height,base}=rect,x=item.x*TILE+ox,y=item.y*TILE+oy;
    c.save();c.translate(x,y);
    c.save();if(item.kind==='wall'&&item.rotation===1)c.rotate(Math.PI/2);else if(item.kind==='conveyor'&&item.face)c.rotate(Math.atan2(item.face.x,-item.face.y));
    const sprite=BUILDINGS[item.kind]?.floor?{image:assets.buildings,plain:true}:shadowedObject(assets.buildings,rect,width,height,'building:'+key);
    if(sprite.plain)c.drawImage(sprite.image,rect.x,rect.y,rect.w,rect.h,-width/2,base-height,width,height);
    else c.drawImage(sprite.image,-width/2-sprite.pad,base-height-sprite.pad,sprite.width,sprite.height);
    c.restore();
    if(['conveyor','arm','sorter','drill'].includes(item.kind)&&item.face){
      // Discrete output arrow follows the machine direction without rotating tall art.
      const {x:dx,y:dy}=item.face,px=dx*22,py=dy*16;c.strokeStyle='#d8bd82';c.lineWidth=2;c.beginPath();c.moveTo(px-dx*5-dy*4,py-dy*5+dx*4);c.lineTo(px,py);c.lineTo(px-dx*5+dy*4,py-dy*5-dx*4);c.stroke();
    }
    if(item.treasure)glow(c,0,-10,45,'#e0a94d35');
    c.restore();
  }
  function drawBuilding(c,item,clock,ox,oy){buildingSprite(c,item,clock,ox,oy);}
  function railSprite(c,item,ox,oy){const x=Math.floor(item.x),y=Math.floor(item.y),mask=railMask(railwayTracks,x,y),key=mask+':'+detailScale;let tile=railTextures.get(key);if(!tile){tile=makeCanvas();tile.width=tile.height=TILE*detailScale;const t=tile.getContext('2d');t.scale(detailScale,detailScale);drawRailTile(t,mask);railTextures.set(key,tile);}c.drawImage(tile,x*TILE+ox,y*TILE+oy,TILE,TILE);}
  function wagonSprite(c,item,ox,oy){
    if(!assets.wagon)return;const d=item.face||{x:0,y:1},index=d.y<0?0:d.x>0?1:d.y>0?2:3,rect=WAGON_FRAMES[index],width=d.x?76:64,height=width*rect.h/rect.w,x=item.x*TILE+ox,y=item.y*TILE+oy;
    const sprite=shadowedObject(assets.wagon,rect,width,height,'wagon:'+index);c.drawImage(sprite.image,x-width/2-sprite.pad,y+20-height-sprite.pad,sprite.width,sprite.height);
    if(!item.riderId){const resource=Object.entries(item.buffer||{}).find(([,n])=>n>0)?.[0];if(resource){c.save();c.beginPath();c.ellipse(x,y+23-height*.7,width*.29,height*.14,0,0,TAU);c.clip();for(let k=0;k<5;k++){c.fillStyle=RESOURCES[resource]?.color||'#9a968c';c.beginPath();c.ellipse(x+(k-2)*7,y+23-height*.7+(k%2)*4,7,5,k*.4,0,TAU);c.fill();c.strokeStyle='#181b20';c.lineWidth=1;c.stroke();}c.restore();}}
  }
  function placementPreview(c,state,me,clock,placement,ox,oy){
    const target=pointerTile(view,placement.pointer.x,placement.pointer.y);if(!target)return;
    const field=isFieldItem(placement.kind),reason=field?fieldActionReason(state,me,placement.kind,target):null,result=field?{ok:!reason,reason}:checkPlacement(state,me,placement.kind,target,placement.rotation??0),px=target.x*TILE+ox,py=target.y*TILE+oy,color=result.ok?'#92e7aa':'#fa8b80';
    c.save();c.fillStyle=result.ok?'#5fbf7b30':'#e0665930';c.strokeStyle=color;c.lineWidth=2;c.fillRect(px+1,py+1,TILE-2,TILE-2);c.strokeRect(px+1,py+1,TILE-2,TILE-2);
    const ghost={kind:placement.kind,x:target.x+.5,y:target.y+.5,face:result.face||me.face,rotation:placement.rotation??0};
    if(!field){if(BUILDING_LAYOUT[ghost.kind])buildingSprite(c,ghost,clock,ox,oy);else installation(c,ghost,clock,ox,oy);}
    c.globalAlpha=1;const label=result.ok?(field?(placement.kind==='shovel'?(fieldAt(state,target)?'CLIC · Enlever la terre':'CLIC · Préparer la terre'):'CLIC · Semer'):placement.kind==='wall'?'CLIC · Poser · R · Tourner':'CLIC · Poser'):result.reason;c.font='bold 10px "Segoe UI", Arial, sans-serif';const tw=c.measureText(label).width;
    const lx=px+32-tw/2,ly=py+TILE+14;c.fillStyle='#05090ee8';c.fillRect(lx-6,ly-12,tw+12,18);text(c,label,lx,ly,10,color,'bold');c.restore();
  }
  function fluids(c,state,ox,oy,w,h,clock){
    if(!state.world)return;for(let y=Math.max(0,Math.floor(-oy/TILE));y<Math.min(state.tiles.length,Math.ceil((h-oy)/TILE));y++)for(let x=Math.max(0,Math.floor(-ox/TILE));x<Math.min(state.tiles[0].length,Math.ceil((w-ox)/TILE));x++){
      const t=state.tiles[y][x],px=x*TILE+ox,py=y*TILE+oy;
      if(t===10||t===11){
        const lava=t===11;
        if(lava||!assets['biome-terrain']){const g=c.createLinearGradient(px,py,px+TILE,py+TILE);g.addColorStop(0,lava?'#d76522':'#17475b');g.addColorStop(1,lava?'#5d1b17':'#061b2d');c.fillStyle=g;c.globalAlpha=lava?.8:1;c.fillRect(px,py,TILE+1,TILE+1);c.globalAlpha=1;}
        c.strokeStyle=lava?'#ffc36c65':'#9bdfe52b';c.lineWidth=lava?2:1;
        for(let k=0;k<3;k++){const yy=py+12+k*19;c.beginPath();c.moveTo(px,yy);c.bezierCurveTo(px+16,yy+Math.sin(clock+x+k)*4,px+40,yy-Math.sin(clock+y+k)*4,px+64,yy);c.stroke();}
        if(lava)glow(c,px+32,py+32,72,'#f97c3324');
        else naturalProp(c,state,x,y,px,py);
      }
    }
  }
  function actors(c,state,scenery,clock,ox,oy){
    const ordered=state.players.filter(p=>!p.escaped&&!p.vehicleId).map(p=>({depth:p.y,p}));
    for(const s of scenery)if(s.kind==='arch'||s.kind==='lift')ordered.push({depth:s.depth,s});
    for(const item of state.installations||[])if(item.kind!=='rail'&&!BUILDINGS[item.kind]?.floor&&item.x*TILE+ox>-90&&item.x*TILE+ox<c.canvas.width+90&&item.y*TILE+oy>-90&&item.y*TILE+oy<c.canvas.height+90)ordered.push({depth:item.y,item});
    for(const item of state.landmarks||[])ordered.push({depth:item.y,item:{...item,kind:'chest',treasure:true}});
    if(state.base?.foundry)ordered.push({depth:3.5,item:{kind:'forge',x:20.5,y:3.5}});
    ordered.sort((a,b)=>a.depth-b.depth);
    for(const item of ordered)if(item.p)miner(c,item.p,clock,ox,oy);else if(item.item){
      installation(c,item.item,clock,ox,oy);if(item.item.kind==='wagon'){const riders=state.players.filter(p=>p.vehicleId===item.item.id).sort((a,b)=>a.slot-b.slot);for(const [i,p]of riders.entries()){const horizontal=!!item.item.face?.x,seat={x:horizontal?(i%3-1)*16:(i%2-.5)*20,y:horizontal?Math.floor(i/3)*11-12:Math.floor(i/2)*8-14};c.save();c.beginPath();c.rect(item.item.x*TILE+ox-33,item.item.y*TILE+oy-74,66,82);c.clip();miner(c,p,clock,ox,oy,seat);c.restore();}if(riders.length){c.save();c.beginPath();c.rect(item.item.x*TILE+ox-45,item.item.y*TILE+oy-8,90,40);c.clip();wagonSprite(c,item.item,ox,oy);c.restore();}}
    }else structure(c,item.s,ox,oy,item.s.kind==='lift');
  }

  function updateParticles(state,clock,quality) {
    if(state.revision!==lastRevision){
      if(state.world){for(const [x,y,old,t]of state.changedCells||[])if(t===0&&resourceFor(old)&&quality!=='low')for(let k=0;k<14;k++)particles.push({x:x+.5,y:y+.5,born:clock,dx:Math.sin(k*11)*.9,dy:Math.cos(k*7)*.65,color:oreColor[old]||'#bba17a',r:2+hash(x,y,k)*3});}
      else for(let y=0;y<state.tiles.length;y++)for(let x=0;x<state.tiles[y].length;x++){
        const key=y*state.tiles[0].length+x,t=state.tiles[y][x],old=previousTiles.get(key);
        if(t===0&&old>0&&old<9&&quality!=='low'){
          for(let k=0;k<14;k++)particles.push({x:x+.5,y:y+.5,born:clock,dx:Math.sin(k*11)*.9,dy:Math.cos(k*7)*.65,color:old>1?oreColor[old]:'#bba17a',r:2+hash(x,y,k)*3});
        }
        previousTiles.set(key,t);
      }
      lastRevision=state.revision;
    }
    while(particles.length&&clock-particles[0].born>1.2)particles.shift();
    if(particles.length>240)particles.splice(0,particles.length-240);
  }

  function mining(c,state,ox,oy,clock,quality) {
    const fractures=new Map();
    for(const p of state.players)if(p.mine>0&&p.alive&&!p.escaped){
      const x=Math.floor(p.x)+p.face.x,y=Math.floor(p.y)+p.face.y;
      if(state.tiles[y]?.[x]<=0)continue;const key=`${x},${y}`;
      fractures.set(key,{x,y,progress:Math.max(p.mine,fractures.get(key)?.progress||0)});
    }
    for(const {x,y,progress}of fractures.values()){
      const cx=(x+.5)*TILE+ox,cy=(y+.5)*TILE+oy;
      for(let k=0;k<5;k++){
        const a=k*TAU/5+hash(x,y,4),r=(15+hash(x,y,k)*12)*clamp(progress,0,1);
        c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a+.2)*r*.5,cy+Math.sin(a+.2)*r*.5);c.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
        c.strokeStyle='#010305c9';c.lineWidth=3;c.stroke();c.strokeStyle='#dcc39588';c.lineWidth=.7;c.stroke();
      }
      if(quality!=='low')for(let i=0;i<7;i++){
        const age=(clock*3.6+i/7)%1,a=hash(x,y,i)*TAU,dx=Math.cos(a)*age*33,dy=Math.sin(a)*age*22+age*age*8;
        c.globalAlpha=1-age;c.strokeStyle=i%2?'#fff2c0':'#e4ab5e';c.lineWidth=i%2?1:2;
        c.beginPath();c.moveTo(cx+dx*.7,cy+dy*.7);c.lineTo(cx+dx,cy+dy);c.stroke();
      }
      c.globalAlpha=1;
    }
  }

  function gasClouds(c,state,ox,oy,w,h,clock,quality) {
    if(Math.sin(state.time/12)<=0||(-oy+h)/TILE<30)return;
    const x0=Math.max(0,Math.floor(-ox/TILE)),x1=Math.min(state.tiles[0].length,Math.ceil((w-ox)/TILE));
    const y0=Math.max(30,Math.floor(-oy/TILE)),y1=Math.min(state.tiles.length,Math.ceil((h-oy)/TILE));
    c.save();c.beginPath();
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(state.tiles[y][x]===0&&(!state.world||['deep','volcano'].includes(biomeAt(state.world,x,y).id)))c.rect(x*TILE+ox,y*TILE+oy,TILE+1,TILE+1);
    c.clip();
    for(let y=y0-2;y<y1+2;y+=3)for(let x=x0-2;x<x1+2;x+=3){
      const xx=(x+1.5)*TILE+ox+Math.sin(clock*.2+hash(x,y)*TAU)*35;
      const yy=(y+1.5)*TILE+oy+Math.cos(clock*.16+hash(x,y,2)*TAU)*30;
      glow(c,xx,yy,quality==='low'?110:160,'#a8c43b70');
    }
    c.restore();
  }

  function worldDetails(c,state,ox,oy,w,h,clock,quality) {
    if(quality==='low')return;
    for(const p of particles){
      const age=clock-p.born,x=(p.x+p.dx*age)*TILE+ox,y=(p.y+p.dy*age+age*age*.35)*TILE+oy;
      c.globalAlpha=1-age/1.2;c.fillStyle=p.color;c.beginPath();c.ellipse(x,y,p.r,p.r*.7,age*4,0,TAU);c.fill();
      if(age<.5){c.globalAlpha=.03*(1-age*2);glow(c,p.x*TILE+ox,p.y*TILE+oy,30+age*40,'#b8a17e');}
    }
    c.globalAlpha=1;
    for(let i=0;i<36;i++){
      const x=hash(i,3)*w+Math.sin(clock*.2+i)*14,y=(hash(i,4)*h-clock*2)%h;
      if(state.tiles[Math.floor((y-oy)/TILE)]?.[Math.floor((x-ox)/TILE)]!==0)continue;
      c.fillStyle='#d4c29338';c.fillRect(x,y,1.5,1.5);
    }
  }

  function crystals(c,state,ox,oy,w,h,clock) {
    const x0=Math.max(0,Math.floor(-ox/TILE)),x1=Math.min(state.tiles[0].length,Math.ceil((w-ox)/TILE));
    const y0=Math.max(0,Math.floor(-oy/TILE)),y1=Math.min(state.tiles.length,Math.ceil((h-oy)/TILE));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(state.tiles[y][x]===3||state.tiles[y][x]===4){
      const t=state.tiles[y][x],pulse=.65+Math.sin(clock*1.6+hash(x,y)*TAU)*.2;
      c.globalAlpha=pulse;glow(c,(x+.5)*TILE+ox,(y+.48)*TILE+oy,29,oreColor[t]+'24');
      c.globalAlpha=1;
    }
  }

  function hud(c,w,h,state,me) {
    const top=c.createLinearGradient(0,0,0,84);top.addColorStop(0,'#000000cc');top.addColorStop(1,'transparent');c.fillStyle=top;c.fillRect(0,0,w,84);
    text(c,'DEEP MINERS',24,40,26,'#e6dfcf','bold');
    c.strokeStyle='#d89d44';c.lineWidth=3;c.beginPath();c.moveTo(221,40);c.lineTo(237,22);c.moveTo(225,20);c.quadraticCurveTo(237,20,241,30);c.stroke();
    const depth=Math.max(0,Math.floor((me.y-5)*10));
    const biome=state.world?biomeAt(state.world,me.x,me.y):biomeFor(me.y);
    if(w>900){text(c,state.mode==='free'?biome.name:'02 · OBSCURITÉ',w/2-85,28,12,state.mode==='free'?biome.color:'#bfbdb5','bold');text(c,`PROFONDEUR −${depth} m`,w/2-69,48,10,'#9a9d99');}
    const seconds=Math.max(0,Math.ceil(state.duration-state.time));
    if(state.mode==='free')text(c,'LIBRE',w-91,38,18,'#e4dfd4','bold');else text(c,`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`,w-109,40,28,seconds<60?'#efad69':'#e4dfd4','bold');
    if(state.mode!=='free'){
    const tx=w-188,teamH=53+state.players.length*40+(state.mode==='free'?94:65);
    panel(c,tx-12,67,181,teamH);text(c,'ÉQUIPE',tx,90,11,'#b8b3a9','bold');
    state.players.forEach((p,i)=>{
      const y=116+i*40;helmet(c,tx+8,y-1,p.color);text(c,p.name.slice(0,13),tx+28,y-3,11,p.color,'bold');
      bar(c,tx+28,y+5,118,p.o2/100,p.color,6);
      if(!p.alive||p.escaped||!p.connected)text(c,p.escaped?'À L’ABRI':!p.alive?'À SECOURIR':'HORS LIGNE',tx+28,y+25,8,'#c6b5a0');
    });
    const qy=117+state.players.length*40+8;if(state.mode==='free'){text(c,'STOCK COMMUN',tx,qy,10,'#b8b3a9');text(c,`Pierre ${state.stock?.stone||0} · Or ${state.stock?.gold||0}`,tx,qy+22,11,'#dfb15e','bold');text(c,`Turq. ${state.stock?.crystal||0} · Am. ${state.stock?.amethyst||0}`,tx,qy+42,11,'#81d1d5');text(c,`PIOCHE ${['I','II','III','IV'][me.pickTier||0]} · ATELIER B`,tx,qy+62,10,'#b9b7a7');}else {text(c,'QUOTA RAPPORTÉ',tx,qy,10,'#b8b3a9');text(c,`${state.bank} / ${state.target}`,tx,qy+27,23,'#dfb15e','bold');
    bar(c,tx,qy+39,145,state.target?state.bank/state.target:0,'#ce9c49',4);}
    }
    panel(c,18,h-114,258,95);
    if(state.mode==='free'){
      panel(c,18,h-210,258,88);text(c,`VIE  ${Math.ceil(me.health??100)} / 100`,32,h-188,12,(me.health??100)<30?'#ef7774':'#e59494','bold');bar(c,32,h-177,228,(me.health??100)/100,'#cc7575',7);
      text(c,`SATIÉTÉ  ${Math.ceil(me.hunger??100)} %`,32,h-151,12,(me.hunger??100)<20?'#efad59':'#d4bd79','bold');bar(c,32,h-141,228,(me.hunger??100)/100,'#c5a353',7);
    }
    text(c,`OXYGÈNE  ${Math.ceil(me.o2)} %`,32,h-89,12,me.o2<30?'#edb658':'#91d6d3','bold');
    bar(c,32,h-77,228,me.o2/100,me.o2<30?'#dfa24a':'#80c7c8',9);
    text(c,`SAC  ${me.bag} / ${capacity(me)}`,32,h-47,12,'#c7c4bd','bold');bar(c,32,h-34,228,me.bag/capacity(me),'#c5b9a0',7);
    if(w>1000&&state.mode!=='free'){
      const keys=[['ZQSD',64],['ESPACE',84],['E',34]],sx=w-243;let x=sx;
      for(const [label,kw]of keys){panel(c,x,h-53,kw,33);text(c,label,x+10,h-31,12,'#cfcbc1','bold');x+=kw+10;}
    }
    if(state.events[0]){
      const x=18,y=h-(state.mode==='free'?302:210),mw=258;panel(c,x,y,mw,82);text(c,'RADIO',x+14,y+20,10,'#d6a963','bold');
      c.save();c.font='11px sans-serif';const lines=[''];for(const word of state.events[0].split(' ')){const i=lines.length-1,next=lines[i]?(lines[i]+' '+word):word;if(c.measureText(next).width>mw-28&&lines[i])lines.push(word);else lines[i]=next;}c.restore();
      lines.slice(0,3).forEach((line,i)=>text(c,line+(i===2&&lines.length>3?'…':''),x+14,y+39+i*15,11,'#ddd7cb'));
    }
  }

  function draw(c,w,h,state,me,clock,settings={}) {
    railwayTracks=railIndex(state);
    const reset=lastCode!==state.code||state.time<lastGameTime;
    if(reset){previousTiles.clear();particles.length=0;chunks.clear();chamberPropCache.clear();materialSampler.clear();fixedLightCache.clear();terrainTiles=null;terrainVersion=terrainRevision=-1;lastRevision=-1;camera=null;lastClock=null;animator.reset();}
    lastCode=state.code;lastGameTime=state.time;
    const quality=settings.quality||'high',brightness=settings.brightness??1;
    animator.prune(state.players);
    if(!camera||Math.hypot(camera.x-me.x,camera.y-me.y)>5)camera={x:me.x,y:me.y};
    const dt=lastClock===null?0:clamp(clock-lastClock,0,.1),ease=1-Math.exp(-dt*16);
    camera.x+=(me.x-camera.x)*ease;camera.y+=(me.y-camera.y)*ease;lastClock=clock;
    view=caveView(w,h,camera,settings.zoom);
    const {zoom,ox,oy,width:vw,height:vh}=view;
    const scale=clamp(Math.ceil((settings.pixelRatio||1)*zoom*2)/2,1,2);
    if(detailScale!==scale){detailScale=scale;chunks.clear();propTextures.clear();objectShadows.clear();terrainTiles=null;}
    c.save();c.clearRect(0,0,w,h);c.fillStyle='#02050a';c.fillRect(0,0,w,h);c.scale(zoom,zoom);
    terrain(c,state,ox,oy,vw,vh);fluids(c,state,ox,oy,vw,vh,clock);chamberProps(c,state,ox,oy,vw,vh);builtSurfaces(c,state,ox,oy,vw,vh);updateParticles(state,clock,quality);
    const scenery=visibleStructures(state,ox,oy,vw,vh);
    for(const s of scenery)if(s.kind!=='arch')structure(c,s,ox,oy);
    gasClouds(c,state,ox,oy,vw,vh,clock,quality);mining(c,state,ox,oy,clock,quality);
    worldDetails(c,state,ox,oy,vw,vh,clock,quality);
    actors(c,state,scenery,clock,ox,oy);
    lights(c,vw,vh,state,me,ox,oy,quality,brightness,clock);crystals(c,state,ox,oy,vw,vh,clock);
    if(settings.placement)placementPreview(c,state,me,clock,settings.placement,ox,oy);
    c.restore();
    const v=c.createRadialGradient(w/2,h/2,h*.27,w/2,h/2,Math.max(w,h)*.65);v.addColorStop(0,'transparent');v.addColorStop(1,'#00060a8a');c.fillStyle=v;c.fillRect(0,0,w,h);
    if(!settings.separateHUD)overlays(c,w,h,state,me,clock,settings);
  }

  function overlays(c,w,h,state,me,clock,settings){
    const {zoom,ox,oy}=caveView(w,h,camera||me,settings.zoom);
    c.save();c.scale(zoom,zoom);
    for(const p of state.players){
      if(p.escaped||p.vehicleId&&state.players.find(q=>q.vehicleId===p.vehicleId)?.id!==p.id)continue;const x=p.x*TILE+ox,y=p.y*TILE+oy;
      c.font='bold 10px "Segoe UI", Arial, sans-serif';c.textAlign='center';c.fillStyle=p.color;c.strokeStyle='#000b';c.lineWidth=2.5;
      const label=p.vehicleId?state.players.filter(q=>q.vehicleId===p.vehicleId).map(q=>q.name).join(' · '):p.name;c.strokeText(label,x,y-78);c.fillText(label,x,y-78);
      if(!p.alive){c.fillStyle='#f2bc86';c.fillText(`E · SECOURIR ${Math.floor(p.revive/3*100)} %`,x,y+43);}
    }
    const tx=Math.floor(me.x)+me.face.x,ty=Math.floor(me.y)+me.face.y,t=state.tiles[ty]?.[tx];
    if(me.alive&&!me.escaped&&t>0&&t<9){
      const x=(tx+.5)*TILE+ox,y=(ty+.5)*TILE+oy;c.strokeStyle=oreColor[t]||'#c8bd9a';c.lineWidth=1.25;
      for(let k=0;k<4;k++){c.beginPath();c.arc(x,y,28,k*Math.PI/2+.3,k*Math.PI/2+.85);c.stroke();}
      if(me.mine>0){c.strokeStyle='#f6cb7e';c.lineWidth=3;c.beginPath();c.arc(x,y,32,-Math.PI/2,-Math.PI/2+TAU*clamp(me.mine,0,1));c.stroke();}
    }
    if(state.mode==='free'&&resourceFor(t)&&(me.pickTier||0)<requiredPick(t)){text(c,requiredPick(t)===3?'PIOCHE EN ACIER REQUISE':requiredPick(t)===2?'PIOCHE DE PROFONDEUR REQUISE':'PIOCHE RENFORCÉE REQUISE',(tx+.5)*TILE+ox-110,(ty+.5)*TILE+oy+44,10,'#e4bb81','bold');}
    for(const item of state.installations||[])if(item.kind==='drill'&&Math.hypot(item.x-me.x,item.y-me.y)<2.5){const amount=Object.values(item.buffer||{}).reduce((a,b)=>a+b,0);text(c,amount?'E · CAISSE '+amount+' / 12':item.status==='empty'?'GISEMENT ÉPUISÉ':'FOREUSE EN MARCHE',item.x*TILE+ox-64,item.y*TILE+oy+34,9,'#bfc1ac','bold');}
    const plot=fieldAt(state,{x:tx,y:ty});if(plot&&CROPS[plot.crop])text(c,cropReady(plot)?'E · RÉCOLTER':CROPS[plot.crop].name+' · '+Math.ceil(CROPS[plot.crop].seconds-(plot.growth||0))+' s',plot.x*TILE+ox-40,plot.y*TILE+oy+35,10,cropReady(plot)?'#a8e893':'#d5c6a7','bold');
    c.restore();
    if(settings.hud===false)return;
    hud(c,w,h,state,me);
    const gas=(state.world?['deep','volcano'].includes(biomeAt(state.world,me.x,me.y).id):me.y>30)&&Math.sin(state.time/12)>0;
    if(me.blockedMine)text(c,me.blockedMine.toUpperCase(),24,h-318,11,'#e4bb81','bold');
    if(!me.alive&&state.mode==='free'){panel(c,w/2-190,h/2+55,380,58);text(c,'UN AMI PEUT TE SECOURIR AVEC E',w/2-160,h/2+78,12,'#e3be8b','bold');text(c,'Ou utilise « Retour de secours » : le sac sera perdu.',w/2-169,h/2+97,10,'#bbb8ab');}
    if(gas)text(c,'POCHE DE GAZ · REMONTEZ VERS UNE ZONE PLUS HAUTE',24,80,11,'#c7d37d','bold');
    if(me.o2<30&&me.alive&&!me.escaped){
      c.strokeStyle=`rgba(219,150,53,${.35+Math.sin(clock*3)*.1})`;c.lineWidth=3;c.strokeRect(2,2,w-4,h-4);
      text(c,'AIR FAIBLE · RETOUR À L’ASCENSEUR',24,h-223,11,'#e5aa65','bold');
    }
    if(!me.alive||me.escaped){panel(c,w/2-235,65,470,42);text(c,me.escaped?'Vous êtes à l’abri. Vos amis continuent.':'À terre : un ami doit maintenir E près de vous.',w/2-220,90,12,me.escaped?'#81cfd3':'#eab581');}
  }
  function drawHUD(c,w,h,state,me,clock,settings={}){c.clearRect(0,0,w,h);overlays(c,w,h,state,me,clock,settings);}
  return {pointerTile:(x,y)=>pointerTile(view,x,y),draw,drawHUD};
}



