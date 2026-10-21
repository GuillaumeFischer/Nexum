import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {createPixelMinerArt,PIXEL_MINER_ASSETS} from '../games/deep-miners/client/pixel-miner.js';import {PIXEL_MINER} from '../games/deep-miners/client/pixel-miner-layout.js';import {spriteComponents} from './lib/sprite-components.mjs';
const require=createRequire(process.env.CANVAS_MODULE_ROOT?path.join(process.env.CANVAS_MODULE_ROOT,'package.json'):import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas'),client=fileURLToPath(new URL('../games/deep-miners/client/',import.meta.url)),out=path.resolve(process.argv[2]||'test-output/pixel-miner');await fs.mkdir(out,{recursive:true});
const assets=Object.fromEntries(await Promise.all(Object.entries(PIXEL_MINER_ASSETS).map(async([k,p])=>[k,await loadImage(path.join(client,p))]))),makeCanvas=()=>createCanvas(1,1),art=createPixelMinerArt(assets,makeCanvas),sample=createCanvas(192,160),c=sample.getContext('2d');
const hash=data=>createHash('sha256').update(data).digest('hex'),report={checkedAt:new Date().toISOString(),completePoses:0,paletteColors:0,minimumMargin:96,walkCycles:0,walkDistinct:[],carriedToolSamples:0,seatedChecks:0,detached:[],nativeCanvasOnly:true,interactiveWindowTested:false};
const original=createCanvas(assets['miner-pixel'].width,assets['miner-pixel'].height).getContext('2d');original.drawImage(assets['miner-pixel'],0,0);const colors=new Set();
for(let row=0;row<3;row++)for(let column=0;column<12;column++){
 const data=original.getImageData(column*96,row*96,96,96).data;let left=96,right=0,top=96,bottom=0,count=0;
 for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4;assert(data[i+3]===0||data[i+3]===255,'Pixel alpha must be binary');if(data[i+3]){colors.add(data.slice(i,i+3).join(','));left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}}
 assert(count>500);assert(left>1&&top>1&&right<94&&bottom<94,`Clipped sprite ${row}/${column}`);report.minimumMargin=Math.min(report.minimumMargin,left,top,95-right,95-bottom);report.completePoses++;
 const parts=spriteComponents(data,96,96,{minimumPixels:3}).parts;if(parts.length!==1)report.detached.push({row,column,parts});
}
report.paletteColors=colors.size;assert(report.paletteColors<=26);
for(let dir=0;dir<4;dir++)for(const heldItem of [null,'pick','shovel']){
 const unique=new Set();for(let step=0;step<4;step++){
  c.clearRect(0,0,192,160);art.draw(c,{alive:true,slot:0,heldItem},{dir,phase:step/4,walk:true},96,135);const data=c.getImageData(0,0,192,160).data;unique.add(hash(data));
  const parts=spriteComponents(data,192,160,{minimumPixels:3}).parts;if(parts.length!==1)report.detached.push({dir,heldItem,step,parts});if(heldItem)report.carriedToolSamples++;
 }report.walkDistinct.push({dir,heldItem,count:unique.size});report.walkCycles++;
}
const colorsRendered=new Set();for(let slot=0;slot<6;slot++){c.clearRect(0,0,192,160);art.draw(c,{alive:true,slot,heldItem:null},{dir:0},96,135);colorsRendered.add(hash(c.getImageData(0,0,192,160).data));}assert.equal(colorsRendered.size,6);report.playerColors=6;
for(let dir=0;dir<4;dir++)for(let slot=0;slot<6;slot++){
 let expected;for(let i=0;i<4;i++){
  c.clearRect(0,0,192,160);art.draw(c,{alive:true,slot,vehicleId:'wagon',heldItem:i%2?'pick':'shovel',mine:i/4,actionSeconds:.3},{dir,walk:true,phase:i/4,clock:i*2},96,135);const actual=hash(c.getImageData(0,0,192,160).data);if(!expected)expected=actual;else assert.equal(actual,expected);report.seatedChecks++;
 }
}
for(let row=0;row<3;row++)for(let column=0;column<12;column++)for(let slot=1;slot<6;slot++){
 const p={alive:true,slot,heldItem:null},pose={dir:row,walk:column>0&&column<5,phase:Math.max(0,column-1)/4};if(column===5)p.vehicleId='wagon';if(column>=6&&column<9){p.heldItem='pick';p.mine=(column-6+.2)/3;}if(column>=9){p.heldItem='shovel';p.actionSeconds=.45*(1-(column-9+.2)/3);}art.draw(c,p,pose,96,135);
}
assert(art.cacheSize<=256);report.tintCacheEntries=art.cacheSize;art.clear();assert.equal(art.cacheSize,0);
await fs.writeFile(path.join(out,'graphics-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(report.detached.length,0,'Detached pixels in prepared sprites or carried tools');assert(report.walkDistinct.every(c=>c.count===4),'Every walk cycle must contain four distinct images');
