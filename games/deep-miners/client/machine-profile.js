export const COMMON_STOCK_CAPACITY=50000;
export const MACHINE_REACH=1.35;
export const MACHINE_PROFILES={
 trash:{title:'Poubelle',inputs:[],outputs:[],help:'Jette les objets et les ressources de ton sac après confirmation. La destruction est définitive.'},
 chest:{title:'Stock commun',help:'Tous les coffres donnent accès au même stock partagé avec la base.'},
 furnace:{title:'Four',inputs:['iron','wood'],outputs:['steel'],help:'2 fers + 1 bois → 1 acier. Relie le four à une source d’énergie.'},
 generator:{title:'Générateur',inputs:['wood'],outputs:[],help:'Le bois alimente les machines voisines.'},
 drill:{title:'Foreuse',inputs:[],outputs:['stone','gold','crystal','amethyst','copper','tin','iron','wood','rare'],help:'La caisse reçoit uniquement le minerai extrait. Énergie requise.'},
 farm:{title:'Culture de champignons',inputs:[],outputs:['food'],help:'Récolte les champignons produits ici.'},
 stove:{title:'Cuisinière',inputs:['carrot','potato','tomato','wheat','food','wood'],outputs:[],help:'Dépose les ingrédients ici ou utilise ceux de ton sac pour préparer un plat.'},
 battery:{title:'Batterie',inputs:[],outputs:[],help:'Stocke jusqu’à 60 unités d’énergie du réseau.'},
 conveyor:{title:'Convoyeur',help:'Transporte les objets vers sa sortie.'},
 arm:{title:'Bras mécanique',help:'Transfère les objets de l’arrière vers l’avant. Énergie requise.'},
 sorter:{title:'Trieur',help:'Choisis la ressource à envoyer vers la sortie.'},
 wagon:{title:'Wagon',help:'E : monter ou descendre. Carte : choisir une destination. Le conducteur peut reprendre la conduite avec ZQSD.'},
 bench:{title:'Établi',inputs:[],outputs:[],help:'Ouvre l’atelier pour fabriquer avec le stock commun.'},
 air:{title:'Relais d’oxygène',inputs:[],outputs:[],help:'Recharge automatiquement l’air des mineurs à proximité.'}
};
export function acceptsResource(machine,id){const inputs=MACHINE_PROFILES[machine.kind]?.inputs;return inputs===undefined||inputs.includes(id);}
export function nearestMachine(world,p){const distance=m=>Math.hypot(p.x-m.x,p.y-m.y),near=(world.installations||[]).filter(m=>MACHINE_PROFILES[m.kind]&&distance(m)<=MACHINE_REACH);if(!near.length)return null;const min=Math.min(...near.map(distance)),face=p.face||{x:0,y:1},forward=m=>(m.x-p.x)*face.x+(m.y-p.y)*face.y;return near.filter(m=>distance(m)<=min+.12).sort((a,b)=>forward(b)-forward(a)||distance(a)-distance(b)||a.id-b.id)[0];}
