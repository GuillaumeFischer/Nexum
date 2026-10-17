import {RESOURCES,RECIPES,recipeReason,capacity} from './progression.js';
import {itemIcon,recipeIcon,recipeCategory,itemDescription,uiNode as node} from './item-ui.js';
const nearBase=p=>Math.hypot(p.x-17.5,p.y-3.5)<2.6;
export function createBaseUI({command,releaseKeys,notify=()=>{},closeColony=()=>{}}){
 const $=id=>document.getElementById(id),panel=$('workshop');let state=null,me=null,last='',busy=false,opened=false,category='tools',selected='pick1';
 async function action(type,details){if(busy)return;busy=true;last='';render(state,me);try{await command(type,details);$('workshopNotice').textContent='';notify(type==='craft'?'Fabrication terminée. Ton équipement est prêt.':'');}catch(e){$('workshopNotice').textContent=e.message;notify(e.message);}finally{busy=false;last='';render(state,me);}}
 function open(){if(!state||state.mode!=='free')return;closeColony();releaseKeys();opened=true;panel.hidden=false;last='';render(state,me);$('closeWorkshop').focus();}
 function close(){const wasOpen=opened;opened=false;panel.hidden=true;releaseKeys();if(wasOpen)$('openWorkshop').focus();}
 $('dismantle').onclick=()=>action('dismantle');$('recoverMiner').onclick=()=>action('recover');$('openWorkshop').onclick=open;$('closeWorkshop').onclick=close;
 document.addEventListener('keydown',event=>{if(!opened||event.key!=='Tab'||!event.shiftKey)return;const buttons=[...panel.querySelectorAll('button:not([disabled])')],index=buttons.indexOf(document.activeElement);if(!buttons.length)return;event.preventDefault();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();});
 for(const [kind,id]of [['lamp','placeLamp'],['air','placeAir'],['drill','placeDrill']])$(id).onclick=()=>action('place',{kind});
 for(const b of panel.querySelectorAll('[data-category]'))b.onclick=()=>{category=b.dataset.category;selected=RECIPES.find(r=>recipeCategory(r)===category)?.id;last='';render(state,me);};
 function chips(stock){return Object.entries(RESOURCES).map(([id,r])=>{const chip=node('span',undefined,'stock-chip illustrated-stock');chip.style.setProperty('--resource',r.color);chip.append(itemIcon(id,me),node('span',r.name),node('strong',String(stock?.[id]||0)));chip.title=r.name;if(!stock?.[id])chip.className+=' empty-stock';return chip;});}
 function render(next,player){
  state=next;me=player;if(!state||!me)return;
  $('recoverMiner').hidden=state.mode!=='free'||me.alive;$('openWorkshop').hidden=state.mode!=='free';$('dismantle').disabled=busy||!(state.installations||[]).some(item=>Math.hypot(item.x-me.x,item.y-me.y)<1.6);$('buildTools').hidden=state.mode!=='free'||!me.alive||state.phase!=='running';
  for(const [kind,id,key,label]of [['lamp','placeLamp','F','Torche'],['air','placeAir','R','Relais d’air'],['drill','placeDrill','G','Foreuse']]){const count=me.items?.[kind]||0;$(id).textContent=`${key} · ${label} (${count})`;$(id).disabled=!count||busy;}
  if(!opened)return;
  const atWorkshop=nearBase(me)||state.installations?.some(s=>s.kind==='bench'&&Math.hypot(s.x-me.x,s.y-me.y)<2.2);
  const signature=JSON.stringify([category,selected,state.stock,state.base,me.cargo,me.pickTier,me.items,me.capacity,me.tank,me.alive,atWorkshop,state.phase,busy]);if(signature===last)return;last=signature;
  $('baseStatus').textContent=atWorkshop?'':'Ascenseur ou établi requis';
  $('commonStock').replaceChildren(...chips(state.stock));
  $('equipmentSummary').textContent=`Pioche ${['de départ','renforcée','de profondeur','en acier'][me.pickTier||0]} · Sac ${me.bag} / ${capacity(me)} · Réservoir ${me.tank?'amélioré':'standard'}`;
  for(const b of panel.querySelectorAll('[data-category]'))b.setAttribute('aria-pressed',String(b.dataset.category===category));
  const order=['pick1','pickCopper','pick2','pack','tank','foundry','pickIron','pick3'];
  const recipes=RECIPES.filter(r=>recipeCategory(r)===category).sort((a,b)=>(order.indexOf(a.id)<0?100:order.indexOf(a.id))-(order.indexOf(b.id)<0?100:order.indexOf(b.id)));
  const reason=r=>recipeReason(r,state,me)||(state.phase!=='running'?'Ouvre d’abord la mine.':'')||(!atWorkshop?'Rejoins un atelier.':'');
  const cards=recipes.map(r=>{const why=reason(r),card=node('button',undefined,'recipe-tile'+(selected===r.id?' selected':''));card.type='button';card.dataset.recipe=r.id;card.setAttribute('aria-pressed',String(selected===r.id));card.title=r.name+' · '+(why||'Disponible');card.append(itemIcon(recipeIcon(r),me,'recipe-art'),node('strong',r.name),node('span',why.startsWith('Déjà')?'✓ Équipé':why==='Stock commun insuffisant.'?'Matériaux manquants':why?'À débloquer':'✓ Disponible','recipe-status '+(why?'locked':'available')));card.onclick=()=>{selected=r.id;last='';render(state,me);};return card;});
  $('recipes').replaceChildren(...cards);
  const recipe=RECIPES.find(r=>r.id===selected)||recipes[0],detail=$('recipeDetail');detail.replaceChildren();if(recipe){
   detail.append(node('h3',recipe.name),itemIcon(recipeIcon(recipe),me,'detail-art'),node('p',recipe.item?itemDescription(recipe.item,me):recipe.description,'item-description'),node('h4','MATÉRIAUX REQUIS'));
   for(const [id,n]of Object.entries(recipe.cost)){const available=state.stock?.[id]||0,row=node('div',undefined,'ingredient '+(available>=n?'satisfied':'missing'));row.append(itemIcon(id,me),node('span',RESOURCES[id].name),node('strong',`${available} / ${n}`),node('span',available>=n?'✓':'−','ingredient-status'));detail.append(row);}
   const why=reason(recipe),button=node('button',busy?'Fabrication…':'Fabriquer','primary craft-button');button.type='button';button.disabled=busy||!!why;button.dataset.craft=recipe.id;button.onclick=()=>action('craft',{recipe:recipe.id});detail.append(button);if(why)detail.append(node('p',why,'craft-reason'));
  }
  $('progressGoal').textContent=!me.pickTier?'Objectif : pioche renforcée':!state.base?.foundry?'Objectif : atelier de forge':me.pickTier<2?'Objectif : pioche de profondeur':'';
 }
 return {open,close,render,get opened(){return opened;},dismantle(){if(!busy)return action('dismantle');},place(kind){if(!busy)return action('place',{kind});}};
}
