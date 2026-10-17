const TAU=Math.PI*2,STRIDE=1.6;
export const facingRow=face=>face.y>0?0:face.x>0?1:face.y<0?2:3;

export function createAnimator(){
  const poses=new Map();
  function update(player,clock){
    let pose=poses.get(player.id);
    if(!pose){pose={x:player.x,y:player.y,clock,phase:(player.slot||0)/6,weight:0,settle:0};poses.set(player.id,pose);}
    const dt=Math.max(0,Math.min(.1,clock-pose.clock)),distance=Math.hypot(player.x-pose.x,player.y-pose.y);
    const teleported=distance>.9||clock-pose.clock>.35;
    const walking=!teleported&&player.alive&&!player.escaped&&!player.using&&!(player.mine>0)&&dt>0&&distance/dt>.15&&(player.moving||distance>.012);
    if(teleported){pose.phase=pose.weight=0;pose.settle=0;}
    if(walking){pose.phase+=distance/STRIDE;pose.weight=Math.min(1,pose.weight+dt*12);pose.settle=Math.ceil(pose.phase*2)/2;}
    else {pose.weight=Math.max(0,pose.weight-dt*10);pose.phase+=(pose.settle-pose.phase)*(1-Math.exp(-dt*18));}
    pose.x=player.x;pose.y=player.y;pose.clock=clock;
    const phase=((pose.phase%1)+1)%1,dir=facingRow(player.face);
    return {dir,walk:pose.weight>.05&&player.alive&&!player.escaped&&!player.using&&!(player.mine>0),column:Math.floor(phase*8)%8,phase,
      // Small motion follows each actual step; it is independent of global time.
      lift:-(1-Math.cos(phase*TAU*2))*.45*pose.weight};
  }
  return {update,reset(){poses.clear();},prune(players){const ids=new Set(players.map(p=>p.id));for(const id of poses.keys())if(!ids.has(id))poses.delete(id);}};
}
