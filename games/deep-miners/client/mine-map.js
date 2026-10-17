import {BIOMES,biomeAt} from './world.js';
import {railIndex,railStops,findRailRoute,RAIL_DIRECTIONS,railwayKey} from './railway.js';
export const MAP_COLORS={players:'#75e1a7',base:'#f3c77d',stops:'#67c9fa'};
export function drawMineMap({state,me,node,content,button,onRoute}){
 const holder=node('div',undefined,'mine-map-holder'),canvas=node('canvas',undefined,'world-map');canvas.width=800;canvas.height=440;canvas.setAttribute('aria-label','Carte : personnages verts, bases dorées, arrêts de wagon bleus');holder.append(canvas);content.append(holder);const c=canvas.getContext('2d');c.fillStyle='#070c12';c.fillRect(0,0,800,440);
 const tracks=railIndex(state),stops=railStops(state),wagon=state.installations.find(w=>w.id===me.vehicleId),entries=Object.keys(state.world?.atlas||{}).map(k=>k.split(',').map(Number));
 for(const r of tracks.values())entries.push([Math.floor(r.x/16),Math.floor(r.y/16)]);for(const p of state.players)entries.push([Math.floor(p.x/16),Math.floor(p.y/16)]);for(const [,x,y]of state.baseMap||[])entries.push([Math.floor(x/16),Math.floor(y/16)]);entries.push([1,0]);
 const minX=Math.min(...entries.map(e=>e[0]))-1,minY=Math.min(...entries.map(e=>e[1]))-1,maxX=Math.max(...entries.map(e=>e[0]))+2,maxY=Math.max(...entries.map(e=>e[1]))+2,scale=Math.min(780/(maxX-minX),420/(maxY-minY)),ox=(800-(maxX-minX)*scale)/2-minX*scale,oy=(440-(maxY-minY)*scale)/2-minY*scale;
 const point=(x,y)=>({x:x/16*scale+ox,y:y/16*scale+oy});
 for(const [key,data]of Object.entries(state.world?.atlas||{})){const [x,y]=key.split(',').map(Number),biome=BIOMES.find(b=>b.id===data.biome);c.fillStyle=(biome?.color||'#927f67')+'60';c.fillRect(x*scale+ox,y*scale+oy,scale,scale);}
 const cell=(x,y,t)=>{if(t<0)return;const p=point(x,y);c.fillStyle=t===0?(state.world?biomeAt(state.world,x,y).color:'#9d835e'):t===10?'#458aa8':t===11?'#ce6638':'#242e34';c.fillRect(p.x,p.y,scale/16+.5,scale/16+.5);};
 if(state.world){for(const [key,chunk]of Object.entries(state.chunks||{})){const [cx,cy]=key.split(',').map(Number);for(let i=0;i<256;i++)cell(cx*16+i%16,cy*16+Math.floor(i/16),chunk.tiles[i]);}}
 else for(let y=0;y<state.tiles.length;y++)for(let x=0;x<state.tiles[y].length;x++)cell(x,y,state.tiles[y][x]);
 c.strokeStyle='#879693';c.lineWidth=1.3;for(const r of tracks.values())for(const d of [{x:1,y:0},{x:0,y:1}])if(tracks.has(railwayKey(r.x+d.x,r.y+d.y))){const a=point(r.x,r.y),b=point(r.x+d.x,r.y+d.y);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
 if(wagon?.destination){const path=findRailRoute(state,wagon,wagon.destination);if(path){c.strokeStyle='#75e1a7';c.lineWidth=2.5;c.beginPath();path.forEach((p,i)=>{const q=point(p.x+.5,p.y+.5);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.stroke();}}
 const marker=(x,y,color,base=false,mine=false)=>{const p=point(x,y);c.fillStyle=color;c.strokeStyle='#081018';c.lineWidth=1.5;c.beginPath();if(base){c.moveTo(p.x,p.y-4);c.lineTo(p.x+4,p.y);c.lineTo(p.x,p.y+4);c.lineTo(p.x-4,p.y);c.closePath();}else c.arc(p.x,p.y,mine?4:3,0,Math.PI*2);c.fill();c.stroke();if(mine){c.strokeStyle='#ffffff';c.beginPath();c.arc(p.x,p.y,6,0,Math.PI*2);c.stroke();}};
 marker(17.5,3.5,MAP_COLORS.base,true);for(const [,x,y]of state.baseMap||[])marker(x,y,MAP_COLORS.base,true);for(const p of state.players)marker(p.x,p.y,MAP_COLORS.players,false,p.id===me.id);
 const reachable=new Map();for(const [i,s]of stops.entries()){
  const p=point(s.x,s.y),route=wagon?findRailRoute(state,wagon,s):null;reachable.set(s.id,!!route);const label=`Arrêt ${i+1} · ${Math.floor(s.x)}, ${Math.floor(s.y)}`;
  const b=button(label,()=>onRoute(s.id),!wagon||!route);b.className='map-stop';b.setAttribute('aria-label',label+(wagon&&!route?' · non relié':''));b.title=label+(!wagon?' · monte dans un wagon':!route?' · voie non reliée':' · choisir ce trajet');b.style.left=p.x/8+'%';b.style.top=p.y/4.4+'%';b.textContent='';b.append(node('span',undefined,'map-stop-dot'));holder.append(b);
 }
 const legend=node('div',undefined,'map-legend');for(const [label,color]of [['Personnages',MAP_COLORS.players],['Bases et établis',MAP_COLORS.base],['Arrêts de wagon',MAP_COLORS.stops]]){const n=node('span',label);n.style.setProperty('--marker-color',color);legend.append(n);}content.append(legend);
 const hint=node('p',wagon?me.vehicleDriver?'Clique sur un arrêt bleu pour voyager automatiquement. ZQSD reprend la conduite ; E permet de descendre.':'Clique sur un arrêt bleu pour choisir le trajet. Le premier mineur à bord conduit ; E permet de descendre.':'Les points bleus sont les extrémités de rails. Monte dans un wagon avec E pour choisir un trajet.','muted');content.replaceChildren(legend,hint,holder);
 const names=node('div',undefined,'map-crew');for(const p of state.players)names.append(node('span',`${p.id===me.id?'Vous · ':''}${p.name} · ${Math.floor(p.x)}, ${Math.floor(p.y)}`));content.append(names);
 return {stops,reachable};
}
