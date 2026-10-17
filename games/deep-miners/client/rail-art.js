// Same wood, gauge and iron highlights as the original central mine track.
export function drawRailTile(c,mask){
 const sleeper=(x,y,w=56,h=6)=>{c.fillStyle='#07080980';c.fillRect(x,y+3,w,h+2);c.fillStyle='#57452f';c.fillRect(x,y,w,h);c.fillStyle='#95734788';c.fillRect(x+3,y,w-6,1);};
 const iron=(draw)=>{c.lineCap='butt';c.lineWidth=9;c.strokeStyle='#05070988';draw();c.stroke();c.lineWidth=5;c.strokeStyle='#414340';draw();c.stroke();c.lineWidth=1.5;c.strokeStyle='#abaaa1';draw();c.stroke();};
 const straight=(start=0,end=64)=>{for(const y of [17,45])if(y>=start&&y<end)sleeper(4,y);for(const x of [14,49])iron(()=>{c.beginPath();c.moveTo(x,start);c.lineTo(x,end);});};
 c.save();c.beginPath();c.rect(0,0,64,64);c.clip();const curves={3:0,6:1,12:2,9:3},turn=curves[mask];
 if(turn!==undefined){c.translate(32,32);c.rotate(turn*Math.PI/2);c.translate(-32,-32);for(const angle of [Math.PI*.94,Math.PI*.75,Math.PI*.56]){c.save();c.translate(64,0);c.rotate(angle);sleeper(4,-3);c.restore();}for(const r of [14.5,49.5])iron(()=>{c.beginPath();c.arc(64,0,r,Math.PI,Math.PI/2,true);});}
 else if(mask===10){c.translate(32,32);c.rotate(Math.PI/2);c.translate(-32,-32);straight();}
 else if([1,2,4,8].includes(mask)){c.translate(32,32);c.rotate(Math.log2(mask)*Math.PI/2);c.translate(-32,-32);straight(0,35);sleeper(4,31);}
 else if(mask===0){straight(15,49);}
 else if(mask===5)straight();
 else {if(mask&5)straight(mask&1?0:32,mask&4?64:32);c.save();c.translate(32,32);c.rotate(Math.PI/2);c.translate(-32,-32);if(mask&10)straight(mask&2?0:32,mask&8?64:32);c.restore();c.fillStyle='#303531';c.fillRect(28,28,8,8);c.fillStyle='#a7a49b';c.fillRect(30,30,2,2);}
 c.restore();
}
