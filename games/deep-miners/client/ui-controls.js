// Use the typed letter as well as the physical code: M is Semicolon on AZERTY.
export function menuShortcut(event){
 if(event.ctrlKey||event.altKey||event.metaKey)return null;
 if(event.code==='Tab'&&!event.shiftKey)return 'inventory';
 if(event.key?.toLowerCase()==='m'||event.code==='KeyM')return 'map';
 if(event.code==='KeyC')return 'build';
 return null;
}
