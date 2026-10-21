import {MINER_RIG} from './miner-rig-layout.js';
import {minerMotion} from './miner-motion.js';
export const MINER_RIG_ASSETS=Object.fromEntries(Object.entries(MINER_RIG).map(([view,rig])=>['miner-rig-'+view,rig.asset]));
const COLORS=[[245,189,98],[80,216,220],[168,125,233],[230,96,114],[99,166,239],[183,210,92]],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createMinerRig(assets,makeCanvas,seatedArt){
 const cache=new Map();let lastPose,lastPlayer,lastMotion;
 const motion=(p,pose)=>{if(lastPose!==pose||lastPlayer!==p){lastPose=pose;lastPlayer=p;lastMotion=minerMotion(p,pose);}return lastMotion;};
 function source(view,name,slot){
  const part=MINER_RIG[view].parts[name],image=assets['miner-rig-'+view];if(!slot)return {image,...part};
  const key=view+':'+name+':'+slot;let tile=cache.get(key);
  if(!tile){
   tile=makeCanvas();tile.width=Math.ceil(part.w);tile.height=Math.ceil(part.h);const c=tile.getContext('2d');c.drawImage(image,part.x,part.y,part.w,part.h,0,0,tile.width,tile.height);
   const pixels=c.getImageData(0,0,tile.width,tile.height),d=pixels.data,color=COLORS[slot]||COLORS[0];
   for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(d[i+3]&&r>125&&g/r>.5&&g/r<.91&&b/r<.48){const v=clamp(r/215,.25,1.3);d[i]=Math.min(255,color[0]*v);d[i+1]=Math.min(255,color[1]*v);d[i+2]=Math.min(255,color[2]*v);}}
   c.putImageData(pixels,0,0);if(cache.size>=240)cache.delete(cache.keys().next().value);cache.set(key,tile);
  }
  return {...part,image:tile,x:0,y:0,w:tile.width,h:tile.height};
 }
 function piece(c,view,name,slot,p,height,anchor=[.5,.5],angle=0,width=null){
  const s=source(view,name,slot),w=width??s.w/s.h*height;
  c.save();c.translate(p.x,p.y);c.rotate(angle);c.drawImage(s.image,s.x,s.y,s.w,s.h,-anchor[0]*w,-anchor[1]*height,w,height);c.restore();
 }
 function bone(c,view,name,slot,start,end){
  const s=source(view,name,slot),ax=s.a[0]*s.w,ay=s.a[1]*s.h,bx=s.b[0]*s.w,by=s.b[1]*s.h;
  const scale=Math.hypot(end.x-start.x,end.y-start.y)/Math.hypot(bx-ax,by-ay),angle=Math.atan2(end.y-start.y,end.x-start.x),sourceAngle=Math.atan2(by-ay,bx-ax),thickness=name.startsWith('lower')?.7:name.startsWith('upper')?.88:1;
  c.save();c.translate(start.x,start.y);c.rotate(angle-Math.PI/2);c.scale(scale*thickness,scale);c.rotate(Math.PI/2-sourceAngle);c.drawImage(s.image,s.x,s.y,s.w,s.h,-ax,-ay,s.w,s.h);c.restore();
 }
 function leg(c,view,slot,l,near){
  const suffix=near?'Near':'Far';
  piece(c,view,'boot'+suffix,slot,l.foot,11.2,[view==='east'?.65:.5,.94],l.roll);
  bone(c,view,'shin'+suffix,slot,l.knee,l.ankle);bone(c,view,'thigh'+suffix,slot,l.hip,l.knee);
 }
 function tool(c,view,m,hand){
  if(m.held!=='pick'&&m.held!=='shovel')return;
  const s=source(view,m.held,0),pick=m.held==='pick';
  const tail=pick?(view==='south'?[.22,.12]:view==='east'?[.22,.92]:[.5,.92]):[.35,.12];
  const head=pick?(view==='south'?[.58,.78]:view==='east'?[.54,.27]:[.5,.18]):[.6,.8];
  const ax=(tail[0]+(head[0]-tail[0])*.35)*s.w,ay=(tail[1]+(head[1]-tail[1])*.35)*s.h;
  const shaftAngle=Math.atan2((head[1]-tail[1])*s.h,(head[0]-tail[0])*s.w),length=Math.hypot((head[0]-tail[0])*s.w,(head[1]-tail[1])*s.h),scale=(pick?22:24)/length;
  const carry=view==='east'?1.05:view==='north'?1.25:1.85,angle=(m.mining||m.shovelling)?carry-Math.cos(m.action*Math.PI*2)*1.3:carry;
  c.save();c.translate(hand.x,hand.y-1);c.rotate(angle-shaftAngle);c.scale(scale,scale);c.drawImage(s.image,s.x,s.y,s.w,s.h,-ax,-ay,s.w,s.h);c.restore();
 }
 function draw(c,p,pose,x,y){
  if(p.vehicleId)return seatedArt.draw(c,p,pose,x,y);
  if(!p.alive)return seatedArt.draw(c,{...p,heldItem:null,mine:0,actionSeconds:0},{...pose,walk:false},x,y);
  const m=motion(p,pose),view=['south','east','north'][m.row],slot=p.slot||0;
  c.save();c.translate(x,y);if(m.mirror)c.scale(-1,1);
  leg(c,view,slot,m.legs[1],false);
  bone(c,view,'upperFar',slot,m.arms[1].shoulder,m.arms[1].elbow);bone(c,view,'lowerFar',slot,m.arms[1].elbow,m.arms[1].hand);
  leg(c,view,slot,m.legs[0],true);
  tool(c,view,m,m.arms[0].hand);bone(c,view,'lowerNear',slot,m.arms[0].elbow,m.arms[0].hand);
  bone(c,view,'upperNear',slot,m.arms[0].shoulder,m.arms[0].elbow);
  piece(c,view,'pelvis',slot,{x:m.body.x,y:-28+m.body.y+31},8,[.5,.5],0,18);
  piece(c,view,'torso',slot,m.body,26,[.5,.91],m.torsoAngle,26);
  piece(c,view,'head',slot,m.head,22,[.5,.94],m.headAngle,24);
  c.restore();return m;
 }
 function ellipse(c,x,y,rx,ry,alpha){
  c.save();c.translate(x,y);c.scale(rx,ry);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(12,8,4,${alpha})`);g.addColorStop(.5,`rgba(12,8,4,${alpha*.5})`);g.addColorStop(1,'rgba(12,8,4,0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
 }
 function shadow(c,p,pose,x,y){
  if(p.vehicleId)return;if(!p.alive)return seatedArt.shadow(c,p,pose,x,y);
  const m=motion(p,pose);c.save();c.translate(x,y);if(m.mirror)c.scale(-1,1);ellipse(c,0,-1.2,17,3.8,.18);
  for(const l of m.legs)ellipse(c,l.foot.x,l.foot.y+.2,4.3,1.5,.58*l.contact);c.restore();
 }
 return {draw,shadow,clear(){cache.clear();seatedArt.clear();},get cacheSize(){return cache.size;}};
}
