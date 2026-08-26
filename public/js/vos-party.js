(()=>{function Le(t){let e=window.VOS_PWA;return e&&e.authHeaders?e.authHeaders(t||{}):t||{}}async function He(t,e){let n=await fetch(t,{cache:"no-store",...e||{},headers:Le({"Content-Type":"application/json",...(e||{}).headers||{}})}),s=await n.json().catch(()=>({}));if(!n.ok){let c=new Error(s.error||`HTTP ${n.status}`);throw c.status=n.status,c.code=s.error_code,c}return s}function P(t,e){let n=e?{...t,playerName:e}:t;return He("/api/play/op",{method:"POST",body:JSON.stringify(n)})}function ne(t,e,n){if(!t)return t;let s=JSON.parse(JSON.stringify(t)),c=n&&n.maxHp;switch(e.op){case"damage":{let r=Math.min(s.hp.temp||0,e.amount);return s.hp.temp-=r,s.hp.current!=null&&(s.hp.current=Math.max(0,s.hp.current-(e.amount-r))),s.hp.current===0?null:s}case"heal":{s.hp.current==null&&(s.hp.current=0);let r=s.hp.current+e.amount;return s.hp.current=c!=null?Math.min(r,c):r,s}case"spendSlot":{let r=String(e.level),v=((n||{}).slots||{})[r],C=(s.slots[r]||0)+1;return v!=null&&C>v?null:(s.slots[r]=C,s)}case"restoreSlot":{let r=String(e.level);return s.slots[r]=Math.max(0,(s.slots[r]||0)-1),s}case"useCharge":{let r=(s.uses[e.feature]||0)+1;return e.max!=null&&r>e.max?null:(s.uses[e.feature]=r,s)}case"restoreCharge":return s.uses[e.feature]=Math.max(0,(s.uses[e.feature]||0)-1),s;default:return null}}function oe(t,e){switch(t.op){case"damage":return{op:"setHp",value:e.hp.current,_restore:e};case"heal":return{op:"setHp",value:e.hp.current};case"setHp":return{op:"setHp",value:e.hp.current};case"setTempHp":return{op:"setTempHp",value:e.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:t.level};case"restoreSlot":return{op:"spendSlot",level:t.level};case"useCharge":return{op:"restoreCharge",feature:t.feature};case"restoreCharge":return{op:"useCharge",feature:t.feature};case"addCondition":return{op:"removeCondition",condition:t.condition};case"removeCondition":return{op:"addCondition",condition:t.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-t.delta};case"setExhaustion":return{op:"setExhaustion",value:e.exhaustion};default:return null}}var O=new Map;async function U(t){if(O.has(t))return O.get(t);let e=fetch(t,{cache:"default"}).then(n=>{if(!n.ok)throw new Error(`HTTP ${n.status}`);return n.json()}).catch(n=>{throw O.delete(t),n});return O.set(t,e),e}function W(t){return U(t)}function ie(){return U("/data/play/conditions.json")}var re={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function le(t){let e=t&&t.classes||[];for(let n of e){let s=String(n.identifier||n.name||"").toLowerCase();if(re[s])return re[s]}return null}async function ce(t){if(!t)return null;try{return await U(`/data/play/spells-${t}.json`)}catch{return null}}function ue(t,e){if(!t||!Array.isArray(t.prepared)||!e)return null;let n=t.prepared[e-1];return typeof n=="number"?n:null}function pe(){return W("/data/play/masquerade.json")}function de(){return W("/data/play/forms.json")}function me(t,e){if(!t||!e)return[];let n=new Set((t.features||[]).map(s=>(s.name||"").toLowerCase()).filter(s=>s.startsWith("maschera ")).map(s=>s.split(" ")[1]));return Object.values(e.masks).filter(s=>n.has(s.key)).sort((s,c)=>s.name.localeCompare(c.name))}function z(t){return t&&t.level>=6?3:1}function J(t,e,n){return!t||!e||!e.type?[]:(t[e.type]||[]).filter(s=>s.crValue<=n)}function R(t){let e=Math.max(0,Math.floor(t/1e3));return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`}function fe(t,e){let n=[],s=e&&e.spellcasting&&e.spellcasting.dc,c=e&&(e.abilities||[]).find(r=>r.key==="int")||null;return c&&t.abilities&&t.abilities.int!==c.score&&n.push({label:"Intelligence",value:`${c.score} (${c.mod>=0?"+":""}${c.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),s&&n.push({label:"Save DC",value:String(s),why:"Any DC in this creature's abilities uses your spell save DC."}),n.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),n}var Ae=[1,2,3,4,5,6,7,8,10,12,15,20],qe=12;function ye(t){let e=t.root,n=t.onState,s=t.playerName||null,c=t.model||null,r=t.state,v=t.limits,C=!1,w=null,E=null,A=null;function ve(){if(navigator.vibrate)try{navigator.vibrate(qe)}catch{}}async function h(o,{undoable:a=!0}={}){if(C)return;C=!0;let i=r;ve();let l=ne(r,o,v);l&&(r=l,n(r,{optimistic:!0}));try{let d=await P(o,s);r=d.state,v=d.limits||v,n(r,{note:d.note}),a&&be(o,i,d.note)}catch(d){r=i,n(r,{error:d.message}),H(d.message,{tone:"error"})}finally{C=!1}}function be(o,a,i){let l=oe(o,a);H(i||"Done",{action:l?{label:"Undo",run:()=>h(l,{undoable:!1})}:null})}let g=null,G=null;function H(o,{tone:a="",action:i=null}={}){if(g||(g=document.createElement("div"),g.className="vos-play-toast",g.setAttribute("role","status"),document.body.appendChild(g)),g.className=`vos-play-toast is-on${a?` is-${a}`:""}`,g.innerHTML='<span class="vos-play-toast-text"></span>',g.querySelector(".vos-play-toast-text").textContent=o,i){let l=document.createElement("button");l.type="button",l.className="vos-play-toast-action",l.textContent=i.label,l.addEventListener("click",()=>{I(),i.run()}),g.appendChild(l)}clearTimeout(G),G=setTimeout(I,i?6e3:3e3)}function I(){g&&g.classList.remove("is-on")}let S=null;function L(o,a,i){b(),S=document.createElement("div"),S.className="vos-play-sheet",S.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${o}">
        <div class="vos-play-sheet-head">
          <span>${o}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${a}</div>
      </div>`,document.body.appendChild(S),S.addEventListener("click",d=>{d.target.closest("[data-close]")&&b()}),i&&i(S);let l=S.querySelector("button:not([data-close])");l&&l.focus()}function b(){S&&(S.remove(),S=null)}function Q(){let o=v&&v.maxHp||0,a=r.hp.current!=null?r.hp.current:o,i=Ae.map(l=>`<button type="button" class="vos-play-num" data-amount="${l}">${l}</button>`).join("");L("Hit points",`
      <div class="vos-play-hp">
        <span class="vos-play-hp-now">${a}<i>/${o||"\u2014"}</i></span>
        ${r.hp.temp?`<span class="vos-play-hp-temp">+${r.hp.temp} temp</span>`:""}
      </div>
      <div class="vos-play-mode" role="group" aria-label="Damage or healing">
        <button type="button" class="is-on" data-mode="damage">Damage</button>
        <button type="button" data-mode="heal">Heal</button>
      </div>
      <div class="vos-play-nums">${i}</div>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="999" placeholder="Other" aria-label="Amount">
        <button type="submit">Apply</button>
      </form>
      <label class="vos-play-check"><input type="checkbox" data-critical> Critical hit</label>
      <div class="vos-play-row">
        <button type="button" class="vos-play-secondary" data-temp>Set temp HP</button>
        <button type="button" class="vos-play-secondary" data-full>Full</button>
      </div>
    `,l=>{let d="damage";l.querySelectorAll("[data-mode]").forEach(p=>{p.addEventListener("click",()=>{d=p.dataset.mode,l.querySelectorAll("[data-mode]").forEach(f=>f.classList.toggle("is-on",f===p))})});let u=()=>!!l.querySelector("[data-critical]").checked,y=p=>{p>0&&(b(),h(d==="heal"?{op:"heal",amount:p}:{op:"damage",amount:p,critical:u()}))};l.querySelectorAll("[data-amount]").forEach(p=>{p.addEventListener("click",()=>y(Number(p.dataset.amount)))}),l.querySelector(".vos-play-custom").addEventListener("submit",p=>{p.preventDefault(),y(Number(p.target.querySelector("input").value))}),l.querySelector("[data-full]").addEventListener("click",()=>{b(),h({op:"setHp",value:o})}),l.querySelector("[data-temp]").addEventListener("click",()=>{let p=Number(window.prompt("Temporary hit points",String(r.hp.temp||0)));b(),Number.isFinite(p)&&p>=0&&h({op:"setTempHp",value:p,keepHigher:!1})})})}function $e(){let o=Number(r.hitDiceSpent||0),a=v&&v.hitDice||0;L("Hit dice",`
      <p class="vos-play-note">${Math.max(0,a-o)} of ${a} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `,i=>{i.querySelector(".vos-play-custom").addEventListener("submit",l=>{l.preventDefault();let d=Number(l.target.querySelector("input").value)||0;b(),h({op:"spendHitDie",healed:d})}),i.querySelector("[data-nothing]").addEventListener("click",()=>{b(),h({op:"spendHitDie"})})})}function ge(){L("Rest",`
      <button type="button" class="vos-play-rest" data-rest="shortRest">
        <b>Short rest</b><span>30 minutes. Spend hit dice one at a time.</span>
      </button>
      <button type="button" class="vos-play-rest" data-rest="fieldRest">
        <b>Field rest</b><span>8 hours somewhere unsafe. Hit dice heal for their maximum.</span>
      </button>
      <button type="button" class="vos-play-rest is-long" data-rest="longRest">
        <b>Long rest</b><span>Everything back, and one point of exhaustion clears.</span>
      </button>
      <p class="vos-play-note">A long rest needs your own bed or a Secure place \u2014 or three
      quiet nights to establish a haven. Never inside the fog.</p>
    `,o=>{o.querySelectorAll("[data-rest]").forEach(a=>{a.addEventListener("click",()=>{let i=a.dataset.rest;i==="longRest"&&!window.confirm("Take a long rest?")||(b(),h({op:i}))})})})}let ke=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function X(){let o=new Set(r.conditions||[]),a={};try{a=await ie()}catch{}let i=ke.map(u=>{let y=a[u]||{};return`<div class="vos-play-cond-row${o.has(u)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${u}">${m(y.name||u.charAt(0).toUpperCase()+u.slice(1))}</button>
        ${y.text?`<details class="vos-play-cond-rules">
          <summary>What it does${y.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${m(y.text)}</p>
        </details>`:""}
      </div>`}).join(""),l=r.concentration,d=`<div class="vos-play-conc">
      ${l?`<span>Concentrating on <b>${m(l.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;L("Conditions",d+`<div class="vos-play-conds is-rows">${i}</div>`,u=>{u.querySelectorAll("[data-condition]").forEach(f=>{f.addEventListener("click",()=>{let $=f.dataset.condition,x=f.closest(".vos-play-cond-row"),j=!x.classList.contains("is-on");x.classList.toggle("is-on",j),h({op:j?"addCondition":"removeCondition",condition:$})})});let y=u.querySelector("[data-break]");y&&y.addEventListener("click",()=>{b(),h({op:"breakConcentration"})});let p=u.querySelector("[data-concentrate]");p&&p.addEventListener("click",()=>{let f=window.prompt("Concentrating on which spell?");b(),f&&f.trim()&&h({op:"concentrate",spell:f.trim()})})})}function m(o){return String(o??"").replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a])}async function we(){let o=c&&c.spells||[];if(!o.length){H("This character has no spells.",{tone:"error"});return}let a=await Se(),i=new Set(r.prepared||[]),l=o.map(u=>{let y=u.spells.map(p=>{let f=p.always||p.level===0,$=f||i.has(p.id),x=[p.school,...p.meta].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${$?" is-on":""}${f?" is-fixed":""}"
                       data-name="${m(p.name.toLowerCase())}">
          <input type="checkbox" data-spell="${m(p.id)}"${$?" checked":""}${f?" disabled":""}>
          <span class="vos-play-spell-name">${m(p.name)}${f?'<i title="Always available">always</i>':""}</span>
          <span class="vos-play-spell-meta">${m(x)}</span>
        </label>`}).join("");return`<h4 class="vos-play-spell-level">${m(u.label)}</h4>${y}`}).join(""),d=Z();L("Prepare spells",`
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${d}${a?` / ${a}`:""}</span>
        <input type="search" class="vos-play-search" placeholder="Search your spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Your spellbook. Cantrips and always-prepared spells do not
      count against the total.${a?` Your class prepares ${a} at this level; going over
      is allowed if something says so.`:""}</p>
      <div class="vos-play-spells">${l}</div>
    `,u=>{let y=u.querySelector("[data-count]");u.querySelectorAll("[data-spell]").forEach(f=>{f.addEventListener("change",()=>{f.closest(".vos-play-spell").classList.toggle("is-on",f.checked),h({op:"togglePrepared",spell:f.dataset.spell},{undoable:!1});let $=Z(u);y.textContent=a?`${$} / ${a}`:String($),y.classList.toggle("is-over",!!(a&&$>a))})});let p=u.querySelector(".vos-play-search");p.addEventListener("input",()=>{let f=p.value.trim().toLowerCase();u.querySelectorAll(".vos-play-spell").forEach($=>{$.hidden=!!f&&!$.dataset.name.includes(f)})})})}function Z(o){if(o)return o.querySelectorAll("[data-spell]:checked:not(:disabled)").length;let a=new Set;return(c&&c.spells||[]).forEach(i=>i.spells.forEach(l=>{(l.always||l.level===0)&&a.add(l.id)})),(r.prepared||[]).filter(i=>!a.has(i)).length}async function Se(){return w||(w=await ce(le(c)).catch(()=>null)),ue(w,c&&c.level||0)}async function B(){return E||(E=await pe().catch(()=>null)),A||(A=await de().catch(()=>null)),!!E}async function ee(){if(!await B()){H("Could not load the masks.",{tone:"error"});return}let o=me(c,E);if(!o.length){H("This character has no masks.",{tone:"error"});return}let a=r.mask,i=o.map(l=>`
      <button type="button" class="vos-play-mask${a&&a.key===l.key?" is-on":""}"
              data-mask="${m(l.key)}">
        <b>${m(l.name)}</b>
        <span>${m(l.type)} \xB7 ${J(A,l,z(c)).length} forms available</span>
      </button>`).join("");L("The Masquerade",`
      ${a?`<p class="vos-play-note">Wearing <b>${m(a.key)}</b> \u2014 ${R(a.remainingMs)}${a.paused?" (paused)":""} left.</p>`:""}
      ${i}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      ${a?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
    `,l=>{l.querySelectorAll("[data-mask]").forEach(u=>{u.addEventListener("click",()=>{let y=u.dataset.mask;b();let p=(c.abilities||[]).find(x=>x.key==="cha"),f=(c.classes||[]).filter(x=>String(x.identifier).toLowerCase()==="bard").reduce((x,j)=>x+(j.levels||0),0)||c.level||0,$=p?Math.max(0,p.mod+f):0;h({op:"donMask",mask:y,tempHp:$})})});let d=l.querySelector("[data-remove]");d&&d.addEventListener("click",()=>{b(),h({op:"removeMask"})})})}async function xe(){if(!r.mask){ee();return}if(!await B())return;let o=E.masks[r.mask.key],a=z(c),i=J(A,o,a);if(!i.length){H("No forms available for this mask.",{tone:"error"});return}let l=i.map((d,u)=>`
      <button type="button" class="vos-play-form" data-form="${u}">
        <b>${m(d.name)}</b>
        <span class="vos-play-form-cr">CR ${m(d.cr)}</span>
        <span class="vos-play-form-meta">AC ${m(d.ac)} \xB7 ${m(d.hp)} HP \xB7 ${m(d.speed)}</span>
      </button>`).join("");L(`Assume a form \u2014 ${m(o.name)}`,`
      <p class="vos-play-note">Challenge Rating ${a} or lower${c.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${l}</div>
    `,d=>{d.querySelectorAll("[data-form]").forEach(u=>{u.addEventListener("click",()=>{let y=i[Number(u.dataset.form)];b(),h({op:"assumeForm",creature:y.name,source:y.source,cr:y.cr,hp:y.hp})})})})}async function Ce(){if(!r.form||!await B())return"";let o=E.masks[r.mask?r.mask.key:""],i=(A&&o&&A[o.type]||[]).find(u=>u.name===r.form.creature);if(!i)return"";let l=fe(i,c).map(u=>`
      <div class="vos-play-override">
        <b>${m(u.label)}</b><span>${m(u.value)}</span><i>${m(u.why)}</i>
      </div>`).join(""),d=(u,y)=>u.length?`
      <h4 class="vos-play-form-h">${y}</h4>
      ${u.map(p=>`<p class="vos-play-form-entry"><b>${m(p.name)}.</b> ${m(p.text)}</p>`).join("")}`:"";return`
      <article class="vos-play-formblock">
        <header>
          <h3>${m(i.name)}</h3>
          <p>${m(i.size)} ${m(i.type)} \xB7 CR ${m(i.cr)}</p>
        </header>
        <div class="vos-play-form-vitals">
          <span><b>${m(i.ac)}</b>AC</span>
          <span><b>${m(r.form.hp)}</b>/${m(r.form.maxHp)} HP</span>
          <span><b>${m(i.speed)}</b>Speed</span>
        </div>
        <div class="vos-play-overrides">${l}</div>
        ${d(i.traits,"Traits")}
        ${d(i.actions,"Actions")}
      </article>`}function te(o){return(c&&c.activatable||[]).find(a=>a.id===o)||null}function ae(o){return!!(r.active||{})[o]}function se(o){let a=Number((r.uses||{})[o.id]||0);return Math.max(0,o.uses.max-a)}function Ee(o){let a=te(o);if(a){if(ae(o)){_(o);return}if(!se(a)){H(`No uses of ${a.name} left \u2014 a rest brings them back.`,{tone:"warn"});return}h({op:"activateFeature",feature:a.id,name:a.name,max:a.uses.max})}}function _(o){let a=te(o);if(!a)return;let i=ae(o),l=se(a);L(a.name,`
      <p class="vos-play-feature-state">${i?"Active now.":`${l} of ${a.uses.max} uses left${a.uses.recovery?`, back on a ${m(a.uses.recovery)}`:""}${a.activation?` \xB7 ${m(a.activation)}`:""}.`}</p>
      <ul class="vos-play-feature-grants">${a.grants.map(d=>`<li>${m(d)}</li>`).join("")}</ul>
      ${i?'<button type="button" class="vos-play-btn is-danger" data-feature-act="end">End it</button>':`<button type="button" class="vos-play-btn is-primary" data-feature-act="start"${l?"":" disabled"}>${l?`Use ${m(a.name)}`:"No uses left"}</button>`}
    `,d=>{let u=d.querySelector("[data-feature-act]");u&&u.addEventListener("click",()=>{b(),h(u.dataset.featureAct==="end"?{op:"endFeature",feature:a.id}:{op:"activateFeature",feature:a.id,name:a.name,max:a.uses.max})})})}function T(o){let a=o.target.closest("[data-play]");if(!(!a||!e.contains(a))&&!(o.type==="keydown"&&!["Enter"," "].includes(o.key)))switch(o.type==="keydown"&&o.preventDefault(),a.dataset.play){case"hp":Q();break;case"hitdice":$e();break;case"slot":{let i=Number(a.dataset.level),l=a.dataset.spent==="1";h({op:l?"restoreSlot":"spendSlot",level:i});break}case"pact":{if(a.dataset.spent==="1")return;h({op:"spendPactSlot"});break}case"charge":{let i=a.dataset.feature;if(!i)return;h({op:"useCharge",feature:i,max:Number(a.dataset.max)||void 0});break}case"feature":_(a.dataset.feature);break;case"end-feature":h({op:"endFeature",feature:a.dataset.feature});break;case"exhaustion":{let i=Number(a.dataset.value);h({op:"setExhaustion",value:i===r.exhaustion?i-1:i});break}case"conditions":case"condition":X();break;default:break}}return e.addEventListener("click",T),e.addEventListener("keydown",T),{apply:h,openHpPad:Q,openRests:ge,openConditions:X,openPrepare:we,openMasks:ee,openForms:xe,openFeature:_,activateFeature:Ee,formStatblockHtml:Ce,setState(o,a){r=o,a&&(v=a)},destroy(){e.removeEventListener("click",T),e.removeEventListener("keydown",T),b(),I()}}}var Me=12e3,M=document.getElementById("vos-party-root"),V=document.getElementById("vos-party-status"),F=[],Y=null,q=!1;function k(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function Ne(t=6e3){return new Promise(e=>{let n=Date.now();(function s(){if(window.VOS_PWA)return e(window.VOS_PWA);if(Date.now()-n>t)return e(null);setTimeout(s,80)})()})}function De(t){let e=window.VOS_PWA;return e&&e.authHeaders?e.authHeaders(t||{}):t||{}}async function Te(){let t=await fetch("/api/play/party",{cache:"no-store",headers:De()}),e=await t.json().catch(()=>({}));if(!t.ok){let n=new Error(e.error||`HTTP ${t.status}`);throw n.status=t.status,n}return e.party||[]}function je(t,e){if(!e||t==null)return"";let n=t/e;return t===0?"is-down":n<=.25?"is-bloodied":n<=.5?"is-hurt":""}function Pe(t){let e=t.limits&&t.limits.slots||{},n=t.state.slots||{},s=Object.keys(e).sort();return s.length?s.map(c=>{let r=e[c],v=Math.max(0,r-(n[c]||0));return`<span class="vos-party-slot${v?"":" is-empty"}">
      <i>${k(c)}</i>${v}<b>/${r}</b></span>`}).join(""):""}function Oe(t){let e=t.state,n=t.limits&&t.limits.maxHp||0,s=e.hp.current!=null?e.hp.current:n,c=n?Math.max(0,Math.min(100,s/n*100)):0,r=(e.conditions||[]).includes("dying"),v=(e.conditions||[]).filter(w=>w!=="dying"),C=Math.max(0,(t.limits&&t.limits.hitDice||0)-(e.hitDiceSpent||0));return t.hasStatblock?`<article class="vos-party-card ${je(s,n)}${r?" is-dying":""}"
                   data-player="${k(t.playerName)}">
    <header class="vos-party-head">
      <h2>${k(t.character)}</h2>
      <span class="vos-party-class">${k(t.classLine||"")}</span>
      ${t.ac!=null?`<span class="vos-party-ac">AC ${k(t.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${k(t.character)} hit points ${s} of ${n}">
      <span class="vos-party-hp-fill" style="width:${c}%"></span>
      <span class="vos-party-hp-text">
        <b>${s}</b><i>/${n||"\u2014"}</i>
        ${e.hp.temp?`<em>+${e.hp.temp}</em>`:""}
      </span>
      ${r?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${e.exhaustion?`<div class="vos-party-exh" title="\u2212${e.exhaustion*2} to d20 tests, \u2212${e.exhaustion*5} ft">
      ${Array.from({length:6},(w,E)=>`<span class="${E<e.exhaustion?"is-on":""}"></span>`).join("")}
      <b>Exhaustion ${e.exhaustion}</b>
    </div>`:""}

    ${e.mask?`<div class="vos-party-mask">
      ${k(e.form?e.form.creature:e.mask.key)} \xB7 ${R(e.mask.remainingMs)}${e.mask.paused?" paused":""}
    </div>`:""}

    ${e.concentration?`<div class="vos-party-conc">Concentrating: ${k(e.concentration.spell)}</div>`:""}

    ${Object.keys(e.active||{}).length?`<div class="vos-party-active">${Object.values(e.active).map(w=>k(w.name)).join(" \xB7 ")}</div>`:""}

    <div class="vos-party-row">
      ${Pe(t)}
      ${C?`<span class="vos-party-hd">${C} HD</span>`:""}
    </div>

    <div class="vos-party-conds">
      ${v.length?v.map(w=>`<span>${k(w)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <a class="vos-party-view" href="/sheet/?as=${encodeURIComponent(t.playerName)}"
         title="Open their sheet as they see it">View</a>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${k(t.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function K(){M.innerHTML=F.map(Oe).join("")}function N(t,e=""){V&&(V.textContent=t,V.className=`vos-party-status${e?` is-${e}`:""}`)}function Re(t){let e=F.find(n=>n.playerName===t);return e?ye({root:M,playerName:t,state:e.state,limits:e.limits,onState(n){e.state=n,K()}}):null}async function Fe(t,e){let n=e==="heal"?"Heal":"Damage",s=Number(window.prompt(`${n} ${t.character} by how much?`,"5"));if(!(!Number.isFinite(s)||s<=0))try{let c=await P({op:e==="heal"?"heal":"damage",amount:s},t.playerName);t.state=c.state,t.limits=c.limits||t.limits,K()}catch(c){N(c.message,"error")}}function Ie(t){let e=t.target.closest("[data-act]");if(!e)return;let n=e.closest("[data-player]");if(!n)return;let s=F.find(v=>v.playerName===n.dataset.player);if(!s)return;let c=e.dataset.act;if(c==="damage"||c==="heal"){Fe(s,c);return}let r=Re(s.playerName);r&&(c==="hp"&&r.openHpPad(),c==="conditions"&&r.openConditions())}async function D({quiet:t=!1}={}){t||N("Refreshing\u2026");try{F=await Te(),K(),N(`Updated ${new Date().toLocaleTimeString()}`)}catch(e){if(e.status===401||e.status===403){N("DM only.","error"),he();return}N(`Could not refresh \u2014 ${e.message}`,"error")}}function Be(){he(),Y=setInterval(()=>{!q&&!document.hidden&&D({quiet:!0})},Me)}function he(){clearInterval(Y),Y=null}document.addEventListener("visibilitychange",()=>{document.hidden||D({quiet:!0})});async function _e(){let t=await Ne(),e=t&&t.getPlayerName?t.getPlayerName():null;if(!e){M.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(e==="DM"||t&&t.isDm&&t.isDm())){M.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}M.addEventListener("click",Ie);let n=document.getElementById("vos-party-pause");n&&n.addEventListener("click",()=>{q=!q,n.textContent=q?"Resume updates":"Pause updates",n.setAttribute("aria-pressed",String(q)),q||D()});let s=document.getElementById("vos-party-refresh");s&&s.addEventListener("click",()=>D()),await D(),Be()}M&&_e();})();
