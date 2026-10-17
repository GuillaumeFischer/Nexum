// Sprite identity and harvest identity come from the same immutable table.
// Existing tile numbers stay compatible with saved mines and generator 1.
export const MINERALS=Object.freeze(Object.fromEntries([
 ['stone',1,'Pierre',3],['gold',2,'Or',2],['crystal',3,'Turquoise',2],
 ['amethyst',4,'Améthyste',2],['copper',5,'Cuivre',2],['tin',6,'Étain',2],
 ['iron',7,'Fer',2],['rare',12,'Obsidiane astrale',2]
].map(([id,tile,name,count])=>[id,Object.freeze({id,tile,name,count,asset:`assets/mineral-${id}.webp`})])));
const byTile=Object.freeze(Object.fromEntries(Object.values(MINERALS).map(m=>[m.tile,m])));
const drops=Object.freeze({...Object.fromEntries(Object.values(MINERALS).map(m=>[m.tile,Object.freeze({resource:m.id,count:m.count})])),8:Object.freeze({resource:'wood',count:2})});
export const mineralForTile=tile=>Number.isInteger(tile)?byTile[tile]:undefined;
export const dropFor=tile=>Number.isInteger(tile)?drops[tile]:undefined;
