import {drawTrashPanel} from './trash-panel.js';
import {quickbarKey} from './quickbar-controls.js';
import {drawMineMap} from './mine-map.js';
import {drawMachinePanel} from './machine-panel.js';
import {nearestMachine,MACHINE_REACH} from './machine-profile.js';
import {SEEDS,FOODS,COOKING_RECIPES,isFieldItem,fieldActionReason,fieldAt,cropReady} from './agriculture.js';
import {BUILDINGS,RESOURCES,inventorySlots,capacity,weight,quickbarIds,carriedCount,isQuickbarItem} from './progression.js';
import {itemIcon,itemName,itemDescription,pickName} from './item-ui.js';
import {BIOMES,biomeAt} from './world.js';
import {checkPlacement,isPlaceable} from './placement.js';
import {INSTALLATION_LIMITS,INSTALLATION_LABELS,installationCounts} from './installation-limits.js';
const statusNames={working:'En marche',power:'Énergie manquante',fuel:'Bois manquant',materials:'Fer ou bois manquant',full:'Stockage plein',empty:'Épuisé',idle:'Stockage',growing:'Croissance',charged:'Chargée'};
export function createColonyUI({command,releaseKeys,selectionChanged=()=>{},notify,closeWorkshop,openWorkshop}){
 const $=id=>document.getElementById(id),root=$('colony'),content=$('colonyContent'),bar=$('quickbar');let state=null,me=null,opened=false,tab='inventory',machineId=null,signature='',busy=false,dragId=null,dragQuickIndex=null,selectionIndex=0,inventorySelected=null,pendingBindings=null,barSignature='',hudSignature='',mineCode=null;
 const trashDraft={};
 const transferDraft={values:new Map(),editing:false};
 addEventListener('blur',()=>{if(transferDraft.editing){transferDraft.editing=false;signature='';render(state,me);}});
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(label,fn,disabled=false)=>{const b=node('button',label);b.type='button';b.disabled=disabled||busy;b.onclick=fn;return b;};
 async function act(type,details={}){if(busy)return;busy=true;signature='';render(state,me);try{await command(type,details);notify('');if(type==='wagon'&&['board','exit','route'].includes(details.action))close();}catch(e){notify(e.message);}finally{busy=false;signature='';render(state,me);}}
 function open(next='inventory',id=null){if(!state||state.mode!=='free')return;closeWorkshop();releaseKeys();opened=true;tab=next;machineId=id;transferDraft.values.clear();transferDraft.editing=false;trashDraft.machine=null;root.hidden=false;signature='';render(state,me);content.scrollTop=0;$('closeColony').focus();}
 function close(){transferDraft.editing=false;const wasOpen=opened;opened=false;root.hidden=true;trashDraft.machine=null;if(wasOpen){releaseKeys();$('openColony').focus();}}
 $('openColony').onclick=()=>open();$('openMap').onclick=()=>open('map');$('closeColony').onclick=close;
 for(const b of root.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;signature='';render(state,me);content.scrollTop=0;};
 $('buildSelected').onclick=()=>{if(isPlaceable(bindings()[selectionIndex]))notify('Vise une case dans la mine, puis clique pour poser.');else placeSelected();};
 const bindings=()=>pendingBindings||quickbarIds(me||{});
 let inventoryPage=0;
 let wallRotation=0;
 $('rotateSelected').onclick=rotateSelected;
 function rotateSelected(){if(opened||busy||bindings()[selectionIndex]!=='wall'||!me?.alive)return false;wallRotation=1-wallRotation;barSignature='';render(state,me);return true;}
 function cycleSlot(direction){selectSlot((selectionIndex+1+Math.sign(direction)+10)%10-1);}
 function selectSlot(index){if(!Number.isInteger(index)||index<-1||index>8)return;selectionIndex=index;signature='';barSignature='';render(state,me);selectionChanged();syncEquip();}
 function syncEquip(){if(state?.phase==='running'&&me?.alive)void command('equip',{slot:selectionIndex}).catch(e=>notify(e.message));}
 async function saveBindings(ids,index=selectionIndex){if(busy)return;pendingBindings=ids;selectionIndex=index;busy=true;signature='';barSignature='';render(state,me);selectionChanged();try{await command('quickbar',{slots:ids});await command('equip',{slot:selectionIndex});notify('');}catch(e){pendingBindings=null;notify(e.message);}finally{busy=false;signature='';barSignature='';render(state,me);}}
 function assign(id,index){const ids=[...bindings()],other=id?ids.indexOf(id):-1;if(other>=0&&other!==index)ids[other]=null;ids[index]=id;void saveBindings(ids,index);}
 function suggestedSlot(id){const ids=bindings(),existing=ids.indexOf(id),empty=ids.indexOf(null);return existing>=0?existing:empty>=0?empty:selectionIndex<=0?1:selectionIndex;}
 function equip(id,index=suggestedSlot(id)){if(bindings()[index]===id)selectSlot(index);else assign(id,index);close();}
 function stopDrag(){dragId=null;dragQuickIndex=null;barSignature='';}
 function quickSlots(){const holder=node('div',undefined,'hotbar-slots'),hands=node('button',undefined,'hotbar-slot hands-slot'+(selectionIndex===-1?' selected':''));hands.type='button';hands.dataset.slot='-1';hands.setAttribute('aria-pressed',String(selectionIndex===-1));hands.setAttribute('aria-label','Raccourci 1 · Mains vides');hands.title='1 · Mains vides';hands.append(node('span','1','slot-key'),itemIcon('hands',me));hands.onclick=()=>selectSlot(-1);holder.append(hands);for(const [index,id]of bindings().entries()){
  const count=id?carriedCount(me,id):0,b=node('button',undefined,'hotbar-slot'+(index===selectionIndex?' selected':'')+(id&&!count?' unavailable':''));b.type='button';b.dataset.slot=String(index);b.setAttribute('aria-pressed',String(index===selectionIndex));b.setAttribute('aria-label',`Raccourci ${quickbarKey(index)} · ${id?itemName(id,me)+' · '+count:'Vide'}`);b.title=`${quickbarKey(index)} · ${id?itemName(id,me):'Emplacement vide'}${id&&!count?' · Aucun dans le sac':''} · Clic droit ou Suppr pour retirer`;b.append(node('span',String(quickbarKey(index)),'slot-key'));if(id){b.append(itemIcon(id,me));if(id!=='pick')b.append(node('span',String(count),'slot-count'));b.draggable=true;b.ondragstart=e=>{dragId=id;dragQuickIndex=index;e.dataTransfer?.setData('text/plain',id);};b.ondragend=stopDrag;}
  b.onclick=()=>selectSlot(index);b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const id=dragId||e.dataTransfer?.getData('text/plain'),source=dragQuickIndex;stopDrag();if(!isQuickbarItem(id))return;if(source!==null){const ids=[...bindings()];[ids[source],ids[index]]=[ids[index],ids[source]];void saveBindings(ids,index);}else assign(id,index);};b.oncontextmenu=e=>{e.preventDefault();assign(null,index);};b.onkeydown=e=>{if(e.key==='Delete'){e.preventDefault();assign(null,index);}};holder.append(b);
 }return holder;}
 function placeSelected(target){
  if(me.vehicleId){notify('Descends du wagon avant d’utiliser un outil ou de construire.');return;}
  const selected=bindings()[selectionIndex];
  if(!selected){if(target)void act('harvest',{target});else notify('Sélectionne un objet ou vise une plante mûre pour récolter.');return;}
  if(selected==='pick'){notify('Maintiens Espace pour miner devant toi.');return;}
  if(!carriedCount(me,selected)){notify('Cet objet n’est plus dans ton sac.');return;}
  if(FOODS[selected]){void act('eat',{food:selected});return;}
  if(isFieldItem(selected)){target??={x:Math.floor(me.x)+me.face.x,y:Math.floor(me.y)+me.face.y};const reason=fieldActionReason(state,me,selected,target);if(reason){notify(reason);return;}void act(selected==='shovel'?'till':'plant',{target,...(SEEDS[selected]?{seed:selected}:{})});return;}
  if(RESOURCES[selected]){notify(selected==='wheat'?'Utilise le blé dans la cuisinière pour préparer du pain.':'Dépose les minerais à l’ascenseur avec E.');return;}
  const result=checkPlacement(state,me,selected,target,wallRotation);if(!result.ok){notify(result.reason);return;}
  const details={kind:selected,...(selected==='wall'?{rotation:wallRotation}:{}),...(target?{target}:{})};if(BUILDINGS[selected])void act('build',details);else void act('place',details);
 }
 function renderTeam(){
  const hud=$('teamHUD');hud.hidden=state.mode!=='free'||state.phase!=='running';if(hud.hidden)return;
  const sig=JSON.stringify([state.players.map(p=>[p.id,p.name,p.color,Math.ceil(p.o2),Math.ceil(p.health??100),Math.ceil(p.hunger??100),p.alive,p.connected]),me.cargo,state.stock,capacity(me)]);if(sig===hudSignature)return;hudSignature=sig;
  const heading=node('div',undefined,'team-heading');heading.append(node('strong','ÉQUIPE'),node('span',state.players.length+' / 6'));
  const players=node('div',undefined,'team-players');for(const p of state.players){
   const row=node('div',undefined,'team-player'),helmet=node('span','⛑','team-helmet');helmet.style.color=p.color;
   const info=node('div',undefined,'team-player-info'),label=node('div',undefined,'team-player-label');
   label.append(node('strong',p.name),node('span',p.id===me.id?'VOUS':!p.alive?'À SECOURIR':!p.connected?'HORS LIGNE':''));
   const meter=node('meter');meter.min=0;meter.max=100;meter.value=p.o2;meter.style.setProperty('--player-color',p.color);meter.setAttribute('aria-label',p.name+' · oxygène '+Math.ceil(p.o2)+' %');meter.title=Math.ceil(p.o2)+' % d’oxygène';info.append(label,meter);row.append(helmet,info);players.append(row);
  }
  const stockSection=(title,stock)=>{const section=node('div',undefined,'hud-stock-section');section.append(node('h3',title));const grid=node('div',undefined,'hud-stock-grid');
   const visible=Object.keys(RESOURCES).filter(id=>stock?.[id]>0);if(!visible.length)visible.push('stone','gold');
   for(const id of visible){const row=node('div',undefined,'hud-resource');row.title=RESOURCES[id].name;row.append(itemIcon(id,me),node('span',id==='rare'?'Obsidiane':id==='food'?'Champignon':RESOURCES[id].name),node('strong',String(stock?.[id]||0)));grid.append(row);}section.append(grid);return section;};
  const personal=stockSection('STOCK PERSO',me.cargo),charge=node('div',undefined,'hud-charge');charge.append(node('span','Sac'),node('strong',weight(me.cargo)+' / '+capacity(me)));personal.append(charge);
  const footer=node('div',undefined,'team-footer');footer.append(node('span','E · Déposer'),node('span','B · Atelier'));hud.replaceChildren(heading,players,personal,stockSection('STOCK COMMUN',state.stock),footer);
 }
 function drawMap(){drawMineMap({state,me,node,content,button,onRoute:stopId=>act('wagon',{id:me.vehicleId,action:'route',stopId})});}
 function MACHINE_PROFILES_TITLE(){const kind=state?.installations.find(s=>s.id===machineId)?.kind;return kind==='chest'?'STOCK COMMUN':kind==='trash'?'POUBELLE':'MACHINE';}
 function render(next,player){
  state=next;me=player;if(!state||!me)return;if(mineCode!==state.code){mineCode=state.code;wallRotation=0;pendingBindings=null;selectionIndex=me.selectedSlot||0;inventorySelected=null;inventoryPage=0;barSignature='';signature='';stopDrag();}if(pendingBindings&&JSON.stringify(pendingBindings)===JSON.stringify(quickbarIds(me)))pendingBindings=null;
  bar.hidden=state.mode!=='free'||state.phase!=='running'||!me.alive;const selected=bindings()[selectionIndex],count=selected?carriedCount(me,selected):0;
  $('rotateSelected').hidden=selected!=='wall';$('rotateSelected').disabled=busy||!count;
  $('rotateSelected').textContent='R · Tourner '+(wallRotation?'↕':'↔');$('rotateSelected').title='Tourner le mur · '+(wallRotation?'Vertical':'Horizontal');
  const barSig=JSON.stringify([bindings(),selectionIndex,me.items,me.cargo,me.pickTier,busy]);if(barSig!==barSignature&&!dragId){barSignature=barSig;$('quickbarItems').replaceChildren(quickSlots());$('quickbarLabel').textContent=selected?itemName(selected,me):'Mains vides';$('buildSelected').textContent=selected==='pick'?'ESPACE · Miner':FOODS[selected]?'CLIC · Manger':selected==='shovel'?'CLIC · Terre':SEEDS[selected]?'CLIC · Semer':RESOURCES[selected]?'E · Déposer':selected?'CLIC · Poser':'Mains vides';$('buildSelected').disabled=busy||!count||selected==='pick'||!!RESOURCES[selected]&&!FOODS[selected]&&!SEEDS[selected];}
  renderTeam();
  if(!opened)return;const sig=JSON.stringify([tab,inventoryPage,tab==='build'?state.installationCounts:null,tab==='trade'||tab==='storage'?state.stock:null,tab==='trade'?state.coins:null,tab==='map'?state.world?.atlas:null,tab==='map'?[state.mapVersion,state.railVersion,me.vehicleDriver,state.players.map(p=>[p.x,p.y,p.face,p.alive]),state.installations.find(s=>s.id===me.vehicleId)?.destination]:null,me.cargo,me.items,me.inventoryOrder,me.pickTier,me.capacity,me.tank,me.vehicleId,inventorySelected,bindings(),selectionIndex,Math.floor(me.x),Math.floor(me.y),tab==='storage'?state.installations.map(s=>[s.id,s.kind,s.buffer,s.status,s.riderIds,s.automatic,Math.floor(s.energy||0)]):null,busy]);if(sig===signature||dragId||transferDraft.editing)return;signature=sig;const transferFocus=document.activeElement?.dataset?.transferKey;
  $('colonyTitle').textContent={inventory:'INVENTAIRE',build:'CONSTRUCTION',map:'CARTE DE LA MINE',storage:MACHINE_PROFILES_TITLE(),trade:'COMPTOIR'}[tab];
  for(const b of root.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));content.dataset.view=tab;content.replaceChildren();
  if(tab==='map'){drawMap();return;}
  if(tab==='inventory'){
   const summary=node('div',undefined,'inventory-summary');summary.append(node('span',`Charge du sac ${weight(me.cargo)} / ${capacity(me)}`));const meter=node('meter');meter.min=0;meter.max=capacity(me);meter.value=weight(me.cargo);meter.setAttribute('aria-label','Charge du sac');summary.append(meter,node('span',''));content.append(summary);
   const layout=node('div',undefined,'inventory-layout'),grid=node('div',undefined,'inventory-grid'),slots=inventorySlots(me);if(!slots.some(s=>s?.id===inventorySelected))inventorySelected=slots.find(Boolean)?.id||null;
   const lastSlot=slots.findLastIndex(Boolean),pages=Math.max(1,Math.ceil((lastSlot+1)/24));inventoryPage=Math.min(inventoryPage,pages-1);
   const gridWrapper=node('div',undefined,'inventory-grid-wrapper');
   for(let index=0;index<24;index++){
    const slotIndex=inventoryPage*24+index,slot=slots[slotIndex];
    const cell=node('button',undefined,'inventory-slot'+(slot&&slot.id===inventorySelected?' selected':''));cell.type='button';cell.dataset.inventorySlot=String(slotIndex);cell.setAttribute('aria-label',slot?`${itemName(slot.id,me)} · ${slot.count}`:`Case vide ${slotIndex+1}`);cell.title=slot?itemName(slot.id,me):'Case vide';cell.ondragover=e=>e.preventDefault();cell.ondrop=e=>{e.preventDefault();if(slotIndex>=slots.length)return;const ids=slots.map(s=>s?.id||null),a=ids.indexOf(dragId);stopDrag();if(a<0)return;[ids[a],ids[slotIndex]]=[ids[slotIndex],ids[a]];void act('inventory',{order:ids});};
    if(slotIndex>=slots.length)cell.disabled=true;
    if(slot){cell.append(itemIcon(slot.id,me),node('span',String(slot.count),'slot-count'));cell.draggable=true;cell.style.setProperty('--resource',RESOURCES[slot.id]?.color||'#d1b276');cell.ondragstart=e=>{dragId=slot.id;dragQuickIndex=null;e.dataTransfer?.setData('text/plain',slot.id);};cell.ondragend=stopDrag;cell.onclick=()=>{inventorySelected=slot.id;signature='';render(state,me);};}grid.append(cell);
   }
   gridWrapper.append(grid);if(pages>1){const pager=node('div',undefined,'inventory-pages');pager.append(button('Page précédente',()=>{inventoryPage--;signature='';render(state,me);},inventoryPage===0),node('span',`Page ${inventoryPage+1} / ${pages}`),button('Page suivante',()=>{inventoryPage++;signature='';render(state,me);},inventoryPage===pages-1));gridWrapper.append(pager);}
   const detail=node('aside',undefined,'inventory-detail'),slot=slots.find(s=>s?.id===inventorySelected);if(slot){detail.append(node('h3',itemName(slot.id,me)),itemIcon(slot.id,me,'detail-art'),node('p',itemDescription(slot.id,me),'item-description'),node('p',`× ${slot.count}`));const targetLabel=node('label','Emplacement','shortcut-target'),target=node('select');target.setAttribute('aria-label','Raccourci pour cet objet');for(const [index,id]of bindings().entries()){const option=node('option',`${quickbarKey(index)} · ${id?itemName(id,me):'Vide'}`);option.value=String(index);target.append(option);}target.value=String(suggestedSlot(slot.id));const equipButton=button('Assigner',()=>equip(slot.id,Number(target.value)));target.onchange=()=>{equipButton.textContent=`Assigner · ${quickbarKey(Number(target.value))}`;};targetLabel.append(target);detail.append(targetLabel,equipButton);if(FOODS[slot.id])detail.append(button('Manger · +'+FOODS[slot.id].hunger+' satiété',()=>act('eat',{food:slot.id})));}else detail.append(node('h3','Ton sac est vide'),node('p','Mine une paroi avec Espace pour récolter des ressources.'));
   const equipment=node('div',undefined,'equipment-row');for(const [id,label]of [['pick',pickName(me)],[capacity(me)>80?'pack':'pack0',`Sac ${capacity(me)}`],[me.tank?'tank':'tank0',me.tank?'Réservoir amélioré':'Réservoir standard']]){const e=node('div');e.append(itemIcon(id,me),node('small',label));equipment.append(e);}layout.append(gridWrapper,detail);content.append(layout);
   const strip=node('div',undefined,'inventory-hotbar');strip.append(node('h4','BARRE RAPIDE'),quickSlots(),node('p','Glisser · assigner / Clic droit · retirer','muted'));const equipped=node('div',undefined,'inventory-equipment');equipped.append(node('h4','ÉQUIPEMENT'),equipment);strip.append(equipped);content.append(strip);
  }
  if(tab==='build'){
   const usage=node('div',undefined,'resource-row'),counts=installationCounts(state);for(const key of ['rails','structures','plots','machines','wagons'])usage.append(node('span',`${INSTALLATION_LABELS[key]} ${counts[key]} / ${INSTALLATION_LIMITS[key]}`,'stock-chip'));content.append(node('h3','Capacité de la mine'),usage);
   const grid=node('div',undefined,'building-grid');for(const [id,b]of Object.entries(BUILDINGS)){const card=node('article',undefined,'building-tile');card.append(itemIcon(id,me,'recipe-art'),node('h3',b.name),node('p',itemDescription(id,me)));grid.append(card);}content.append(grid);
  }
  if(tab==='trade'){
   const base=Math.hypot(me.x-17.5,me.y-3.5)<2.6;content.append(node('h3',`Graines · ${state.coins||0} crédits communs`),node('p',base?'Une graine par parcelle. Les trésors apportent des crédits.':'Rejoins le comptoir à l’ascenseur.','muted'));
   const grid=node('div',undefined,'seed-shop');for(const [id,seed]of Object.entries(SEEDS)){const card=node('article',undefined,'seed-card');card.append(itemIcon(id,me,'recipe-art'),node('h3',seed.name),node('p',`${seed.price} crédits · Sac : ${me.cargo?.[id]||0}`),button('Acheter 1',()=>act('trade',{action:'buy',offer:id}),!base||(state.coins||0)<seed.price));grid.append(card);}content.append(grid);
  }
  if(tab==='storage'){const machine=state.installations.find(m=>m.id===machineId);if(!machine||Math.hypot(machine.x-me.x,machine.y-me.y)>MACHINE_REACH){content.append(node('p','Approche-toi de la machine, puis appuie sur E.'));return;}if(machine.kind==='trash'){drawTrashPanel({me,machine,node,button,content,act,draft:trashDraft,refresh:()=>{signature='';render(state,me);}});return;}drawMachinePanel({state,me,machine,node,button,content,act,draft:transferDraft,refresh:()=>{signature='';render(state,me);},openMap:()=>open('map'),openWorkshop:()=>{close();openWorkshop();}});if(transferFocus)document.getElementById(transferFocus)?.focus({preventScroll:true});}

 }
 root.addEventListener('keydown',e=>{if(e.key!=='Tab'||!e.shiftKey)return;const controls=[...root.querySelectorAll('button:not(:disabled),select,input:not(:disabled)')],i=controls.indexOf(document.activeElement);if(!controls.length)return;e.preventDefault();controls[(i+(e.shiftKey?-1:1)+controls.length)%controls.length].focus();});
 return {render,open,close,placeSelected,rotateSelected,get rotation(){return wallRotation;},selectItem:equip,get selected(){return bindings()[selectionIndex];},selectSlot,cycleSlot,get opened(){return opened;},get activeTab(){return tab;},nearMachine(){if(me?.vehicleId){releaseKeys();void act('wagon',{id:me.vehicleId,action:'exit'});return true;}if(me&&fieldAt(state,{x:Math.floor(me.x)+me.face.x,y:Math.floor(me.y)+me.face.y})?.crop)return false;const m=me&&nearestMachine(state,me);if(!m)return false;if(m.kind==='wagon'){releaseKeys();void act('wagon',{id:m.id,action:'board'});}else if(m.kind==='bench')openWorkshop();else open('storage',m.id);return true;}};
}
