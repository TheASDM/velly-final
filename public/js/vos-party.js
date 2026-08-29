(()=>{function _e(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function ze(a,t){let i=await fetch(a,{cache:"no-store",...t||{},headers:_e({"Content-Type":"application/json",...(t||{}).headers||{}})}),s=await i.json().catch(()=>({}));if(!i.ok){let o=new Error(s.error||`HTTP ${i.status}`);throw o.status=i.status,o.code=s.error_code,o}return s}function j(a,t){let i=t?{...a,playerName:t}:a;return ze("/api/play/op",{method:"POST",body:JSON.stringify(i)})}function de(a,t,i){if(!a)return a;let s=JSON.parse(JSON.stringify(a)),o=i&&i.maxHp;switch(t.op){case"damage":{let l=Math.min(s.hp.temp||0,t.amount);return s.hp.temp-=l,s.hp.current!=null&&(s.hp.current=Math.max(0,s.hp.current-(t.amount-l))),s.hp.current===0?null:s}case"heal":{s.hp.current==null&&(s.hp.current=0);let l=s.hp.current+t.amount;return s.hp.current=o!=null?Math.min(l,o):l,s}case"spendSlot":{let l=String(t.level),h=((i||{}).slots||{})[l],g=(s.slots[l]||0)+1;return h!=null&&g>h?null:(s.slots[l]=g,s)}case"restoreSlot":{let l=String(t.level);return s.slots[l]=Math.max(0,(s.slots[l]||0)-1),s}case"useCharge":{let l=(s.uses[t.feature]||0)+1;return t.max!=null&&l>t.max?null:(s.uses[t.feature]=l,t.tempHp!=null&&(s.hp.temp=Math.max(s.hp.temp||0,t.tempHp)),s)}case"restoreCharge":return s.uses[t.feature]=Math.max(0,(s.uses[t.feature]||0)-1),s;case"spendPactSlot":{let l=(i||{}).pact,h=(s.pact||0)+1;return l!=null&&h>l?null:(s.pact=h,s)}case"restorePactSlot":return s.pact=Math.max(0,(s.pact||0)-1),s;default:return null}}function me(a,t){switch(a.op){case"damage":return{op:"setHp",value:t.hp.current,_restore:t};case"heal":return{op:"setHp",value:t.hp.current};case"setHp":return{op:"setHp",value:t.hp.current};case"setTempHp":return{op:"setTempHp",value:t.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:a.level};case"restoreSlot":return{op:"spendSlot",level:a.level};case"spendPactSlot":return{op:"restorePactSlot"};case"restorePactSlot":return{op:"spendPactSlot"};case"useCharge":return{op:"restoreCharge",feature:a.feature};case"restoreCharge":return{op:"useCharge",feature:a.feature};case"addCondition":return{op:"removeCondition",condition:a.condition};case"removeCondition":return{op:"addCondition",condition:a.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-a.delta};case"setExhaustion":return{op:"setExhaustion",value:t.exhaustion};default:return null}}var O=new Map;async function V(a){if(O.has(a))return O.get(a);let t=fetch(a,{cache:"default"}).then(i=>{if(!i.ok)throw new Error(`HTTP ${i.status}`);return i.json()}).catch(i=>{throw O.delete(a),i});return O.set(a,t),t}function Y(a){return V(a)}function he(){return V("/data/play/conditions.json")}var fe={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function ye(a){let t=a&&a.classes||[];for(let i of t){let s=String(i.identifier||i.name||"").toLowerCase();if(fe[s])return fe[s]}return null}async function ve(a){if(!a)return null;try{return await V(`/data/play/spells-${a}.json`)}catch{return null}}function be(a,t){if(!a||!Array.isArray(a.prepared)||!t)return null;let i=a.prepared[t-1];return typeof i=="number"?i:null}function ge(){return Y("/data/play/masquerade.json")}function $e(){return Y("/data/play/forms.json")}function ke(a,t){if(!a||!t)return[];let i=new Set((a.features||[]).map(s=>(s.name||"").toLowerCase()).filter(s=>s.startsWith("maschera ")).map(s=>s.split(" ")[1]));return Object.values(t.masks).filter(s=>i.has(s.key)).sort((s,o)=>s.name.localeCompare(o.name))}function J(a){return a&&a.level>=6?3:1}function K(a,t,i){return!a||!t||!t.type?[]:(a[t.type]||[]).filter(s=>s.crValue<=i)}function we(a,t){let i=[],s=t&&t.spellcasting&&t.spellcasting.dc,o=t&&(t.abilities||[]).find(l=>l.key==="int")||null;return o&&a.abilities&&a.abilities.int!==o.score&&i.push({label:"Intelligence",value:`${o.score} (${o.mod>=0?"+":""}${o.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),s&&i.push({label:"Save DC",value:String(s),why:"Any DC in this creature's abilities uses your spell save DC."}),i.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),i}function Ue(a){return a.replace(/@[A-Za-z]+\[((?:[^\[\]]|\[[^\]]*\])*)\](?:\{([^}]*)\})?/g,(t,i,s)=>{if(s)return s;let o=String(i).split("|"),l=o.length===3&&o[2].trim()?o[2]:o[0];return l.split(".").pop()||l})}function We(a){return a.replace(/&(?:amp;)?Reference\[([^\]]*)\](?:\{([^}]*)\})?/gi,(t,i,s)=>s||String(i).split("=").pop().trim().replace(/([a-z0-9])([A-Z])/g,"$1 $2"))}function Ve(a){let t={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};return a.replace(/\[\[\/([a-z]+)([^\]]*)\]\](?:\{([^}]*)\})?/gi,(i,s,o,l)=>{if(l)return l;let h=String(o).trim(),g=s.toLowerCase();if(g==="check"||g==="save"||g==="skill"||g==="concentration"){let A=h.match(/dc=(\d+)/i),T=h.match(/(?:ability|skill)=([a-z]+)/i),f=T?t[T[1].toLowerCase()]||T[1]:"",B=g==="save"||g==="concentration"?"save":"check";return[A?`DC ${A[1]}`:"",f,B].filter(Boolean).join(" ")}let w=h.replace(/\b\w+=[^\s]+/g,"").trim(),S=h.match(/type=([a-z]+)/i);return[w,S?S[1]:""].filter(Boolean).join(" ")})}var Ye={h:"Hit: ",hom:"Hit or Miss: ",actsavefail:"Failure: ",actsavesuccess:"Success: ",actsavesuccessorfail:"Success or Failure: "},Je={mw:"Melee Weapon Attack:",rw:"Ranged Weapon Attack:","mw,rw":"Melee or Ranged Weapon Attack:",ms:"Melee Spell Attack:",rs:"Ranged Spell Attack:","ms,rs":"Melee or Ranged Spell Attack:",m:"Melee Attack Roll:",r:"Ranged Attack Roll:","m,r":"Melee or Ranged Attack Roll:"},Ke={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};function Ze(a){return a.replace(/\{@([a-zA-Z]+)(?: ([^{}]*))?\}/g,(t,i,s="")=>{let o=i.toLowerCase(),l=Ye[o];if(l!==void 0)return l;if(o==="recharge")return`(Recharge ${s?`${s}\u20136`:"6"})`;if(o==="atk"||o==="atkr")return Je[s.replace(/\s/g,"")]??s;if(o==="hit")return/^[+-]/.test(s.trim())?s.trim():`+${s.trim()}`;if(o==="dc")return`DC ${s.trim()}`;if(o==="actsave")return`${Ke[s.trim().toLowerCase()]??s} Saving Throw:`;let h=s.split("|");return h.length===3&&h[2].trim()?h[2]:h[0]})}function Se(a){let t=String(a??"");return t=Ze(t),t=Ue(t),t=We(t),t=Ve(t),t}var Ge=[1,2,3,4,5,6,7,8,10,12,15,20],Qe=12;function xe(a){let t=a.root,i=a.onState,s=a.playerName||null,o=a.model||null,l=a.state,h=a.limits,g=!1,w=null,S=null,A=null;function T(){if(navigator.vibrate)try{navigator.vibrate(Qe)}catch{}}async function f(n,{undoable:e=!0}={}){if(g)return!1;g=!0;let r=l;T();let c=de(l,n,h);c&&(l=c,i(l,{optimistic:!0}));try{let u=await j(n,s);return l=u.state,h=u.limits||h,i(l,{note:u.note}),e&&B(n,r,u.note),!0}catch(u){return l=r,i(l,{error:u.message}),$(u.message,{tone:"error"}),!1}finally{g=!1}}function B(n,e,r){let c=me(n,e);$(r||"Done",{action:c?{label:"Undo",run:()=>f(c,{undoable:!1})}:null})}let x=null,X=null;function $(n,{tone:e="",action:r=null}={}){if(x||(x=document.createElement("div"),x.className="vos-play-toast",x.setAttribute("role","status"),document.body.appendChild(x)),x.className=`vos-play-toast is-on${e?` is-${e}`:""}`,x.innerHTML='<span class="vos-play-toast-text"></span>',x.querySelector(".vos-play-toast-text").textContent=n,r){let c=document.createElement("button");c.type="button",c.className="vos-play-toast-action",c.textContent=r.label,c.addEventListener("click",()=>{_(),r.run()}),x.appendChild(c)}clearTimeout(X),X=setTimeout(_,r?6e3:3e3)}function _(){x&&x.classList.remove("is-on")}let E=null;function L(n,e,r){b(),E=document.createElement("div"),E.className="vos-play-sheet",E.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${n}">
        <div class="vos-play-sheet-head">
          <span>${n}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${e}</div>
      </div>`,document.body.appendChild(E),E.addEventListener("click",u=>{u.target.closest("[data-close]")&&b()}),r&&r(E);let c=E.querySelector("button:not([data-close])");c&&c.focus()}function b(){E&&(E.remove(),E=null)}function ee(){let n=h&&h.maxHp||0,e=l.hp.current!=null?l.hp.current:n,r=Ge.map(c=>`<button type="button" class="vos-play-num" data-amount="${c}">${c}</button>`).join("");L("Hit points",`
      <div class="vos-play-hp">
        <span class="vos-play-hp-now">${e}<i>/${n||"\u2014"}</i></span>
        ${l.hp.temp?`<span class="vos-play-hp-temp">+${l.hp.temp} temp</span>`:""}
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
    `,c=>{let u="damage";c.querySelectorAll("[data-mode]").forEach(m=>{m.addEventListener("click",()=>{u=m.dataset.mode,c.querySelectorAll("[data-mode]").forEach(v=>v.classList.toggle("is-on",v===m))})});let p=()=>!!c.querySelector("[data-critical]").checked,y=m=>{m>0&&(b(),f(u==="heal"?{op:"heal",amount:m}:{op:"damage",amount:m,critical:p()}))};c.querySelectorAll("[data-amount]").forEach(m=>{m.addEventListener("click",()=>y(Number(m.dataset.amount)))}),c.querySelector(".vos-play-custom").addEventListener("submit",m=>{m.preventDefault(),y(Number(m.target.querySelector("input").value))}),c.querySelector("[data-full]").addEventListener("click",()=>{b(),f({op:"setHp",value:n})}),c.querySelector("[data-temp]").addEventListener("click",()=>{let m=Number(window.prompt("Temporary hit points",String(l.hp.temp||0)));b(),Number.isFinite(m)&&m>=0&&f({op:"setTempHp",value:m,keepHigher:!1})})})}function Ee(){let n=Number(l.hitDiceSpent||0),e=h&&h.hitDice||0;L("Hit dice",`
      <p class="vos-play-note">${Math.max(0,e-n)} of ${e} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `,r=>{r.querySelector(".vos-play-custom").addEventListener("submit",c=>{c.preventDefault();let u=Number(c.target.querySelector("input").value)||0;b(),f({op:"spendHitDie",healed:u})}),r.querySelector("[data-nothing]").addEventListener("click",()=>{b(),f({op:"spendHitDie"})})})}function Le(){let n=o&&o.pactRecovery;if(!n||!(h&&h.pact))return"";let e=Math.max(0,n.uses.max-Number((l.uses||{})[n.id]||0));return`<button type="button" class="vos-play-rest" data-pact-rite${e?"":" disabled"}>
      <b>${d(n.name)}</b><span>${e?"A 1-minute rite. Regain up to half your pact slots, rounded up.":"Spent \u2014 a long rest brings it back."}</span>
    </button>`}async function Ae(){let n=o.pactRecovery,e=Number(l.pact||0);if(!e){$("No pact slots are spent.",{tone:"warn"});return}let r=Math.min(e,Math.ceil((h.pact||0)/2));if(await f({op:"useCharge",feature:n.id,max:n.uses.max},{undoable:!1})){for(let c=0;c<r;c+=1)await f({op:"restorePactSlot"},{undoable:!1});$(`${n.name} \u2014 ${r} pact slot${r===1?"":"s"} regained.`)}}function Ne(){L("Rest",`
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
    `,n=>{n.querySelectorAll("[data-rest]").forEach(r=>{r.addEventListener("click",()=>{let c=r.dataset.rest;c==="longRest"&&!window.confirm("Take a long rest?")||(b(),f({op:c}))})});let e=n.querySelector("[data-pact-rite]");e&&e.addEventListener("click",()=>{b(),Ae()})})}let He=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function te(){let n=new Set(l.conditions||[]),e={};try{e=await he()}catch{}let r=He.map(p=>{let y=e[p]||{};return`<div class="vos-play-cond-row${n.has(p)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${p}">${d(y.name||p.charAt(0).toUpperCase()+p.slice(1))}</button>
        ${y.text?`<details class="vos-play-cond-rules">
          <summary>What it does${y.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${d(y.text)}</p>
        </details>`:""}
      </div>`}).join(""),c=l.concentration,u=`<div class="vos-play-conc">
      ${c?`<span>Concentrating on <b>${d(c.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;L("Conditions",u+`<div class="vos-play-conds is-rows">${r}</div>`,p=>{p.querySelectorAll("[data-condition]").forEach(v=>{v.addEventListener("click",()=>{let k=v.dataset.condition,N=v.closest(".vos-play-cond-row"),W=!N.classList.contains("is-on");N.classList.toggle("is-on",W),f({op:W?"addCondition":"removeCondition",condition:k})})});let y=p.querySelector("[data-break]");y&&y.addEventListener("click",()=>{b(),f({op:"breakConcentration"})});let m=p.querySelector("[data-concentrate]");m&&m.addEventListener("click",()=>{let v=window.prompt("Concentrating on which spell?");b(),v&&v.trim()&&f({op:"concentrate",spell:v.trim()})})})}function d(n){return String(n??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}async function Me(){let n=o&&o.spells||[];if(!n.length){$("This character has no spells.",{tone:"error"});return}let e=await Te(),r=new Set(l.prepared||[]),c=n.map(p=>{let y=p.spells.map(m=>{let v=m.always||m.level===0,k=v||r.has(m.id),N=[m.school,...m.meta].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${k?" is-on":""}${v?" is-fixed":""}"
                       data-name="${d(m.name.toLowerCase())}">
          <input type="checkbox" data-spell="${d(m.id)}"${k?" checked":""}${v?" disabled":""}>
          <span class="vos-play-spell-name">${d(m.name)}${v?'<i title="Always available">always</i>':""}</span>
          <span class="vos-play-spell-meta">${d(N)}</span>
        </label>`}).join("");return`<h4 class="vos-play-spell-level">${d(p.label)}</h4>${y}`}).join(""),u=ae();L("Prepare spells",`
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${u}${e?` / ${e}`:""}</span>
        <input type="search" class="vos-play-search" placeholder="Search your spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Your spellbook. Cantrips and always-prepared spells do not
      count against the total.${e?` Your class prepares ${e} at this level; going over
      is allowed if something says so.`:""}</p>
      <div class="vos-play-spells">${c}</div>
    `,p=>{let y=p.querySelector("[data-count]");p.querySelectorAll("[data-spell]").forEach(v=>{v.addEventListener("change",()=>{v.closest(".vos-play-spell").classList.toggle("is-on",v.checked),f({op:"togglePrepared",spell:v.dataset.spell},{undoable:!1});let k=ae(p);y.textContent=e?`${k} / ${e}`:String(k),y.classList.toggle("is-over",!!(e&&k>e))})});let m=p.querySelector(".vos-play-search");m.addEventListener("input",()=>{let v=m.value.trim().toLowerCase();p.querySelectorAll(".vos-play-spell").forEach(k=>{k.hidden=!!v&&!k.dataset.name.includes(v)})})})}function ae(n){if(n)return n.querySelectorAll("[data-spell]:checked:not(:disabled)").length;let e=new Set;return(o&&o.spells||[]).forEach(r=>r.spells.forEach(c=>{(c.always||c.level===0)&&e.add(c.id)})),(l.prepared||[]).filter(r=>!e.has(r)).length}async function Te(){return w||(w=await ve(ye(o)).catch(()=>null)),be(w,o&&o.level||0)}async function z(){return S||(S=await ge().catch(()=>null)),A||(A=await $e().catch(()=>null)),!!S}async function ne(){if(!await z()){$("Could not load the masks.",{tone:"error"});return}let n=ke(o,S);if(!n.length){$("This character has no masks.",{tone:"error"});return}let e=l.mask,r=se(),c=n.map(u=>`
      <button type="button" class="vos-play-mask${e&&e.key===u.key?" is-on":""}"
              data-mask="${d(u.key)}">
        <b>${d(u.name)}</b>
        <span>${d(u.type)} \xB7 ${K(A,u,J(o)).length} forms available</span>
      </button>`).join("");L("The Masquerade",`
      ${e?`<p class="vos-play-note">Wearing <b>${d(e.key)}</b>.</p>`:""}
      ${r!=null?`<p class="vos-play-note">${r} of ${o.maskUses.uses.max} donnings left today.</p>`:""}
      ${c}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      ${e?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
    `,u=>{u.querySelectorAll("[data-mask]").forEach(y=>{y.addEventListener("click",async()=>{let m=y.dataset.mask;if(b(),se()===0){$("No mask donnings left \u2014 a long rest brings them back.",{tone:"warn"});return}let v=(o.abilities||[]).find(R=>R.key==="cha"),k=(o.classes||[]).filter(R=>String(R.identifier).toLowerCase()==="bard").reduce((R,Be)=>R+(Be.levels||0),0)||o.level||0,N=v?Math.max(0,v.mod+k):0;await f({op:"donMask",mask:m,tempHp:N})&&o.maskUses&&f({op:"useCharge",feature:o.maskUses.id,max:o.maskUses.uses.max},{undoable:!1})})});let p=u.querySelector("[data-remove]");p&&p.addEventListener("click",()=>{b(),f({op:"removeMask"})})})}function se(){let n=o&&o.maskUses;return n?Math.max(0,n.uses.max-Number((l.uses||{})[n.id]||0)):null}async function Re(){if(!l.mask){ne();return}if(!await z())return;let n=S.masks[l.mask.key],e=J(o),r=K(A,n,e);if(!r.length){$("No forms available for this mask.",{tone:"error"});return}let c=r.map((u,p)=>`
      <button type="button" class="vos-play-form" data-form="${p}">
        <b>${d(u.name)}</b>
        <span class="vos-play-form-cr">CR ${d(u.cr)}</span>
        <span class="vos-play-form-meta">AC ${d(u.ac)} \xB7 ${d(u.hp)} HP \xB7 ${d(u.speed)}</span>
      </button>`).join("");L(`Assume a form \u2014 ${d(n.name)}`,`
      <p class="vos-play-note">Challenge Rating ${e} or lower${o.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${c}</div>
    `,u=>{u.querySelectorAll("[data-form]").forEach(p=>{p.addEventListener("click",()=>{let y=r[Number(p.dataset.form)];b(),f({op:"assumeForm",creature:y.name,source:y.source,cr:y.cr,hp:y.hp})})})})}async function De(){if(!l.form||!await z())return"";let n=S.masks[l.mask?l.mask.key:""],r=(A&&n&&A[n.type]||[]).find(p=>p.name===l.form.creature);if(!r)return"";let c=we(r,o).map(p=>`
      <div class="vos-play-override">
        <b>${d(p.label)}</b><span>${d(p.value)}</span><i>${d(p.why)}</i>
      </div>`).join(""),u=(p,y)=>p.length?`
      <h4 class="vos-play-form-h">${y}</h4>
      ${p.map(m=>`<p class="vos-play-form-entry"><b>${d(m.name)}.</b> ${d(Se(m.text))}</p>`).join("")}`:"";return`
      <article class="vos-play-formblock">
        <header>
          <h3>${d(r.name)}</h3>
          <p>${d(r.size)} ${d(r.type)} \xB7 CR ${d(r.cr)}</p>
        </header>
        <div class="vos-play-form-vitals">
          <span><b>${d(r.ac)}</b>AC</span>
          <span><b>${d(l.form.hp)}</b>/${d(l.form.maxHp)} HP</span>
          <span><b>${d(r.speed)}</b>Speed</span>
        </div>
        <div class="vos-play-overrides">${c}</div>
        ${u(r.traits,"Traits")}
        ${u(r.actions,"Actions")}
      </article>`}function oe(n){return(o&&o.activatable||[]).find(e=>e.id===n)||null}function re(n){return!!(l.active||{})[n]}function le(n){let e=Number((l.uses||{})[n.id]||0);return Math.max(0,n.uses.max-e)}function qe(n){let e=oe(n);if(e){if(re(n)){U(n);return}if(!le(e)){$(`No uses of ${e.name} left \u2014 a rest brings them back.`,{tone:"warn"});return}f({op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})}}function U(n){let e=oe(n);if(!e)return;let r=re(n),c=le(e);L(e.name,`
      <p class="vos-play-feature-state">${r?"Active now.":`${c} of ${e.uses.max} uses left${e.uses.recovery?`, back on a ${d(e.uses.recovery)}`:""}${e.activation?` \xB7 ${d(e.activation)}`:""}.`}</p>
      <ul class="vos-play-feature-grants">${e.grants.map(u=>`<li>${d(u)}</li>`).join("")}</ul>
      ${(e.related||[]).length?`<p class="vos-play-note">Riding on it: ${e.related.map(u=>`<b>${d(u.name)}</b>`).join(", ")} \u2014 their text is under Features.</p>`:""}
      ${r?'<button type="button" class="vos-play-btn is-danger" data-feature-act="end">End it</button>':`<button type="button" class="vos-play-btn is-primary" data-feature-act="start"${c?"":" disabled"}>${c?`Use ${d(e.name)}`:"No uses left"}</button>`}
    `,u=>{let p=u.querySelector("[data-feature-act]");p&&p.addEventListener("click",()=>{b(),f(p.dataset.featureAct==="end"?{op:"endFeature",feature:e.id}:{op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})})})}function P(n,e){return Math.max(0,e-Number((l.uses||{})[n]||0))}function Pe({id:n,name:e,max:r,tempHp:c}){if(!P(n,r)){$(`No uses of ${e} left \u2014 a rest brings them back.`,{tone:"warn"});return}let u={op:"useCharge",feature:n,max:r};c&&(u.tempHp=c),f(u)}function ie(n){return(o&&o.freeCasts||[]).find(e=>e.id===n)||null}function ce(n){let e=l.concentration;return!!(n.concentration&&e&&e.spell===n.spellName)}async function ue(n){let e=ie(n);if(e){if(ce(e)||!P(e.id,e.uses.max)){pe(n);return}e.concentration&&!await f({op:"concentrate",spell:e.spellName},{undoable:!1})||(await f({op:"useCharge",feature:e.id,max:e.uses.max},{undoable:!1}),$(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`))}}function Fe(n){return!n.spellLevel||!(o&&o.spellcasting)?null:(o.spellcasting.slots||[]).filter(e=>!e.pact&&e.level>=n.spellLevel).find(e=>Math.max(0,e.max-Number((l.slots||{})[String(e.level)]||0))>0)||null}function je(n){for(let e of o&&o.spells||[]){let r=e.spells.find(c=>c.id===n);if(r)return r.description||""}return""}function pe(n){let e=ie(n);if(!e)return;let r=ce(e),c=P(e.id,e.uses.max),u=!r&&!c?Fe(e):null;L(e.spellName,`
      <p class="vos-play-feature-state">${r?`Active now \u2014 concentrating on ${d(e.spellName)}.`:`${c} of ${e.uses.max} free casts left${e.uses.recovery?`, back on a ${d(e.uses.recovery)}`:""} \u2014 ${d(e.featureName)}.`}</p>
      ${r?`<button type="button" class="vos-play-btn is-danger" data-cast-act="end">End ${d(e.spellName)}</button>`:`<button type="button" class="vos-play-btn is-primary" data-cast-act="free"${c?"":" disabled"}>${c?"Cast \u2014 no slot spent":"No free casts left"}</button>`}
      ${u?`<button type="button" class="vos-play-btn" data-cast-act="slot"
          data-level="${u.level}">Cast with a level ${u.level} slot</button>`:""}
      <div class="vos-play-rules">${je(e.spellId)}</div>
    `,p=>{p.querySelectorAll("[data-cast-act]").forEach(y=>{y.addEventListener("click",async()=>{let m=y.dataset.castAct;if(b(),m==="end"){f({op:"breakConcentration"});return}if(m==="free"){ue(n);return}if(m==="slot"){if(!await f({op:"spendSlot",level:Number(y.dataset.level)},{undoable:!1}))return;e.concentration&&await f({op:"concentrate",spell:e.spellName},{undoable:!1}),$(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`)}})})})}function Oe(n){let e=(o&&o.features||[]).find(r=>r.id===n);e&&L(e.name,`
      <p class="vos-play-feature-state">Once per turn \u2014 no uses to spend.</p>
      <div class="vos-play-rules">${e.description||""}</div>
    `)}async function Ie(){let n=o&&o.zeroHpRescue;!n||!P(n.id,n.uses.max)||await f({op:"useCharge",feature:n.id,max:n.uses.max},{undoable:!1})&&(await f({op:"heal",amount:1},{undoable:!1}),await f({op:"adjustExhaustion",delta:-1},{undoable:!1}),$(`${n.name} \u2014 up at 1 hit point.`))}function F(n){let e=n.target.closest("[data-play]");if(!(!e||!t.contains(e))&&!(n.type==="keydown"&&!["Enter"," "].includes(n.key)))switch(n.type==="keydown"&&n.preventDefault(),e.dataset.play){case"hp":ee();break;case"hitdice":Ee();break;case"slot":{let r=Number(e.dataset.level),c=e.dataset.spent==="1";f({op:c?"restoreSlot":"spendSlot",level:r});break}case"pact":{f({op:e.dataset.spent==="1"?"restorePactSlot":"spendPactSlot"});break}case"charge":{let r=e.dataset.feature;if(!r)return;f({op:"useCharge",feature:r,max:Number(e.dataset.max)||void 0});break}case"charge-pip":{let r=e.dataset.feature;if(!r)return;f(e.dataset.spent==="1"?{op:"restoreCharge",feature:r}:{op:"useCharge",feature:r,max:Number(e.dataset.max)||void 0});break}case"feature":U(e.dataset.feature);break;case"end-feature":f({op:"endFeature",feature:e.dataset.feature});break;case"exhaustion":{let r=Number(e.dataset.value);f({op:"setExhaustion",value:r===l.exhaustion?r-1:r});break}case"conditions":case"condition":te();break;default:break}}return t.addEventListener("click",F),t.addEventListener("keydown",F),{apply:f,openHpPad:ee,openRests:Ne,openConditions:te,openPrepare:Me,openMasks:ne,openForms:Re,openFeature:U,activateFeature:qe,spendCharge:Pe,castFreeSpell:ue,openFreeCast:pe,openPerTurnRule:Oe,rescueFromZero:Ie,formStatblockHtml:De,setState(n,e){l=n,e&&(h=e)},destroy(){t.removeEventListener("click",F),t.removeEventListener("keydown",F),b(),_()}}}var Xe=12e3,M=document.getElementById("vos-party-root"),Z=document.getElementById("vos-party-status"),I=[],G=null,H=!1;function C(a){return String(a??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}function et(a=6e3){return new Promise(t=>{let i=Date.now();(function s(){if(window.VOS_PWA)return t(window.VOS_PWA);if(Date.now()-i>a)return t(null);setTimeout(s,80)})()})}function tt(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function at(){let a=await fetch("/api/play/party",{cache:"no-store",headers:tt()}),t=await a.json().catch(()=>({}));if(!a.ok){let i=new Error(t.error||`HTTP ${a.status}`);throw i.status=a.status,i}return t.party||[]}function nt(a,t){if(!t||a==null)return"";let i=a/t;return a===0?"is-down":i<=.25?"is-bloodied":i<=.5?"is-hurt":""}function st(a){let t=a.limits&&a.limits.slots||{},i=a.state.slots||{},s=Object.keys(t).sort();return s.length?s.map(o=>{let l=t[o],h=Math.max(0,l-(i[o]||0));return`<span class="vos-party-slot${h?"":" is-empty"}">
      <i>${C(o)}</i>${h}<b>/${l}</b></span>`}).join(""):""}function ot(a){let t=a.state,i=a.limits&&a.limits.maxHp||0,s=t.hp.current!=null?t.hp.current:i,o=i?Math.max(0,Math.min(100,s/i*100)):0,l=(t.conditions||[]).includes("dying"),h=(t.conditions||[]).filter(w=>w!=="dying"),g=Math.max(0,(a.limits&&a.limits.hitDice||0)-(t.hitDiceSpent||0));return a.hasStatblock?`<article class="vos-party-card ${nt(s,i)}${l?" is-dying":""}"
                   data-player="${C(a.playerName)}">
    <header class="vos-party-head">
      <h2>${C(a.character)}</h2>
      <span class="vos-party-class">${C(a.classLine||"")}</span>
      ${a.ac!=null?`<span class="vos-party-ac">AC ${C(a.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${C(a.character)} hit points ${s} of ${i}">
      <span class="vos-party-hp-fill" style="width:${o}%"></span>
      <span class="vos-party-hp-text">
        <b>${s}</b><i>/${i||"\u2014"}</i>
        ${t.hp.temp?`<em>+${t.hp.temp}</em>`:""}
      </span>
      ${l?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${t.exhaustion?`<div class="vos-party-exh" title="\u2212${t.exhaustion*2} to d20 tests, \u2212${t.exhaustion*5} ft">
      ${Array.from({length:6},(w,S)=>`<span class="${S<t.exhaustion?"is-on":""}"></span>`).join("")}
      <b>Exhaustion ${t.exhaustion}</b>
    </div>`:""}

    ${t.mask?`<div class="vos-party-mask">
      ${C(t.form?t.form.creature:t.mask.key)}
    </div>`:""}

    ${t.concentration?`<div class="vos-party-conc">Concentrating: ${C(t.concentration.spell)}</div>`:""}

    ${Object.keys(t.active||{}).length?`<div class="vos-party-active">${Object.values(t.active).map(w=>C(w.name)).join(" \xB7 ")}</div>`:""}

    <div class="vos-party-row">
      ${st(a)}
      ${g?`<span class="vos-party-hd">${g} HD</span>`:""}
    </div>

    <div class="vos-party-conds">
      ${h.length?h.map(w=>`<span>${C(w)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <a class="vos-party-view" href="/sheet/?as=${encodeURIComponent(a.playerName)}"
         title="Open their sheet as they see it">View</a>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${C(a.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function Q(){M.innerHTML=I.map(ot).join("")}function D(a,t=""){Z&&(Z.textContent=a,Z.className=`vos-party-status${t?` is-${t}`:""}`)}function rt(a){let t=I.find(i=>i.playerName===a);return t?xe({root:M,playerName:a,state:t.state,limits:t.limits,onState(i){t.state=i,Q()}}):null}async function lt(a,t){let i=t==="heal"?"Heal":"Damage",s=Number(window.prompt(`${i} ${a.character} by how much?`,"5"));if(!(!Number.isFinite(s)||s<=0))try{let o=await j({op:t==="heal"?"heal":"damage",amount:s},a.playerName);a.state=o.state,a.limits=o.limits||a.limits,Q()}catch(o){D(o.message,"error")}}function it(a){let t=a.target.closest("[data-act]");if(!t)return;let i=t.closest("[data-player]");if(!i)return;let s=I.find(h=>h.playerName===i.dataset.player);if(!s)return;let o=t.dataset.act;if(o==="damage"||o==="heal"){lt(s,o);return}let l=rt(s.playerName);l&&(o==="hp"&&l.openHpPad(),o==="conditions"&&l.openConditions())}async function q({quiet:a=!1}={}){a||D("Refreshing\u2026");try{I=await at(),Q(),D(`Updated ${new Date().toLocaleTimeString()}`)}catch(t){if(t.status===401||t.status===403){D("DM only.","error"),Ce();return}D(`Could not refresh \u2014 ${t.message}`,"error")}}function ct(){Ce(),G=setInterval(()=>{!H&&!document.hidden&&q({quiet:!0})},Xe)}function Ce(){clearInterval(G),G=null}document.addEventListener("visibilitychange",()=>{document.hidden||q({quiet:!0})});async function ut(){let a=await et(),t=a&&a.getPlayerName?a.getPlayerName():null;if(!t){M.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(t==="DM"||a&&a.isDm&&a.isDm())){M.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}M.addEventListener("click",it);let i=document.getElementById("vos-party-pause");i&&i.addEventListener("click",()=>{H=!H,i.textContent=H?"Resume updates":"Pause updates",i.setAttribute("aria-pressed",String(H)),H||q()});let s=document.getElementById("vos-party-refresh");s&&s.addEventListener("click",()=>q()),await q(),ct()}M&&ut();})();
