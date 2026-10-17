import {createHash} from 'node:crypto';
const decoder=new TextDecoder('utf-8',{fatal:true});
export function acceptKey(key){return createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');}
export function frame(data,opcode=1){const b=Buffer.isBuffer(data)?data:Buffer.from(data),size=b.length;const h=Buffer.alloc(size<126?2:4);h[0]=0x80|opcode;h[1]=size<126?size:126;if(size>=126)h.writeUInt16BE(size,2);return Buffer.concat([h,b]);}
// Limited RFC6455 endpoint: masked text, fragmentation, ping/pong and close.
// No extensions or binary messages are negotiated; messages are capped at 4096 B.
export function connectSocket(socket,head,onMessage,onClose){
 let pending=Buffer.alloc(0),parts=[],partSize=0,fragment=false,ended=false;
 const peer={send(value){if(!ended&&!socket.destroyed&&socket.writableLength<256000)socket.write(frame(JSON.stringify(value)));},ping(){if(!ended)socket.write(frame('',9));},close(code=1000){if(ended)return;ended=true;const b=Buffer.alloc(2);b.writeUInt16BE(code);socket.end(frame(b,8));onClose();},get closed(){return ended;}};
 const finish=()=>{if(!ended){ended=true;onClose();}};
 socket.on('close',finish);socket.on('error',finish);
 function consume(chunk){
  pending=Buffer.concat([pending,chunk]);if(pending.length>8192){peer.close(1009);return;}
  while(pending.length>=2&&!ended){const first=pending[0],fin=!!(first&128),op=first&15,masked=!!(pending[1]&128);let len=pending[1]&127,offset=2;
   if(first&112||!masked||![0,1,8,9,10].includes(op)){peer.close(1002);return;}
   if(len===127){peer.close(1009);return;}if(len===126){if(pending.length<4)return;len=pending.readUInt16BE(2);offset=4;}
   if(len>4096||op>=8&&(!fin||len>125)){peer.close(1009);return;}if(pending.length<offset+4+len)return;
   const mask=pending.subarray(offset,offset+4),data=Buffer.from(pending.subarray(offset+4,offset+4+len));pending=pending.subarray(offset+4+len);for(let i=0;i<len;i++)data[i]^=mask[i%4];
   if(op===8){peer.close();return;}if(op===9){socket.write(frame(data,10));continue;}if(op===10)continue;
   if(op===1&&fragment||op===0&&!fragment){peer.close(1002);return;}
   if(op===1){parts=[];partSize=0;}parts.push(data);partSize+=len;if(partSize>4096){peer.close(1009);return;}fragment=!fin;
   if(fin){try{onMessage(JSON.parse(decoder.decode(Buffer.concat(parts))),peer);}catch{peer.send({type:'error',error:'Message invalide.'});}parts=[];partSize=0;}
  }
 }
 socket.on('data',consume);if(head?.length)queueMicrotask(()=>consume(head));return peer;
}
