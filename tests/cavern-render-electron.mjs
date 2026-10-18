import { app, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";

const scratch = process.env.NEXUM_MENU_SCRATCH,
  root = path.join(process.env.NEXUM_MENU_GAME_ROOT, "client");
app.setPath("userData", path.join(scratch, "profile"));
const checks = [];
let window, server;
const js = (code) => window.webContents.executeJavaScript(code);
const checked = (label) => {
  checks.push(label);
  console.log("OK · " + label);
};

async function run() {
  server = http.createServer(async (req, res) => {
    try {
      if (req.url === "/") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<style>body{margin:0;background:#000}canvas{display:block}</style><canvas id="scene"></canvas><script type="module">import {createRenderer,loadAssets,TILE} from "/renderer.js";import {caveView} from "/cave-camera.js";window.qa={createRenderer,TILE,caveView,assets:await loadAssets()};</script>',
        );
        return;
      }
      const file = path.resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
      if (!file.startsWith(root + path.sep))
        throw Error("Path outside fixture");
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".webp")
            ? "image/webp"
            : "image/png",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { backgroundThrottling: false },
  });
  const errors = [];
  window.webContents.on("console-message", (_e, details) => {
    if (details.level === "error") errors.push(details.message);
  });
  await window.loadURL(`http://127.0.0.1:${server.address().port}`);
  for (let i = 0; !(await js("!!window.qa")); i++) {
    if (i > 300)
      throw Error("Renderer assets did not load: " + errors.join("; "));
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  await js(`window.fixture=(depth=18)=>{
    const tiles=Array.from({length:256},()=>Array(80).fill(-1));
    for(let y=depth-10;y<depth+11;y++)for(let x=37;x<64;x++)tiles[y][x]=1;
    for(let y=depth-3;y<=depth+3;y++)for(let x=46;x<=55;x++)tiles[y][x]=0;
    for(let y=depth-1;y<=depth+1;y++)for(let x=39;x<=61;x++)tiles[y][x]=0;
    for(let y=depth-8;y<depth-3;y++)for(let x=51;x<=52;x++)tiles[y][x]=0;
    for(let y=depth+1;y<depth+8;y++)for(let x=53;x<=55;x++)tiles[y][x]=0;
    for(const [x,dy,t]of [[47,-4,2],[48,-4,7],[54,-4,5],[55,-4,6],[56,2,3],[56,3,4],[45,3,7],[45,-3,2]])tiles[depth+dy][x]=t;
    const me={id:'qa',name:'Explorateur',slot:0,x:49.5,y:depth-1.5,face:{x:0,y:-1},alive:true,connected:true,color:'#f5bd62',o2:100,health:100,hunger:90,bag:0,items:{},cargo:{},pickTier:3,mine:0};
    return {code:'VISUAL',tiles,world:{generator:1,seed:'nexum-cavern-0134',width:80,height:256},players:[me],installations:[{id:1,kind:'lamp',x:47.5,y:depth-2.5},{id:2,kind:'lamp',x:54.5,y:depth+2.5}],structures:[],landmarks:[],events:[],stock:{},mode:'free',phase:'running',time:0,revision:1,mapVersion:1,changedCells:[]};
  };window.renderFixture=async(depth=18,w=1280,h=800)=>{
    const canvas=document.getElementById('scene');canvas.width=w;canvas.height=h;
    const state=window.state=fixture(depth),me=state.players[0],r=window.renderer=qa.createRenderer(qa.assets),c=canvas.getContext('2d');
    window.settings={zoom:1.1,quality:'high',brightness:.6,separateHUD:false,hud:false,pixelRatio:1};
    for(let i=0;i<90;i++)r.draw(c,w,h,state,me,i/60,settings);
    return {png:canvas.toDataURL('image/png').split(',')[1],tile:r.pointerTile(w/2,h/2)};
  };void 0;`);
  for (const [name, depth, w, h] of [
    ["rock", 18, 1280, 800],
    ["forest", 68, 1280, 800],
    ["crystal", 37, 1920, 1080],
    ["ruins", 98, 1280, 800],
    ["water", 128, 1280, 800],
    ["volcano", 170, 1280, 800],
    ["deep", 220, 1280, 800],
    ["compact", 18, 960, 640],
  ]) {
    const result = await js(`renderFixture(${depth},${w},${h})`);
    await fs.writeFile(
      path.join(scratch, name + ".png"),
      Buffer.from(result.png, "base64"),
    );
    const aim = await js(`(()=>{
      const feet=renderer.pointerTile(${w}/2,${h}*.56),me=state.players[0];
      const v=qa.caveView(${w},${h},me,settings.zoom);
      return {feet,expected:{x:Math.floor(me.x),y:Math.floor(me.y)},wall:renderer.pointerTile((48.5*64+v.ox)*v.zoom,((me.y-2.5)*64+v.oy)*v.zoom)};
    })()`);
    assert.deepEqual(aim.feet, aim.expected);
    assert.equal(aim.wall.x, 48);
    assert.equal(aim.wall.y, depth - 4);
    checked("Rendu " + name + " sans erreur");
  }
  checked("Cadrage et ciblage alignés après changement de taille");
  const mining = await js(`(()=>{
    const canvas=document.getElementById('scene'),c=canvas.getContext('2d'),s=fixture(18),me=s.players[0],r=qa.createRenderer(qa.assets),opts={...settings,quality:'low'};
    const draw=renderer=>renderer.draw(c,960,640,s,me,8,opts);
    for(let i=0;i<60;i++)draw(r);
    s.tiles[14][47]=0;s.mapVersion++;s.revision++;s.changedCells=[[47,14,2,0]];
    draw(r);const immediate=canvas.toDataURL();
    const cold=qa.createRenderer(qa.assets);for(let i=0;i<60;i++)draw(cold);
    const mined=immediate===canvas.toDataURL();
    s.tiles[14][48]=0;s.mapVersion++;s.revision++;s.changedCells=[];s.chunks={'3,0':{version:2}};
    for(let i=0;i<60;i++)draw(r);const streamed=canvas.toDataURL();
    const fresh=qa.createRenderer(qa.assets);for(let i=0;i<60;i++)draw(fresh);
    return {mined,streamed:streamed===canvas.toDataURL()};
  })()`);
  assert(mining.mined);
  checked(
    "Les faces et ombres voisines disparaissent immédiatement au minage, même entre deux secteurs",
  );
  assert(mining.streamed);
  checked("Les parois restent continues au chargement des secteurs voisins");
  const lighting = await js(`(()=>{
    const canvas=document.getElementById('scene');canvas.width=1280;canvas.height=960;
    const c=canvas.getContext('2d'),s=fixture(18),me=s.players[0];s.installations=[];
    for(let i=0;i<3;i++)s.tiles[14-i][49]=5;
    const r=qa.createRenderer(qa.assets);for(let i=0;i<60;i++)r.draw(c,1280,960,s,me,8,settings);
    const v=qa.caveView(1280,960,me,settings.zoom),levels=[];
    for(let i=0;i<3;i++){
      const x=Math.round((49.5*64+v.ox)*v.zoom),y=Math.round(((14.5-i)*64+v.oy)*v.zoom);
      const pixels=c.getImageData(x-8,y-8,16,16).data;let sum=0;
      for(let k=0;k<pixels.length;k+=4)sum+=pixels[k]*.2126+pixels[k+1]*.7152+pixels[k+2]*.0722;
      levels.push(sum/256);
    }
    return levels;
  })()`);
  assert(
    lighting[0] > lighting[1] * 1.3 && lighting[1] > lighting[2] * 1.2,
    JSON.stringify(lighting),
  );
  checked(
    "La frontale révèle les minerais avec une atténuation sur deux couches de mur",
  );
  await js("renderFixture(18,960,640)");
  const stress = await js(`(()=>{
    const c=document.getElementById('scene').getContext('2d'),me=state.players[0],times=[],before=JSON.stringify(state.tiles);
    for(let i=0;i<45;i++){me.x+=.006;const t=performance.now();renderer.draw(c,960,640,state,me,2+i/60,settings);times.push(performance.now()-t);}
    times.sort((a,b)=>a-b);return {p95:times[Math.floor(times.length*.95)],unchanged:before===JSON.stringify(state.tiles)};
  })()`);
  assert(stress.unchanged);
  checked("Le rendu ne modifie aucune case de la mine");
  assert(stress.p95 < 32, JSON.stringify(stress));
  checked("Défilement sans reconstruction continue des parois");
  assert.equal(errors.length, 0, errors.join("; "));
  await fs.writeFile(
    path.join(scratch, "report.json"),
    JSON.stringify(
      {
        ok: true,
        checks,
        stress,
        wallLightLevels: lighting,
        gameRoot: process.env.NEXUM_MENU_GAME_ROOT,
        historicalSuitesRerun: false,
      },
      null,
      2,
    ),
  );
}
void app.whenReady().then(async () => {
  let code = 0;
  try {
    await run();
  } catch (error) {
    code = 1;
    await fs.writeFile(
      path.join(scratch, "report.json"),
      JSON.stringify({ ok: false, checks, error: error.stack }),
    );
  } finally {
    window?.destroy();
    server?.close();
    app.exit(code);
  }
});
