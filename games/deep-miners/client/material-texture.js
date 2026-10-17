// Overlapping, translated samples preserve the illustration's lighting.
// Every sample belongs to a world-space lattice point: the same sample crosses
// adjacent cells and cached chunks, without reflecting the source artwork.
function noise(x,y,salt){
 let n=Math.imul(x^salt,0x45d9f3b)^Math.imul(y,0x119de1f3);
 n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);
 return ((n^(n>>>16))>>>0)/4294967296;
}

function sample(im,index,cols,rows,x,y){
 const w=im.width/cols,h=im.height/rows,k=index*71+cols*13;
 const scale=.70+noise(x,y,k+1)*.26,sw=w*scale,sh=h*scale;
 return {x:index%cols*w+(w-sw)*noise(x,y,k+2),y:Math.floor(index/cols)*h+(h-sh)*noise(x,y,k+3),w:sw,h:sh};
}

export function createMaterialSampler(makeCanvas,cellSize=64,{cacheEntries=128,cacheBytes=12*1024*1024}={}){
 const cache=new Map(),images=new WeakMap();let imageID=0,bytes=0,density=0,size=0,masks=[],scratch=null;
 function clear(){cache.clear();bytes=0;}
 function prepare(ratio){
  if(density===ratio)return;
  clear();density=ratio;size=Math.round(cellSize*2*ratio);
  scratch=makeCanvas();scratch.width=scratch.height=size;
  masks=[];
  // Complementary masks sum to one, including where four samples meet.
  // A narrow feather keeps foliage sharp while hiding source image edges.
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const canvas=makeCanvas();canvas.width=canvas.height=size;const c=canvas.getContext('2d');
   const gx=c.createLinearGradient(0,0,size,0),gy=c.createLinearGradient(0,0,0,size);
   for(const [gradient,side]of [[gx,dx],[gy,dy]])for(const [at,alpha]of [[0,1-side],[.35,1-side],[.65,side],[1,side]])gradient.addColorStop(at,`rgba(255,255,255,${alpha})`);
   c.fillStyle=gx;c.fillRect(0,0,size,size);c.globalCompositeOperation='destination-in';c.fillStyle=gy;c.fillRect(0,0,size,size);
   masks.push(canvas);
  }
 }
 function region(im,index,cols,rows,bx,by){
  if(!images.has(im))images.set(im,++imageID);
  const key=`${images.get(im)}:${cols}:${rows}:${index}:${bx}:${by}`;
  if(cache.has(key)){const canvas=cache.get(key);cache.delete(key);cache.set(key,canvas);return canvas;}
  const canvas=makeCanvas();canvas.width=canvas.height=size;
  const c=canvas.getContext('2d'),s=scratch.getContext('2d');c.globalCompositeOperation='lighter';
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const crop=sample(im,index,cols,rows,bx+dx,by+dy);
   s.globalCompositeOperation='source-over';s.clearRect(0,0,size,size);
   // The two halves of one unflipped sample meet on the lattice boundary.
   s.drawImage(im,crop.x+(1-dx)*crop.w/2,crop.y+(1-dy)*crop.h/2,crop.w/2,crop.h/2,0,0,size,size);
   s.globalCompositeOperation='destination-in';s.drawImage(masks[dy*2+dx],0,0);
   c.drawImage(scratch,0,0);
  }
  cache.set(key,canvas);bytes+=size*size*4;
  while(cache.size>cacheEntries||bytes>cacheBytes&&cache.size>1){cache.delete(cache.keys().next().value);bytes-=size*size*4;}
  return canvas;
 }
 function draw(c,im,index,cols,rows,x,y,px,py,ratio=1){
  prepare(ratio);
  const bx=Math.floor(x/2),by=Math.floor(y/2),texture=region(im,index,cols,rows,bx,by),half=size/2;
  c.drawImage(texture,(x-bx*2)*half,(y-by*2)*half,half,half,px,py,cellSize,cellSize);
 }
 return {draw,clear,get cachedEntries(){return cache.size;},get cachedBytes(){return bytes;}};
}
