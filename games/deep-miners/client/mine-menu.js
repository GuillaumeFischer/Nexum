export function createMineMenu({root,registry,server,onResume,onOpen,onDeleted,onChange,notify}){
 const list=document.getElementById('mineMenuList'),message=document.getElementById('mineMenuMessage'),refresh=document.getElementById('refreshMines');let opened=false,busy=false,returnFocus=null;
 const node=(tag,text,className)=>{const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;};
 function button(text,action){const b=node('button',text);b.type='button';b.onclick=action;return b;}
 async function request(action,extra={}){
  const origin=new URL(server()).origin,credentials=registry.list().filter(mine=>mine.server===origin).map(({code,token})=>({code,token}));
  const response=await fetch(origin+'/api/mines',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,credentials,reconnectKey:registry.reconnectKey(),...extra}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Gestion des mines indisponible.');return {data,origin};
 }
 function card(mine,origin){
  const row=node('article','','mine-card'),heading=node('h3',mine.title),details=node('p',mine.code+' · '+(mine.practice?'Solo':'Entre amis')+' · '+mine.players+' mineur'+(mine.players>1?'s':''));
  const date=new Date(mine.updatedAt);const stamp=node('p','Dernière sauvegarde : '+(Number.isNaN(date.getTime())?'inconnue':date.toLocaleString('fr-FR')),'mine-date');
  const actions=node('div','','mine-actions');actions.append(button('Reprendre',()=>{close();onResume({...mine,server:origin});}),button('Copier le code',async()=>{try{await navigator.clipboard.writeText(mine.code);notify('Code copié : '+mine.code);}catch{notify('Code : '+mine.code);}}));
  if(mine.canManage){
   actions.append(button('Renommer',()=>{const editor=node('div','','mine-edit'),input=document.createElement('input');input.value=mine.title;input.maxLength=40;input.setAttribute('aria-label','Nom de la mine '+mine.code);
    const save=button('Enregistrer',async()=>{save.disabled=true;try{await request('rename',{code:mine.code,token:mine.token,title:input.value});await load();}catch(error){message.textContent=error.message;save.disabled=false;}});
    editor.append(input,save,button('Annuler',()=>editor.remove()));row.append(editor);input.focus();}));
   actions.append(button('Supprimer',()=>{if(row.querySelector?.('.mine-delete-confirm'))return;const confirmation=node('div','','mine-delete-confirm');confirmation.append(node('p','Supprimer définitivement « '+mine.title+' » ? Les personnages, objets et constructions de cette mine seront effacés pour tous ses joueurs.'));
    const confirm=button('Supprimer définitivement',async()=>{confirm.disabled=true;try{await request('delete',{code:mine.code,token:mine.token,confirm:mine.code});registry.forget(mine.code,origin);onDeleted(mine.code,origin);onChange();await load();notify('Mine '+mine.code+' supprimée.');}catch(error){message.textContent=error.message;confirm.disabled=false;}});confirm.className='danger';confirmation.append(confirm,button('Annuler',()=>confirmation.remove()));row.append(confirmation);confirm.focus();}));
  }else actions.append(node('span','Mine partagée · gestion réservée au créateur','mine-date'));
  row.append(heading,details,stamp,actions);return row;
 }
 async function load(){if(busy)return;busy=true;refresh.disabled=true;message.textContent='Chargement des mines…';try{
  const {data,origin}=await request('list');for(const code of data.missing||[])registry.forget(code,origin);onChange();
  list.replaceChildren(...data.mines.map(mine=>card(mine,origin)));message.textContent=data.mines.length?data.mines.length+' mine'+(data.mines.length>1?'s':''):'Aucune mine enregistrée. Crée une nouvelle mine pour commencer.';
 }catch(error){message.textContent=error.message;}finally{busy=false;refresh.disabled=false;}}
 function open(){returnFocus=document.activeElement;onOpen();opened=true;root.hidden=false;document.querySelector('main').inert=true;document.querySelector('header').inert=true;document.getElementById('closeMineMenu').focus();void load();}
 function close(){opened=false;root.hidden=true;document.querySelector('main').inert=false;document.querySelector('header').inert=false;returnFocus?.focus();}
 refresh.onclick=load;document.getElementById('closeMineMenu').onclick=close;
 addEventListener('keydown',event=>{if(!opened)return;if(event.code==='Escape'){event.preventDefault();close();}else if(event.code==='Tab'){
  const focusable=[...root.querySelectorAll('button:not(:disabled),input')],index=focusable.indexOf(document.activeElement);if(event.shiftKey&&(index<=0)){event.preventDefault();focusable.at(-1)?.focus();}else if(!event.shiftKey&&(index<0||index===focusable.length-1)){event.preventDefault();focusable[0]?.focus();}
 }event.stopImmediatePropagation();},{capture:true});
 return {open,close,get opened(){return opened;}};
}
