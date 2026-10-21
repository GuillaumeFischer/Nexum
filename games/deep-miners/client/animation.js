import {capacity} from './progression.js';
const TAU=Math.PI*2;
export const facingRow=face=>face.y>0?0:face.x>0?1:face.y<0?2:3;

export function createAnimator(){
  const poses=new Map();
  function update(player,clock){
    let pose=poses.get(player.id);
    if(!pose){pose={x:player.x,y:player.y,clock,phase:0,weight:0,amount:0,settle:0,run:0,heading:player.face.x};poses.set(player.id,pose);}
    const dt=Math.max(0,Math.min(.1,clock-pose.clock)),distance=Math.hypot(player.x-pose.x,player.y-pose.y);
    const teleported=distance>.9||clock-pose.clock>.35;
    const walking=!player.vehicleId&&!teleported&&player.alive&&!player.escaped&&!player.using&&!(player.mine>0)&&dt>0&&distance/dt>.15&&(player.moving||distance>.012);
    if(teleported||player.vehicleId){pose.phase=pose.weight=pose.run=pose.amount=0;pose.settle=0;pose.heading=player.face.x;}
    const walkSpeed=3.1*(1-(player.bag||0)/(capacity(player)*2.5));
    const running=walking?Math.max(0,Math.min(1,(distance/dt/Math.max(.1,walkSpeed)-1.08)/.42)):0;
    pose.run+=(running-pose.run)*(1-Math.exp(-dt*18));
    pose.heading=player.face.x;
    if(walking){if(pose.weight===0&&pose.amount===0)pose.phase=.125;pose.phase+=distance/(1.25+pose.run*.15);pose.weight=1;}
    else pose.weight=0;
    pose.amount+=(Number(walking)-pose.amount)*(1-Math.exp(-dt*26));if(pose.amount<.001)pose.amount=0;
    pose.x=player.x;pose.y=player.y;pose.clock=clock;
    const phase=((pose.phase%1)+1)%1,dir=facingRow(player.face);
    const weight=player.vehicleId?0:pose.weight,step=Math.sin(phase*TAU),flight=(1-Math.cos(phase*TAU*2))/2;
    return {dir,clock,amount:pose.amount,walk:weight>.05&&player.alive&&!player.escaped&&!player.using&&!(player.mine>0),column:Math.floor(phase*8)%8,phase,run:pose.run,
      // Gait follows travelled distance, so blocked movement never runs in place.
      // All body transforms pivot at the feet; contact phases have zero lift.
      lift:weight?-flight*(.25+pose.run*.25)*weight:0,
      lean:weight?pose.heading*(.008+pose.run*.022)*weight:0,
      sway:weight?step*(.003+pose.run*.002)*weight:0,
      stretchX:1+flight*.002*weight,
      stretchY:1-flight*(.002+pose.run*.002)*weight};
  }
  return {update,reset(){poses.clear();},prune(players){const ids=new Set(players.map(p=>p.id));for(const id of poses.keys())if(!ids.has(id))poses.delete(id);}};
}
