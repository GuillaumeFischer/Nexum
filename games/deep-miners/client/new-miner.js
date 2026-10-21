import {MINER_ATLASES,MINER_CELL} from './new-miner-layout.js';
import {facingRow} from './animation.js';
import {MINER_GROUND} from './miner-ground-layout.js';
export const NEW_MINER_ASSETS=Object.fromEntries(Object.entries(MINER_ATLASES).map(([name,sheet])=>['miner-v2-'+name,sheet.asset]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function minerFrame(player,pose){
 const dir=facingRow(player.face),row=dir===3?1:dir,mirror=dir===3;
 const held=player.heldItem===undefined?'pick':player.heldItem,equipment=held==='pick'?'pick':held==='shovel'?'shovel':'empty';
 let atlas='idle',column=equipment==='pick'?1:equipment==='shovel'?2:0;
 if(player.vehicleId)column=3;
 else if(equipment==='pick'&&player.mine>0){atlas='actions';column=clamp(Math.floor(player.mine*4),0,3);}
 else if(equipment==='shovel'&&player.actionSeconds>0){atlas='actions';column=4+clamp(Math.floor((1-player.actionSeconds/.45)*4),0,3);}
 else if(pose.walk){atlas=equipment+(pose.run>.45?'-run':'-walk');column=clamp(pose.column,0,7);}
 return {atlas,row,column,mirror,seated:!!player.vehicleId};
}
const COLORS=[[245,189,98],[80,216,220],[168,125,233],[230,96,114],[99,166,239],[183,210,92]];
export function minerSupport(frame){
 if(frame.seated)return null;
 return MINER_GROUND[frame.atlas]?.[frame.row*MINER_ATLASES[frame.atlas].columns+frame.column]||null;
}
export function createNewMinerArt(assets,makeCanvas){
 const cache=new Map(),{width,height,anchorX,anchorY}=MINER_CELL;
 function imageFor(frame,slot){
  const sheet=assets['miner-v2-'+frame.atlas];
  if(!sheet)throw Error('Missing new miner atlas: '+frame.atlas);
  const x=frame.column*width,y=frame.row*height;
  if(!slot)return {image:sheet,x,y};
  const key=frame.atlas+':'+frame.row+':'+frame.column+':'+slot;
  let canvas=cache.get(key);
  if(!canvas){
   canvas=makeCanvas();canvas.width=width;canvas.height=height;
   const c=canvas.getContext('2d');c.drawImage(sheet,x,y,width,height,0,0,width,height);
   const pixels=c.getImageData(0,0,width,height),color=COLORS[slot]||COLORS[0],d=pixels.data;
   for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(d[i+3]&&r>125&&g/r>.5&&g/r<.91&&b/r<.48){const v=clamp(r/215,.25,1.3);d[i]=Math.min(255,color[0]*v);d[i+1]=Math.min(255,color[1]*v);d[i+2]=Math.min(255,color[2]*v);}}
   c.putImageData(pixels,0,0);if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,canvas);
  }
  return {image:canvas,x:0,y:0};
 }
 function draw(c,player,pose,x,y){
  const frame=minerFrame(player,pose),source=imageFor(frame,player.slot||0),support=minerSupport(frame);
  c.save();c.translate(x,y);
  if(frame.seated){c.translate(0,-5);c.scale(.68,.68);}
  if(!player.alive)c.rotate(Math.PI/2);
  if(frame.mirror)c.scale(-1,1);
  const groundOffset=support&&player.alive?(anchorY-support.y)/2:0;
  c.drawImage(source.image,source.x,source.y,width,height,-anchorX/2,-anchorY/2+groundOffset,width/2,height/2);
  c.restore();return frame;
 }
 function softEllipse(c,x,y,rx,ry,opacity){
  c.save();c.translate(x,y);c.scale(rx,ry);
  const gradient=c.createRadialGradient(0,0,0,0,0,1);
  gradient.addColorStop(0,`rgba(12,8,4,${opacity})`);gradient.addColorStop(.45,`rgba(12,8,4,${opacity*.6})`);gradient.addColorStop(1,'rgba(12,8,4,0)');
  c.fillStyle=gradient;c.fillRect(-1,-1,2,2);c.restore();
 }
 function shadow(c,player,pose,x,y){
  const frame=minerFrame(player,pose),support=minerSupport(frame);if(!support)return;
  c.save();c.translate(x,y);if(frame.mirror)c.scale(-1,1);
  const xs=support.contacts.map(p=>p.x),radius=clamp((Math.max(...xs)-Math.min(...xs))/4+8,12,24);
  softEllipse(c,0,-1.2,radius,3.8,.2);
  if(player.alive)for(const sole of support.contacts){
   const weight=pose.walk?clamp(1-(support.y-sole.y)/10,.12,1):1;
   softEllipse(c,(sole.x-anchorX)/2,(sole.y-support.y)/2+.2,clamp(sole.width/4+1,2.8,8),1.6,.58*weight);
  }
  c.restore();
 }
 return {draw,shadow,clear(){cache.clear();},get cacheSize(){return cache.size;}};
}
