(()=>{function kt(t){let e=window.VOS_PWA;return e&&e.authHeaders?e.authHeaders(t||{}):t||{}}async function wt(t,e){let s=await fetch(t,{cache:"no-store",...e||{},headers:kt({"Content-Type":"application/json",...(e||{}).headers||{}})}),a=await s.json().catch(()=>({}));if(!s.ok){let u=new Error(a.error||`HTTP ${s.status}`);throw u.status=s.status,u.code=a.error_code,u}return a}function j(t,e){let s=e?{...t,playerName:e}:t;return wt("/api/play/op",{method:"POST",body:JSON.stringify(s)})}function Z(t,e,s){if(!t)return t;let a=JSON.parse(JSON.stringify(t)),u=s&&s.maxHp;switch(e.op){case"damage":{let n=Math.min(a.hp.temp||0,e.amount);return a.hp.temp-=n,a.hp.current!=null&&(a.hp.current=Math.max(0,a.hp.current-(e.amount-n))),a.hp.current===0?null:a}case"heal":{a.hp.current==null&&(a.hp.current=0);let n=a.hp.current+e.amount;return a.hp.current=u!=null?Math.min(n,u):n,a}case"spendSlot":{let n=String(e.level),y=((s||{}).slots||{})[n],C=(a.slots[n]||0)+1;return y!=null&&C>y?null:(a.slots[n]=C,a)}case"restoreSlot":{let n=String(e.level);return a.slots[n]=Math.max(0,(a.slots[n]||0)-1),a}case"useCharge":{let n=(a.uses[e.feature]||0)+1;return e.max!=null&&n>e.max?null:(a.uses[e.feature]=n,a)}case"restoreCharge":return a.uses[e.feature]=Math.max(0,(a.uses[e.feature]||0)-1),a;default:return null}}function tt(t,e){switch(t.op){case"damage":return{op:"setHp",value:e.hp.current,_restore:e};case"heal":return{op:"setHp",value:e.hp.current};case"setHp":return{op:"setHp",value:e.hp.current};case"setTempHp":return{op:"setTempHp",value:e.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:t.level};case"restoreSlot":return{op:"spendSlot",level:t.level};case"useCharge":return{op:"restoreCharge",feature:t.feature};case"restoreCharge":return{op:"useCharge",feature:t.feature};case"addCondition":return{op:"removeCondition",condition:t.condition};case"removeCondition":return{op:"addCondition",condition:t.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-t.delta};case"setExhaustion":return{op:"setExhaustion",value:e.exhaustion};default:return null}}var P=new Map;async function _(t){if(P.has(t))return P.get(t);let e=fetch(t,{cache:"default"}).then(s=>{if(!s.ok)throw new Error(`HTTP ${s.status}`);return s.json()}).catch(s=>{throw P.delete(t),s});return P.set(t,e),e}function U(t){return _(t)}function at(){return _("/data/play/conditions.json")}var et={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function st(t){let e=t&&t.classes||[];for(let s of e){let a=String(s.identifier||s.name||"").toLowerCase();if(et[a])return et[a]}return null}async function nt(t){if(!t)return null;try{return await _(`/data/play/spells-${t}.json`)}catch{return null}}function ot(t,e){if(!t||!Array.isArray(t.prepared)||!e)return null;let s=t.prepared[e-1];return typeof s=="number"?s:null}function rt(t){return`${t.name.replace(/ /g,"%20").replace(/\//g,"%2f").toLowerCase()}_${String(t.source||"").toLowerCase()}`}function lt(){return U("/data/play/masquerade.json")}function it(){return U("/data/play/forms.json")}function ct(t,e){if(!t||!e)return[];let s=new Set((t.features||[]).map(a=>(a.name||"").toLowerCase()).filter(a=>a.startsWith("maschera ")).map(a=>a.split(" ")[1]));return Object.values(e.masks).filter(a=>s.has(a.key)).sort((a,u)=>a.name.localeCompare(u.name))}function z(t){return t&&t.level>=6?3:1}function W(t,e,s){return!t||!e||!e.type?[]:(t[e.type]||[]).filter(a=>a.crValue<=s)}function O(t){let e=Math.max(0,Math.floor(t/1e3));return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`}function ut(t,e){let s=[],a=e&&e.spellcasting&&e.spellcasting.dc,u=e&&(e.abilities||[]).find(n=>n.key==="int")||null;return u&&t.abilities&&t.abilities.int!==u.score&&s.push({label:"Intelligence",value:`${u.score} (${u.mod>=0?"+":""}${u.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),a&&s.push({label:"Save DC",value:String(a),why:"Any DC in this creature's abilities uses your spell save DC."}),s.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),s}var St=[1,2,3,4,5,6,7,8,10,12,15,20],Ct=12;function pt(t){let e=t.root,s=t.onState,a=t.playerName||null,u=t.model||null,n=t.state,y=t.limits,C=!1,$=null,x=null,H=null;function mt(){if(navigator.vibrate)try{navigator.vibrate(Ct)}catch{}}async function v(c,{undoable:o=!0}={}){if(C)return;C=!0;let r=n;mt();let i=Z(n,c,y);i&&(n=i,s(n,{optimistic:!0}));try{let p=await j(c,a);n=p.state,y=p.limits||y,s(n,{note:p.note}),o&&ht(c,r,p.note)}catch(p){n=r,s(n,{error:p.message}),q(p.message,{tone:"error"})}finally{C=!1}}function ht(c,o,r){let i=tt(c,o);q(r||"Done",{action:i?{label:"Undo",run:()=>v(i,{undoable:!1})}:null})}let g=null,K=null;function q(c,{tone:o="",action:r=null}={}){if(g||(g=document.createElement("div"),g.className="vos-play-toast",g.setAttribute("role","status"),document.body.appendChild(g)),g.className=`vos-play-toast is-on${o?` is-${o}`:""}`,g.innerHTML='<span class="vos-play-toast-text"></span>',g.querySelector(".vos-play-toast-text").textContent=c,r){let i=document.createElement("button");i.type="button",i.className="vos-play-toast-action",i.textContent=r.label,i.addEventListener("click",()=>{F(),r.run()}),g.appendChild(i)}clearTimeout(K),K=setTimeout(F,r?6e3:3e3)}function F(){g&&g.classList.remove("is-on")}let k=null;function L(c,o,r){b(),k=document.createElement("div"),k.className="vos-play-sheet",k.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${c}">
        <div class="vos-play-sheet-head">
          <span>${c}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${o}</div>
      </div>`,document.body.appendChild(k),k.addEventListener("click",p=>{p.target.closest("[data-close]")&&b()}),r&&r(k);let i=k.querySelector("button:not([data-close])");i&&i.focus()}function b(){k&&(k.remove(),k=null)}function G(){let c=y&&y.maxHp||0,o=n.hp.current!=null?n.hp.current:c,r=St.map(i=>`<button type="button" class="vos-play-num" data-amount="${i}">${i}</button>`).join("");L("Hit points",`
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
    `,i=>{let p="damage";i.querySelectorAll("[data-mode]").forEach(d=>{d.addEventListener("click",()=>{p=d.dataset.mode,i.querySelectorAll("[data-mode]").forEach(f=>f.classList.toggle("is-on",f===d))})});let l=()=>!!i.querySelector("[data-critical]").checked,h=d=>{d>0&&(b(),v(p==="heal"?{op:"heal",amount:d}:{op:"damage",amount:d,critical:l()}))};i.querySelectorAll("[data-amount]").forEach(d=>{d.addEventListener("click",()=>h(Number(d.dataset.amount)))}),i.querySelector(".vos-play-custom").addEventListener("submit",d=>{d.preventDefault(),h(Number(d.target.querySelector("input").value))}),i.querySelector("[data-full]").addEventListener("click",()=>{b(),v({op:"setHp",value:c})}),i.querySelector("[data-temp]").addEventListener("click",()=>{let d=Number(window.prompt("Temporary hit points",String(n.hp.temp||0)));b(),Number.isFinite(d)&&d>=0&&v({op:"setTempHp",value:d,keepHigher:!1})})})}function yt(){let c=Number(n.hitDiceSpent||0),o=y&&y.hitDice||0;L("Hit dice",`
      <p class="vos-play-note">${Math.max(0,o-c)} of ${o} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `,r=>{r.querySelector(".vos-play-custom").addEventListener("submit",i=>{i.preventDefault();let p=Number(i.target.querySelector("input").value)||0;b(),v({op:"spendHitDie",healed:p})}),r.querySelector("[data-nothing]").addEventListener("click",()=>{b(),v({op:"spendHitDie"})})})}function ft(){L("Rest",`
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
    `,c=>{c.querySelectorAll("[data-rest]").forEach(o=>{o.addEventListener("click",()=>{let r=o.dataset.rest;r==="longRest"&&!window.confirm("Take a long rest?")||(b(),v({op:r}))})})})}let vt=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function Q(){let c=new Set(n.conditions||[]),o={};try{o=await at()}catch{}let r=vt.map(l=>{let h=o[l]||{};return`<div class="vos-play-cond-row${c.has(l)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${l}">${m(h.name||l.charAt(0).toUpperCase()+l.slice(1))}</button>
        ${h.text?`<details class="vos-play-cond-rules">
          <summary>What it does${h.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${m(h.text)}</p>
        </details>`:""}
      </div>`}).join(""),i=n.concentration,p=`<div class="vos-play-conc">
      ${i?`<span>Concentrating on <b>${m(i.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;L("Conditions",p+`<div class="vos-play-conds is-rows">${r}</div>`,l=>{l.querySelectorAll("[data-condition]").forEach(f=>{f.addEventListener("click",()=>{let w=f.dataset.condition,E=f.closest(".vos-play-cond-row"),R=!E.classList.contains("is-on");E.classList.toggle("is-on",R),v({op:R?"addCondition":"removeCondition",condition:w})})});let h=l.querySelector("[data-break]");h&&h.addEventListener("click",()=>{b(),v({op:"breakConcentration"})});let d=l.querySelector("[data-concentrate]");d&&d.addEventListener("click",()=>{let f=window.prompt("Concentrating on which spell?");b(),f&&f.trim()&&v({op:"concentrate",spell:f.trim()})})})}function m(c){return String(c??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o])}async function bt(){if($||($=await nt(st(u))),!$){q("No spell list for this character.",{tone:"error"});return}let c=u&&u.level||0,o=ot($,c),r=new Set(n.prepared||[]),i=Math.max(0,...Object.keys((y||{}).slots||{}).map(Number)),p=$.spells.filter(l=>l.level<=i).map(l=>{let h=rt(l),d=[l.school,l.time,l.range,l.duration].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${r.has(h)?" is-on":""}"
                       data-level="${l.level}" data-name="${m(l.name.toLowerCase())}">
          <input type="checkbox" data-spell="${m(h)}"${r.has(h)?" checked":""}
                 ${l.level===0?"disabled":""}>
          <span class="vos-play-spell-name">${m(l.name)}${l.concentration?'<i title="Concentration">C</i>':""}${l.ritual?'<i title="Ritual">R</i>':""}</span>
          <span class="vos-play-spell-meta">${m(d)}</span>
        </label>`}).join("");L("Prepare spells",`
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${r.size}${o?` / ${o}`:""}</span>
        <input type="search" class="vos-play-search" placeholder="Search ${$.spells.length} spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Cantrips are always known. ${o?`Your class prepares ${o} at level ${c}; going over is allowed if something says so.`:""}</p>
      <div class="vos-play-spells">${p}</div>
    `,l=>{let h=l.querySelector("[data-count]");l.querySelectorAll("[data-spell]").forEach(f=>{f.addEventListener("change",()=>{f.closest(".vos-play-spell").classList.toggle("is-on",f.checked);let w=l.querySelectorAll("[data-spell]:checked").length;h.textContent=o?`${w} / ${o}`:String(w),h.classList.toggle("is-over",!!(o&&w>o)),v({op:"togglePrepared",spell:f.dataset.spell},{undoable:!1})})});let d=l.querySelector(".vos-play-search");d.addEventListener("input",()=>{let f=d.value.trim().toLowerCase();l.querySelectorAll(".vos-play-spell").forEach(w=>{w.hidden=!!f&&!w.dataset.name.includes(f)})})})}async function B(){return x||(x=await lt().catch(()=>null)),H||(H=await it().catch(()=>null)),!!x}async function X(){if(!await B()){q("Could not load the masks.",{tone:"error"});return}let c=ct(u,x);if(!c.length){q("This character has no masks.",{tone:"error"});return}let o=n.mask,r=c.map(i=>`
      <button type="button" class="vos-play-mask${o&&o.key===i.key?" is-on":""}"
              data-mask="${m(i.key)}">
        <b>${m(i.name)}</b>
        <span>${m(i.type)} \xB7 ${W(H,i,z(u)).length} forms available</span>
      </button>`).join("");L("The Masquerade",`
      ${o?`<p class="vos-play-note">Wearing <b>${m(o.key)}</b> \u2014 ${O(o.remainingMs)}${o.paused?" (paused)":""} left.</p>`:""}
      ${r}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      ${o?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
    `,i=>{i.querySelectorAll("[data-mask]").forEach(l=>{l.addEventListener("click",()=>{let h=l.dataset.mask;b();let d=(u.abilities||[]).find(E=>E.key==="cha"),f=(u.classes||[]).filter(E=>String(E.identifier).toLowerCase()==="bard").reduce((E,R)=>E+(R.levels||0),0)||u.level||0,w=d?Math.max(0,d.mod+f):0;v({op:"donMask",mask:h,tempHp:w})})});let p=i.querySelector("[data-remove]");p&&p.addEventListener("click",()=>{b(),v({op:"removeMask"})})})}async function $t(){if(!n.mask){X();return}if(!await B())return;let c=x.masks[n.mask.key],o=z(u),r=W(H,c,o);if(!r.length){q("No forms available for this mask.",{tone:"error"});return}let i=r.map((p,l)=>`
      <button type="button" class="vos-play-form" data-form="${l}">
        <b>${m(p.name)}</b>
        <span class="vos-play-form-cr">CR ${m(p.cr)}</span>
        <span class="vos-play-form-meta">AC ${m(p.ac)} \xB7 ${m(p.hp)} HP \xB7 ${m(p.speed)}</span>
      </button>`).join("");L(`Assume a form \u2014 ${m(c.name)}`,`
      <p class="vos-play-note">Challenge Rating ${o} or lower${u.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${i}</div>
    `,p=>{p.querySelectorAll("[data-form]").forEach(l=>{l.addEventListener("click",()=>{let h=r[Number(l.dataset.form)];b(),v({op:"assumeForm",creature:h.name,source:h.source,cr:h.cr,hp:h.hp})})})})}async function gt(){if(!n.form||!await B())return"";let c=x.masks[n.mask?n.mask.key:""],r=(H&&c&&H[c.type]||[]).find(l=>l.name===n.form.creature);if(!r)return"";let i=ut(r,u).map(l=>`
      <div class="vos-play-override">
        <b>${m(l.label)}</b><span>${m(l.value)}</span><i>${m(l.why)}</i>
      </div>`).join(""),p=(l,h)=>l.length?`
      <h4 class="vos-play-form-h">${h}</h4>
      ${l.map(d=>`<p class="vos-play-form-entry"><b>${m(d.name)}.</b> ${m(d.text)}</p>`).join("")}`:"";return`
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
        <div class="vos-play-overrides">${i}</div>
        ${p(r.traits,"Traits")}
        ${p(r.actions,"Actions")}
      </article>`}function T(c){let o=c.target.closest("[data-play]");if(!(!o||!e.contains(o))&&!(c.type==="keydown"&&!["Enter"," "].includes(c.key)))switch(c.type==="keydown"&&c.preventDefault(),o.dataset.play){case"hp":G();break;case"hitdice":yt();break;case"slot":{let r=Number(o.dataset.level),i=o.dataset.spent==="1";v({op:i?"restoreSlot":"spendSlot",level:r});break}case"charge":{let r=o.dataset.feature;if(!r)return;v({op:"useCharge",feature:r,max:Number(o.dataset.max)||void 0});break}case"exhaustion":{let r=Number(o.dataset.value);v({op:"setExhaustion",value:r===n.exhaustion?r-1:r});break}case"conditions":case"condition":Q();break;default:break}}return e.addEventListener("click",T),e.addEventListener("keydown",T),{apply:v,openHpPad:G,openRests:ft,openConditions:Q,openPrepare:bt,openMasks:X,openForms:$t,formStatblockHtml:gt,setState(c,o){n=c,o&&(y=o)},destroy(){e.removeEventListener("click",T),e.removeEventListener("keydown",T),b(),F()}}}var xt=12e3,A=document.getElementById("vos-party-root"),J=document.getElementById("vos-party-status"),I=[],V=null,M=!1;function S(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function Et(t=6e3){return new Promise(e=>{let s=Date.now();(function a(){if(window.VOS_PWA)return e(window.VOS_PWA);if(Date.now()-s>t)return e(null);setTimeout(a,80)})()})}function Lt(t){let e=window.VOS_PWA;return e&&e.authHeaders?e.authHeaders(t||{}):t||{}}async function Ht(){let t=await fetch("/api/play/party",{cache:"no-store",headers:Lt()}),e=await t.json().catch(()=>({}));if(!t.ok){let s=new Error(e.error||`HTTP ${t.status}`);throw s.status=t.status,s}return e.party||[]}function qt(t,e){if(!e||t==null)return"";let s=t/e;return t===0?"is-down":s<=.25?"is-bloodied":s<=.5?"is-hurt":""}function Mt(t){let e=t.limits&&t.limits.slots||{},s=t.state.slots||{},a=Object.keys(e).sort();return a.length?a.map(u=>{let n=e[u],y=Math.max(0,n-(s[u]||0));return`<span class="vos-party-slot${y?"":" is-empty"}">
      <i>${S(u)}</i>${y}<b>/${n}</b></span>`}).join(""):""}function At(t){let e=t.state,s=t.limits&&t.limits.maxHp||0,a=e.hp.current!=null?e.hp.current:s,u=s?Math.max(0,Math.min(100,a/s*100)):0,n=(e.conditions||[]).includes("dying"),y=(e.conditions||[]).filter($=>$!=="dying"),C=Math.max(0,(t.limits&&t.limits.hitDice||0)-(e.hitDiceSpent||0));return t.hasStatblock?`<article class="vos-party-card ${qt(a,s)}${n?" is-dying":""}"
                   data-player="${S(t.playerName)}">
    <header class="vos-party-head">
      <h2>${S(t.character)}</h2>
      <span class="vos-party-class">${S(t.classLine||"")}</span>
      ${t.ac!=null?`<span class="vos-party-ac">AC ${S(t.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${S(t.character)} hit points ${a} of ${s}">
      <span class="vos-party-hp-fill" style="width:${u}%"></span>
      <span class="vos-party-hp-text">
        <b>${a}</b><i>/${s||"\u2014"}</i>
        ${e.hp.temp?`<em>+${e.hp.temp}</em>`:""}
      </span>
      ${n?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${e.exhaustion?`<div class="vos-party-exh" title="\u2212${e.exhaustion*2} to d20 tests, \u2212${e.exhaustion*5} ft">
      ${Array.from({length:6},($,x)=>`<span class="${x<e.exhaustion?"is-on":""}"></span>`).join("")}
      <b>Exhaustion ${e.exhaustion}</b>
    </div>`:""}

    ${e.mask?`<div class="vos-party-mask">
      ${S(e.form?e.form.creature:e.mask.key)} \xB7 ${O(e.mask.remainingMs)}${e.mask.paused?" paused":""}
    </div>`:""}

    ${e.concentration?`<div class="vos-party-conc">Concentrating: ${S(e.concentration.spell)}</div>`:""}

    <div class="vos-party-row">
      ${Mt(t)}
      ${C?`<span class="vos-party-hd">${C} HD</span>`:""}
    </div>

    <div class="vos-party-conds">
      ${y.length?y.map($=>`<span>${S($)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <a class="vos-party-view" href="/sheet/?as=${encodeURIComponent(t.playerName)}"
         title="Open their sheet as they see it">View</a>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${S(t.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function Y(){A.innerHTML=I.map(At).join("")}function N(t,e=""){J&&(J.textContent=t,J.className=`vos-party-status${e?` is-${e}`:""}`)}function Nt(t){let e=I.find(s=>s.playerName===t);return e?pt({root:A,playerName:t,state:e.state,limits:e.limits,onState(s){e.state=s,Y()}}):null}async function Dt(t,e){let s=e==="heal"?"Heal":"Damage",a=Number(window.prompt(`${s} ${t.character} by how much?`,"5"));if(!(!Number.isFinite(a)||a<=0))try{let u=await j({op:e==="heal"?"heal":"damage",amount:a},t.playerName);t.state=u.state,t.limits=u.limits||t.limits,Y()}catch(u){N(u.message,"error")}}function Tt(t){let e=t.target.closest("[data-act]");if(!e)return;let s=e.closest("[data-player]");if(!s)return;let a=I.find(y=>y.playerName===s.dataset.player);if(!a)return;let u=e.dataset.act;if(u==="damage"||u==="heal"){Dt(a,u);return}let n=Nt(a.playerName);n&&(u==="hp"&&n.openHpPad(),u==="conditions"&&n.openConditions())}async function D({quiet:t=!1}={}){t||N("Refreshing\u2026");try{I=await Ht(),Y(),N(`Updated ${new Date().toLocaleTimeString()}`)}catch(e){if(e.status===401||e.status===403){N("DM only.","error"),dt();return}N(`Could not refresh \u2014 ${e.message}`,"error")}}function Rt(){dt(),V=setInterval(()=>{!M&&!document.hidden&&D({quiet:!0})},xt)}function dt(){clearInterval(V),V=null}document.addEventListener("visibilitychange",()=>{document.hidden||D({quiet:!0})});async function jt(){let t=await Et(),e=t&&t.getPlayerName?t.getPlayerName():null;if(!e){A.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(e==="DM"||t&&t.isDm&&t.isDm())){A.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}A.addEventListener("click",Tt);let s=document.getElementById("vos-party-pause");s&&s.addEventListener("click",()=>{M=!M,s.textContent=M?"Resume updates":"Pause updates",s.setAttribute("aria-pressed",String(M)),M||D()});let a=document.getElementById("vos-party-refresh");a&&a.addEventListener("click",()=>D()),await D(),Rt()}A&&jt();})();
