// Shared by the local runtime and the deployed radio command gate.
export const COLONY_COMMANDS=new Set(['discard','build','inventory','quickbar','transfer','configure','trade','eat','equip','till','plant','harvest','cook','wagon']);
export const ROOM_COMMANDS=new Set(['start','escape','craft','place','recover','dismantle','save',...COLONY_COMMANDS]);
