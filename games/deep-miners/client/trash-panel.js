import {inventorySlots,carriedCount} from './progression.js';
import {itemIcon,itemName} from './item-ui.js';

export function drawTrashPanel({me,machine,node,button,content,act,draft,refresh}){
 if(draft.machine!==machine.id)Object.assign(draft,{machine:machine.id,item:null,count:1,confirm:false});
 const slots=inventorySlots(me).filter(Boolean),chosen=slots.find(s=>s.id===draft.item);
 if(!chosen){draft.item=null;draft.confirm=false;}
 const panel=node('article',undefined,'machine-panel trash-panel'),hero=node('div',undefined,'machine-hero'),intro=node('div');
 intro.append(node('h2','Poubelle'),node('p','Choisis un objet de ton sac, puis la quantité à jeter.','muted'));
 hero.append(itemIcon('trash',me,'machine-portrait'),intro);panel.append(hero);content.append(panel);
 if(!slots.length){panel.append(node('p','Ton sac est vide.'));return;}
 const grid=node('div',undefined,'trash-items');
 for(const slot of slots){const b=button('',()=>{Object.assign(draft,{item:slot.id,count:1,confirm:false});refresh();});b.className='trash-item'+(draft.item===slot.id?' selected':'');b.setAttribute('aria-label',itemName(slot.id,me)+' · '+slot.count);b.setAttribute('aria-pressed',String(draft.item===slot.id));b.append(itemIcon(slot.id,me),node('strong',itemName(slot.id,me)),node('span','× '+slot.count));grid.append(b);}panel.append(grid);
 if(!chosen)return;
 const available=carriedCount(me,chosen.id);draft.count=Math.max(1,Math.min(draft.count,available));
 const detail=node('section',undefined,'trash-selection');detail.append(node('h3',itemName(chosen.id,me)),itemIcon(chosen.id,me,'detail-art'),node('p',`${draft.count} / ${available} à jeter`));
 if(!draft.confirm){const quantities=node('div',undefined,'slot-actions');for(const n of [...new Set([1,Math.min(10,available),available])])quantities.append(button(n===available&&n>1?'Tout · '+n:String(n),()=>{draft.count=n;refresh();}));detail.append(quantities,button('Jeter · '+draft.count,()=>{draft.confirm=true;refresh();}));}
 else{detail.append(node('p',`Détruire définitivement ${draft.count} × ${itemName(chosen.id,me)} ?`,'trash-warning'));detail.append(button('Annuler',()=>{draft.confirm=false;refresh();}),button('Confirmer la destruction',()=>{const item=draft.item,count=draft.count;draft.confirm=false;void act('discard',{id:machine.id,item,count});}));}
 panel.append(detail);
}
