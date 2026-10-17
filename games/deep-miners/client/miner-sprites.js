export function describeFrame(canvas){
 const {width,height}=canvas,pixels=canvas.getContext('2d').getImageData(0,0,width,height).data;let feet=0,top=height,weightedX=0,weight=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>60){feet=Math.max(feet,y);top=Math.min(top,y);}
 const bodyHeight=feet-top+1;
 for(let y=Math.floor(top+bodyHeight*.25);y<top+bodyHeight*.55;y++)for(let x=0;x<width;x++){const alpha=pixels[(y*width+x)*4+3];if(alpha>60){weightedX+=x*alpha;weight+=alpha;}}
 return {canvas,feet:feet/2,bodyHeight,center:weight?weightedX/weight:width/2};
}

// All equipment variants use the pickaxe silhouette as their size reference.
// Anchor the upper body and the ground contact, rather than the atlas cell.
export function prepareEquippedFrame(makeCanvas,sheet,rect,reference,mirror=false,sourceBodyHeight=rect.h){
 const canvas=makeCanvas();canvas.width=192;canvas.height=160;
 const context=canvas.getContext('2d'),scale=reference.bodyHeight/sourceBodyHeight;context.imageSmoothingQuality='high';
 if(mirror){context.translate(canvas.width,0);context.scale(-1,1);}
 context.drawImage(sheet,rect.x,rect.y,rect.w,rect.h,96-rect.center*scale,158-rect.h*scale,rect.w*scale,rect.h*scale);
 return describeFrame(canvas);
}
