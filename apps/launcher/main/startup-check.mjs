import fs from 'node:fs/promises';

// Only invoked by the local startup verification, with its own temporary profile.
export async function verifyStartup({app,window,state,report}) {
  const renderer=await window.webContents.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({
    title:document.title,
    bridge:typeof window.atelier?.invoke==='function',
    cards:document.querySelectorAll('.game-card').length,
    profile:document.getElementById('profileLabel')?.textContent,
    notice:document.getElementById('notice')?.textContent
  }))))`);
  const result={version:app.getVersion(),visible:window.isVisible(),games:state.games.length,renderer};
  const ok=result.visible&&result.games>0&&renderer.bridge&&renderer.cards===result.games&&renderer.profile===state.profileName;
  await fs.writeFile(report,JSON.stringify({...result,ok},null,2));
  app.exit(ok?0:1);
}
