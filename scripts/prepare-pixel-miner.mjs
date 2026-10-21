import {createRequire} from 'node:module';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spriteComponents,spriteRectangle} from './lib/sprite-components.mjs';
const require=createRequire(process.env.CANVAS_MODULE_ROOT?path.join(process.env.CANVAS_MODULE_ROOT,'package.json'):import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const input=process.argv[2];if(!input)throw Error('Provide the pixel miner source directory');
const client=fileURLToPath(new URL('../games/deep-miners/client/',import.meta.url)),cell={width:96,height:96,anchorX:48,anchorY:84};
const helmet=[[120,75,23],[174,112,27],[222,155,36],[250,192,58],[255,215,105]],browns=[[66,45,28],[96,65,34],[130,90,46],[162,119,63]];
const palette=[[24,25,26],[39,35,30],[32,44,60],[45,62,82],[60,79,101],[80,99,118],[88,39,27],[125,52,32],[158,69,41],[190,91,53],...helmet,[174,106,59],[217,153,96],[247,189,126],...browns,[68,76,82],[105,118,128],[157,171,179],[239,238,211]];
const same=(a,b)=>a.every((v,i)=>v===b[i]),median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
function quantize(canvas){const c=canvas.getContext('2d'),p=c.getImageData(0,0,canvas.width,canvas.height),d=p.data;for(let i=0;i<d.length;i+=4){if(d[i+3]<128){d[i]=d[i+1]=d[i+2]=d[i+3]=0;continue;}let best,score=Infinity;for(const rgb of palette){const cost=(d[i]-rgb[0])**2*2+(d[i+1]-rgb[1])**2*4+(d[i+2]-rgb[2])**2*3;if(cost<score){best=rgb;score=cost;}}d.set([...best,255],i);}c.putImageData(p,0,0);return p;}
function selectPixels(pixels,width,height,accept){const filtered=new Uint8ClampedArray(pixels.length);for(let i=0;i<width*height;i++)if(pixels[i*4+3]&&accept(pixels[i*4],pixels[i*4+1],pixels[i*4+2],i%width,Math.floor(i/width)))filtered[i*4+3]=255;return spriteComponents(filtered,width,height,{minimumPixels:20}).parts;}
const atlas=createCanvas(12*96,3*96),a=atlas.getContext('2d');a.imageSmoothingEnabled=false;const frames=[],measurements=[];
for(const [row,view]of ['south','east','north'].entries()){
 const im=await loadImage(path.join(input,'source-'+view+'.png')),canvas=createCanvas(im.width,im.height),c=canvas.getContext('2d');c.drawImage(im,0,0);const pixels=c.getImageData(0,0,im.width,im.height),components=spriteComponents(pixels.data,im.width,im.height,{threshold:160,minimumPixels:1000,expected:12}),slots=new Map();
 for(const part of components.parts){const col=Math.min(3,Math.floor((part.left+part.right)/2/im.width*4)),line=Math.min(2,Math.floor((part.top+part.bottom)/2/im.height*3)),index=line*4+col;if(slots.has(index))throw Error('Duplicate sprite slot: '+view+'/'+index);slots.set(index,part);}
 const prepared=[];
 for(let column=0;column<12;column++){
  const part=slots.get(column);if(!part)throw Error('Missing sprite: '+view+'/'+column);const rect=spriteRectangle(part,im.width,im.height),tile=createCanvas(rect.width,rect.height),tc=tile.getContext('2d'),p=tc.createImageData(rect.width,rect.height);
  for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++){const xx=x+rect.x,yy=y+rect.y,from=(yy*im.width+xx)*4,to=(y*rect.width+x)*4;if(components.labels[yy*im.width+xx]===part.label)p.data.set([pixels.data[from],pixels.data[from+1],pixels.data[from+2],255],to);}
  const gold=selectPixels(p.data,rect.width,rect.height,(r,g,b)=>r>130&&g/r>.48&&g/r<.92&&b/r<.4).sort((a,b)=>b.count-a.count)[0];if(!gold)throw Error('Helmet not found: '+view+'/'+column);
  const helmetWidth=gold.right-gold.left+1,boots=selectPixels(p.data,rect.width,rect.height,(r,g,b,x,y)=>y>gold.top+(gold.bottom-gold.top+1)*1.9&&r>35&&g/r>.5&&g/r<.87&&b/r>.2&&b/r<.65).filter(p=>p.right-p.left>helmetWidth*.12&&p.bottom-p.top<helmetWidth*.85&&(p.right-p.left)/(p.bottom-p.top+1)>.4);
  if(!boots.length)throw Error('Boot soles not found: '+view+'/'+column);
  const lowest=Math.max(...boots.map(b=>b.bottom)),support=boots.filter(b=>b.bottom>=lowest-helmetWidth*.18).map(b=>{
   let y=b.bottom;for(let yy=b.bottom;yy<=Math.min(rect.height-1,b.bottom+helmetWidth*.15);yy++)for(let x=b.left;x<=b.right;x++)if(p.data[(yy*rect.width+x)*4+3])y=Math.max(y,yy);
   return {x:(b.left+b.right)/2,y,width:b.right-b.left+1};
  });
  const floor=Math.max(...support.map(p=>p.y));tc.putImageData(p,0,0);prepared.push({column,tile,rect,gold,helmetWidth,floor,support});
 }
 const referenceHelmet=median(prepared.slice(0,5).map(p=>p.helmetWidth)),baseScale=68/median(prepared.slice(0,5).map(p=>p.floor-p.gold.top+1));
 for(let column=0;column<12;column++){
  // Complete frontal/rear sprites are reflected for the second half-step so
  // both legs genuinely alternate, rather than repeating a generated left step.
  let sourceColumn=column,mirror=false;
  // A quiet feet-under-hips pose separates the two contacts in the short cycle.
  if(row===0&&column===2)sourceColumn=0;
  if(row===0&&(column===3||column===4)){sourceColumn=column===3?1:0;mirror=true;}
  if(row===2&&column===2){sourceColumn=0;mirror=true;}
  if(row===2&&column===3){sourceColumn=1;mirror=true;}
  if(row===2&&column===4)sourceColumn=0;
  if(row===1&&column===4)sourceColumn=0;
  const p=prepared[sourceColumn],scale=baseScale*(column>=5?referenceHelmet/p.helmetWidth:1),tile=createCanvas(96,96),t=tile.getContext('2d');t.imageSmoothingEnabled=false;const dx=Math.round(cell.anchorX-(p.gold.left+p.gold.right)/2*scale),dy=Math.round(cell.anchorY-(p.floor+1)*scale);
  if(mirror){t.translate(96,0);t.scale(-1,1);}t.drawImage(p.tile,dx,dy,p.tile.width*scale,p.tile.height*scale);t.resetTransform();const pixel=quantize(tile);
  const brownMask=new Uint8ClampedArray(pixel.data.length);for(let i=0;i<96*96;i++)if(pixel.data[i*4+3]&&browns.some(b=>same(b,[...pixel.data.subarray(i*4,i*4+3)])))brownMask[i*4+3]=255;
  // Locate a glove pixel near the anatomical carrying hand, rather than a
  // brown belt/pocket which can merge into the glove's colour component.
  const handHints=[[[29,61],[30,59],[29,61],[30,59],[29,61]],[[34,60],[31,59],[55,59],[32,59],[34,60]],[[65,60],[64,54],[65,60],[65,59],[65,60]]],target=handHints[row][Math.min(column,4)];
  let hand=null,distance=Infinity;for(let y=45;y<72;y++)for(let x=20;x<76;x++)if(brownMask[(y*96+x)*4+3]){const d=(x-target[0])**2+(y-target[1])**2;if(d<distance){distance=d;hand={x,y};}}
  if(column<5&&distance>100)throw Error('Carrying glove not found: '+view+'/'+column);
  hand??={x:target[0],y:target[1]};
  const soles=p.support.map(s=>({x:Math.round(mirror?95-(dx+s.x*scale):dx+s.x*scale),y:Math.round(dy+s.y*scale),width:Math.max(3,Math.round(s.width*scale))}));
  a.drawImage(tile,column*96,row*96);frames.push({row,column,hand,soles});measurements.push({view,column,sourceColumn,mirror,scale,source:p.rect,helmet:p.gold,sourceFloor:p.floor,dx,dy,hand,soles});
 }
}
const toolsImage=await loadImage(path.join(input,'source-tools.png')),toolSource=createCanvas(toolsImage.width,toolsImage.height),ts=toolSource.getContext('2d');ts.drawImage(toolsImage,0,0);const toolPixels=ts.getImageData(0,0,toolsImage.width,toolsImage.height),toolComponents=spriteComponents(toolPixels.data,toolsImage.width,toolsImage.height,{threshold:160,minimumPixels:1000,expected:2}),toolAtlas=createCanvas(80,48),ta=toolAtlas.getContext('2d'),parts={};ta.imageSmoothingEnabled=false;
for(const [index,name]of ['pick','shovel'].entries()){
 const part=toolComponents.parts[index],r=spriteRectangle(part,toolsImage.width,toolsImage.height),tile=createCanvas(r.width,r.height),tc=tile.getContext('2d'),data=tc.createImageData(r.width,r.height);
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const xx=x+r.x,yy=y+r.y,from=(yy*toolsImage.width+xx)*4,to=(y*r.width+x)*4;if(toolComponents.labels[yy*toolsImage.width+xx]===part.label)data.data.set([...toolPixels.data.subarray(from,from+3),255],to);}
 tc.putImageData(data,0,0);const h=name==='pick'?28:32,w=Math.round(r.width/r.height*h),x=index*40+Math.floor((40-w)/2),y=4;ta.drawImage(tile,x,y,w,h);parts[name]={x,y,w,h,grip:[.5,name==='pick'?.61:.46]};
}
quantize(toolAtlas);await fs.writeFile(path.join(client,'assets/miner-pixel.png'),atlas.toBuffer('image/png'));await fs.writeFile(path.join(client,'assets/miner-pixel-tools.png'),toolAtlas.toBuffer('image/png'));
const layout={asset:'assets/miner-pixel.png',cell,columns:12,rows:3,frames},tools={asset:'assets/miner-pixel-tools.png',parts};
await fs.writeFile(path.join(client,'pixel-miner-layout.js'),'// Complete pixel-art sprites, prepared by scripts/prepare-pixel-miner.mjs.\nexport const PIXEL_MINER='+JSON.stringify(layout)+';\nexport const PIXEL_TOOLS='+JSON.stringify(tools)+';\nexport const PIXEL_HELMET='+JSON.stringify(helmet)+';\n');
await fs.writeFile(path.join(input,'prepared-measurements.json'),JSON.stringify({palette,layout,tools,measurements},null,2));console.log(JSON.stringify({poses:frames.length,colors:palette.length,atlas:[atlas.width,atlas.height],tools:parts}));
