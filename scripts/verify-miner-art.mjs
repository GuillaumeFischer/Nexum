// Optional graphics check: provide @napi-rs/canvas via CANVAS_MODULE_ROOT.
// It runs the actual character renderer without opening a game or loading saves.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NEW_MINER_ASSETS,createNewMinerArt} from '../games/deep-miners/client/new-miner.js';
import {MINER_ATLASES,MINER_CELL} from '../games/deep-miners/client/new-miner-layout.js';
const require=createRequire(process.env.CANVAS_MODULE_ROOT?path.join(process.env.CANVAS_MODULE_ROOT,'package.json'):import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const client=fileURLToPath(new URL('../games/deep-miners/client/',import.meta.url));
const output=path.resolve(process.argv[2]||'test-output/rebuilt-miner');await fs.mkdir(output,{recursive:true});
const assets=Object.fromEntries(await Promise.all(Object.entries(NEW_MINER_ASSETS).map(async([key,asset])=>[key,await loadImage(path.join(client,asset))])));
const makeCanvas=()=>createCanvas(1,1),art=createNewMinerArt(assets,makeCanvas),faces=[{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}];
const hash=c=>createHash('sha256').update(c.getImageData(0,0,c.canvas.width,c.canvas.height).data).digest('hex');
let frames=0,minimumMargin=Infinity;
for(const [name,sheet]of Object.entries(MINER_ATLASES)){
 const image=assets['miner-v2-'+name];assert.equal(image.width,sheet.width);assert.equal(image.height,sheet.height);
 const c=createCanvas(image.width,image.height).getContext('2d');c.drawImage(image,0,0);
 for(let row=0;row<3;row++)for(let col=0;col<sheet.columns;col++){
  const {width,height}=MINER_CELL,data=c.getImageData(col*width,row*height,width,height).data;
  let opaque=0,l=width,t=height,r=0,b=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>80){opaque++;l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  assert(opaque>800,`${name}/${row}/${col} empty`);const margin=Math.min(l,t,width-r-1,height-b-1);
  assert(margin>=2,`${name}/${row}/${col} clipped (${margin})`);minimumMargin=Math.min(minimumMargin,margin);frames++;
 }
}
const canvas=createCanvas(180,160),c=canvas.getContext('2d');
const player={id:'qa',x:0,y:0,face:faces[0],alive:true,slot:0,heldItem:null};
let distinctCycles=0;
for(const face of faces)for(const heldItem of [null,'pick','shovel'])for(const run of [0,1]){
 const hashes=new Set();for(let column=0;column<8;column++){c.clearRect(0,0,180,160);art.draw(c,{...player,face,heldItem},{walk:true,run,column},90,130);hashes.add(hash(c));}
 assert.equal(hashes.size,8,'Every cycle must contain eight distinct drawn images');distinctCycles++;
}
const colors=new Set();for(let slot=0;slot<6;slot++){c.clearRect(0,0,180,160);art.draw(c,{...player,slot},{walk:false},90,130);colors.add(hash(c));}assert.equal(colors.size,6);
for(const face of faces)for(let slot=0;slot<6;slot++){
 let reference;for(let i=0;i<9;i++){c.clearRect(0,0,180,160);art.draw(c,{...player,face,slot,vehicleId:'wagon',mine:i/10,actionSeconds:.4,heldItem:i%2?'pick':'shovel'},{walk:true,run:i%2,column:i%8},90,130);const value=hash(c);if(!reference)reference=value;else assert.equal(value,reference);}
}
const palette=createCanvas(720,160),pc=palette.getContext('2d');pc.fillStyle='#17212b';pc.fillRect(0,0,720,160);
for(let slot=0;slot<6;slot++)art.draw(pc,{...player,slot},{walk:false},60+slot*120,135);
await fs.writeFile(path.join(output,'six-joueurs.png'),palette.toBuffer('image/png'));
// Exercise every tint key: the cache must stay bounded even in a full party.
for(const face of faces)for(const heldItem of [null,'pick','shovel'])for(const run of [0,1])for(let column=0;column<8;column++)for(let slot=1;slot<6;slot++)art.draw(c,{...player,face,heldItem,slot},{walk:true,run,column},90,130);
assert(art.cacheSize<=256);const peakCache=art.cacheSize;art.clear();assert.equal(art.cacheSize,0);
const report={checkedAt:new Date().toISOString(),frames,minimumMargin,distinctCycles,distinctPlayerColors:colors.size,seatedStableDirections:4,seatedStableSlots:6,boundedTintCache:peakCache};
await fs.writeFile(path.join(output,'graphics-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
