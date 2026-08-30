(()=>{function We(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function Ve(a,t){let c=await fetch(a,{cache:"no-store",...t||{},headers:We({"Content-Type":"application/json",...(t||{}).headers||{}})}),s=await c.json().catch(()=>({}));if(!c.ok){let o=new Error(s.error||`HTTP ${c.status}`);throw o.status=c.status,o.code=s.error_code,o}return s}function O(a,t){let c=t?{...a,playerName:t}:a;return Ve("/api/play/op",{method:"POST",body:JSON.stringify(c)})}function he(a,t,c){if(!a)return a;let s=JSON.parse(JSON.stringify(a)),o=c&&c.maxHp;switch(t.op){case"damage":{let l=Math.min(s.hp.temp||0,t.amount);return s.hp.temp-=l,s.hp.current!=null&&(s.hp.current=Math.max(0,s.hp.current-(t.amount-l))),s.hp.current===0?null:s}case"heal":{s.hp.current==null&&(s.hp.current=0);let l=s.hp.current+t.amount;return s.hp.current=o!=null?Math.min(l,o):l,s}case"spendSlot":{let l=String(t.level),y=((c||{}).slots||{})[l],g=(s.slots[l]||0)+1;return y!=null&&g>y?null:(s.slots[l]=g,s)}case"restoreSlot":{let l=String(t.level);return s.slots[l]=Math.max(0,(s.slots[l]||0)-1),s}case"useCharge":{let l=(s.uses[t.feature]||0)+1;return t.max!=null&&l>t.max?null:(s.uses[t.feature]=l,t.tempHp!=null&&(s.hp.temp=Math.max(s.hp.temp||0,t.tempHp)),s)}case"restoreCharge":return s.uses[t.feature]=Math.max(0,(s.uses[t.feature]||0)-1),s;case"spendPactSlot":{let l=(c||{}).pact,y=(s.pact||0)+1;return l!=null&&y>l?null:(s.pact=y,s)}case"restorePactSlot":return s.pact=Math.max(0,(s.pact||0)-1),s;default:return null}}function ye(a,t){switch(a.op){case"damage":return{op:"setHp",value:t.hp.current,_restore:t};case"heal":return{op:"setHp",value:t.hp.current};case"setHp":return{op:"setHp",value:t.hp.current};case"setTempHp":return{op:"setTempHp",value:t.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:a.level};case"restoreSlot":return{op:"spendSlot",level:a.level};case"spendPactSlot":return{op:"restorePactSlot"};case"restorePactSlot":return{op:"spendPactSlot"};case"useCharge":return{op:"restoreCharge",feature:a.feature};case"restoreCharge":return{op:"useCharge",feature:a.feature};case"addCondition":return{op:"removeCondition",condition:a.condition};case"removeCondition":return{op:"addCondition",condition:a.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-a.delta};case"setExhaustion":return{op:"setExhaustion",value:t.exhaustion};default:return null}}var I=new Map;async function J(a){if(I.has(a))return I.get(a);let t=fetch(a,{cache:"default"}).then(c=>{if(!c.ok)throw new Error(`HTTP ${c.status}`);return c.json()}).catch(c=>{throw I.delete(a),c});return I.set(a,t),t}function Z(a){return J(a)}function be(){return J("/data/play/conditions.json")}var ve={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function ge(a){let t=a&&a.classes||[];for(let c of t){let s=String(c.identifier||c.name||"").toLowerCase();if(ve[s])return ve[s]}return null}async function $e(a){if(!a)return null;try{return await J(`/data/play/spells-${a}.json`)}catch{return null}}function ke(a,t){if(!a||!Array.isArray(a.prepared)||!t)return null;let c=a.prepared[t-1];return typeof c=="number"?c:null}function we(){return Z("/data/play/masquerade.json")}function Se(){return Z("/data/play/forms.json")}function G(a,t){if(!a||!t)return[];let c=new Set((a.features||[]).map(s=>(s.name||"").toLowerCase()).filter(s=>s.startsWith("maschera ")).map(s=>s.split(" ")[1]));return Object.values(t.masks).filter(s=>c.has(s.key)).sort((s,o)=>s.name.localeCompare(o.name))}function B(a){return a&&a.level>=6?3:1}function K(a,t,c){return!a||!t||!t.type?[]:(a[t.type]||[]).filter(s=>s.crValue<=c)}function xe(a,t){let c=[],s=t&&t.spellcasting&&t.spellcasting.dc,o=t&&(t.abilities||[]).find(l=>l.key==="int")||null;return o&&a.abilities&&a.abilities.int!==o.score&&c.push({label:"Intelligence",value:`${o.score} (${o.mod>=0?"+":""}${o.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),s&&c.push({label:"Save DC",value:String(s),why:"Any DC in this creature's abilities uses your spell save DC."}),c.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),c}function Ye(a){return a.replace(/@[A-Za-z]+\[((?:[^[\]]|\[[^\]]*\])*)\](?:\{([^}]*)\})?/g,(t,c,s)=>{if(s)return s;let o=String(c).split("|"),l=o.length===3&&o[2].trim()?o[2]:o[0];return l.split(".").pop()||l})}function Je(a){return a.replace(/&(?:amp;)?Reference\[([^\]]*)\](?:\{([^}]*)\})?/gi,(t,c,s)=>s||String(c).split("=").pop().trim().replace(/([a-z0-9])([A-Z])/g,"$1 $2"))}function Ze(a){let t={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};return a.replace(/\[\[\/([a-z]+)([^\]]*)\]\](?:\{([^}]*)\})?/gi,(c,s,o,l)=>{if(l)return l;let y=String(o).trim(),g=s.toLowerCase();if(g==="check"||g==="save"||g==="skill"||g==="concentration"){let k=y.match(/dc=(\d+)/i),M=y.match(/(?:ability|skill)=([a-z]+)/i),h=M?t[M[1].toLowerCase()]||M[1]:"",z=g==="save"||g==="concentration"?"save":"check";return[k?`DC ${k[1]}`:"",h,z].filter(Boolean).join(" ")}let S=y.replace(/\b\w+=[^\s]+/g,"").trim(),x=y.match(/type=([a-z]+)/i);return[S,x?x[1]:""].filter(Boolean).join(" ")})}var Ge={h:"Hit: ",hom:"Hit or Miss: ",actsavefail:"Failure: ",actsavesuccess:"Success: ",actsavesuccessorfail:"Success or Failure: "},Ke={mw:"Melee Weapon Attack:",rw:"Ranged Weapon Attack:","mw,rw":"Melee or Ranged Weapon Attack:",ms:"Melee Spell Attack:",rs:"Ranged Spell Attack:","ms,rs":"Melee or Ranged Spell Attack:",m:"Melee Attack Roll:",r:"Ranged Attack Roll:","m,r":"Melee or Ranged Attack Roll:"},Qe={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};function Xe(a){return a.replace(/\{@([a-zA-Z]+)(?: ([^{}]*))?\}/g,(t,c,s="")=>{let o=c.toLowerCase(),l=Ge[o];if(l!==void 0)return l;if(o==="recharge")return`(Recharge ${s?`${s}\u20136`:"6"})`;if(o==="atk"||o==="atkr")return Ke[s.replace(/\s/g,"")]??s;if(o==="hit")return/^[+-]/.test(s.trim())?s.trim():`+${s.trim()}`;if(o==="dc")return`DC ${s.trim()}`;if(o==="actsave")return`${Qe[s.trim().toLowerCase()]??s} Saving Throw:`;let y=s.split("|");return y.length===3&&y[2].trim()?y[2]:y[0]})}function Ce(a){let t=String(a??"");return t=Xe(t),t=Ye(t),t=Je(t),t=Ze(t),t}var et=[1,2,3,4,5,6,7,8,10,12,15,20],tt=12;function Ee(a){let t=a.root,c=a.onState,s=a.playerName||null,o=a.model||null,l=a.state,y=a.limits,g=!1,S=null,x=null,k=null;function M(){if(navigator.vibrate)try{navigator.vibrate(tt)}catch{}}async function h(n,{undoable:e=!0}={}){if(g)return!1;g=!0;let r=l;M();let i=he(l,n,y);i&&(l=i,c(l,{optimistic:!0}));try{let u=await O(n,s);return l=u.state,y=u.limits||y,c(l,{note:u.note}),e&&z(n,r,u.note),!0}catch(u){return l=r,c(l,{error:u.message}),$(u.message,{tone:"error"}),!1}finally{g=!1}}function z(n,e,r){let i=ye(n,e);$(r||"Done",{action:i?{label:"Undo",run:()=>h(i,{undoable:!1})}:null})}let E=null,te=null;function $(n,{tone:e="",action:r=null}={}){if(E||(E=document.createElement("div"),E.className="vos-play-toast",E.setAttribute("role","status"),document.body.appendChild(E)),E.className=`vos-play-toast is-on${e?` is-${e}`:""}`,E.innerHTML='<span class="vos-play-toast-text"></span>',E.querySelector(".vos-play-toast-text").textContent=n,r){let i=document.createElement("button");i.type="button",i.className="vos-play-toast-action",i.textContent=r.label,i.addEventListener("click",()=>{U(),r.run()}),E.appendChild(i)}clearTimeout(te),te=setTimeout(U,r?6e3:3e3)}function U(){E&&E.classList.remove("is-on")}let A=null;function C(n,e,r){b(),A=document.createElement("div"),A.className="vos-play-sheet",A.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${n}">
        <div class="vos-play-sheet-head">
          <span>${n}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${e}</div>
      </div>`,document.body.appendChild(A),A.addEventListener("click",u=>{u.target.closest("[data-close]")&&b()}),r&&r(A);let i=A.querySelector("button:not([data-close])");i&&i.focus()}function b(){A&&(A.remove(),A=null)}function ae(){let n=y&&y.maxHp||0,e=l.hp.current!=null?l.hp.current:n,r=et.map(i=>`<button type="button" class="vos-play-num" data-amount="${i}">${i}</button>`).join("");C("Hit points",`
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
    `,i=>{let u="damage";i.querySelectorAll("[data-mode]").forEach(f=>{f.addEventListener("click",()=>{u=f.dataset.mode,i.querySelectorAll("[data-mode]").forEach(v=>v.classList.toggle("is-on",v===f))})});let d=()=>!!i.querySelector("[data-critical]").checked,m=f=>{f>0&&(b(),h(u==="heal"?{op:"heal",amount:f}:{op:"damage",amount:f,critical:d()}))};i.querySelectorAll("[data-amount]").forEach(f=>{f.addEventListener("click",()=>m(Number(f.dataset.amount)))}),i.querySelector(".vos-play-custom").addEventListener("submit",f=>{f.preventDefault(),m(Number(f.target.querySelector("input").value))}),i.querySelector("[data-full]").addEventListener("click",()=>{b(),h({op:"setHp",value:n})}),i.querySelector("[data-temp]").addEventListener("click",()=>{let f=Number(window.prompt("Temporary hit points",String(l.hp.temp||0)));b(),Number.isFinite(f)&&f>=0&&h({op:"setTempHp",value:f,keepHigher:!1})})})}function Ae(){let n=Number(l.hitDiceSpent||0),e=y&&y.hitDice||0;C("Hit dice",`
      <p class="vos-play-note">${Math.max(0,e-n)} of ${e} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `,r=>{r.querySelector(".vos-play-custom").addEventListener("submit",i=>{i.preventDefault();let u=Number(i.target.querySelector("input").value)||0;b(),h({op:"spendHitDie",healed:u})}),r.querySelector("[data-nothing]").addEventListener("click",()=>{b(),h({op:"spendHitDie"})})})}function Ne(){let n=o&&o.pactRecovery;if(!n||!(y&&y.pact))return"";let e=Math.max(0,n.uses.max-Number((l.uses||{})[n.id]||0));return`<button type="button" class="vos-play-rest" data-pact-rite${e?"":" disabled"}>
      <b>${p(n.name)}</b><span>${e?"A 1-minute rite. Regain up to half your pact slots, rounded up.":"Spent \u2014 a long rest brings it back."}</span>
    </button>`}async function He(){let n=o.pactRecovery,e=Number(l.pact||0);if(!e){$("No pact slots are spent.",{tone:"warn"});return}let r=Math.min(e,Math.ceil((y.pact||0)/2));if(await h({op:"useCharge",feature:n.id,max:n.uses.max},{undoable:!1})){for(let i=0;i<r;i+=1)await h({op:"restorePactSlot"},{undoable:!1});$(`${n.name} \u2014 ${r} pact slot${r===1?"":"s"} regained.`)}}function Te(){C("Rest",`
      <button type="button" class="vos-play-rest" data-rest="shortRest">
        <b>Short rest</b><span>30 minutes. Spend hit dice one at a time.</span>
      </button>
      <button type="button" class="vos-play-rest" data-rest="fieldRest">
        <b>Field rest</b><span>8 hours somewhere unsafe. Hit dice heal for their maximum.</span>
      </button>
      <button type="button" class="vos-play-rest is-long" data-rest="longRest">
        <b>Long rest</b><span>Everything back, and one point of exhaustion clears.</span>
      </button>
      ${Ne()}
      <p class="vos-play-note">A long rest needs your own bed or a Secure place \u2014 or three
      quiet nights to establish a haven. Never inside the fog.</p>
    `,n=>{n.querySelectorAll("[data-rest]").forEach(r=>{r.addEventListener("click",()=>{let i=r.dataset.rest;i==="longRest"&&!window.confirm("Take a long rest?")||(b(),h({op:i}))})});let e=n.querySelector("[data-pact-rite]");e&&e.addEventListener("click",()=>{b(),He()})})}let Me=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function ne(){let n=new Set(l.conditions||[]),e={};try{e=await be()}catch{}let r=Me.map(d=>{let m=e[d]||{};return`<div class="vos-play-cond-row${n.has(d)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${d}">${p(m.name||d.charAt(0).toUpperCase()+d.slice(1))}</button>
        ${m.text?`<details class="vos-play-cond-rules">
          <summary>What it does${m.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${p(m.text)}</p>
        </details>`:""}
      </div>`}).join(""),i=l.concentration,u=`<div class="vos-play-conc">
      ${i?`<span>Concentrating on <b>${p(i.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;C("Conditions",u+`<div class="vos-play-conds is-rows">${r}</div>`,d=>{d.querySelectorAll("[data-condition]").forEach(v=>{v.addEventListener("click",()=>{let w=v.dataset.condition,N=v.closest(".vos-play-cond-row"),Y=!N.classList.contains("is-on");N.classList.toggle("is-on",Y),h({op:Y?"addCondition":"removeCondition",condition:w})})});let m=d.querySelector("[data-break]");m&&m.addEventListener("click",()=>{b(),h({op:"breakConcentration"})});let f=d.querySelector("[data-concentrate]");f&&f.addEventListener("click",()=>{let v=window.prompt("Concentrating on which spell?");b(),v&&v.trim()&&h({op:"concentrate",spell:v.trim()})})})}function p(n){return String(n??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}async function Re(){let n=o&&o.spells||[];if(!n.length){$("This character has no spells.",{tone:"error"});return}let e=await qe(),r=new Set(l.prepared||[]),i=n.map(d=>{let m=d.spells.map(f=>{let v=f.always||f.level===0,w=v||r.has(f.id),N=[f.school,...f.meta].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${w?" is-on":""}${v?" is-fixed":""}"
                       data-name="${p(f.name.toLowerCase())}">
          <input type="checkbox" data-spell="${p(f.id)}"${w?" checked":""}${v?" disabled":""}>
          <span class="vos-play-spell-name">${p(f.name)}${v?'<i title="Always available">always</i>':""}</span>
          <span class="vos-play-spell-meta">${p(N)}</span>
        </label>`}).join("");return`<h4 class="vos-play-spell-level">${p(d.label)}</h4>${m}`}).join(""),u=se();C("Prepare spells",`
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${u}${e?` / ${e}`:""}</span>
        <input type="search" class="vos-play-search" placeholder="Search your spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Your spellbook. Cantrips and always-prepared spells do not
      count against the total.${e?` Your class prepares ${e} at this level; going over
      is allowed if something says so.`:""}</p>
      <div class="vos-play-spells">${i}</div>
    `,d=>{let m=d.querySelector("[data-count]");d.querySelectorAll("[data-spell]").forEach(v=>{v.addEventListener("change",()=>{v.closest(".vos-play-spell").classList.toggle("is-on",v.checked),h({op:"togglePrepared",spell:v.dataset.spell},{undoable:!1});let w=se(d);m.textContent=e?`${w} / ${e}`:String(w),m.classList.toggle("is-over",!!(e&&w>e))})});let f=d.querySelector(".vos-play-search");f.addEventListener("input",()=>{let v=f.value.trim().toLowerCase();d.querySelectorAll(".vos-play-spell").forEach(w=>{w.hidden=!!v&&!w.dataset.name.includes(v)})})})}function se(n){if(n)return n.querySelectorAll("[data-spell]:checked:not(:disabled)").length;let e=new Set;return(o&&o.spells||[]).forEach(r=>r.spells.forEach(i=>{(i.always||i.level===0)&&e.add(i.id)})),(l.prepared||[]).filter(r=>!e.has(r)).length}async function qe(){return S||(S=await $e(ge(o)).catch(()=>null)),ke(S,o&&o.level||0)}async function P(){return x||(x=await we().catch(()=>null)),k||(k=await Se().catch(()=>null)),!!x}async function oe(){if(!await P()){$("Could not load the masks.",{tone:"error"});return}let n=G(o,x);if(!n.length){$("This character has no masks.",{tone:"error"});return}let e=l.mask,r=re(),i=n.map(u=>`
      <button type="button" class="vos-play-mask${e&&e.key===u.key?" is-on":""}"
              data-mask="${p(u.key)}">
        <b>${p(u.name)}</b>
        <span>${p(u.type)} \xB7 ${K(k,u,B(o)).length} forms available</span>
      </button>`).join("");C("The Masquerade",`
      ${e?`<p class="vos-play-note">Wearing <b>${p(e.key)}</b>.</p>`:""}
      ${r!=null?`<p class="vos-play-note">${r} of ${o.maskUses.uses.max} donnings left today.</p>`:""}
      ${i}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      <div class="vos-play-row">
        <button type="button" class="vos-play-secondary" data-browse-all>Browse the forms</button>
        ${e?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
      </div>
    `,u=>{u.querySelector("[data-browse-all]").addEventListener("click",()=>W()),u.querySelectorAll("[data-mask]").forEach(m=>{m.addEventListener("click",async()=>{let f=m.dataset.mask;if(b(),re()===0){$("No mask donnings left \u2014 a long rest brings them back.",{tone:"warn"});return}let v=(o.abilities||[]).find(R=>R.key==="cha"),w=(o.classes||[]).filter(R=>String(R.identifier).toLowerCase()==="bard").reduce((R,Ue)=>R+(Ue.levels||0),0)||o.level||0,N=v?Math.max(0,v.mod+w):0;await h({op:"donMask",mask:f,tempHp:N})&&o.maskUses&&h({op:"useCharge",feature:o.maskUses.id,max:o.maskUses.uses.max},{undoable:!1})})});let d=u.querySelector("[data-remove]");d&&d.addEventListener("click",()=>{b(),h({op:"removeMask"})})})}function re(){let n=o&&o.maskUses;return n?Math.max(0,n.uses.max-Number((l.uses||{})[n.id]||0)):null}async function De(){if(!l.mask){oe();return}if(!await P())return;let n=x.masks[l.mask.key],e=B(o),r=K(k,n,e);if(!r.length){$("No forms available for this mask.",{tone:"error"});return}let i=r.map((u,d)=>`
      <button type="button" class="vos-play-form" data-form="${d}">
        <b>${p(u.name)}</b>
        <span class="vos-play-form-cr">CR ${p(u.cr)}</span>
        <span class="vos-play-form-meta">AC ${p(u.ac)} \xB7 ${p(u.hp)} HP \xB7 ${p(u.speed)}</span>
      </button>`).join("");C(`Assume a form \u2014 ${p(n.name)}`,`
      <p class="vos-play-note">Challenge Rating ${e} or lower${o.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${i}</div>
    `,u=>{u.querySelectorAll("[data-form]").forEach(d=>{d.addEventListener("click",()=>{let m=r[Number(d.dataset.form)];b(),h({op:"assumeForm",creature:m.name,source:m.source,cr:m.cr,hp:m.hp})})})})}function le(n,e){let r=xe(n,o).map(u=>`
      <div class="vos-play-override">
        <b>${p(u.label)}</b><span>${p(u.value)}</span><i>${p(u.why)}</i>
      </div>`).join(""),i=(u,d)=>u.length?`
      <h4 class="vos-play-form-h">${d}</h4>
      ${u.map(m=>`<p class="vos-play-form-entry"><b>${p(m.name)}.</b> ${p(Ce(m.text))}</p>`).join("")}`:"";return`
      <article class="vos-play-formblock">
        <header>
          <h3>${p(n.name)}</h3>
          <p>${p(n.size)} ${p(n.type)} \xB7 CR ${p(n.cr)}</p>
        </header>
        <div class="vos-play-form-vitals">
          <span><b>${p(n.ac)}</b>AC</span>
          <span>${e}</span>
          <span><b>${p(n.speed)}</b>Speed</span>
        </div>
        <div class="vos-play-overrides">${r}</div>
        ${i(n.traits,"Traits")}
        ${i(n.actions,"Actions")}
      </article>`}async function Pe(){if(!l.form||!await P())return"";let n=x.masks[l.mask?l.mask.key:""],r=(k&&n&&k[n.type]||[]).find(i=>i.name===l.form.creature);return r?le(r,`<b>${p(l.form.hp)}</b>/${p(l.form.maxHp)} HP`):""}async function W(){if(!await P()){$("Could not load the masks.",{tone:"error"});return}let n=G(o,x);if(!n.length){$("This character has no masks.",{tone:"error"});return}let e=B(o),r=n.map(i=>{let d=(k&&k[i.type]||[]).map((m,f)=>`
        <button type="button" class="vos-play-form${m.crValue>e?" is-locked":""}"
                data-browse-form="${p(i.type)}:${f}">
          <b>${p(m.name)}</b>
          <span class="vos-play-form-cr">CR ${p(m.cr)}${m.crValue>e?" \xB7 from level 6":""}</span>
          <span class="vos-play-form-meta">AC ${p(m.ac)} \xB7 ${p(m.hp)} HP \xB7 ${p(m.speed)}</span>
        </button>`).join("");return`<h4 class="vos-play-form-h">${p(i.name)}</h4>
        <div class="vos-play-forms">${d}</div>`}).join("");C("The forms",`
      <p class="vos-play-note">Reading, not becoming \u2014 nothing here spends a use.
      Tap a creature for its full block.</p>
      ${r}
    `,i=>{i.querySelectorAll("[data-browse-form]").forEach(u=>{u.addEventListener("click",()=>{let[d,m]=u.dataset.browseForm.split(":");Fe(d,Number(m))})})})}function Fe(n,e){let r=(k&&k[n]||[])[e];r&&C(r.name,`
      ${le(r,`<b>${p(r.hp)}</b>HP`)}
      <button type="button" class="vos-play-secondary" data-back>All the forms</button>
    `,i=>{i.querySelector("[data-back]").addEventListener("click",()=>W())})}function ie(n){return(o&&o.activatable||[]).find(e=>e.id===n)||null}function ce(n){return!!(l.active||{})[n]}function ue(n){let e=Number((l.uses||{})[n.id]||0);return Math.max(0,n.uses.max-e)}function je(n){let e=ie(n);if(e){if(ce(n)){V(n);return}if(!ue(e)){$(`No uses of ${e.name} left \u2014 a rest brings them back.`,{tone:"warn"});return}h({op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})}}function V(n){let e=ie(n);if(!e)return;let r=ce(n),i=ue(e);C(e.name,`
      <p class="vos-play-feature-state">${r?"Active now.":`${i} of ${e.uses.max} uses left${e.uses.recovery?`, back on a ${p(e.uses.recovery)}`:""}${e.activation?` \xB7 ${p(e.activation)}`:""}.`}</p>
      <ul class="vos-play-feature-grants">${e.grants.map(u=>`<li>${p(u)}</li>`).join("")}</ul>
      ${(e.related||[]).length?`<p class="vos-play-note">Riding on it: ${e.related.map(u=>`<b>${p(u.name)}</b>`).join(", ")} \u2014 their text is under Features.</p>`:""}
      ${r?'<button type="button" class="vos-play-btn is-danger" data-feature-act="end">End it</button>':`<button type="button" class="vos-play-btn is-primary" data-feature-act="start"${i?"":" disabled"}>${i?`Use ${p(e.name)}`:"No uses left"}</button>`}
    `,u=>{let d=u.querySelector("[data-feature-act]");d&&d.addEventListener("click",()=>{b(),h(d.dataset.featureAct==="end"?{op:"endFeature",feature:e.id}:{op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})})})}function F(n,e){return Math.max(0,e-Number((l.uses||{})[n]||0))}function Oe({id:n,name:e,max:r,tempHp:i}){if(!F(n,r)){$(`No uses of ${e} left \u2014 a rest brings them back.`,{tone:"warn"});return}let u={op:"useCharge",feature:n,max:r};i&&(u.tempHp=i),h(u)}function pe(n){return(o&&o.freeCasts||[]).find(e=>e.id===n)||null}function de(n){let e=l.concentration;return!!(n.concentration&&e&&e.spell===n.spellName)}async function me(n){let e=pe(n);if(e){if(de(e)||!F(e.id,e.uses.max)){fe(n);return}e.concentration&&!await h({op:"concentrate",spell:e.spellName},{undoable:!1})||(await h({op:"useCharge",feature:e.id,max:e.uses.max},{undoable:!1}),$(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`))}}function Ie(n){return!n.spellLevel||!(o&&o.spellcasting)?null:(o.spellcasting.slots||[]).filter(e=>!e.pact&&e.level>=n.spellLevel).find(e=>Math.max(0,e.max-Number((l.slots||{})[String(e.level)]||0))>0)||null}function Be(n){for(let e of o&&o.spells||[]){let r=e.spells.find(i=>i.id===n);if(r)return r.description||""}return""}function fe(n){let e=pe(n);if(!e)return;let r=de(e),i=F(e.id,e.uses.max),u=!r&&!i?Ie(e):null;C(e.spellName,`
      <p class="vos-play-feature-state">${r?`Active now \u2014 concentrating on ${p(e.spellName)}.`:`${i} of ${e.uses.max} free casts left${e.uses.recovery?`, back on a ${p(e.uses.recovery)}`:""} \u2014 ${p(e.featureName)}.`}</p>
      ${r?`<button type="button" class="vos-play-btn is-danger" data-cast-act="end">End ${p(e.spellName)}</button>`:`<button type="button" class="vos-play-btn is-primary" data-cast-act="free"${i?"":" disabled"}>${i?"Cast \u2014 no slot spent":"No free casts left"}</button>`}
      ${u?`<button type="button" class="vos-play-btn" data-cast-act="slot"
          data-level="${u.level}">Cast with a level ${u.level} slot</button>`:""}
      <div class="vos-play-rules">${Be(e.spellId)}</div>
    `,d=>{d.querySelectorAll("[data-cast-act]").forEach(m=>{m.addEventListener("click",async()=>{let f=m.dataset.castAct;if(b(),f==="end"){h({op:"breakConcentration"});return}if(f==="free"){me(n);return}if(f==="slot"){if(!await h({op:"spendSlot",level:Number(m.dataset.level)},{undoable:!1}))return;e.concentration&&await h({op:"concentrate",spell:e.spellName},{undoable:!1}),$(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`)}})})})}function _e(n){let e=(o&&o.features||[]).find(r=>r.id===n);e&&C(e.name,`
      <p class="vos-play-feature-state">Once per turn \u2014 no uses to spend.</p>
      <div class="vos-play-rules">${e.description||""}</div>
    `)}async function ze(){let n=o&&o.zeroHpRescue;!n||!F(n.id,n.uses.max)||await h({op:"useCharge",feature:n.id,max:n.uses.max},{undoable:!1})&&(await h({op:"heal",amount:1},{undoable:!1}),await h({op:"adjustExhaustion",delta:-1},{undoable:!1}),$(`${n.name} \u2014 up at 1 hit point.`))}function j(n){let e=n.target.closest("[data-play]");if(!(!e||!t.contains(e))&&!(n.type==="keydown"&&!["Enter"," "].includes(n.key)))switch(n.type==="keydown"&&n.preventDefault(),e.dataset.play){case"hp":ae();break;case"hitdice":Ae();break;case"slot":{let r=Number(e.dataset.level),i=e.dataset.spent==="1";h({op:i?"restoreSlot":"spendSlot",level:r});break}case"pact":{h({op:e.dataset.spent==="1"?"restorePactSlot":"spendPactSlot"});break}case"charge":{let r=e.dataset.feature;if(!r)return;h({op:"useCharge",feature:r,max:Number(e.dataset.max)||void 0});break}case"charge-pip":{let r=e.dataset.feature;if(!r)return;h(e.dataset.spent==="1"?{op:"restoreCharge",feature:r}:{op:"useCharge",feature:r,max:Number(e.dataset.max)||void 0});break}case"feature":V(e.dataset.feature);break;case"end-feature":h({op:"endFeature",feature:e.dataset.feature});break;case"exhaustion":{let r=Number(e.dataset.value);h({op:"setExhaustion",value:r===l.exhaustion?r-1:r});break}case"conditions":case"condition":ne();break;default:break}}return t.addEventListener("click",j),t.addEventListener("keydown",j),{apply:h,openHpPad:ae,openRests:Te,openConditions:ne,openPrepare:Re,openMasks:oe,openForms:De,openFormCatalog:W,openFeature:V,activateFeature:je,spendCharge:Oe,castFreeSpell:me,openFreeCast:fe,openPerTurnRule:_e,rescueFromZero:ze,formStatblockHtml:Pe,setState(n,e){l=n,e&&(y=e)},destroy(){t.removeEventListener("click",j),t.removeEventListener("keydown",j),b(),U()}}}var at=12e3,T=document.getElementById("vos-party-root"),Q=document.getElementById("vos-party-status"),_=[],X=null,H=!1;function L(a){return String(a??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}function nt(a=6e3){return new Promise(t=>{let c=Date.now();(function s(){if(window.VOS_PWA)return t(window.VOS_PWA);if(Date.now()-c>a)return t(null);setTimeout(s,80)})()})}function st(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function ot(){let a=await fetch("/api/play/party",{cache:"no-store",headers:st()}),t=await a.json().catch(()=>({}));if(!a.ok){let c=new Error(t.error||`HTTP ${a.status}`);throw c.status=a.status,c}return t.party||[]}function rt(a,t){if(!t||a==null)return"";let c=a/t;return a===0?"is-down":c<=.25?"is-bloodied":c<=.5?"is-hurt":""}function lt(a){let t=a.limits&&a.limits.slots||{},c=a.state.slots||{},s=Object.keys(t).sort();return s.length?s.map(o=>{let l=t[o],y=Math.max(0,l-(c[o]||0));return`<span class="vos-party-slot${y?"":" is-empty"}">
      <i>${L(o)}</i>${y}<b>/${l}</b></span>`}).join(""):""}function it(a){let t=a.state,c=a.limits&&a.limits.maxHp||0,s=t.hp.current!=null?t.hp.current:c,o=c?Math.max(0,Math.min(100,s/c*100)):0,l=(t.conditions||[]).includes("dying"),y=(t.conditions||[]).filter(S=>S!=="dying"),g=Math.max(0,(a.limits&&a.limits.hitDice||0)-(t.hitDiceSpent||0));return a.hasStatblock?`<article class="vos-party-card ${rt(s,c)}${l?" is-dying":""}"
                   data-player="${L(a.playerName)}">
    <header class="vos-party-head">
      <h2>${L(a.character)}</h2>
      <span class="vos-party-class">${L(a.classLine||"")}</span>
      ${a.ac!=null?`<span class="vos-party-ac">AC ${L(a.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${L(a.character)} hit points ${s} of ${c}">
      <span class="vos-party-hp-fill" style="width:${o}%"></span>
      <span class="vos-party-hp-text">
        <b>${s}</b><i>/${c||"\u2014"}</i>
        ${t.hp.temp?`<em>+${t.hp.temp}</em>`:""}
      </span>
      ${l?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${t.exhaustion?`<div class="vos-party-exh" title="\u2212${t.exhaustion*2} to d20 tests, \u2212${t.exhaustion*5} ft">
      ${Array.from({length:6},(S,x)=>`<span class="${x<t.exhaustion?"is-on":""}"></span>`).join("")}
      <b>Exhaustion ${t.exhaustion}</b>
    </div>`:""}

    ${t.mask?`<div class="vos-party-mask">
      ${L(t.form?t.form.creature:t.mask.key)}
    </div>`:""}

    ${t.concentration?`<div class="vos-party-conc">Concentrating: ${L(t.concentration.spell)}</div>`:""}

    ${Object.keys(t.active||{}).length?`<div class="vos-party-active">${Object.values(t.active).map(S=>L(S.name)).join(" \xB7 ")}</div>`:""}

    <div class="vos-party-row">
      ${lt(a)}
      ${g?`<span class="vos-party-hd">${g} HD</span>`:""}
    </div>

    <div class="vos-party-conds">
      ${y.length?y.map(S=>`<span>${L(S)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <a class="vos-party-view" href="/sheet/?as=${encodeURIComponent(a.playerName)}"
         title="Open their sheet as they see it">View</a>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${L(a.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function ee(){T.innerHTML=_.map(it).join("")}function q(a,t=""){Q&&(Q.textContent=a,Q.className=`vos-party-status${t?` is-${t}`:""}`)}function ct(a){let t=_.find(c=>c.playerName===a);return t?Ee({root:T,playerName:a,state:t.state,limits:t.limits,onState(c){t.state=c,ee()}}):null}async function ut(a,t){let c=t==="heal"?"Heal":"Damage",s=Number(window.prompt(`${c} ${a.character} by how much?`,"5"));if(!(!Number.isFinite(s)||s<=0))try{let o=await O({op:t==="heal"?"heal":"damage",amount:s},a.playerName);a.state=o.state,a.limits=o.limits||a.limits,ee()}catch(o){q(o.message,"error")}}function pt(a){let t=a.target.closest("[data-act]");if(!t)return;let c=t.closest("[data-player]");if(!c)return;let s=_.find(y=>y.playerName===c.dataset.player);if(!s)return;let o=t.dataset.act;if(o==="damage"||o==="heal"){ut(s,o);return}let l=ct(s.playerName);l&&(o==="hp"&&l.openHpPad(),o==="conditions"&&l.openConditions())}async function D({quiet:a=!1}={}){a||q("Refreshing\u2026");try{_=await ot(),ee(),q(`Updated ${new Date().toLocaleTimeString()}`)}catch(t){if(t.status===401||t.status===403){q("DM only.","error"),Le();return}q(`Could not refresh \u2014 ${t.message}`,"error")}}function dt(){Le(),X=setInterval(()=>{!H&&!document.hidden&&D({quiet:!0})},at)}function Le(){clearInterval(X),X=null}document.addEventListener("visibilitychange",()=>{document.hidden||D({quiet:!0})});async function mt(){let a=await nt(),t=a&&a.getPlayerName?a.getPlayerName():null;if(!t){T.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(t==="DM"||a&&a.isDm&&a.isDm())){T.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}T.addEventListener("click",pt);let c=document.getElementById("vos-party-pause");c&&c.addEventListener("click",()=>{H=!H,c.textContent=H?"Resume updates":"Pause updates",c.setAttribute("aria-pressed",String(H)),H||D()});let s=document.getElementById("vos-party-refresh");s&&s.addEventListener("click",()=>D()),await D(),dt()}T&&mt();})();
