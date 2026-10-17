const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function displaySize(width,height,deviceRatio=1,mode='screen'){
  const native=clamp(Number.isFinite(deviceRatio)?deviceRatio:1,1,3);
  const limit=Math.min(Math.sqrt(16000000/Math.max(1,width*height)),8192/Math.max(1,width,height));
  const worldRatio=Math.min(limit,mode==='economy'?.75:Math.max(1,Math.min(native,2))),hudRatio=Math.min(native,limit);
  return {worldRatio,hudRatio,worldWidth:Math.ceil(width*worldRatio),worldHeight:Math.ceil(height*worldRatio),hudWidth:Math.ceil(width*hudRatio),hudHeight:Math.ceil(height*hudRatio)};
}

// Automatic quality changes effects, never silently lowers the screen resolution.
export function createEffectQuality(){
  let reduced=false,slow=0,fast=0;
  return {
    observe(fps){
      slow=fps<45?slow+1:0;fast=fps>56?fast+1:0;
      if(slow>=2){reduced=true;fast=0;}else if(fast>=3){reduced=false;slow=0;}
    },
    current(selected){return selected==='low'||selected==='auto'&&reduced?'low':'high';}
  };
}
