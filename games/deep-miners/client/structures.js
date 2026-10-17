export const sceneryHash=(x,y,k=0)=>{const n=Math.sin(x*127.1+y*311.7+k*71.7)*43758.5453;return n-Math.floor(n);};

// Coordinates describe the floor footprint, not the tall painted silhouette.
export function createStructures(tiles){
  const result=[{id:'lift',kind:'lift',anchor:{x:17,y:3},x:15.1,y:.25,w:4.2,h:4.3,depth:4.35,colliders:[
    {x:15.95,y:1,w:2.32,h:1.5},
    {x:15.85,y:2.5,w:.32,h:1.55},{x:18.08,y:2.5,w:.32,h:1.55},
    {x:18.5,y:3,w:.55,h:1.13}
  ]}];
  for(let y=8;y<tiles.length;y+=12)if(tiles[y]?.[17]===0){
    result.push({id:`main-${y}`,kind:'arch',anchor:{x:17,y},x:15.7,y:y-.9,w:3.6,h:2.3,depth:y+1.23,colliders:[
      {x:16.12,y:y+.7,w:.48,h:.62},{x:18.25,y:y+.7,w:.58,h:.62}
    ]});
    if(tiles[y+1]?.[19]>0)result.push({id:`pipe-${y}`,kind:'pipe',anchor:{x:19,y},x:18.9,y,w:1.5,h:2,depth:y+1.9,colliders:[]});
  }
  for(let y=1;y<tiles.length-1;y++)for(let x=2;x<tiles[y].length-2;x++)if(x<14||x>21){
    if(tiles[y][x]===0&&tiles[y-1]?.[x]>0&&tiles[y][x-1]===0&&tiles[y][x+1]===0&&sceneryHash(x,y,70)<.08){
      result.push({id:`side-${x}-${y}`,kind:'arch',anchor:{x,y},x:x-1,y:y-.7,w:2.3,h:1.6,depth:y+.83,colliders:[
        {x:x-.66,y:y+.48,w:.35,h:.43},{x:x+.64,y:y+.48,w:.4,h:.43}
      ]});
    }
    if(tiles[y][x]>0&&tiles[y][x-1]===0&&sceneryHash(x,y,71)<.035)result.push({id:`wallpipe-${x}-${y}`,kind:'pipe',anchor:{x,y},x:x-.25,y:y-.2,w:1.2,h:1.6,depth:y+1.3,colliders:[]});
  }
  return result;
}
