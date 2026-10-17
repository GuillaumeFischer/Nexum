// Saved slots remain -1 for empty hands and 0..8 for the nine item bindings.
export const quickbarKey=slot=>(slot+2)%10;
export const quickbarSlot=digit=>(digit+9)%10-1;
