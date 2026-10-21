import test from 'node:test';
import assert from 'node:assert/strict';
import {MINER_GROUND} from '../games/deep-miners/client/miner-ground-layout.js';
import {MINER_ATLASES,MINER_CELL} from '../games/deep-miners/client/new-miner-layout.js';
import {createNewMinerArt,minerFrame,minerSupport,NEW_MINER_ASSETS} from '../games/deep-miners/client/new-miner.js';
const assets=Object.fromEntries(Object.keys(NEW_MINER_ASSETS).map(k=>[k,{name:k}]));
const art=createNewMinerArt(assets,()=>{throw Error('No colour variant needed');});
function recorder(){
 const calls=[];return {calls,save(){},restore(){},translate(...a){calls.push(['translate',...a]);},scale(...a){calls.push(['scale',...a]);},rotate(){},drawImage(...a){calls.push(['image',...a]);},createRadialGradient(){return {addColorStop(...a){calls.push(['stop',...a]);}};},fillRect(){calls.push(['shadow']);}};
}
function stateFor(name,row,column){
 const player={id:'ground',slot:0,alive:true,face:row===0?{x:0,y:1}:row===1?{x:1,y:0}:{x:0,y:-1},heldItem:null},pose={walk:false,run:0,column:0};
 if(name==='idle')player.heldItem=column===1?'pick':column===2?'shovel':null;
 else if(name==='actions'){player.heldItem=column<4?'pick':'shovel';if(column<4)player.mine=(column+.1)/4;else player.actionSeconds=.45*(1-(column-4+.1)/4);}
 else{player.heldItem=name.startsWith('pick')?'pick':name.startsWith('shovel')?'shovel':null;Object.assign(pose,{walk:true,run:name.endsWith('run')?1:0,column});}
 return {player,pose};
}
test('177 poses à pied disposent de semelles ; les trois poses assises sont exclues',()=>{
 let count=0;
 for(const [name,sheet]of Object.entries(MINER_ATLASES)){
  assert.equal(MINER_GROUND[name].length,sheet.rows*sheet.columns);
  for(const [i,support]of MINER_GROUND[name].entries()){
   if(name==='idle'&&i%4===3){assert.equal(support,null);continue;}
   assert(support.contacts.length>=1&&support.contacts.length<=2);assert.equal(support.y,Math.max(...support.contacts.map(s=>s.y)));
   for(const sole of support.contacts){assert(sole.x>0&&sole.x<MINER_CELL.width);assert(sole.y>140&&sole.y<MINER_CELL.height);assert(sole.width>=7&&sole.width<=28);}count++;
  }
 }assert.equal(count,177);
});
test('Le vrai dessin aligne la semelle porteuse sur le sol pour toutes les poses à pied',()=>{
 for(const [name,sheet]of Object.entries(MINER_ATLASES))for(let row=0;row<3;row++)for(let column=0;column<sheet.columns;column++){
  const support=MINER_GROUND[name][row*sheet.columns+column];if(!support)continue;
  const {player,pose}=stateFor(name,row,column),c=recorder(),frame=art.draw(c,player,pose,0,0);
  assert.equal(frame.atlas,name);assert.equal(frame.column,column);
  const draw=c.calls.find(call=>call[0]==='image');assert.equal(draw[7]+support.y/2,0,`${name}/${row}/${column} floating`);
 }
});
test('L’ombre possède un contour transparent et les contacts suivent les pieds et le miroir',()=>{
 const {player,pose}=stateFor('idle',1,1),right=recorder();art.shadow(right,player,pose,0,0);
 assert(right.calls.filter(c=>c[0]==='shadow').length>=2);assert(right.calls.some(c=>c[0]==='stop'&&c[1]===1&&c[2]==='rgba(12,8,4,0)'));
 player.face={x:-1,y:0};const left=recorder();art.shadow(left,player,pose,0,0);assert(left.calls.some(c=>c[0]==='scale'&&c[1]===-1&&c[2]===1));
});
test('Le wagon conserve sa position assise et ne reçoit aucune ombre de pieds',()=>{
 const {player,pose}=stateFor('idle',0,1);player.vehicleId='wagon';const c=recorder();
 art.shadow(c,player,pose,0,0);assert.equal(c.calls.length,0);const frame=art.draw(c,player,pose,0,0);
 assert.equal(minerSupport(frame),null);assert.equal(c.calls.find(c=>c[0]==='image')[7],-100);
});
