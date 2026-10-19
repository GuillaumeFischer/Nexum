// Mechanical sprite extraction from the original source art. No generated pose,
// body registration or scale is changed; old frame registrations are preserved.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spriteComponents,spriteRectangle,ownsSpritePixel} from './lib/sprite-components.mjs';
const require=createRequire(process.env.CANVAS_MODULE_ROOT?path.join(process.env.CANVAS_MODULE_ROOT,'package.json'):import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const [source,target,reportDirectory]=process.argv.slice(2);
if(!source||!target)throw Error('Usage: node scripts/repair-miner-atlases.mjs <original-source-directory> <asset-directory> [report-directory]');
const registrations=JSON.parse(await fs.readFile(path.join(source,'packed-measurements.json'),'utf8'));
const report=[];
for(const sheet of registrations){
 const image=await loadImage(path.join(source,sheet.name+'.png')),original=createCanvas(image.width,image.height).getContext('2d');original.drawImage(image,0,0);
 const columns=sheet.name==='idle'?4:8,packed=createCanvas(columns*192,3*224),c=packed.getContext('2d');
 const frames=[];
 for(let row=0;row<3;row++){
  const registered=sheet.frames.filter(f=>f.row===row),rowY=registered[0].source.y,rowHeight=registered[0].source.h;
  const rowPixels=original.getImageData(0,rowY,image.width,rowHeight),components=spriteComponents(rowPixels.data,image.width,rowHeight,{expected:columns});
  for(let col=0;col<columns;col++){
   const part=components.parts[col],rect=spriteRectangle(part,image.width,rowHeight),frame=registered[col];
   const tile=createCanvas(rect.width,rect.height),tc=tile.getContext('2d'),pixels=tc.createImageData(rect.width,rect.height);
   for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++){
    const xx=rect.x+x,yy=rect.y+y,from=(yy*image.width+xx)*4,to=(y*rect.width+x)*4;
    if(rowPixels.data[from+3]>=16&&ownsSpritePixel(components,part,xx,yy))pixels.data.set(rowPixels.data.subarray(from,from+4),to);
   }
   tc.putImageData(pixels,0,0);
   const absoluteRootX=frame.source.x+frame.anchorSourceX,absoluteRootY=frame.source.y+frame.anchorSourceY;
   const x=col*192+96-(absoluteRootX-rect.x)*frame.scale,y=row*224+200-(absoluteRootY-rowY-rect.y)*frame.scale;
   c.save();c.beginPath();c.rect(col*192,row*224,192,224);c.clip();c.drawImage(tile,x,y,tile.width*frame.scale,tile.height*frame.scale);c.restore();
   frames.push({row,col,sourceRect:{...rect,y:rect.y+rowY},sourcePixels:part.count,scale:frame.scale,absoluteRootX,absoluteRootY});
  }
 }
 const bytes=await packed.encode('webp',94);await fs.writeFile(path.join(target,'miner-v2-'+sheet.name+'.webp'),bytes);
 report.push({sheet:sheet.name,bytes:bytes.length,frames});
}
if(reportDirectory){await fs.mkdir(reportDirectory,{recursive:true});await fs.writeFile(path.join(reportDirectory,'extraction-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({sheets:report.length,frames:report.reduce((n,s)=>n+s.frames.length,0),bytes:report.reduce((n,s)=>n+s.bytes,0),scaleAndAnchorsPreserved:true}));
