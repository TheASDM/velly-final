(()=>{function kt(e){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(e||{}):e||{}}async function St(e,t){let s=await fetch(e,{cache:"no-store",...t||{},headers:kt({"Content-Type":"application/json",...(t||{}).headers||{}})}),a=await s.json().catch(()=>({}));if(!s.ok){let i=new Error(a.error||`HTTP ${s.status}`);throw i.status=s.status,i.code=a.error_code,i}return a}function j(e,t){let s=t?{...e,playerName:t}:e;return St("/api/play/op",{method:"POST",body:JSON.stringify(s)})}function tt(e,t,s){if(!e)return e;let a=JSON.parse(JSON.stringify(e)),i=s&&s.maxHp;switch(t.op){case"damage":{let n=Math.min(a.hp.temp||0,t.amount);return a.hp.temp-=n,a.hp.current!=null&&(a.hp.current=Math.max(0,a.hp.current-(t.amount-n))),a.hp.current===0?null:a}case"heal":{a.hp.current==null&&(a.hp.current=0);let n=a.hp.current+t.amount;return a.hp.current=i!=null?Math.min(n,i):n,a}case"spendSlot":{let n=String(t.level),f=((s||{}).slots||{})[n],C=(a.slots[n]||0)+1;return f!=null&&C>f?null:(a.slots[n]=C,a)}case"restoreSlot":{let n=String(t.level);return a.slots[n]=Math.max(0,(a.slots[n]||0)-1),a}case"useCharge":{let n=(a.uses[t.feature]||0)+1;return t.max!=null&&n>t.max?null:(a.uses[t.feature]=n,a)}case"restoreCharge":return a.uses[t.feature]=Math.max(0,(a.uses[t.feature]||0)-1),a;default:return null}}function et(e,t){switch(e.op){case"damage":return{op:"setHp",value:t.hp.current,_restore:t};case"heal":return{op:"setHp",value:t.hp.current};case"setHp":return{op:"setHp",value:t.hp.current};case"setTempHp":return{op:"setTempHp",value:t.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:e.level};case"restoreSlot":return{op:"spendSlot",level:e.level};case"useCharge":return{op:"restoreCharge",feature:e.feature};case"restoreCharge":return{op:"useCharge",feature:e.feature};case"addCondition":return{op:"removeCondition",condition:e.condition};case"removeCondition":return{op:"addCondition",condition:e.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-e.delta};case"setExhaustion":return{op:"setExhaustion",value:t.exhaustion};default:return null}}var R=new Map;async function _(e){if(R.has(e))return R.get(e);let t=fetch(e,{cache:"default"}).then(s=>{if(!s.ok)throw new Error(`HTTP ${s.status}`);return s.json()}).catch(s=>{throw R.delete(e),s});return R.set(e,t),t}function U(e){return _(e)}function st(){return _("/data/play/conditions.json")}var at={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function nt(e){let t=e&&e.classes||[];for(let s of t){let a=String(s.identifier||s.name||"").toLowerCase();if(at[a])return at[a]}return null}async function ot(e){if(!e)return null;try{return await _(`/data/play/spells-${e}.json`)}catch{return null}}function rt(e,t){if(!e||!Array.isArray(e.prepared)||!t)return null;let s=e.prepared[t-1];return typeof s=="number"?s:null}function lt(){return U("/data/play/masquerade.json")}function it(){return U("/data/play/forms.json")}function ct(e,t){if(!e||!t)return[];let s=new Set((e.features||[]).map(a=>(a.name||"").toLowerCase()).filter(a=>a.startsWith("maschera ")).map(a=>a.split(" ")[1]));return Object.values(t.masks).filter(a=>s.has(a.key)).sort((a,i)=>a.name.localeCompare(i.name))}function W(e){return e&&e.level>=6?3:1}function z(e,t,s){return!e||!t||!t.type?[]:(e[t.type]||[]).filter(a=>a.crValue<=s)}function O(e){let t=Math.max(0,Math.floor(e/1e3));return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}function ut(e,t){let s=[],a=t&&t.spellcasting&&t.spellcasting.dc,i=t&&(t.abilities||[]).find(n=>n.key==="int")||null;return i&&e.abilities&&e.abilities.int!==i.score&&s.push({label:"Intelligence",value:`${i.score} (${i.mod>=0?"+":""}${i.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),a&&s.push({label:"Save DC",value:String(a),why:"Any DC in this creature's abilities uses your spell save DC."}),s.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),s}var Ct=[1,2,3,4,5,6,7,8,10,12,15,20],xt=12;function pt(e){let t=e.root,s=e.onState,a=e.playerName||null,i=e.model||null,n=e.state,f=e.limits,C=!1,x=null,E=null,H=null;function mt(){if(navigator.vibrate)try{navigator.vibrate(xt)}catch{}}async function v(c,{undoable:o=!0}={}){if(C)return;C=!0;let r=n;mt();let l=tt(n,c,f);l&&(n=l,s(n,{optimistic:!0}));try{let d=await j(c,a);n=d.state,f=d.limits||f,s(n,{note:d.note}),o&&ht(c,r,d.note)}catch(d){n=r,s(n,{error:d.message}),q(d.message,{tone:"error"})}finally{C=!1}}function ht(c,o,r){let l=et(c,o);q(r||"Done",{action:l?{label:"Undo",run:()=>v(l,{undoable:!1})}:null})}let g=null,K=null;function q(c,{tone:o="",action:r=null}={}){if(g||(g=document.createElement("div"),g.className="vos-play-toast",g.setAttribute("role","status"),document.body.appendChild(g)),g.className=`vos-play-toast is-on${o?` is-${o}`:""}`,g.innerHTML='<span class="vos-play-toast-text"></span>',g.querySelector(".vos-play-toast-text").textContent=c,r){let l=document.createElement("button");l.type="button",l.className="vos-play-toast-action",l.textContent=r.label,l.addEventListener("click",()=>{F(),r.run()}),g.appendChild(l)}clearTimeout(K),K=setTimeout(F,r?6e3:3e3)}function F(){g&&g.classList.remove("is-on")}let w=null;function L(c,o,r){b(),w=document.createElement("div"),w.className="vos-play-sheet",w.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${c}">
        <div class="vos-play-sheet-head">
          <span>${c}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${o}</div>
      </div>`,document.body.appendChild(w),w.addEventListener("click",d=>{d.target.closest("[data-close]")&&b()}),r&&r(w);let l=w.querySelector("button:not([data-close])");l&&l.focus()}function b(){w&&(w.remove(),w=null)}function G(){let c=f&&f.maxHp||0,o=n.hp.current!=null?n.hp.current:c,r=Ct.map(l=>`<button type="button" class="vos-play-num" data-amount="${l}">${l}</button>`).join("");L("Hit points",`
      <div class="vos-play-hp">
        <span class="vos-play-hp-now">${o}<i>/${c||"\u2014"}</i></span>
        ${n.hp.temp?`<span class="vos-play-hp-temp">+${n.hp.temp} temp</span>`:""}
      </div>
      <div class="vos-play-mode" role="group" aria-label="Damage or healing">
        <button type="button" class="is-on" data-mode="damage">Damage</button>
        <button type="button" data-mode="heal">Heal</button>
      </div>
      <div class="vos-play-nums">${r}</div>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="999" placeholder="Other" aria-label="Amount">
        <button type="submit">Apply</button>
      </form>
      <label class="vos-play-check"><input type="checkbox" data-critical> Critical hit</label>
      <div class="vos-play-row">
        <button type="button" class="vos-play-secondary" data-temp>Set temp HP</button>
        <button type="button" class="vos-play-secondary" data-full>Full</button>
      </div>
    `,l=>{let d="damage";l.querySelectorAll("[data-mode]").forEach(p=>{p.addEventListener("click",()=>{d=p.dataset.mode,l.querySelectorAll("[data-mode]").forEach(h=>h.classList.toggle("is-on",h===p))})});let u=()=>!!l.querySelector("[data-critical]").checked,y=p=>{p>0&&(b(),v(d==="heal"?{op:"heal",amount:p}:{op:"damage",amount:p,critical:u()}))};l.querySelectorAll("[data-amount]").forEach(p=>{p.addEventListener("click",()=>y(Number(p.dataset.amount)))}),l.querySelector(".vos-play-custom").addEventListener("submit",p=>{p.preventDefault(),y(Number(p.target.querySelector("input").value))}),l.querySelector("[data-full]").addEventListener("click",()=>{b(),v({op:"setHp",value:c})}),l.querySelector("[data-temp]").addEventListener("click",()=>{let p=Number(window.prompt("Temporary hit points",String(n.hp.temp||0)));b(),Number.isFinite(p)&&p>=0&&v({op:"setTempHp",value:p,keepHigher:!1})})})}function yt(){let c=Number(n.hitDiceSpent||0),o=f&&f.hitDice||0;L("Hit dice",`
      <p class="vos-play-note">${Math.max(0,o-c)} of ${o} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `,r=>{r.querySelector(".vos-play-custom").addEventListener("submit",l=>{l.preventDefault();let d=Number(l.target.querySelector("input").value)||0;b(),v({op:"spendHitDie",healed:d})}),r.querySelector("[data-nothing]").addEventListener("click",()=>{b(),v({op:"spendHitDie"})})})}function ft(){L("Rest",`
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
    `,c=>{c.querySelectorAll("[data-rest]").forEach(o=>{o.addEventListener("click",()=>{let r=o.dataset.rest;r==="longRest"&&!window.confirm("Take a long rest?")||(b(),v({op:r}))})})})}let vt=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function Q(){let c=new Set(n.conditions||[]),o={};try{o=await st()}catch{}let r=vt.map(u=>{let y=o[u]||{};return`<div class="vos-play-cond-row${c.has(u)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${u}">${m(y.name||u.charAt(0).toUpperCase()+u.slice(1))}</button>
        ${y.text?`<details class="vos-play-cond-rules">
          <summary>What it does${y.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${m(y.text)}</p>
        </details>`:""}
      </div>`}).join(""),l=n.concentration,d=`<div class="vos-play-conc">
      ${l?`<span>Concentrating on <b>${m(l.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;L("Conditions",d+`<div class="vos-play-conds is-rows">${r}</div>`,u=>{u.querySelectorAll("[data-condition]").forEach(h=>{h.addEventListener("click",()=>{let $=h.dataset.condition,k=h.closest(".vos-play-cond-row"),P=!k.classList.contains("is-on");k.classList.toggle("is-on",P),v({op:P?"addCondition":"removeCondition",condition:$})})});let y=u.querySelector("[data-break]");y&&y.addEventListener("click",()=>{b(),v({op:"breakConcentration"})});let p=u.querySelector("[data-concentrate]");p&&p.addEventListener("click",()=>{let h=window.prompt("Concentrating on which spell?");b(),h&&h.trim()&&v({op:"concentrate",spell:h.trim()})})})}function m(c){return String(c??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o])}async function bt(){let c=i&&i.spells||[];if(!c.length){q("This character has no spells.",{tone:"error"});return}let o=await $t(),r=new Set(n.prepared||[]),l=c.map(u=>{let y=u.spells.map(p=>{let h=p.always||p.level===0,$=h||r.has(p.id),k=[p.school,...p.meta].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${$?" is-on":""}${h?" is-fixed":""}"
                       data-name="${m(p.name.toLowerCase())}">
          <input type="checkbox" data-spell="${m(p.id)}"${$?" checked":""}${h?" disabled":""}>
          <span class="vos-play-spell-name">${m(p.name)}${h?'<i title="Always available">always</i>':""}</span>
          <span class="vos-play-spell-meta">${m(k)}</span>
        </label>`}).join("");return`<h4 class="vos-play-spell-level">${m(u.label)}</h4>${y}`}).join(""),d=X();L("Prepare spells",`
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${d}${o?` / ${o}`:""}</span>
        <input type="search" class="vos-play-search" placeholder="Search your spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Your spellbook. Cantrips and always-prepared spells do not
      count against the total.${o?` Your class prepares ${o} at this level; going over
      is allowed if something says so.`:""}</p>
      <div class="vos-play-spells">${l}</div>
    `,u=>{let y=u.querySelector("[data-count]");u.querySelectorAll("[data-spell]").forEach(h=>{h.addEventListener("change",()=>{h.closest(".vos-play-spell").classList.toggle("is-on",h.checked),v({op:"togglePrepared",spell:h.dataset.spell},{undoable:!1});let $=X(u);y.textContent=o?`${$} / ${o}`:String($),y.classList.toggle("is-over",!!(o&&$>o))})});let p=u.querySelector(".vos-play-search");p.addEventListener("input",()=>{let h=p.value.trim().toLowerCase();u.querySelectorAll(".vos-play-spell").forEach($=>{$.hidden=!!h&&!$.dataset.name.includes(h)})})})}function X(c){if(c)return c.querySelectorAll("[data-spell]:checked:not(:disabled)").length;let o=new Set;return(i&&i.spells||[]).forEach(r=>r.spells.forEach(l=>{(l.always||l.level===0)&&o.add(l.id)})),(n.prepared||[]).filter(r=>!o.has(r)).length}async function $t(){return x||(x=await ot(nt(i)).catch(()=>null)),rt(x,i&&i.level||0)}async function B(){return E||(E=await lt().catch(()=>null)),H||(H=await it().catch(()=>null)),!!E}async function Z(){if(!await B()){q("Could not load the masks.",{tone:"error"});return}let c=ct(i,E);if(!c.length){q("This character has no masks.",{tone:"error"});return}let o=n.mask,r=c.map(l=>`
      <button type="button" class="vos-play-mask${o&&o.key===l.key?" is-on":""}"
              data-mask="${m(l.key)}">
        <b>${m(l.name)}</b>
        <span>${m(l.type)} \xB7 ${z(H,l,W(i)).length} forms available</span>
      </button>`).join("");L("The Masquerade",`
      ${o?`<p class="vos-play-note">Wearing <b>${m(o.key)}</b> \u2014 ${O(o.remainingMs)}${o.paused?" (paused)":""} left.</p>`:""}
      ${r}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      ${o?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
    `,l=>{l.querySelectorAll("[data-mask]").forEach(u=>{u.addEventListener("click",()=>{let y=u.dataset.mask;b();let p=(i.abilities||[]).find(k=>k.key==="cha"),h=(i.classes||[]).filter(k=>String(k.identifier).toLowerCase()==="bard").reduce((k,P)=>k+(P.levels||0),0)||i.level||0,$=p?Math.max(0,p.mod+h):0;v({op:"donMask",mask:y,tempHp:$})})});let d=l.querySelector("[data-remove]");d&&d.addEventListener("click",()=>{b(),v({op:"removeMask"})})})}async function gt(){if(!n.mask){Z();return}if(!await B())return;let c=E.masks[n.mask.key],o=W(i),r=z(H,c,o);if(!r.length){q("No forms available for this mask.",{tone:"error"});return}let l=r.map((d,u)=>`
      <button type="button" class="vos-play-form" data-form="${u}">
        <b>${m(d.name)}</b>
        <span class="vos-play-form-cr">CR ${m(d.cr)}</span>
        <span class="vos-play-form-meta">AC ${m(d.ac)} \xB7 ${m(d.hp)} HP \xB7 ${m(d.speed)}</span>
      </button>`).join("");L(`Assume a form \u2014 ${m(c.name)}`,`
      <p class="vos-play-note">Challenge Rating ${o} or lower${i.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${l}</div>
    `,d=>{d.querySelectorAll("[data-form]").forEach(u=>{u.addEventListener("click",()=>{let y=r[Number(u.dataset.form)];b(),v({op:"assumeForm",creature:y.name,source:y.source,cr:y.cr,hp:y.hp})})})})}async function wt(){if(!n.form||!await B())return"";let c=E.masks[n.mask?n.mask.key:""],r=(H&&c&&H[c.type]||[]).find(u=>u.name===n.form.creature);if(!r)return"";let l=ut(r,i).map(u=>`
      <div class="vos-play-override">
        <b>${m(u.label)}</b><span>${m(u.value)}</span><i>${m(u.why)}</i>
      </div>`).join(""),d=(u,y)=>u.length?`
      <h4 class="vos-play-form-h">${y}</h4>
      ${u.map(p=>`<p class="vos-play-form-entry"><b>${m(p.name)}.</b> ${m(p.text)}</p>`).join("")}`:"";return`
      <article class="vos-play-formblock">
        <header>
          <h3>${m(r.name)}</h3>
          <p>${m(r.size)} ${m(r.type)} \xB7 CR ${m(r.cr)}</p>
        </header>
        <div class="vos-play-form-vitals">
          <span><b>${m(r.ac)}</b>AC</span>
          <span><b>${m(n.form.hp)}</b>/${m(n.form.maxHp)} HP</span>
          <span><b>${m(r.speed)}</b>Speed</span>
        </div>
        <div class="vos-play-overrides">${l}</div>
        ${d(r.traits,"Traits")}
        ${d(r.actions,"Actions")}
      </article>`}function T(c){let o=c.target.closest("[data-play]");if(!(!o||!t.contains(o))&&!(c.type==="keydown"&&!["Enter"," "].includes(c.key)))switch(c.type==="keydown"&&c.preventDefault(),o.dataset.play){case"hp":G();break;case"hitdice":yt();break;case"slot":{let r=Number(o.dataset.level),l=o.dataset.spent==="1";v({op:l?"restoreSlot":"spendSlot",level:r});break}case"charge":{let r=o.dataset.feature;if(!r)return;v({op:"useCharge",feature:r,max:Number(o.dataset.max)||void 0});break}case"exhaustion":{let r=Number(o.dataset.value);v({op:"setExhaustion",value:r===n.exhaustion?r-1:r});break}case"conditions":case"condition":Q();break;default:break}}return t.addEventListener("click",T),t.addEventListener("keydown",T),{apply:v,openHpPad:G,openRests:ft,openConditions:Q,openPrepare:bt,openMasks:Z,openForms:gt,formStatblockHtml:wt,setState(c,o){n=c,o&&(f=o)},destroy(){t.removeEventListener("click",T),t.removeEventListener("keydown",T),b(),F()}}}var Et=12e3,M=document.getElementById("vos-party-root"),J=document.getElementById("vos-party-status"),I=[],V=null,A=!1;function S(e){return String(e??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}function Lt(e=6e3){return new Promise(t=>{let s=Date.now();(function a(){if(window.VOS_PWA)return t(window.VOS_PWA);if(Date.now()-s>e)return t(null);setTimeout(a,80)})()})}function Ht(e){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(e||{}):e||{}}async function qt(){let e=await fetch("/api/play/party",{cache:"no-store",headers:Ht()}),t=await e.json().catch(()=>({}));if(!e.ok){let s=new Error(t.error||`HTTP ${e.status}`);throw s.status=e.status,s}return t.party||[]}function At(e,t){if(!t||e==null)return"";let s=e/t;return e===0?"is-down":s<=.25?"is-bloodied":s<=.5?"is-hurt":""}function Mt(e){let t=e.limits&&e.limits.slots||{},s=e.state.slots||{},a=Object.keys(t).sort();return a.length?a.map(i=>{let n=t[i],f=Math.max(0,n-(s[i]||0));return`<span class="vos-party-slot${f?"":" is-empty"}">
      <i>${S(i)}</i>${f}<b>/${n}</b></span>`}).join(""):""}function Nt(e){let t=e.state,s=e.limits&&e.limits.maxHp||0,a=t.hp.current!=null?t.hp.current:s,i=s?Math.max(0,Math.min(100,a/s*100)):0,n=(t.conditions||[]).includes("dying"),f=(t.conditions||[]).filter(x=>x!=="dying"),C=Math.max(0,(e.limits&&e.limits.hitDice||0)-(t.hitDiceSpent||0));return e.hasStatblock?`<article class="vos-party-card ${At(a,s)}${n?" is-dying":""}"
                   data-player="${S(e.playerName)}">
    <header class="vos-party-head">
      <h2>${S(e.character)}</h2>
      <span class="vos-party-class">${S(e.classLine||"")}</span>
      ${e.ac!=null?`<span class="vos-party-ac">AC ${S(e.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${S(e.character)} hit points ${a} of ${s}">
      <span class="vos-party-hp-fill" style="width:${i}%"></span>
      <span class="vos-party-hp-text">
        <b>${a}</b><i>/${s||"\u2014"}</i>
        ${t.hp.temp?`<em>+${t.hp.temp}</em>`:""}
      </span>
      ${n?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${t.exhaustion?`<div class="vos-party-exh" title="\u2212${t.exhaustion*2} to d20 tests, \u2212${t.exhaustion*5} ft">
      ${Array.from({length:6},(x,E)=>`<span class="${E<t.exhaustion?"is-on":""}"></span>`).join("")}
      <b>Exhaustion ${t.exhaustion}</b>
    </div>`:""}

    ${t.mask?`<div class="vos-party-mask">
      ${S(t.form?t.form.creature:t.mask.key)} \xB7 ${O(t.mask.remainingMs)}${t.mask.paused?" paused":""}
    </div>`:""}

    ${t.concentration?`<div class="vos-party-conc">Concentrating: ${S(t.concentration.spell)}</div>`:""}

    <div class="vos-party-row">
      ${Mt(e)}
      ${C?`<span class="vos-party-hd">${C} HD</span>`:""}
    </div>

    <div class="vos-party-conds">
      ${f.length?f.map(x=>`<span>${S(x)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <a class="vos-party-view" href="/sheet/?as=${encodeURIComponent(e.playerName)}"
         title="Open their sheet as they see it">View</a>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${S(e.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function Y(){M.innerHTML=I.map(Nt).join("")}function N(e,t=""){J&&(J.textContent=e,J.className=`vos-party-status${t?` is-${t}`:""}`)}function Dt(e){let t=I.find(s=>s.playerName===e);return t?pt({root:M,playerName:e,state:t.state,limits:t.limits,onState(s){t.state=s,Y()}}):null}async function Tt(e,t){let s=t==="heal"?"Heal":"Damage",a=Number(window.prompt(`${s} ${e.character} by how much?`,"5"));if(!(!Number.isFinite(a)||a<=0))try{let i=await j({op:t==="heal"?"heal":"damage",amount:a},e.playerName);e.state=i.state,e.limits=i.limits||e.limits,Y()}catch(i){N(i.message,"error")}}function Pt(e){let t=e.target.closest("[data-act]");if(!t)return;let s=t.closest("[data-player]");if(!s)return;let a=I.find(f=>f.playerName===s.dataset.player);if(!a)return;let i=t.dataset.act;if(i==="damage"||i==="heal"){Tt(a,i);return}let n=Dt(a.playerName);n&&(i==="hp"&&n.openHpPad(),i==="conditions"&&n.openConditions())}async function D({quiet:e=!1}={}){e||N("Refreshing\u2026");try{I=await qt(),Y(),N(`Updated ${new Date().toLocaleTimeString()}`)}catch(t){if(t.status===401||t.status===403){N("DM only.","error"),dt();return}N(`Could not refresh \u2014 ${t.message}`,"error")}}function jt(){dt(),V=setInterval(()=>{!A&&!document.hidden&&D({quiet:!0})},Et)}function dt(){clearInterval(V),V=null}document.addEventListener("visibilitychange",()=>{document.hidden||D({quiet:!0})});async function Rt(){let e=await Lt(),t=e&&e.getPlayerName?e.getPlayerName():null;if(!t){M.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(t==="DM"||e&&e.isDm&&e.isDm())){M.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}M.addEventListener("click",Pt);let s=document.getElementById("vos-party-pause");s&&s.addEventListener("click",()=>{A=!A,s.textContent=A?"Resume updates":"Pause updates",s.setAttribute("aria-pressed",String(A)),A||D()});let a=document.getElementById("vos-party-refresh");a&&a.addEventListener("click",()=>D()),await D(),jt()}M&&Rt();})();
