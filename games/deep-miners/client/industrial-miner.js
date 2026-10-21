import {INDUSTRIAL_MINER,INDUSTRIAL_TOOLS} from './industrial-miner-layout.js';
import {facingRow} from './animation.js';
export const INDUSTRIAL_MINER_ASSETS={'miner-industrial':INDUSTRIAL_MINER.asset,'miner-industrial-tools':INDUSTRIAL_TOOLS.asset};
const COLORS=[[207,81,48],[80,216,220],[168,125,233],[230,96,114],[99,166,239],[183,210,92]],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function industrialMinerFrame(player,pose){
 const dir=pose.dir??facingRow(player.face),held=player.heldItem===undefined?'pick':player.heldItem;
 let column=0,carry=held==='pick'||held==='shovel'?held:null;
 if(player.vehicleId){column=5;carry=null;}
 else if(!player.alive)carry=null;
 else if(held==='pick'&&player.mine>0){column=6+clamp(Math.floor(player.mine*3),0,2);carry=null;}
 else if(held==='shovel'&&player.actionSeconds>0){column=9+clamp(Math.floor((1-player.actionSeconds/.45)*3),0,2);carry=null;}
 else if(pose.walk)column=1+Math.floor((((pose.phase??0)%1+1)%1)*4);
 return {row:dir===3?1:dir,column,mirror:dir===3,carry,seated:!!player.vehicleId};
}
export function createIndustrialMinerArt(assets,makeCanvas){
 const cache=new Map(),cell=INDUSTRIAL_MINER.cell;
 function source(frame,slot){
  const x=frame.column*cell.width,y=frame.row*cell.height;if(!slot)return {image:assets['miner-industrial'],x,y};
  const key=frame.row+':'+frame.column+':'+slot;let image=cache.get(key);
  if(!image){
   image=makeCanvas();image.width=cell.width;image.height=cell.height;const c=image.getContext('2d');c.drawImage(assets['miner-industrial'],x,y,cell.width,cell.height,0,0,cell.width,cell.height);
   const r=INDUSTRIAL_MINER.frames[frame.row*12+frame.column].helmet,pixels=c.getImageData(r.x,r.y,r.w,r.h),d=pixels.data,color=COLORS[slot]||COLORS[0];
   for(let i=0;i<d.length;i+=4)if(d[i+3]&&d[i]>90&&d[i]>d[i+1]*1.25&&d[i]>d[i+2]*1.5){const light=clamp(d[i]/207,.35,1.3);for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(color[k]*light));}
   c.putImageData(pixels,r.x,r.y);if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,image);
  }
  return {image,x:0,y:0};
 }
 function draw(c,p,pose,x,y){
  const frame=industrialMinerFrame(p,pose),s=source(frame,p.slot||0),data=INDUSTRIAL_MINER.frames[frame.row*12+frame.column];c.save();c.translate(x,y);c.imageSmoothingEnabled=true;
  if(frame.seated){c.translate(0,-5);c.scale(.85,.85);}if(!p.alive)c.rotate(Math.PI/2);if(frame.mirror)c.scale(-1,1);
  c.drawImage(s.image,s.x,s.y,cell.width,cell.height,-cell.anchorX/2,-cell.anchorY/2,cell.width/2,cell.height/2);
  if(frame.carry){const t=INDUSTRIAL_TOOLS.parts[frame.carry],side=frame.row===1,angle=frame.carry==='pick'?(side?2.05:frame.row===2?2.05:-2.05):(side?-.45:frame.row===2?-.4:.4);const hand={x:data.hand.x,y:data.hand.y+4};
   c.save();c.translate((hand.x-cell.anchorX)/2,(hand.y-cell.anchorY)/2);c.rotate(angle);c.drawImage(assets['miner-industrial-tools'],t.x,t.y,t.w,t.h,-t.grip[0]*t.w/2,-t.grip[1]*t.h/2,t.w/2,t.h/2);c.restore();
   // Redraw the original fingers over the shaft, in body coordinates. The
   // tool stays behind the fist without adding a second hand or rotating it.
   const gx=Math.floor(hand.x-5),gy=Math.floor(hand.y-4);
   c.drawImage(s.image,s.x+gx,s.y+gy,10,10,(gx-cell.anchorX)/2,(gy-cell.anchorY)/2,5,5);}
  c.restore();return frame;
 }
 function ellipse(c,x,y,rx,ry,alpha){c.save();c.translate(x,y);c.scale(rx,ry);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(12,8,4,${alpha})`);g.addColorStop(.5,`rgba(12,8,4,${alpha*.5})`);g.addColorStop(1,'rgba(12,8,4,0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();}
 function shadow(c,p,pose,x,y){if(p.vehicleId)return;const frame=industrialMinerFrame(p,pose),data=INDUSTRIAL_MINER.frames[frame.row*12+frame.column],floor=Math.max(...data.soles.map(s=>s.y));c.save();c.translate(x,y);if(frame.mirror)c.scale(-1,1);ellipse(c,0,-.5,15,3,.18);if(p.alive)for(const sole of data.soles)ellipse(c,(sole.x-cell.anchorX)/2,(sole.y-cell.anchorY)/2+1,Math.max(2,sole.width/4),1.3,.5*clamp(1-(floor-sole.y)/20,.08,1));c.restore();}
 return {draw,shadow,clear(){cache.clear();},get cacheSize(){return cache.size;}};
}
