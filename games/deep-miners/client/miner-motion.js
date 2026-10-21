const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t),point=(x,y)=>({x,y});
export function solveLimb(a,b,upper,lower,bend=1){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(.001,Math.hypot(dx,dy)),reach=Math.min(d,upper+lower-.001);
 const along=clamp((upper*upper-lower*lower+reach*reach)/(2*reach),0,upper),side=Math.sqrt(Math.max(0,upper*upper-along*along))*bend;
 return point(a.x+dx/d*along-dy/d*side,a.y+dy/d*along+dx/d*side);
}
export function stepPose(phase,run,amount){
 const p=((phase%1)+1)%1,stance=.6,stride=8+run*3.5,swing=clamp((p-stance)/(1-stance),0,1);
 const travel=p<stance?mix(stride,-stride,p/stance):mix(-stride,stride,smooth(swing));
 const lift=p<stance?0:Math.sin(Math.PI*swing)**1.3*(3.2+run*3.6);
 const roll=p<stance?(-.08*(1-smooth(clamp(p/.1,0,1)))+.12*smooth(clamp((p-.43)/.17,0,1))):mix(.12,-.08,smooth(swing))-.2*Math.sin(Math.PI*swing)**2;
 return {travel:travel*amount,lift:lift*amount,roll:roll*amount,contact:p<stance?1:1-.96*Math.sin(Math.PI*swing)**.7*amount};
}
export function minerMotion(player,pose){
 const row=pose.dir===3?1:pose.dir,side=row===1,back=row===2,mirror=pose.dir===3;
 const amount=pose.amount??(pose.walk?1:0),run=pose.run||0,phase=pose.phase||0,clock=pose.clock||0;
 const held=player.heldItem===undefined?'pick':player.heldItem;
 const mining=!player.vehicleId&&held==='pick'&&player.mine>0,shovelling=!player.vehicleId&&held==='shovel'&&player.actionSeconds>0;
 const action=mining?clock*2.6%1:shovelling?clamp(1-player.actionSeconds/.45,0,1):0;
 const hit=mining||shovelling?Math.sin(Math.PI*action)**2:0;
 const bob=(Math.cos(phase*TAU*2)-1)*(.45+run*.35)*amount+Math.sin(clock*2)*.12*(1-amount)+hit*.8;
 const sway=Math.sin(phase*TAU)*(.55+run*.25)*amount;
 const body=point(sway+(side?run*1.8*amount:0)+hit*(side?1.5:0),-31+bob);
 const nearSign=back?1:-1,legs=[];
 for(let i=0;i<2;i++){
  const sign=i? -nearSign:nearSign,step=stepPose(phase+i*.5,run,amount);
  const foot=side?point((i?5:1)+step.travel,(i?-3:0)-step.lift):point(sign*7+Math.sin(phase*TAU+i*Math.PI)*.5*amount,(i?-1:0)+step.travel*(back?-.28:.28)-step.lift);
  const ankle=point(foot.x+(side?-2.8:0)+Math.sin(step.roll)*6,foot.y-6.5*Math.cos(step.roll));
  const hip=point(body.x+(side?(i?3:0):sign*4),-25+bob+(side&&i?-2:0));
  const knee=side?point(mix(hip.x,ankle.x,.5)+1.5+step.lift*.95+run*.6*amount,mix(hip.y,ankle.y,.5)-step.lift*.2):point(mix(hip.x,ankle.x,.5)+sign*(.8+step.lift*.12),mix(hip.y,ankle.y,.54)-step.lift*.15);
  legs.push({hip,knee,ankle,foot,roll:side?step.roll:step.roll*.22,contact:step.contact});
 }
 const arms=[];
 for(let i=0;i<2;i++){
  // Rear arm sockets sit under the backpack straps of the sleeveless trunk.
  // The old wider sockets relied on the painted sleeves to hide a small gap.
  const sign=i?-nearSign:nearSign,shoulder=point(body.x+(side?(i?4:-2):sign*(back?8.5:10)),-48+bob+(side&&i?-1.5:0));
  const swing=Math.sin(phase*TAU+i*Math.PI)*(3.6+run*3.8)*amount;
  const hand=side?point(shoulder.x+2-swing,shoulder.y+22-run*4*amount):point(shoulder.x+sign*(1.3+run*1.4*amount),shoulder.y+22-swing*.4-run*3*amount);
  if(i===0&&held&&(mining||shovelling)){
   hand.x+=side?hit*8:(back?-2:2)*hit;hand.y-=Math.sin(action*TAU)*7+hit*2;
  }else if(i===0&&(held==='pick'||held==='shovel')){hand.x+=side?2:sign;hand.y+=1;}
  const elbow=solveLimb(shoulder,hand,10.8,11.7,side?-1:sign<0?1:-1);
  arms.push({shoulder,elbow,hand});
 }
 return {row,side,back,mirror,amount,run,phase,body,legs,arms,head:point(body.x+(side?3:0),-51.5+bob*.55),headAngle:sway*.007,torsoAngle:(side?-.025-run*.045:Math.sin(phase*TAU)*.012)*amount,held,mining,shovelling,action,hit};
}
