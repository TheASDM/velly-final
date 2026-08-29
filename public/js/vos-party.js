(()=>{function Ue(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function _e(a,t){let i=await fetch(a,{cache:"no-store",...t||{},headers:Ue({"Content-Type":"application/json",...(t||{}).headers||{}})}),o=await i.json().catch(()=>({}));if(!i.ok){let r=new Error(o.error||`HTTP ${i.status}`);throw r.status=i.status,r.code=o.error_code,r}return o}function j(a,t){let i=t?{...a,playerName:t}:a;return _e("/api/play/op",{method:"POST",body:JSON.stringify(i)})}function pe(a,t,i){if(!a)return a;let o=JSON.parse(JSON.stringify(a)),r=i&&i.maxHp;switch(t.op){case"damage":{let l=Math.min(o.hp.temp||0,t.amount);return o.hp.temp-=l,o.hp.current!=null&&(o.hp.current=Math.max(0,o.hp.current-(t.amount-l))),o.hp.current===0?null:o}case"heal":{o.hp.current==null&&(o.hp.current=0);let l=o.hp.current+t.amount;return o.hp.current=r!=null?Math.min(l,r):l,o}case"spendSlot":{let l=String(t.level),v=((i||{}).slots||{})[l],E=(o.slots[l]||0)+1;return v!=null&&E>v?null:(o.slots[l]=E,o)}case"restoreSlot":{let l=String(t.level);return o.slots[l]=Math.max(0,(o.slots[l]||0)-1),o}case"useCharge":{let l=(o.uses[t.feature]||0)+1;return t.max!=null&&l>t.max?null:(o.uses[t.feature]=l,t.tempHp!=null&&(o.hp.temp=Math.max(o.hp.temp||0,t.tempHp)),o)}case"restoreCharge":return o.uses[t.feature]=Math.max(0,(o.uses[t.feature]||0)-1),o;case"spendPactSlot":{let l=(i||{}).pact,v=(o.pact||0)+1;return l!=null&&v>l?null:(o.pact=v,o)}case"restorePactSlot":return o.pact=Math.max(0,(o.pact||0)-1),o;default:return null}}function de(a,t){switch(a.op){case"damage":return{op:"setHp",value:t.hp.current,_restore:t};case"heal":return{op:"setHp",value:t.hp.current};case"setHp":return{op:"setHp",value:t.hp.current};case"setTempHp":return{op:"setTempHp",value:t.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:a.level};case"restoreSlot":return{op:"spendSlot",level:a.level};case"spendPactSlot":return{op:"restorePactSlot"};case"restorePactSlot":return{op:"spendPactSlot"};case"useCharge":return{op:"restoreCharge",feature:a.feature};case"restoreCharge":return{op:"useCharge",feature:a.feature};case"addCondition":return{op:"removeCondition",condition:a.condition};case"removeCondition":return{op:"addCondition",condition:a.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-a.delta};case"setExhaustion":return{op:"setExhaustion",value:t.exhaustion};default:return null}}var F=new Map;async function W(a){if(F.has(a))return F.get(a);let t=fetch(a,{cache:"default"}).then(i=>{if(!i.ok)throw new Error(`HTTP ${i.status}`);return i.json()}).catch(i=>{throw F.delete(a),i});return F.set(a,t),t}function J(a){return W(a)}function fe(){return W("/data/play/conditions.json")}var me={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function ye(a){let t=a&&a.classes||[];for(let i of t){let o=String(i.identifier||i.name||"").toLowerCase();if(me[o])return me[o]}return null}async function he(a){if(!a)return null;try{return await W(`/data/play/spells-${a}.json`)}catch{return null}}function ve(a,t){if(!a||!Array.isArray(a.prepared)||!t)return null;let i=a.prepared[t-1];return typeof i=="number"?i:null}function be(){return J("/data/play/masquerade.json")}function $e(){return J("/data/play/forms.json")}function ge(a,t){if(!a||!t)return[];let i=new Set((a.features||[]).map(o=>(o.name||"").toLowerCase()).filter(o=>o.startsWith("maschera ")).map(o=>o.split(" ")[1]));return Object.values(t.masks).filter(o=>i.has(o.key)).sort((o,r)=>o.name.localeCompare(r.name))}function V(a){return a&&a.level>=6?3:1}function Y(a,t,i){return!a||!t||!t.type?[]:(a[t.type]||[]).filter(o=>o.crValue<=i)}function O(a){let t=Math.max(0,Math.floor(a/1e3));return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}function ke(a,t){let i=[],o=t&&t.spellcasting&&t.spellcasting.dc,r=t&&(t.abilities||[]).find(l=>l.key==="int")||null;return r&&a.abilities&&a.abilities.int!==r.score&&i.push({label:"Intelligence",value:`${r.score} (${r.mod>=0?"+":""}${r.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),o&&i.push({label:"Save DC",value:String(o),why:"Any DC in this creature's abilities uses your spell save DC."}),i.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),i}var ze=[1,2,3,4,5,6,7,8,10,12,15,20],We=12;function we(a){let t=a.root,i=a.onState,o=a.playerName||null,r=a.model||null,l=a.state,v=a.limits,E=!1,S=null,L=null,N=null;function xe(){if(navigator.vibrate)try{navigator.vibrate(We)}catch{}}async function f(s,{undoable:e=!0}={}){if(E)return!1;E=!0;let n=l;xe();let c=pe(l,s,v);c&&(l=c,i(l,{optimistic:!0}));try{let u=await j(s,o);return l=u.state,v=u.limits||v,i(l,{note:u.note}),e&&Ce(s,n,u.note),!0}catch(u){return l=n,i(l,{error:u.message}),$(u.message,{tone:"error"}),!1}finally{E=!1}}function Ce(s,e,n){let c=de(s,e);$(n||"Done",{action:c?{label:"Undo",run:()=>f(c,{undoable:!1})}:null})}let k=null,Z=null;function $(s,{tone:e="",action:n=null}={}){if(k||(k=document.createElement("div"),k.className="vos-play-toast",k.setAttribute("role","status"),document.body.appendChild(k)),k.className=`vos-play-toast is-on${e?` is-${e}`:""}`,k.innerHTML='<span class="vos-play-toast-text"></span>',k.querySelector(".vos-play-toast-text").textContent=s,n){let c=document.createElement("button");c.type="button",c.className="vos-play-toast-action",c.textContent=n.label,c.addEventListener("click",()=>{B(),n.run()}),k.appendChild(c)}clearTimeout(Z),Z=setTimeout(B,n?6e3:3e3)}function B(){k&&k.classList.remove("is-on")}let x=null;function C(s,e,n){b(),x=document.createElement("div"),x.className="vos-play-sheet",x.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${s}">
        <div class="vos-play-sheet-head">
          <span>${s}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${e}</div>
      </div>`,document.body.appendChild(x),x.addEventListener("click",u=>{u.target.closest("[data-close]")&&b()}),n&&n(x);let c=x.querySelector("button:not([data-close])");c&&c.focus()}function b(){x&&(x.remove(),x=null)}function X(){let s=v&&v.maxHp||0,e=l.hp.current!=null?l.hp.current:s,n=ze.map(c=>`<button type="button" class="vos-play-num" data-amount="${c}">${c}</button>`).join("");C("Hit points",`
      <div class="vos-play-hp">
        <span class="vos-play-hp-now">${e}<i>/${s||"\u2014"}</i></span>
        ${l.hp.temp?`<span class="vos-play-hp-temp">+${l.hp.temp} temp</span>`:""}
      </div>
      <div class="vos-play-mode" role="group" aria-label="Damage or healing">
        <button type="button" class="is-on" data-mode="damage">Damage</button>
        <button type="button" data-mode="heal">Heal</button>
      </div>
      <div class="vos-play-nums">${n}</div>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="999" placeholder="Other" aria-label="Amount">
        <button type="submit">Apply</button>
      </form>
      <label class="vos-play-check"><input type="checkbox" data-critical> Critical hit</label>
      <div class="vos-play-row">
        <button type="button" class="vos-play-secondary" data-temp>Set temp HP</button>
        <button type="button" class="vos-play-secondary" data-full>Full</button>
      </div>
    `,c=>{let u="damage";c.querySelectorAll("[data-mode]").forEach(m=>{m.addEventListener("click",()=>{u=m.dataset.mode,c.querySelectorAll("[data-mode]").forEach(h=>h.classList.toggle("is-on",h===m))})});let p=()=>!!c.querySelector("[data-critical]").checked,y=m=>{m>0&&(b(),f(u==="heal"?{op:"heal",amount:m}:{op:"damage",amount:m,critical:p()}))};c.querySelectorAll("[data-amount]").forEach(m=>{m.addEventListener("click",()=>y(Number(m.dataset.amount)))}),c.querySelector(".vos-play-custom").addEventListener("submit",m=>{m.preventDefault(),y(Number(m.target.querySelector("input").value))}),c.querySelector("[data-full]").addEventListener("click",()=>{b(),f({op:"setHp",value:s})}),c.querySelector("[data-temp]").addEventListener("click",()=>{let m=Number(window.prompt("Temporary hit points",String(l.hp.temp||0)));b(),Number.isFinite(m)&&m>=0&&f({op:"setTempHp",value:m,keepHigher:!1})})})}function Ee(){let s=Number(l.hitDiceSpent||0),e=v&&v.hitDice||0;C("Hit dice",`
      <p class="vos-play-note">${Math.max(0,e-s)} of ${e} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `,n=>{n.querySelector(".vos-play-custom").addEventListener("submit",c=>{c.preventDefault();let u=Number(c.target.querySelector("input").value)||0;b(),f({op:"spendHitDie",healed:u})}),n.querySelector("[data-nothing]").addEventListener("click",()=>{b(),f({op:"spendHitDie"})})})}function Le(){let s=r&&r.pactRecovery;if(!s||!(v&&v.pact))return"";let e=Math.max(0,s.uses.max-Number((l.uses||{})[s.id]||0));return`<button type="button" class="vos-play-rest" data-pact-rite${e?"":" disabled"}>
      <b>${d(s.name)}</b><span>${e?"A 1-minute rite. Regain up to half your pact slots, rounded up.":"Spent \u2014 a long rest brings it back."}</span>
    </button>`}async function Ne(){let s=r.pactRecovery,e=Number(l.pact||0);if(!e){$("No pact slots are spent.",{tone:"warn"});return}let n=Math.min(e,Math.ceil((v.pact||0)/2));if(await f({op:"useCharge",feature:s.id,max:s.uses.max},{undoable:!1})){for(let c=0;c<n;c+=1)await f({op:"restorePactSlot"},{undoable:!1});$(`${s.name} \u2014 ${n} pact slot${n===1?"":"s"} regained.`)}}function He(){C("Rest",`
      <button type="button" class="vos-play-rest" data-rest="shortRest">
        <b>Short rest</b><span>30 minutes. Spend hit dice one at a time.</span>
      </button>
      <button type="button" class="vos-play-rest" data-rest="fieldRest">
        <b>Field rest</b><span>8 hours somewhere unsafe. Hit dice heal for their maximum.</span>
      </button>
      <button type="button" class="vos-play-rest is-long" data-rest="longRest">
        <b>Long rest</b><span>Everything back, and one point of exhaustion clears.</span>
      </button>
      ${Le()}
      <p class="vos-play-note">A long rest needs your own bed or a Secure place \u2014 or three
      quiet nights to establish a haven. Never inside the fog.</p>
    `,s=>{s.querySelectorAll("[data-rest]").forEach(n=>{n.addEventListener("click",()=>{let c=n.dataset.rest;c==="longRest"&&!window.confirm("Take a long rest?")||(b(),f({op:c}))})});let e=s.querySelector("[data-pact-rite]");e&&e.addEventListener("click",()=>{b(),Ne()})})}let Ae=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function ee(){let s=new Set(l.conditions||[]),e={};try{e=await fe()}catch{}let n=Ae.map(p=>{let y=e[p]||{};return`<div class="vos-play-cond-row${s.has(p)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${p}">${d(y.name||p.charAt(0).toUpperCase()+p.slice(1))}</button>
        ${y.text?`<details class="vos-play-cond-rules">
          <summary>What it does${y.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${d(y.text)}</p>
        </details>`:""}
      </div>`}).join(""),c=l.concentration,u=`<div class="vos-play-conc">
      ${c?`<span>Concentrating on <b>${d(c.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;C("Conditions",u+`<div class="vos-play-conds is-rows">${n}</div>`,p=>{p.querySelectorAll("[data-condition]").forEach(h=>{h.addEventListener("click",()=>{let g=h.dataset.condition,H=h.closest(".vos-play-cond-row"),z=!H.classList.contains("is-on");H.classList.toggle("is-on",z),f({op:z?"addCondition":"removeCondition",condition:g})})});let y=p.querySelector("[data-break]");y&&y.addEventListener("click",()=>{b(),f({op:"breakConcentration"})});let m=p.querySelector("[data-concentrate]");m&&m.addEventListener("click",()=>{let h=window.prompt("Concentrating on which spell?");b(),h&&h.trim()&&f({op:"concentrate",spell:h.trim()})})})}function d(s){return String(s??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}async function Me(){let s=r&&r.spells||[];if(!s.length){$("This character has no spells.",{tone:"error"});return}let e=await qe(),n=new Set(l.prepared||[]),c=s.map(p=>{let y=p.spells.map(m=>{let h=m.always||m.level===0,g=h||n.has(m.id),H=[m.school,...m.meta].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${g?" is-on":""}${h?" is-fixed":""}"
                       data-name="${d(m.name.toLowerCase())}">
          <input type="checkbox" data-spell="${d(m.id)}"${g?" checked":""}${h?" disabled":""}>
          <span class="vos-play-spell-name">${d(m.name)}${h?'<i title="Always available">always</i>':""}</span>
          <span class="vos-play-spell-meta">${d(H)}</span>
        </label>`}).join("");return`<h4 class="vos-play-spell-level">${d(p.label)}</h4>${y}`}).join(""),u=te();C("Prepare spells",`
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${u}${e?` / ${e}`:""}</span>
        <input type="search" class="vos-play-search" placeholder="Search your spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Your spellbook. Cantrips and always-prepared spells do not
      count against the total.${e?` Your class prepares ${e} at this level; going over
      is allowed if something says so.`:""}</p>
      <div class="vos-play-spells">${c}</div>
    `,p=>{let y=p.querySelector("[data-count]");p.querySelectorAll("[data-spell]").forEach(h=>{h.addEventListener("change",()=>{h.closest(".vos-play-spell").classList.toggle("is-on",h.checked),f({op:"togglePrepared",spell:h.dataset.spell},{undoable:!1});let g=te(p);y.textContent=e?`${g} / ${e}`:String(g),y.classList.toggle("is-over",!!(e&&g>e))})});let m=p.querySelector(".vos-play-search");m.addEventListener("input",()=>{let h=m.value.trim().toLowerCase();p.querySelectorAll(".vos-play-spell").forEach(g=>{g.hidden=!!h&&!g.dataset.name.includes(h)})})})}function te(s){if(s)return s.querySelectorAll("[data-spell]:checked:not(:disabled)").length;let e=new Set;return(r&&r.spells||[]).forEach(n=>n.spells.forEach(c=>{(c.always||c.level===0)&&e.add(c.id)})),(l.prepared||[]).filter(n=>!e.has(n)).length}async function qe(){return S||(S=await he(ye(r)).catch(()=>null)),ve(S,r&&r.level||0)}async function U(){return L||(L=await be().catch(()=>null)),N||(N=await $e().catch(()=>null)),!!L}async function ae(){if(!await U()){$("Could not load the masks.",{tone:"error"});return}let s=ge(r,L);if(!s.length){$("This character has no masks.",{tone:"error"});return}let e=l.mask,n=se(),c=s.map(u=>`
      <button type="button" class="vos-play-mask${e&&e.key===u.key?" is-on":""}"
              data-mask="${d(u.key)}">
        <b>${d(u.name)}</b>
        <span>${d(u.type)} \xB7 ${Y(N,u,V(r)).length} forms available</span>
      </button>`).join("");C("The Masquerade",`
      ${e?`<p class="vos-play-note">Wearing <b>${d(e.key)}</b> \u2014 ${O(e.remainingMs)}${e.paused?" (paused)":""} left.</p>`:""}
      ${n!=null?`<p class="vos-play-note">${n} of ${r.maskUses.uses.max} donnings left today.</p>`:""}
      ${c}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      ${e?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
    `,u=>{u.querySelectorAll("[data-mask]").forEach(y=>{y.addEventListener("click",async()=>{let m=y.dataset.mask;if(b(),se()===0){$("No mask donnings left \u2014 a long rest brings them back.",{tone:"warn"});return}let h=(r.abilities||[]).find(q=>q.key==="cha"),g=(r.classes||[]).filter(q=>String(q.identifier).toLowerCase()==="bard").reduce((q,Be)=>q+(Be.levels||0),0)||r.level||0,H=h?Math.max(0,h.mod+g):0;await f({op:"donMask",mask:m,tempHp:H})&&r.maskUses&&f({op:"useCharge",feature:r.maskUses.id,max:r.maskUses.uses.max},{undoable:!1})})});let p=u.querySelector("[data-remove]");p&&p.addEventListener("click",()=>{b(),f({op:"removeMask"})})})}function se(){let s=r&&r.maskUses;return s?Math.max(0,s.uses.max-Number((l.uses||{})[s.id]||0)):null}async function Pe(){if(!l.mask){ae();return}if(!await U())return;let s=L.masks[l.mask.key],e=V(r),n=Y(N,s,e);if(!n.length){$("No forms available for this mask.",{tone:"error"});return}let c=n.map((u,p)=>`
      <button type="button" class="vos-play-form" data-form="${p}">
        <b>${d(u.name)}</b>
        <span class="vos-play-form-cr">CR ${d(u.cr)}</span>
        <span class="vos-play-form-meta">AC ${d(u.ac)} \xB7 ${d(u.hp)} HP \xB7 ${d(u.speed)}</span>
      </button>`).join("");C(`Assume a form \u2014 ${d(s.name)}`,`
      <p class="vos-play-note">Challenge Rating ${e} or lower${r.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${c}</div>
    `,u=>{u.querySelectorAll("[data-form]").forEach(p=>{p.addEventListener("click",()=>{let y=n[Number(p.dataset.form)];b(),f({op:"assumeForm",creature:y.name,source:y.source,cr:y.cr,hp:y.hp})})})})}async function De(){if(!l.form||!await U())return"";let s=L.masks[l.mask?l.mask.key:""],n=(N&&s&&N[s.type]||[]).find(p=>p.name===l.form.creature);if(!n)return"";let c=ke(n,r).map(p=>`
      <div class="vos-play-override">
        <b>${d(p.label)}</b><span>${d(p.value)}</span><i>${d(p.why)}</i>
      </div>`).join(""),u=(p,y)=>p.length?`
      <h4 class="vos-play-form-h">${y}</h4>
      ${p.map(m=>`<p class="vos-play-form-entry"><b>${d(m.name)}.</b> ${d(m.text)}</p>`).join("")}`:"";return`
      <article class="vos-play-formblock">
        <header>
          <h3>${d(n.name)}</h3>
          <p>${d(n.size)} ${d(n.type)} \xB7 CR ${d(n.cr)}</p>
        </header>
        <div class="vos-play-form-vitals">
          <span><b>${d(n.ac)}</b>AC</span>
          <span><b>${d(l.form.hp)}</b>/${d(l.form.maxHp)} HP</span>
          <span><b>${d(n.speed)}</b>Speed</span>
        </div>
        <div class="vos-play-overrides">${c}</div>
        ${u(n.traits,"Traits")}
        ${u(n.actions,"Actions")}
      </article>`}function ne(s){return(r&&r.activatable||[]).find(e=>e.id===s)||null}function oe(s){return!!(l.active||{})[s]}function re(s){let e=Number((l.uses||{})[s.id]||0);return Math.max(0,s.uses.max-e)}function Te(s){let e=ne(s);if(e){if(oe(s)){_(s);return}if(!re(e)){$(`No uses of ${e.name} left \u2014 a rest brings them back.`,{tone:"warn"});return}f({op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})}}function _(s){let e=ne(s);if(!e)return;let n=oe(s),c=re(e);C(e.name,`
      <p class="vos-play-feature-state">${n?"Active now.":`${c} of ${e.uses.max} uses left${e.uses.recovery?`, back on a ${d(e.uses.recovery)}`:""}${e.activation?` \xB7 ${d(e.activation)}`:""}.`}</p>
      <ul class="vos-play-feature-grants">${e.grants.map(u=>`<li>${d(u)}</li>`).join("")}</ul>
      ${(e.related||[]).length?`<p class="vos-play-note">Riding on it: ${e.related.map(u=>`<b>${d(u.name)}</b>`).join(", ")} \u2014 their text is under Features.</p>`:""}
      ${n?'<button type="button" class="vos-play-btn is-danger" data-feature-act="end">End it</button>':`<button type="button" class="vos-play-btn is-primary" data-feature-act="start"${c?"":" disabled"}>${c?`Use ${d(e.name)}`:"No uses left"}</button>`}
    `,u=>{let p=u.querySelector("[data-feature-act]");p&&p.addEventListener("click",()=>{b(),f(p.dataset.featureAct==="end"?{op:"endFeature",feature:e.id}:{op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})})})}function T(s,e){return Math.max(0,e-Number((l.uses||{})[s]||0))}function Re({id:s,name:e,max:n,tempHp:c}){if(!T(s,n)){$(`No uses of ${e} left \u2014 a rest brings them back.`,{tone:"warn"});return}let u={op:"useCharge",feature:s,max:n};c&&(u.tempHp=c),f(u)}function le(s){return(r&&r.freeCasts||[]).find(e=>e.id===s)||null}function ie(s){let e=l.concentration;return!!(s.concentration&&e&&e.spell===s.spellName)}async function ce(s){let e=le(s);if(e){if(ie(e)||!T(e.id,e.uses.max)){ue(s);return}e.concentration&&!await f({op:"concentrate",spell:e.spellName},{undoable:!1})||(await f({op:"useCharge",feature:e.id,max:e.uses.max},{undoable:!1}),$(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`))}}function je(s){return!s.spellLevel||!(r&&r.spellcasting)?null:(r.spellcasting.slots||[]).filter(e=>!e.pact&&e.level>=s.spellLevel).find(e=>Math.max(0,e.max-Number((l.slots||{})[String(e.level)]||0))>0)||null}function Fe(s){for(let e of r&&r.spells||[]){let n=e.spells.find(c=>c.id===s);if(n)return n.description||""}return""}function ue(s){let e=le(s);if(!e)return;let n=ie(e),c=T(e.id,e.uses.max),u=!n&&!c?je(e):null;C(e.spellName,`
      <p class="vos-play-feature-state">${n?`Active now \u2014 concentrating on ${d(e.spellName)}.`:`${c} of ${e.uses.max} free casts left${e.uses.recovery?`, back on a ${d(e.uses.recovery)}`:""} \u2014 ${d(e.featureName)}.`}</p>
      ${n?`<button type="button" class="vos-play-btn is-danger" data-cast-act="end">End ${d(e.spellName)}</button>`:`<button type="button" class="vos-play-btn is-primary" data-cast-act="free"${c?"":" disabled"}>${c?"Cast \u2014 no slot spent":"No free casts left"}</button>`}
      ${u?`<button type="button" class="vos-play-btn" data-cast-act="slot"
          data-level="${u.level}">Cast with a level ${u.level} slot</button>`:""}
      <div class="vos-play-rules">${Fe(e.spellId)}</div>
    `,p=>{p.querySelectorAll("[data-cast-act]").forEach(y=>{y.addEventListener("click",async()=>{let m=y.dataset.castAct;if(b(),m==="end"){f({op:"breakConcentration"});return}if(m==="free"){ce(s);return}if(m==="slot"){if(!await f({op:"spendSlot",level:Number(y.dataset.level)},{undoable:!1}))return;e.concentration&&await f({op:"concentrate",spell:e.spellName},{undoable:!1}),$(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`)}})})})}function Oe(s){let e=(r&&r.features||[]).find(n=>n.id===s);e&&C(e.name,`
      <p class="vos-play-feature-state">Once per turn \u2014 no uses to spend.</p>
      <div class="vos-play-rules">${e.description||""}</div>
    `)}async function Ie(){let s=r&&r.zeroHpRescue;!s||!T(s.id,s.uses.max)||await f({op:"useCharge",feature:s.id,max:s.uses.max},{undoable:!1})&&(await f({op:"heal",amount:1},{undoable:!1}),await f({op:"adjustExhaustion",delta:-1},{undoable:!1}),$(`${s.name} \u2014 up at 1 hit point.`))}function R(s){let e=s.target.closest("[data-play]");if(!(!e||!t.contains(e))&&!(s.type==="keydown"&&!["Enter"," "].includes(s.key)))switch(s.type==="keydown"&&s.preventDefault(),e.dataset.play){case"hp":X();break;case"hitdice":Ee();break;case"slot":{let n=Number(e.dataset.level),c=e.dataset.spent==="1";f({op:c?"restoreSlot":"spendSlot",level:n});break}case"pact":{f({op:e.dataset.spent==="1"?"restorePactSlot":"spendPactSlot"});break}case"charge":{let n=e.dataset.feature;if(!n)return;f({op:"useCharge",feature:n,max:Number(e.dataset.max)||void 0});break}case"charge-pip":{let n=e.dataset.feature;if(!n)return;f(e.dataset.spent==="1"?{op:"restoreCharge",feature:n}:{op:"useCharge",feature:n,max:Number(e.dataset.max)||void 0});break}case"feature":_(e.dataset.feature);break;case"end-feature":f({op:"endFeature",feature:e.dataset.feature});break;case"exhaustion":{let n=Number(e.dataset.value);f({op:"setExhaustion",value:n===l.exhaustion?n-1:n});break}case"conditions":case"condition":ee();break;default:break}}return t.addEventListener("click",R),t.addEventListener("keydown",R),{apply:f,openHpPad:X,openRests:He,openConditions:ee,openPrepare:Me,openMasks:ae,openForms:Pe,openFeature:_,activateFeature:Te,spendCharge:Re,castFreeSpell:ce,openFreeCast:ue,openPerTurnRule:Oe,rescueFromZero:Ie,formStatblockHtml:De,setState(s,e){l=s,e&&(v=e)},destroy(){t.removeEventListener("click",R),t.removeEventListener("keydown",R),b(),B()}}}var Je=12e3,M=document.getElementById("vos-party-root"),K=document.getElementById("vos-party-status"),I=[],G=null,A=!1;function w(a){return String(a??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}function Ve(a=6e3){return new Promise(t=>{let i=Date.now();(function o(){if(window.VOS_PWA)return t(window.VOS_PWA);if(Date.now()-i>a)return t(null);setTimeout(o,80)})()})}function Ye(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function Ke(){let a=await fetch("/api/play/party",{cache:"no-store",headers:Ye()}),t=await a.json().catch(()=>({}));if(!a.ok){let i=new Error(t.error||`HTTP ${a.status}`);throw i.status=a.status,i}return t.party||[]}function Ge(a,t){if(!t||a==null)return"";let i=a/t;return a===0?"is-down":i<=.25?"is-bloodied":i<=.5?"is-hurt":""}function Qe(a){let t=a.limits&&a.limits.slots||{},i=a.state.slots||{},o=Object.keys(t).sort();return o.length?o.map(r=>{let l=t[r],v=Math.max(0,l-(i[r]||0));return`<span class="vos-party-slot${v?"":" is-empty"}">
      <i>${w(r)}</i>${v}<b>/${l}</b></span>`}).join(""):""}function Ze(a){let t=a.state,i=a.limits&&a.limits.maxHp||0,o=t.hp.current!=null?t.hp.current:i,r=i?Math.max(0,Math.min(100,o/i*100)):0,l=(t.conditions||[]).includes("dying"),v=(t.conditions||[]).filter(S=>S!=="dying"),E=Math.max(0,(a.limits&&a.limits.hitDice||0)-(t.hitDiceSpent||0));return a.hasStatblock?`<article class="vos-party-card ${Ge(o,i)}${l?" is-dying":""}"
                   data-player="${w(a.playerName)}">
    <header class="vos-party-head">
      <h2>${w(a.character)}</h2>
      <span class="vos-party-class">${w(a.classLine||"")}</span>
      ${a.ac!=null?`<span class="vos-party-ac">AC ${w(a.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${w(a.character)} hit points ${o} of ${i}">
      <span class="vos-party-hp-fill" style="width:${r}%"></span>
      <span class="vos-party-hp-text">
        <b>${o}</b><i>/${i||"\u2014"}</i>
        ${t.hp.temp?`<em>+${t.hp.temp}</em>`:""}
      </span>
      ${l?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${t.exhaustion?`<div class="vos-party-exh" title="\u2212${t.exhaustion*2} to d20 tests, \u2212${t.exhaustion*5} ft">
      ${Array.from({length:6},(S,L)=>`<span class="${L<t.exhaustion?"is-on":""}"></span>`).join("")}
      <b>Exhaustion ${t.exhaustion}</b>
    </div>`:""}

    ${t.mask?`<div class="vos-party-mask">
      ${w(t.form?t.form.creature:t.mask.key)} \xB7 ${O(t.mask.remainingMs)}${t.mask.paused?" paused":""}
    </div>`:""}

    ${t.concentration?`<div class="vos-party-conc">Concentrating: ${w(t.concentration.spell)}</div>`:""}

    ${Object.keys(t.active||{}).length?`<div class="vos-party-active">${Object.values(t.active).map(S=>w(S.name)).join(" \xB7 ")}</div>`:""}

    <div class="vos-party-row">
      ${Qe(a)}
      ${E?`<span class="vos-party-hd">${E} HD</span>`:""}
    </div>

    <div class="vos-party-conds">
      ${v.length?v.map(S=>`<span>${w(S)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <a class="vos-party-view" href="/sheet/?as=${encodeURIComponent(a.playerName)}"
         title="Open their sheet as they see it">View</a>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${w(a.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function Q(){M.innerHTML=I.map(Ze).join("")}function P(a,t=""){K&&(K.textContent=a,K.className=`vos-party-status${t?` is-${t}`:""}`)}function Xe(a){let t=I.find(i=>i.playerName===a);return t?we({root:M,playerName:a,state:t.state,limits:t.limits,onState(i){t.state=i,Q()}}):null}async function et(a,t){let i=t==="heal"?"Heal":"Damage",o=Number(window.prompt(`${i} ${a.character} by how much?`,"5"));if(!(!Number.isFinite(o)||o<=0))try{let r=await j({op:t==="heal"?"heal":"damage",amount:o},a.playerName);a.state=r.state,a.limits=r.limits||a.limits,Q()}catch(r){P(r.message,"error")}}function tt(a){let t=a.target.closest("[data-act]");if(!t)return;let i=t.closest("[data-player]");if(!i)return;let o=I.find(v=>v.playerName===i.dataset.player);if(!o)return;let r=t.dataset.act;if(r==="damage"||r==="heal"){et(o,r);return}let l=Xe(o.playerName);l&&(r==="hp"&&l.openHpPad(),r==="conditions"&&l.openConditions())}async function D({quiet:a=!1}={}){a||P("Refreshing\u2026");try{I=await Ke(),Q(),P(`Updated ${new Date().toLocaleTimeString()}`)}catch(t){if(t.status===401||t.status===403){P("DM only.","error"),Se();return}P(`Could not refresh \u2014 ${t.message}`,"error")}}function at(){Se(),G=setInterval(()=>{!A&&!document.hidden&&D({quiet:!0})},Je)}function Se(){clearInterval(G),G=null}document.addEventListener("visibilitychange",()=>{document.hidden||D({quiet:!0})});async function st(){let a=await Ve(),t=a&&a.getPlayerName?a.getPlayerName():null;if(!t){M.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(t==="DM"||a&&a.isDm&&a.isDm())){M.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}M.addEventListener("click",tt);let i=document.getElementById("vos-party-pause");i&&i.addEventListener("click",()=>{A=!A,i.textContent=A?"Resume updates":"Pause updates",i.setAttribute("aria-pressed",String(A)),A||D()});let o=document.getElementById("vos-party-refresh");o&&o.addEventListener("click",()=>D()),await D(),at()}M&&st();})();
