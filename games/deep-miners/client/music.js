// Playback starts from a user gesture, as required by browser autoplay rules.
export function createMusic(audio,storage,buttons){
  audio.loop=true;audio.volume=.1;audio.preload='none';
  let enabled=true,pending=false,blocked=false;
  try{enabled=storage.getItem('dm-music')!=='off';}catch{}
  function render(){for(const button of buttons){button.textContent=enabled?(blocked?'Lancer la musique':'Musique : oui'):'Musique : non';button.setAttribute('aria-pressed',String(enabled));button.title='Musique en boucle · volume 10 %';}}
  function start(){
    if(!enabled||pending||!audio.paused)return;
    pending=true;
    try{Promise.resolve(audio.play()).then(()=>{pending=false;blocked=false;if(!enabled)audio.pause();render();},()=>{pending=false;blocked=true;render();});}
    catch{pending=false;blocked=true;render();}
  }
  function toggle(){
    if(enabled&&blocked){start();return;}
    enabled=!enabled;blocked=false;
    try{storage.setItem('dm-music',enabled?'on':'off');}catch{}
    if(enabled)start();else audio.pause();render();
  }
  for(const button of buttons)button.onclick=()=>{toggle();button.blur?.();};
  render();return {start,toggle};
}
