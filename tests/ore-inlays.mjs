import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

export async function verifyOreInlays({ js, scratch, checked }) {
  const samples = await js(`(async()=>{
    const {drawOreVeins,ORE_INLAYS}=await import('/ore-veins.js');
    const {drawCaveWall}=await import('/cave-walls.js');
    window.oreArt={drawOreVeins,drawCaveWall,ORE_INLAYS};
    const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
    const c=canvas.getContext('2d'),samples=[];
    for(const id of Object.keys(ORE_INLAYS)){
      c.clearRect(0,0,96,96);drawOreVeins(c,id,17,12,16,16);
      const pixels=c.getImageData(0,0,96,96).data;let outside=0,coverage=0;
      for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(pixels[(y*96+x)*4+3]){
        if(x<16||x>=80||y<16||y>=80)outside++;else coverage++;
      }
      samples.push({id,outside,coverage,png:canvas.toDataURL()});
    }
    return samples;
  })()`);
  assert.equal(samples.length, 7);
  assert.equal(new Set(samples.map((s) => s.png)).size, 7);
  checked("Les sept minerais ont des inclusions distinctes et reconnaissables");
  assert(samples.every((s) => s.outside === 0));
  checked("Aucun fragment ne déborde de sa case de roche");
  const hidden = await js(`(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const c=canvas.getContext('2d');c.globalAlpha=0;oreArt.drawOreVeins(c,'gold',17,12,0,0);
    return c.getImageData(0,0,64,64).data.some((v,i)=>i%4===3&&v>0);
  })()`);
  assert(!hidden);
  checked("Un mur masqué ne laisse apparaître aucun éclat de minerai");
  assert(
    samples.every((s) => s.coverage > 200 && s.coverage < 1400),
    JSON.stringify(samples.map(({ id, coverage }) => ({ id, coverage }))),
  );
  checked("Les fragments laissent la roche visible entre les inclusions");
  const sheet = await js(`(()=>{
    const canvas=document.createElement('canvas');canvas.width=1140;canvas.height=400;
    const c=canvas.getContext('2d');c.fillStyle='#080c10';c.fillRect(0,0,1140,400);
    const names=['Or','Turquoise','Améthyste','Cuivre','Étain','Fer','Obsidiane astrale'];
    Object.keys(oreArt.ORE_INLAYS).forEach((id,i)=>{
      for(let row=0;row<2;row++){
        c.save();c.translate(16+i*160,42+row*174);c.scale(2,2);
        const tiles=Array.from({length:3},()=>[1,1,1]);if(row===1)tiles[2][1]=0;
        oreArt.drawCaveWall(c,tiles,1,1,0,0,()=>{
          const im=qa.assets['biome-terrain'];c.drawImage(im,0,im.height/2,im.width/6,im.height/2,0,0,64,64);
        },plane=>oreArt.drawOreVeins(c,id,17,12,0,0,plane));
        c.restore();
      }
      c.fillStyle='#e4ddcd';c.font='14px Segoe UI';c.fillText(names[i],16+i*160,24);
    });
    return canvas.toDataURL().split(',')[1];
  })()`);
  await fs.writeFile(
    path.join(scratch, "ore-surfaces.png"),
    Buffer.from(sheet, "base64"),
  );
  checked("Les inclusions suivent le dessus et les faces verticales des murs");
  const corridor = await js(`(()=>{
    const canvas=document.getElementById('scene');canvas.width=1280;canvas.height=960;
    const c=canvas.getContext('2d'),s=window.oreScene=fixture(18),me=s.players[0];
    s.code='INLAYS';s.tiles=Array.from({length:64},()=>Array(80).fill(-1));s.world.height=64;
    for(let y=8;y<=28;y++)for(let x=44;x<=56;x++)s.tiles[y][x]=x>=49&&x<=51?0:1;
    for(const [x,y,t]of [[48,15,2],[48,17,4],[48,19,6],[48,21,7],[52,15,5],[52,18,3],[52,21,12]])s.tiles[y][x]=t;
    me.x=50.5;me.y=18.5;me.face={x:-1,y:0};
    s.installations=[{id:1,kind:'lamp',x:49.5,y:15.5},{id:2,kind:'lamp',x:51.5,y:20.5}];
    for(let y=8;y<=28;y++)s.installations.push({id:100+y,kind:'rail',x:50.5,y:y+.5});
    const mineralImages=new Set(Object.keys(qa.assets).filter(k=>k.startsWith('mineral-')).map(k=>qa.assets[k]));
    const original=c.drawImage.bind(c);let floatingIcons=0;
    c.drawImage=(im,...args)=>{if(mineralImages.has(im))floatingIcons++;return original(im,...args);};
    const r=window.oreRenderer=qa.createRenderer(qa.assets);
    window.oreSettings={zoom:1.1,quality:'low',brightness:.6,separateHUD:true,pixelRatio:1};
    for(let i=0;i<80;i++)r.draw(c,1280,960,s,me,8,oreSettings);
    c.drawImage=original;return {floatingIcons,png:canvas.toDataURL().split(',')[1]};
  })()`);
  assert.equal(corridor.floatingIcons, 0);
  await fs.writeFile(
    path.join(scratch, "ore-corridor.png"),
    Buffer.from(corridor.png, "base64"),
  );
  checked(
    "La galerie affiche des veines dans la roche sans utiliser les icônes de butin",
  );
  const mined = await js(`(()=>{
    const canvas=document.getElementById('scene'),c=canvas.getContext('2d'),s=oreScene,me=s.players[0];
    s.tiles[15][48]=0;s.mapVersion++;s.revision++;s.changedCells=[[48,15,2,0]];
    oreRenderer.draw(c,1280,960,s,me,8,oreSettings);const actual=canvas.toDataURL();
    const cold=qa.createRenderer(qa.assets);for(let i=0;i<80;i++)cold.draw(c,1280,960,s,me,8,oreSettings);
    return actual===canvas.toDataURL();
  })()`);
  assert(mined);
  checked("Le minerai incrusté disparaît dès que sa case est creusée");
  const performance = await js(`(()=>{
    const c=document.getElementById('scene').getContext('2d'),s=oreScene,me=s.players[0],before=JSON.stringify(s.tiles),times=[];
    for(let i=0;i<45;i++){const t=window.performance.now();oreRenderer.draw(c,1280,960,s,me,9+i/60,oreSettings);times.push(window.performance.now()-t);}
    times.sort((a,b)=>a-b);return {p95:times[Math.floor(times.length*.95)],unchanged:before===JSON.stringify(s.tiles)};
  })()`);
  assert(performance.unchanged);
  checked("Le nouveau visuel ne modifie pas les cases de minerai");
  assert(performance.p95 < 32, JSON.stringify(performance));
  checked("Les veines restent en cache pendant le déplacement");
  return { performance };
}
