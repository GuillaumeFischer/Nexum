// Persist command replies with the room: retrying a transaction whose commit
// response was lost must acknowledge it without consuming items twice.
export function onceRadioCommand(room,connectionId,message,run){
 if(!Number.isSafeInteger(message.requestId))return run();
 const key=connectionId+':'+message.requestId,replies=room.radioReplies??={};
 if(Object.hasOwn(replies,key)){if(replies[key].error)throw Error(replies[key].error);return;}
 try{const result=run();replies[key]={ok:true};return result;}
 catch(error){replies[key]={error:error.message};throw error;}
 finally{const keys=Object.keys(replies);for(const old of keys.slice(0,Math.max(0,keys.length-128)))delete replies[old];}
}
