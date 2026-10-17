import fs from 'node:fs/promises';
import path from 'node:path';
const root='games/deep-miners/client',target=path.join(root,'assets/fonts');
await fs.mkdir(target,{recursive:true});
const response=await fetch('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap',{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('Polices indisponibles.');
let css=await response.text(),index=0;
for(const match of css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/g)){
  const name='font-'+(++index)+'.ttf',font=await fetch(match[1],{signal:AbortSignal.timeout(20000)});
  if(!font.ok)throw Error('Police indisponible.');
  await fs.writeFile(path.join(target,name),Buffer.from(await font.arrayBuffer()));
  css=css.replace(match[0],`url('assets/fonts/${name}')`);
}
if(index!==7)throw Error('Le fournisseur a changé le format des polices.');
for(const family of ['barlowcondensed','dmsans']){
  const licence=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`);
  if(!licence.ok)throw Error('Licence de police indisponible.');
  await fs.writeFile(path.join(target,'LICENSE-'+family+'.txt'),await licence.text());
}
const file=path.join(root,'style.css'),style=await fs.readFile(file,'utf8');
await fs.writeFile(file,style.replace(/^@import[^\n]+\r?\n/,css+'\n'));
console.log('Sept polices et leurs licences sont incluses dans le jeu.');
