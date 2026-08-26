(()=>{function kt(e){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(e||{}):e||{}}async function wt(e,t){let s=await fetch(e,{cache:"no-store",...t||{},headers:kt({"Content-Type":"application/json",...(t||{}).headers||{}})}),a=await s.json().catch(()=>({}));if(!s.ok){let u=new Error(a.error||`HTTP ${s.status}`);throw u.status=s.status,u.code=a.error_code,u}return a}function P(e,t){let s=t?{...e,playerName:t}:e;return wt("/api/play/op",{method:"POST",body:JSON.stringify(s)})}function Z(e,t,s){if(!e)return e;let a=JSON.parse(JSON.stringify(e)),u=s&&s.maxHp;switch(t.op){case"damage":{let n=Math.min(a.hp.temp||0,t.amount);return a.hp.temp-=n,a.hp.current!=null&&(a.hp.current=Math.max(0,a.hp.current-(t.amount-n))),a.hp.current===0?null:a}case"heal":{a.hp.current==null&&(a.hp.current=0);let n=a.hp.current+t.amount;return a.hp.current=u!=null?Math.min(n,u):n,a}case"spendSlot":{let n=String(t.level),h=((s||{}).slots||{})[n],C=(a.slots[n]||0)+1;return h!=null&&C>h?null:(a.slots[n]=C,a)}case"restoreSlot":{let n=String(t.level);return a.slots[n]=Math.max(0,(a.slots[n]||0)-1),a}case"useCharge":{let n=(a.uses[t.feature]||0)+1;return t.max!=null&&n>t.max?null:(a.uses[t.feature]=n,a)}case"restoreCharge":return a.uses[t.feature]=Math.max(0,(a.uses[t.feature]||0)-1),a;default:return null}}function tt(e,t){switch(e.op){case"damage":return{op:"setHp",value:t.hp.current,_restore:t};case"heal":return{op:"setHp",value:t.hp.current};case"setHp":return{op:"setHp",value:t.hp.current};case"setTempHp":return{op:"setTempHp",value:t.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:e.level};case"restoreSlot":return{op:"spendSlot",level:e.level};case"useCharge":return{op:"restoreCharge",feature:e.feature};case"restoreCharge":return{op:"useCharge",feature:e.feature};case"addCondition":return{op:"removeCondition",condition:e.condition};case"removeCondition":return{op:"addCondition",condition:e.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-e.delta};case"setExhaustion":return{op:"setExhaustion",value:t.exhaustion};default:return null}}var R=new Map;async function _(e){if(R.has(e))return R.get(e);let t=fetch(e,{cache:"default"}).then(s=>{if(!s.ok)throw new Error(`HTTP ${s.status}`);return s.json()}).catch(s=>{throw R.delete(e),s});return R.set(e,t),t}function z(e){return _(e)}function at(){return _("/data/play/conditions.json")}var et={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function st(e){let t=e&&e.classes||[];for(let s of t){let a=String(s.identifier||s.name||"").toLowerCase();if(et[a])return et[a]}return null}async function nt(e){if(!e)return null;try{return await _(`/data/play/spells-${e}.json`)}catch{return null}}function ot(e,t){if(!e||!Array.isArray(e.prepared)||!t)return null;let s=e.prepared[t-1];return typeof s=="number"?s:null}function rt(e){return`${e.name.replace(/ /g,"%20").replace(/\//g,"%2f").toLowerCase()}_${String(e.source||"").toLowerCase()}`}function lt(){return z("/data/play/masquerade.json")}function it(){return z("/data/play/forms.json")}function ct(e,t){if(!e||!t)return[];let s=new Set((e.features||[]).map(a=>(a.name||"").toLowerCase()).filter(a=>a.startsWith("maschera ")).map(a=>a.split(" ")[1]));return Object.values(t.masks).filter(a=>s.has(a.key)).sort((a,u)=>a.name.localeCompare(u.name))}function U(e){return e&&e.level>=6?3:1}function W(e,t,s){return!e||!t||!t.type?[]:(e[t.type]||[]).filter(a=>a.crValue<=s)}function O(e){let t=Math.max(0,Math.floor(e/1e3));return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}function ut(e,t){let s=[],a=t&&t.spellcasting&&t.spellcasting.dc,u=t&&(t.abilities||[]).find(n=>n.key==="int")||null;return u&&e.abilities&&e.abilities.int!==u.score&&s.push({label:"Intelligence",value:`${u.score} (${u.mod>=0?"+":""}${u.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),a&&s.push({label:"Save DC",value:String(a),why:"Any DC in this creature's abilities uses your spell save DC."}),s.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),s}var St=[1,2,3,4,5,6,7,8,10,12,15,20],Ct=12;function pt(e){let t=e.root,s=e.onState,a=e.playerName||null,u=e.model||null,n=e.state,h=e.limits,C=!1,$=null,x=null,H=null;function mt(){if(navigator.vibrate)try{navigator.vibrate(Ct)}catch{}}async function v(c,{undoable:o=!0}={}){if(C)return;C=!0;let r=n;mt();let i=Z(n,c,h);i&&(n=i,s(n,{optimistic:!0}));try{let p=await P(c,a);n=p.state,h=p.limits||h,s(n,{note:p.note}),o&&yt(c,r,p.note)}catch(p){n=r,s(n,{error:p.message}),q(p.message,{tone:"error"})}finally{C=!1}}function yt(c,o,r){let i=tt(c,o);q(r||"Done",{action:i?{label:"Undo",run:()=>v(i,{undoable:!1})}:null})}let g=null,K=null;function q(c,{tone:o="",action:r=null}={}){if(g||(g=document.createElement("div"),g.className="vos-play-toast",g.setAttribute("role","status"),document.body.appendChild(g)),g.className=`vos-play-toast is-on${o?` is-${o}`:""}`,g.innerHTML='<span class="vos-play-toast-text"></span>',g.querySelector(".vos-play-toast-text").textContent=c,r){let i=document.createElement("button");i.type="button",i.className="vos-play-toast-action",i.textContent=r.label,i.addEventListener("click",()=>{I(),r.run()}),g.appendChild(i)}clearTimeout(K),K=setTimeout(I,r?6e3:3e3)}function I(){g&&g.classList.remove("is-on")}let k=null;function L(c,o,r){b(),k=document.createElement("div"),k.className="vos-play-sheet",k.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${c}">
        <div class="vos-play-sheet-head">
          <span>${c}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${o}</div>
      </div>`,document.body.appendChild(k),k.addEventListener("click",p=>{p.target.closest("[data-close]")&&b()}),r&&r(k);let i=k.querySelector("button:not([data-close])");i&&i.focus()}function b(){k&&(k.remove(),k=null)}function G(){let c=h&&h.maxHp||0,o=n.hp.current!=null?n.hp.current:c,r=St.map(i=>`<button type="button" class="vos-play-num" data-amount="${i}">${i}</button>`).join("");L("Hit points",`
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
    `,i=>{let p="damage";i.querySelectorAll("[data-mode]").forEach(d=>{d.addEventListener("click",()=>{p=d.dataset.mode,i.querySelectorAll("[data-mode]").forEach(f=>f.classList.toggle("is-on",f===d))})});let l=()=>!!i.querySelector("[data-critical]").checked,y=d=>{d>0&&(b(),v(p==="heal"?{op:"heal",amount:d}:{op:"damage",amount:d,critical:l()}))};i.querySelectorAll("[data-amount]").forEach(d=>{d.addEventListener("click",()=>y(Number(d.dataset.amount)))}),i.querySelector(".vos-play-custom").addEventListener("submit",d=>{d.preventDefault(),y(Number(d.target.querySelector("input").value))}),i.querySelector("[data-full]").addEventListener("click",()=>{b(),v({op:"setHp",value:c})}),i.querySelector("[data-temp]").addEventListener("click",()=>{let d=Number(window.prompt("Temporary hit points",String(n.hp.temp||0)));b(),Number.isFinite(d)&&d>=0&&v({op:"setTempHp",value:d,keepHigher:!1})})})}function ht(){let c=Number(n.hitDiceSpent||0),o=h&&h.hitDice||0;L("Hit dice",`
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
    `,c=>{c.querySelectorAll("[data-rest]").forEach(o=>{o.addEventListener("click",()=>{let r=o.dataset.rest;r==="longRest"&&!window.confirm("Take a long rest?")||(b(),v({op:r}))})})})}let vt=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function Q(){let c=new Set(n.conditions||[]),o={};try{o=await at()}catch{}let r=vt.map(l=>{let y=o[l]||{};return`<div class="vos-play-cond-row${c.has(l)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${l}">${m(y.name||l.charAt(0).toUpperCase()+l.slice(1))}</button>
        ${y.text?`<details class="vos-play-cond-rules">
          <summary>What it does${y.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${m(y.text)}</p>
        </details>`:""}
      </div>`}).join(""),i=n.concentration,p=`<div class="vos-play-conc">
      ${i?`<span>Concentrating on <b>${m(i.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;L("Conditions",p+`<div class="vos-play-conds is-rows">${r}</div>`,l=>{l.querySelectorAll("[data-condition]").forEach(f=>{f.addEventListener("click",()=>{let w=f.dataset.condition,E=f.closest(".vos-play-cond-row"),j=!E.classList.contains("is-on");E.classList.toggle("is-on",j),v({op:j?"addCondition":"removeCondition",condition:w})})});let y=l.querySelector("[data-break]");y&&y.addEventListener("click",()=>{b(),v({op:"breakConcentration"})});let d=l.querySelector("[data-concentrate]");d&&d.addEventListener("click",()=>{let f=window.prompt("Concentrating on which spell?");b(),f&&f.trim()&&v({op:"concentrate",spell:f.trim()})})})}function m(c){return String(c??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o])}async function bt(){if($||($=await nt(st(u))),!$){q("No spell list for this character.",{tone:"error"});return}let c=u&&u.level||0,o=ot($,c),r=new Set(n.prepared||[]),i=Math.max(0,...Object.keys((h||{}).slots||{}).map(Number)),p=$.spells.filter(l=>l.level<=i).map(l=>{let y=rt(l),d=[l.school,l.time,l.range,l.duration].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${r.has(y)?" is-on":""}"
                       data-level="${l.level}" data-name="${m(l.name.toLowerCase())}">
          <input type="checkbox" data-spell="${m(y)}"${r.has(y)?" checked":""}
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
    `,l=>{let y=l.querySelector("[data-count]");l.querySelectorAll("[data-spell]").forEach(f=>{f.addEventListener("change",()=>{f.closest(".vos-play-spell").classList.toggle("is-on",f.checked);let w=l.querySelectorAll("[data-spell]:checked").length;y.textContent=o?`${w} / ${o}`:String(w),y.classList.toggle("is-over",!!(o&&w>o)),v({op:"togglePrepared",spell:f.dataset.spell},{undoable:!1})})});let d=l.querySelector(".vos-play-search");d.addEventListener("input",()=>{let f=d.value.trim().toLowerCase();l.querySelectorAll(".vos-play-spell").forEach(w=>{w.hidden=!!f&&!w.dataset.name.includes(f)})})})}async function B(){return x||(x=await lt().catch(()=>null)),H||(H=await it().catch(()=>null)),!!x}async function X(){if(!await B()){q("Could not load the masks.",{tone:"error"});return}let c=ct(u,x);if(!c.length){q("This character has no masks.",{tone:"error"});return}let o=n.mask,r=c.map(i=>`
      <button type="button" class="vos-play-mask${o&&o.key===i.key?" is-on":""}"
              data-mask="${m(i.key)}">
        <b>${m(i.name)}</b>
        <span>${m(i.type)} \xB7 ${W(H,i,U(u)).length} forms available</span>
      </button>`).join("");L("The Masquerade",`
      ${o?`<p class="vos-play-note">Wearing <b>${m(o.key)}</b> \u2014 ${O(o.remainingMs)}${o.paused?" (paused)":""} left.</p>`:""}
      ${r}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      ${o?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
    `,i=>{i.querySelectorAll("[data-mask]").forEach(l=>{l.addEventListener("click",()=>{let y=l.dataset.mask;b();let d=(u.abilities||[]).find(E=>E.key==="cha"),f=(u.classes||[]).filter(E=>String(E.identifier).toLowerCase()==="bard").reduce((E,j)=>E+(j.levels||0),0)||u.level||0,w=d?Math.max(0,d.mod+f):0;v({op:"donMask",mask:y,tempHp:w})})});let p=i.querySelector("[data-remove]");p&&p.addEventListener("click",()=>{b(),v({op:"removeMask"})})})}async function $t(){if(!n.mask){X();return}if(!await B())return;let c=x.masks[n.mask.key],o=U(u),r=W(H,c,o);if(!r.length){q("No forms available for this mask.",{tone:"error"});return}let i=r.map((p,l)=>`
      <button type="button" class="vos-play-form" data-form="${l}">
        <b>${m(p.name)}</b>
        <span class="vos-play-form-cr">CR ${m(p.cr)}</span>
        <span class="vos-play-form-meta">AC ${m(p.ac)} \xB7 ${m(p.hp)} HP \xB7 ${m(p.speed)}</span>
      </button>`).join("");L(`Assume a form \u2014 ${m(c.name)}`,`
      <p class="vos-play-note">Challenge Rating ${o} or lower${u.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${i}</div>
    `,p=>{p.querySelectorAll("[data-form]").forEach(l=>{l.addEventListener("click",()=>{let y=r[Number(l.dataset.form)];b(),v({op:"assumeForm",creature:y.name,source:y.source,cr:y.cr,hp:y.hp})})})})}async function gt(){if(!n.form||!await B())return"";let c=x.masks[n.mask?n.mask.key:""],r=(H&&c&&H[c.type]||[]).find(l=>l.name===n.form.creature);if(!r)return"";let i=ut(r,u).map(l=>`
      <div class="vos-play-override">
        <b>${m(l.label)}</b><span>${m(l.value)}</span><i>${m(l.why)}</i>
      </div>`).join(""),p=(l,y)=>l.length?`
      <h4 class="vos-play-form-h">${y}</h4>
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
      </article>`}function T(c){let o=c.target.closest("[data-play]");if(!(!o||!t.contains(o))&&!(c.type==="keydown"&&!["Enter"," "].includes(c.key)))switch(c.type==="keydown"&&c.preventDefault(),o.dataset.play){case"hp":G();break;case"hitdice":ht();break;case"slot":{let r=Number(o.dataset.level),i=o.dataset.spent==="1";v({op:i?"restoreSlot":"spendSlot",level:r});break}case"charge":{let r=o.dataset.feature;if(!r)return;v({op:"useCharge",feature:r,max:Number(o.dataset.max)||void 0});break}case"exhaustion":{let r=Number(o.dataset.value);v({op:"setExhaustion",value:r===n.exhaustion?r-1:r});break}case"conditions":case"condition":Q();break;default:break}}return t.addEventListener("click",T),t.addEventListener("keydown",T),{apply:v,openHpPad:G,openRests:ft,openConditions:Q,openPrepare:bt,openMasks:X,openForms:$t,formStatblockHtml:gt,setState(c,o){n=c,o&&(h=o)},destroy(){t.removeEventListener("click",T),t.removeEventListener("keydown",T),b(),I()}}}var xt=12e3,A=document.getElementById("vos-party-root"),J=document.getElementById("vos-party-status"),F=[],V=null,M=!1;function S(e){return String(e??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}function Et(e=6e3){return new Promise(t=>{let s=Date.now();(function a(){if(window.VOS_PWA)return t(window.VOS_PWA);if(Date.now()-s>e)return t(null);setTimeout(a,80)})()})}function Lt(e){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(e||{}):e||{}}async function Ht(){let e=await fetch("/api/play/party",{cache:"no-store",headers:Lt()}),t=await e.json().catch(()=>({}));if(!e.ok){let s=new Error(t.error||`HTTP ${e.status}`);throw s.status=e.status,s}return t.party||[]}function qt(e,t){if(!t||e==null)return"";let s=e/t;return e===0?"is-down":s<=.25?"is-bloodied":s<=.5?"is-hurt":""}function Mt(e){let t=e.limits&&e.limits.slots||{},s=e.state.slots||{},a=Object.keys(t).sort();return a.length?a.map(u=>{let n=t[u],h=Math.max(0,n-(s[u]||0));return`<span class="vos-party-slot${h?"":" is-empty"}">
      <i>${S(u)}</i>${h}<b>/${n}</b></span>`}).join(""):""}function At(e){let t=e.state,s=e.limits&&e.limits.maxHp||0,a=t.hp.current!=null?t.hp.current:s,u=s?Math.max(0,Math.min(100,a/s*100)):0,n=(t.conditions||[]).includes("dying"),h=(t.conditions||[]).filter($=>$!=="dying"),C=Math.max(0,(e.limits&&e.limits.hitDice||0)-(t.hitDiceSpent||0));return e.hasStatblock?`<article class="vos-party-card ${qt(a,s)}${n?" is-dying":""}"
                   data-player="${S(e.playerName)}">
    <header class="vos-party-head">
      <h2>${S(e.character)}</h2>
      <span class="vos-party-class">${S(e.classLine||"")}</span>
      ${e.ac!=null?`<span class="vos-party-ac">AC ${S(e.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${S(e.character)} hit points ${a} of ${s}">
      <span class="vos-party-hp-fill" style="width:${u}%"></span>
      <span class="vos-party-hp-text">
        <b>${a}</b><i>/${s||"\u2014"}</i>
        ${t.hp.temp?`<em>+${t.hp.temp}</em>`:""}
      </span>
      ${n?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${t.exhaustion?`<div class="vos-party-exh" title="\u2212${t.exhaustion*2} to d20 tests, \u2212${t.exhaustion*5} ft">
      ${Array.from({length:6},($,x)=>`<span class="${x<t.exhaustion?"is-on":""}"></span>`).join("")}
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
      ${h.length?h.map($=>`<span>${S($)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${S(e.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function Y(){A.innerHTML=F.map(At).join("")}function N(e,t=""){J&&(J.textContent=e,J.className=`vos-party-status${t?` is-${t}`:""}`)}function Nt(e){let t=F.find(s=>s.playerName===e);return t?pt({root:A,playerName:e,state:t.state,limits:t.limits,onState(s){t.state=s,Y()}}):null}async function Dt(e,t){let s=t==="heal"?"Heal":"Damage",a=Number(window.prompt(`${s} ${e.character} by how much?`,"5"));if(!(!Number.isFinite(a)||a<=0))try{let u=await P({op:t==="heal"?"heal":"damage",amount:a},e.playerName);e.state=u.state,e.limits=u.limits||e.limits,Y()}catch(u){N(u.message,"error")}}function Tt(e){let t=e.target.closest("[data-act]");if(!t)return;let s=t.closest("[data-player]");if(!s)return;let a=F.find(h=>h.playerName===s.dataset.player);if(!a)return;let u=t.dataset.act;if(u==="damage"||u==="heal"){Dt(a,u);return}let n=Nt(a.playerName);n&&(u==="hp"&&n.openHpPad(),u==="conditions"&&n.openConditions())}async function D({quiet:e=!1}={}){e||N("Refreshing\u2026");try{F=await Ht(),Y(),N(`Updated ${new Date().toLocaleTimeString()}`)}catch(t){if(t.status===401||t.status===403){N("DM only.","error"),dt();return}N(`Could not refresh \u2014 ${t.message}`,"error")}}function jt(){dt(),V=setInterval(()=>{!M&&!document.hidden&&D({quiet:!0})},xt)}function dt(){clearInterval(V),V=null}document.addEventListener("visibilitychange",()=>{document.hidden||D({quiet:!0})});async function Pt(){let e=await Et(),t=e&&e.getPlayerName?e.getPlayerName():null;if(!t){A.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(t==="DM"||e&&e.isDm&&e.isDm())){A.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}A.addEventListener("click",Tt);let s=document.getElementById("vos-party-pause");s&&s.addEventListener("click",()=>{M=!M,s.textContent=M?"Resume updates":"Pause updates",s.setAttribute("aria-pressed",String(M)),M||D()});let a=document.getElementById("vos-party-refresh");a&&a.addEventListener("click",()=>D()),await D(),jt()}A&&Pt();})();
