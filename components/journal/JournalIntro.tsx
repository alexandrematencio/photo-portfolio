/**
 * L'entrée de l'accueil du journal, au CHARGEMENT seulement (essai du
 * 2026-10-27, demande Alexandre) — la cascade de « Page Transition Loader »
 * (codepen.io/ARS/pen/wavXgQ), sans son loader (disque orange + anneaux,
 * retiré à sa demande), ramenée à 1,5 s au plus.
 *
 * Le titre arrive en `scale` avec le recul-dépassement du pen ; chaque bloc
 * visible se déroule ensuite de gauche à droite, du haut vers le bas (le
 * `scaleX` des barres du pen, en `clip-path` pour ne pas écraser le texte).
 *
 * Script inline plutôt que composant client : il part au `DOMContentLoaded`,
 * sans attendre l'hydratation. Jusque-là, un `body::after` couleur de page
 * (une `<style>` posée dans `<head>`, aucun nœud dans le body) évite que la
 * page se montre une frame avant de disparaître. Les éléments sont animés par
 * la Web Animations API, qui ne touche à aucun attribut — rien que
 * l'hydratation puisse contester.
 *
 * Une navigation interne n'exécute pas un `<script>` rendu par React : l'entrée
 * ne joue qu'au chargement. `prefers-reduced-motion` : rien ne joue.
 */

const POP = 300; // le titre
const WIPE = 220; // chaque bloc
const STEP = 60; // décalage maximal entre deux blocs
const END = 1500; // tout est en place

// La courbe du pen pour les blocs : un recul sous 0, un dépassement au-delà de 1.
const POP_EASE = 'cubic-bezier(0.87, -0.41, 0.19, 1.44)';

function introScript(): string {
  return `(function(){var me=document.currentScript,cover;try{
if(!matchMedia('(prefers-reduced-motion: no-preference)').matches||!me||!document.body.animate)return;
cover=document.createElement('style');
cover.textContent='body::after{content:"";position:fixed;inset:0;z-index:2147483000;background:var(--color-bg)}';
document.head.appendChild(cover);
setTimeout(function(){cover.remove();},${END});
function go(){try{var H=innerHeight,root=me.parentElement&&me.parentElement.querySelector('article');if(!root)return;
var h1=root.querySelector(':scope>header>h1'),list=[];
root.querySelectorAll(':scope>header>*:not(h1),:scope>div>div,:scope>div>aside>*,:scope>div>section>:not(ol),:scope>div>section>ol>li').forEach(function(el){
var r=el.getBoundingClientRect();if(r.height&&r.top<H&&r.bottom>0)list.push([r.top,el]);});
list.sort(function(x,y){return x[0]-y[0];});
var n=list.length,step=Math.min(${STEP},(${END - WIPE - STEP})/Math.max(1,n-1));
if(h1)h1.animate([{transform:'scale(0)',transformOrigin:'0 60%'},{transform:'scale(1)',transformOrigin:'0 60%'}],
{duration:${POP},easing:'${POP_EASE}',fill:'backwards'});
list.forEach(function(x,i){x[1].animate([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],
{delay:${STEP}+i*step,duration:${WIPE},easing:'cubic-bezier(.25,1,.5,1)',fill:'backwards'});});
}finally{cover.remove();}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
}catch(e){if(cover)cover.remove();}})();`;
}

export function JournalIntro() {
  return <script dangerouslySetInnerHTML={{ __html: introScript() }} />;
}
