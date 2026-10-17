// Match the server position to the elapsed part of its acknowledged input.
// This is simulation time, never a timestamp supplied by the client.
export function acknowledgeInput(player,dt){
 const seconds=Math.max(0,Math.min(.25,dt));
 player.ackInputSeconds=(player.ackSeq===player.inputSeq?player.ackInputSeconds||0:0)+seconds;
 player.ackSeq=player.inputSeq;
}
