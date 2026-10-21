import {PIXEL_MINER,PIXEL_TOOLS,PIXEL_HELMET} from './pixel-miner-layout.js';
import {facingRow} from './animation.js';
export const PIXEL_MINER_ASSETS={'miner-pixel':PIXEL_MINER.asset,'miner-pixel-tools':PIXEL_TOOLS.asset};
const COLORS=[[245,189,98],[80,216,220],[168,125,233],[230,96,114],[99,166,239],[183,210,92]],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function pixelMinerFrame(player,pose){
 const dir=pose.dir??facingRow(player.face),row=dir===3?1:dir,mirror=dir===3;
 const held=player.heldItem===undefined?'pick':player.heldItem,equipment=held==='pick'?'pick':held==='shovel'?'shovel':null;
 let column=0,carry=equipment;
 if(player.vehicleId){column=5;carry=null;}
 else if(!player.alive){carry=null;}
 else if(equipment==='pick'&&player.mine>0){column=6+clamp(Math.floor(player.mine*3),0,2);carry=null;}
 else if(equipment==='shovel'&&player.actionSeconds>0){column=9+clamp(Math.floor((1-player.actionSeconds/.45)*3),0,2);carry=null;}
 else if(pose.walk)column=1+Math.floor((((pose.phase??0)%1+1)%1)*4);
 return {row,column,mirror,carry,seated:!!player.vehicleId};
}

export function createPixelMinerArt(assets,makeCanvas){
 const cache=new Map(),cell=PIXEL_MINER.cell;
 function source(frame,slot){
  const x=frame.column*cell.width,y=frame.row*cell.height;
  if(!slot)return {image:assets['miner-pixel'],x,y};
  const key=frame.row+':'+frame.column+':'+slot;let image=cache.get(key);
  if(!image){
   image=makeCanvas();image.width=cell.width;image.height=cell.height;const c=image.getContext('2d');c.drawImage(assets['miner-pixel'],x,y,cell.width,cell.height,0,0,cell.width,cell.height);
   const pixels=c.getImageData(0,0,cell.width,cell.height),d=pixels.data,color=COLORS[slot]||COLORS[0];
   for(let i=0;i<d.length;i+=4)if(d[i+3]){
    const shade=PIXEL_HELMET.findIndex(rgb=>rgb[0]===d[i]&&rgb[1]===d[i+1]&&rgb[2]===d[i+2]);
    if(shade>=0){const light=[.43,.62,.82,1,1.12][shade];for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(color[k]*light));}
   }
   c.putImageData(pixels,0,0);if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,image);
  }
  return {image,x:0,y:0};
 }
 function draw(c,player,pose,x,y){
  const frame=pixelMinerFrame(player,pose),s=source(frame,player.slot||0),metadata=PIXEL_MINER.frames[frame.row*12+frame.column];
  c.save();c.translate(x,y);c.imageSmoothingEnabled=false;
  if(frame.seated){c.translate(0,-5);c.scale(.85,.85);}
  if(!player.alive)c.rotate(Math.PI/2);
  if(frame.mirror)c.scale(-1,1);
  c.drawImage(s.image,s.x,s.y,cell.width,cell.height,-cell.anchorX,-cell.anchorY,cell.width,cell.height);
  if(frame.carry){
   const tool=PIXEL_TOOLS.parts[frame.carry],hand=metadata.hand,side=frame.row===1;
   const angle=frame.carry==='pick'?(side?2.05:frame.row===2?2.05:-2.05):(side?-.45:frame.row===2?-.4:.4);
   c.translate(hand.x-cell.anchorX,hand.y-cell.anchorY);c.rotate(angle);
   c.drawImage(assets['miner-pixel-tools'],tool.x,tool.y,tool.w,tool.h,-tool.grip[0]*tool.w,-tool.grip[1]*tool.h,tool.w,tool.h);
  }
  c.restore();return frame;
 }
 function ellipse(c,x,y,rx,ry,alpha){
  c.save();c.translate(x,y);c.scale(rx,ry);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(12,8,4,${alpha})`);g.addColorStop(.5,`rgba(12,8,4,${alpha*.5})`);g.addColorStop(1,'rgba(12,8,4,0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
 }
 function shadow(c,player,pose,x,y){
  if(player.vehicleId)return;
  const frame=pixelMinerFrame(player,pose),metadata=PIXEL_MINER.frames[frame.row*12+frame.column];c.save();c.translate(x,y);if(frame.mirror)c.scale(-1,1);
  ellipse(c,0,-.5,14,3,.18);
  if(player.alive)for(const sole of metadata.soles)ellipse(c,sole.x-cell.anchorX,sole.y-cell.anchorY+1,Math.max(2,sole.width/2),1.2,.5);
  c.restore();
 }
 return {draw,shadow,clear(){cache.clear();},get cacheSize(){return cache.size;}};
}
