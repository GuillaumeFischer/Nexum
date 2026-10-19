import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteComponents,spriteRectangle,ownsSpritePixel} from '../scripts/lib/sprite-components.mjs';
function fixture(){
 const width=40,height=24,data=new Uint8ClampedArray(width*height*4);
 const pixel=(x,y,alpha=255)=>data[(y*width+x)*4+3]=alpha;
 const block=(x,y,w,h)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixel(xx,yy);};
 block(3,2,10,20);block(12,17,10,2); // first miner's tool crosses the old x=20 cut
 block(25,2,10,20);block(19,8,7,2); // next miner's tool overlaps its neighbour's bounds
 pixel(22,18,40);pixel(15,3,40); // antialias next to the tool, and an isolated remnant
 return {width,height,data};
}
test('Les outils dépassant une ancienne case restent attachés au bon personnage',()=>{
 const f=fixture(),result=spriteComponents(f.data,f.width,f.height,{minimumPixels:10,expected:2});
 assert.equal(result.parts[0].right,21);assert.equal(result.parts[1].left,19);
 assert(ownsSpritePixel(result,result.parts[0],21,18));assert(!ownsSpritePixel(result,result.parts[1],21,18));
 assert(ownsSpritePixel(result,result.parts[1],19,8));assert(!ownsSpritePixel(result,result.parts[0],19,8));
 const rect=spriteRectangle(result.parts[0],f.width,f.height);assert(rect.x+rect.width>21);
});
test('Le contour adouci est conservé sans absorber les fragments éloignés',()=>{
 const f=fixture(),result=spriteComponents(f.data,f.width,f.height,{minimumPixels:10,expected:2}),part=result.parts[0];
 assert(ownsSpritePixel(result,part,22,18));assert(!ownsSpritePixel(result,part,15,3,1));
});
test('Une planche dont les silhouettes sont fusionnées est refusée',()=>{
 const f=fixture();assert.throws(()=>spriteComponents(f.data,f.width,f.height,{minimumPixels:10,expected:3}),/Expected 3 silhouettes, found 2/);
});
