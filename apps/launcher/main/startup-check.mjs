import fs from "node:fs/promises";

// Only invoked by the local startup verification, with its own temporary profile.
export async function verifyStartup({ app, window, state, report }) {
  const renderer = await window.webContents.executeJavaScript(`(async()=>{
    await document.fonts.ready;
    for(const file of ['nexum-mark.svg','nexum-mine-hero.png','nexum-worlds.png']){const image=new Image();image.src=new URL('../assets/'+file,location.href);await image.decode();}
    document.getElementById('joinNav').click();const multiplayer=!document.getElementById('joinSection').hidden;
    document.getElementById('settingsNav').click();const settings=!document.getElementById('settings').hidden;
    document.getElementById('downloadsNav').click();const downloads=!document.getElementById('downloads').hidden;
    const search=document.getElementById('search');search.value='___aucun_jeu___';search.dispatchEvent(new Event('input'));const searchWorks=!document.getElementById('emptySearch').hidden&&document.querySelectorAll('.game-card').length===0;
    search.value='';search.dispatchEvent(new Event('input'));document.getElementById('homeNav').click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {title:document.title,bridge:typeof window.atelier?.invoke==='function',cards:document.querySelectorAll('.game-card').length,
      profile:document.getElementById('profileLabel')?.textContent,notice:document.getElementById('notice')?.textContent,
      multiplayer,settings,downloads,searchWorks,fonts:document.fonts.check('12px Inter')&&document.fonts.check('12px Outfit'),
      noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,heroVisible:!document.getElementById('home').hidden};
  })()`);
  const result = {
    version: app.getVersion(),
    visible: window.isVisible(),
    games: state.games.length,
    renderer,
  };
  const ok =
    result.visible &&
    result.games > 0 &&
    renderer.title === "NEXUM" &&
    renderer.bridge &&
    renderer.cards === result.games &&
    renderer.profile === state.profileName &&
    renderer.multiplayer &&
    renderer.settings &&
    renderer.downloads &&
    renderer.searchWorks &&
    renderer.fonts &&
    renderer.noHorizontalOverflow &&
    renderer.heroVisible;
  await fs.writeFile(report, JSON.stringify({ ...result, ok }, null, 2));
  app.exit(ok ? 0 : 1);
}
