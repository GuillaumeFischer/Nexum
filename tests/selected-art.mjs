import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
export async function verifySelectedArt({ js, scratch, checked }) {
  const sprites = await js(`(async()=>{
    const art=await import('/torch-art.js'),layout=await import('/torch-art-layout.js'),ore=await import('/ore-veins.js');
    window.selectedArt={...art,...layout,...ore};
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
    const hashes=[];for(const f of layout.TORCH_FRAMES){c.clearRect(0,0,256,256);c.drawImage(qa.assets['torch-flames'],f.x,f.y,f.w,f.h,0,0,f.w,f.h);hashes.push(canvas.toDataURL());}
    const corners=[];for(const id of ['mineral-inlays','torch-body','torch-flames']){c.clearRect(0,0,256,256);c.drawImage(qa.assets[id],0,0,256,256);corners.push(c.getImageData(0,0,1,1).data[3]);}
    return {unique:new Set(hashes).size,corners,types:Object.keys(ore.ORE_INLAYS)};
  })()`);
  assert.equal(sprites.unique, 12);
  assert(sprites.corners.every((a) => a === 0));
  assert.equal(sprites.types.length, 7);
  checked(
    "Sept minerais peints et douze images de flamme chargés avec transparence",
  );
  const anchors = await js(`(()=>{
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;const c=canvas.getContext('2d');
    const t=selectedArt.createTorchArt(qa.assets,()=>document.createElement('canvas')),body=[],roots=[];
    const original=c.drawImage.bind(c);c.drawImage=(image,...a)=>{
      if(image===qa.assets['torch-body'])body.push(a.slice(4));
      if(image===qa.assets['torch-flames']){const f=selectedArt.TORCH_FRAMES.find(f=>f.x===a[0]&&f.y===a[1]);roots.push([a[4]+f.anchorX*a[6]/f.w,a[5]+f.anchorY*a[7]/f.h].map(v=>Math.round(v*1000)));}
      original(image,...a);
    };
    for(let i=0;i<24;i++)t.draw(c,{id:4,x:1.5,y:2},i/17,0,0);
    return {body:new Set(body.map(JSON.stringify)).size,roots:new Set(roots.map(JSON.stringify)).size};
  })()`);
  assert.deepEqual(anchors, { body: 1, roots: 1 });
  checked(
    "Pieds du trépied immobiles et racine de flamme ancrée dans le braséro",
  );
  const phases = await js(`(()=>{
    const a=Array.from({length:120},(_,i)=>selectedArt.torchAnimation(i/60,5)),other=selectedArt.torchAnimation(.3,6);
    return {frames:new Set(a.map(p=>p.index)).size,range:[Math.min(...a.map(p=>p.intensity)),Math.max(...a.map(p=>p.intensity))],different:other.phase!==a[0].phase};
  })()`);
  assert.equal(phases.frames, 12);
  assert(phases.range[0] > 0.96 && phases.range[1] < 1.04);
  assert(phases.different);
  checked("Flamme interpolée, scintillement modéré et torches désynchronisées");
  const icon = await js(`(async()=>{
    const {itemIcon}=await import('/item-ui.js');const element=itemIcon('lamp');document.body.append(element);
    const image=element.querySelector('img');await image.decode();const result={path:new URL(image.src).pathname,width:image.naturalWidth};element.remove();return result;
  })()`);
  assert(icon.path.endsWith("/torch-tripod-icon.webp") && icon.width > 0);
  checked(
    "Le trépied apparaît aussi dans les icônes de l’atelier et de l’inventaire",
  );
  const corridor = await js(`(()=>{
    const canvas=document.getElementById('scene');canvas.width=1280;canvas.height=960;
    const c=canvas.getContext('2d'),s=window.selectedScene=fixture(18),me=s.players[0];
    s.code='ART0136';s.tiles=Array.from({length:64},()=>Array(80).fill(-1));s.world.height=64;
    for(let y=8;y<=28;y++)for(let x=44;x<=56;x++)s.tiles[y][x]=x>=49&&x<=51?0:1;
    for(const [x,y,t]of [[48,15,2],[48,17,4],[48,19,6],[48,21,7],[52,15,5],[52,18,3],[52,21,12]])s.tiles[y][x]=t;
    me.x=50.5;me.y=18.5;me.face={x:-1,y:0};
    s.installations=[{id:1,kind:'lamp',x:49.5,y:15.5},{id:2,kind:'lamp',x:51.5,y:20.5}];
    for(let y=8;y<=28;y++)s.installations.push({id:100+y,kind:'rail',x:50.5,y:y+.5});
    window.selectedRenderer=qa.createRenderer(qa.assets);window.selectedOptions={zoom:1.1,quality:'low',brightness:.6,separateHUD:true,pixelRatio:1};
    for(let i=0;i<70;i++)selectedRenderer.draw(c,1280,960,s,me,8,selectedOptions);
    return canvas.toDataURL().split(',')[1];
  })()`);
  await fs.writeFile(
    path.join(scratch, "selected-corridor.png"),
    Buffer.from(corridor, "base64"),
  );
  const sheet = await js(`(async()=>{
    const {drawCaveWall}=await import('/cave-walls.js'),canvas=document.createElement('canvas');canvas.width=1140;canvas.height=430;const c=canvas.getContext('2d');
    c.fillStyle='#101419';c.fillRect(0,0,1140,430);
    const names={gold:'Or',copper:'Cuivre',tin:'Étain',iron:'Fer',crystal:'Turquoise',amethyst:'Améthyste',rare:'Obsidiane astrale'};
    Object.keys(selectedArt.ORE_INLAYS).forEach((id,i)=>{
      c.fillStyle='#e4ddcd';c.font='14px Segoe UI';c.fillText(names[id],12+i*160,24);
      for(let row=0;row<2;row++){
        c.save();c.translate(12+i*160,42+row*180);c.scale(2,2);
        const tiles=[[1,1,1],[1,1,0],[1,row?0:1,1]];
        drawCaveWall(c,tiles,1,1,0,0,()=>{const im=qa.assets['biome-terrain'];c.drawImage(im,0,im.height/2,im.width/6,im.height/2,0,0,64,64)},plane=>selectedArt.drawOreVeins(c,id,17,12,0,0,plane,qa.assets['mineral-inlays']));
        c.restore();
      }
    });
    return canvas.toDataURL().split(',')[1];
  })()`);
  await fs.writeFile(
    path.join(scratch, "selected-minerals.png"),
    Buffer.from(sheet, "base64"),
  );
  checked(
    "Veines métalliques et poches cristallines intégrées aux deux faces des parois",
  );
  const lighting = await js(`(()=>{
    const canvas=document.getElementById('scene');canvas.width=1280;canvas.height=960;const c=canvas.getContext('2d');
    const s=fixture(18),me=s.players[0];s.code='LIGHT0136';s.world=null;s.tiles=Array.from({length:64},()=>Array(64).fill(0));
    for(let y=0;y<64;y++)s.tiles[y][34]=1;me.x=32.5;me.y=32.5;me.escaped=true;s.installations=[];
    const r=qa.createRenderer(qa.assets),opts={...selectedOptions,quality:'high'},render=()=>r.draw(c,1280,960,s,me,8,opts);
    for(let i=0;i<50;i++)render();
    const v=qa.caveView(1280,960,me,1.1),points=[1.5,2.5,3.5,4.3,4.8].map(d=>[31.5-d,32.5]);points.push([35.5,32.5]);
    const sample=()=>points.map(([x,y])=>{const a=c.getImageData(Math.round((x*64+v.ox)*v.zoom)-4,Math.round((y*64+v.oy)*v.zoom)-4,8,8).data;let sum=0;for(let i=0;i<a.length;i+=4)sum+=a[i]*.2126+a[i+1]*.7152+a[i+2]*.0722;return sum/64});
    const baseline=sample();s.installations=[{id:1,kind:'lamp',x:31.5,y:32.5}];render();const lit=sample();
    s.tiles[32][34]=0;s.revision++;s.mapVersion++;s.changedCells=[[34,32,1,0]];render();const opened=sample();
    return {deltas:lit.map((n,i)=>n-baseline[i]),opened:opened[5]-baseline[5]};
  })()`);
  const d = lighting.deltas;
  assert(d[0] > d[1] && d[1] > d[2] && d[2] > d[3], JSON.stringify(lighting));
  assert(d[2] > 2);
  assert(Math.abs(d[4]) < 1);
  checked(
    "Diffusion douce étendue avec atténuation progressive et extinction en périphérie",
  );
  assert(Math.abs(d[5]) < 1 && lighting.opened > 2, JSON.stringify(lighting));
  checked(
    "Les murs bloquent le halo, qui traverse une galerie nouvellement creusée",
  );
  const mined = await js(`(()=>{
    const canvas=document.getElementById('scene'),c=canvas.getContext('2d'),s=selectedScene,me=s.players[0];canvas.width=1280;canvas.height=960;
    s.tiles[15][48]=0;s.mapVersion++;s.revision++;s.changedCells=[[48,15,2,0]];
    selectedRenderer.draw(c,1280,960,s,me,8,selectedOptions);const actual=canvas.toDataURL();
    const cold=qa.createRenderer(qa.assets);for(let i=0;i<70;i++)cold.draw(c,1280,960,s,me,8,selectedOptions);
    return actual===canvas.toDataURL();
  })()`);
  assert(mined);
  checked(
    "Les nouveaux dessins de minerai disparaissent immédiatement à l’extraction",
  );
  const performance = await js(`(()=>{
    const c=document.getElementById('scene').getContext('2d'),s=selectedScene,me=s.players[0],before=JSON.stringify(s.tiles),times=[];
    for(let i=0;i<40;i++){const t=window.performance.now();selectedRenderer.draw(c,1280,960,s,me,9+i/60,selectedOptions);times.push(window.performance.now()-t)}times.sort((a,b)=>a-b);
    return {p95:times[Math.floor(times.length*.95)],unchanged:before===JSON.stringify(s.tiles)};
  })()`);
  assert(performance.unchanged);
  assert(performance.p95 < 32, JSON.stringify(performance));
  checked("Animations fluides dans la scène de contrôle et terrain inchangé");
  return { lighting, performance };
}
