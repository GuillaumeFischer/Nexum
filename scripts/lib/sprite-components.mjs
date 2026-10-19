// Sprite sheets generated as illustrations are not necessarily aligned to a grid.
// Identify each complete silhouette before assigning it to an animation cell.
export function spriteComponents(data,width,height,{threshold=80,minimumPixels=1000,expected}={}){
 const labels=new Int32Array(width*height),queue=new Int32Array(width*height),parts=[];let label=0;
 for(let i=0;i<labels.length;i++)if(!labels[i]&&data[i*4+3]>threshold){
  label++;let count=0,left=width,right=-1,top=height,bottom=-1,head=0,tail=0;queue[tail++]=i;labels[i]=label;
  while(head<tail){
   const n=queue[head++],x=n%width,y=Math.floor(n/width);count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy,k=yy*width+xx;
    if(xx>=0&&xx<width&&yy>=0&&yy<height&&!labels[k]&&data[k*4+3]>threshold){labels[k]=label;queue[tail++]=k;}
   }
  }
  if(count>=minimumPixels)parts.push({label,count,left,right,top,bottom});
 }
 parts.sort((a,b)=>a.left-b.left);
 if(expected!==undefined&&parts.length!==expected)throw Error(`Expected ${expected} silhouettes, found ${parts.length}`);
 return {parts,labels,width,height};
}

export function spriteRectangle(component,width,height,padding=2){
 const x=Math.max(0,component.left-padding),y=Math.max(0,component.top-padding);
 return {x,y,width:Math.min(width-1,component.right+padding)-x+1,height:Math.min(height-1,component.bottom+padding)-y+1};
}

// Include the original antialiased outline, but never another silhouette, even
// when two bounding rectangles overlap (for example a pickaxe beside a boot).
export function ownsSpritePixel(components,component,x,y,radius=2){
 const {labels,width,height}=components,owner=labels[y*width+x];
 if(owner)return owner===component.label;
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const xx=x+dx,yy=y+dy;if(xx>=0&&xx<width&&yy>=0&&yy<height&&labels[yy*width+xx]===component.label)return true;
 }
 return false;
}
