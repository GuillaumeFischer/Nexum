import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spriteComponents,spriteRectangle,ownsSpritePixel} from './lib/sprite-components.mjs';
const require=createRequire(process.env.CANVAS_MODULE_ROOT?path.join(process.env.CANVAS_MODULE_ROOT,'package.json'):import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const source=process.argv[2],torsoSource=process.argv[3];
if(!source||!torsoSource)throw Error('Provide the original rig sheet directory and the sleeveless torso directory');
const client=fileURLToPath(new URL('../games/deep-miners/client/',import.meta.url));
const names=['reference','head','torso','pelvis','upperNear','lowerNear','upperFar','lowerFar','thighNear','shinNear','bootNear','thighFar','shinFar','bootFar','pick','shovel'];
const layouts={},report=[];
for(const view of ['south','east','north']){
 const image=await loadImage(path.join(source,'rig-'+view+'.png')),original=createCanvas(image.width,image.height).getContext('2d');original.drawImage(image,0,0);
 const pixels=original.getImageData(0,0,image.width,image.height),components=spriteComponents(pixels.data,image.width,image.height,{minimumPixels:1500,expected:16}),slots=new Map();
 for(const part of components.parts){const col=Math.min(3,Math.floor((part.left+part.right)/2/image.width*4)),row=Math.min(3,Math.floor((part.top+part.bottom)/2/image.height*4)),index=row*4+col;if(slots.has(index))throw Error(`Overlapping rig parts: ${view}/${index}`);slots.set(index,part);}
 const packed=createCanvas(1024,1024),c=packed.getContext('2d'),parts={};
 for(let i=0;i<16;i++){
  const part=slots.get(i);if(!part)throw Error(`Missing rig part: ${view}/${names[i]}`);
  const full=spriteRectangle(part,image.width,image.height),r={...full};
  // Keep the kneepad with the thigh, overlapping the lower leg. Remove the
  // second pad drawn in the shin source and the spare scarf under the head.
  if(i===1)r.height=Math.round(r.height*.78);
  if(i===3){const trim=Math.round(r.height*.32);r.y+=trim;r.height=Math.round(r.height*(view==='east'?.3:.4));}
  if(i===9||i===12){const trim=Math.round(r.height*(view==='north'?.18:.48));r.y+=trim;r.height-=trim;}
  // The front forearm sheets contain an extra sleeve; the lower arm starts at
  // its rolled cuff. The elbow cap remains hidden under the upper-arm overlap.
  if(view==='south'&&(i===5||i===7)){const trim=Math.round(r.height*.42);r.y+=trim;r.height-=trim;}
  const tile=createCanvas(r.width,r.height),tc=tile.getContext('2d'),data=tc.createImageData(r.width,r.height);
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
   const xx=r.x+x,yy=r.y+y,from=(yy*image.width+xx)*4,to=(y*r.width+x)*4;
   if(pixels.data[from+3]>=16&&ownsSpritePixel(components,part,xx,yy))data.data.set(pixels.data.subarray(from,from+4),to);
  }
  tc.putImageData(data,0,0);
  // The original sheet has sleeves painted into its torso. Always replace that
  // slot with a sleeveless trunk: sleeves belong exclusively to the arm bones.
  let prepared=tile;
  if(i===2){
   const trunk=await loadImage(path.join(torsoSource,'torso-'+view+'.png')),trunkCanvas=createCanvas(trunk.width,trunk.height),trunkContext=trunkCanvas.getContext('2d');trunkContext.drawImage(trunk,0,0);
   const trunkPixels=trunkContext.getImageData(0,0,trunk.width,trunk.height),trunkParts=spriteComponents(trunkPixels.data,trunk.width,trunk.height,{minimumPixels:1500,expected:1}),trunkRect=spriteRectangle(trunkParts.parts[0],trunk.width,trunk.height);
   prepared=createCanvas(trunkRect.width,trunkRect.height);prepared.getContext('2d').drawImage(trunkCanvas,trunkRect.x,trunkRect.y,trunkRect.width,trunkRect.height,0,0,trunkRect.width,trunkRect.height);
  }
  const scale=Math.min(232/prepared.width,232/prepared.height),w=prepared.width*scale,h=prepared.height*scale,x=i%4*256+(256-w)/2,y=Math.floor(i/4)*256+(256-h)/2;
  c.drawImage(prepared,x,y,w,h);
  const a=[.5,.08],b=[.5,.91];
  if(i===8||i===11)b[1]=.8;
  if(i===4||i===6){a[0]=i===4?.66:.42;b[0]=i===4?.4:.6;}
  if((i===5||i===7)&&view==='south'){a[0]=i===5?.36:.64;b[0]=i===5?.61:.39;}
  if((i===5||i===7)&&view==='east'){a[0]=.27;b[0]=.68;}
  parts[names[i]]={x,y,w,h,a,b};
 }
 const asset='assets/miner-rig-'+view+'.webp',bytes=await packed.encode('webp',94);await fs.writeFile(path.join(client,asset),bytes);
 layouts[view]={asset,parts};report.push({view,bytes:bytes.length,parts:Object.keys(parts).length,torso:'sleeveless'});
}
await fs.writeFile(path.join(client,'miner-rig-layout.js'),'// Continuous character rig; source art and joint anchors prepared by scripts/prepare-miner-rig.mjs.\nexport const MINER_RIG='+JSON.stringify(layouts)+';\n');
await fs.writeFile(path.join(torsoSource,'rig-extraction.json'),JSON.stringify({layouts,report},null,2));console.log(JSON.stringify(report));
