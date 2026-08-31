(()=>{function Ze(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function Ge(a,t){let r=await fetch(a,{cache:"no-store",...t||{},headers:Ze({"Content-Type":"application/json",...(t||{}).headers||{}})}),n=await r.json().catch(()=>({}));if(!r.ok){let o=new Error(n.error||`HTTP ${r.status}`);throw o.status=r.status,o.code=n.error_code,o}return n}function O(a,t){let r=t?{...a,playerName:t}:a;return Ge("/api/play/op",{method:"POST",body:JSON.stringify(r)})}function ve(a,t,r){if(!a)return a;let n=JSON.parse(JSON.stringify(a)),o=r&&r.maxHp;switch(t.op){case"damage":{let i=Math.min(n.hp.temp||0,t.amount);return n.hp.temp-=i,n.hp.current!=null&&(n.hp.current=Math.max(0,n.hp.current-(t.amount-i))),n.hp.current===0?null:n}case"heal":{n.hp.current==null&&(n.hp.current=0);let i=n.hp.current+t.amount;return n.hp.current=o!=null?Math.min(i,o):i,n}case"spendSlot":{let i=String(t.level),p=((r||{}).slots||{})[i],v=(n.slots[i]||0)+1;return p!=null&&v>p?null:(n.slots[i]=v,n)}case"restoreSlot":{let i=String(t.level);return n.slots[i]=Math.max(0,(n.slots[i]||0)-1),n}case"useCharge":{let i=(n.uses[t.feature]||0)+1;return t.max!=null&&i>t.max?null:(n.uses[t.feature]=i,t.tempHp!=null&&(n.hp.temp=Math.max(n.hp.temp||0,t.tempHp)),n)}case"restoreCharge":return n.uses[t.feature]=Math.max(0,(n.uses[t.feature]||0)-1),n;case"spendPactSlot":{let i=(r||{}).pact,p=(n.pact||0)+1;return i!=null&&p>i?null:(n.pact=p,n)}case"restorePactSlot":return n.pact=Math.max(0,(n.pact||0)-1),n;default:return null}}function be(a,t){switch(a.op){case"damage":return{op:"setHp",value:t.hp.current,_restore:t};case"heal":return{op:"setHp",value:t.hp.current};case"setHp":return{op:"setHp",value:t.hp.current};case"setTempHp":return{op:"setTempHp",value:t.hp.temp,keepHigher:!1};case"spendSlot":return{op:"restoreSlot",level:a.level};case"restoreSlot":return{op:"spendSlot",level:a.level};case"spendPactSlot":return{op:"restorePactSlot"};case"restorePactSlot":return{op:"spendPactSlot"};case"useCharge":return{op:"restoreCharge",feature:a.feature};case"restoreCharge":return{op:"useCharge",feature:a.feature};case"addCondition":return{op:"removeCondition",condition:a.condition};case"removeCondition":return{op:"addCondition",condition:a.condition};case"adjustExhaustion":return{op:"adjustExhaustion",delta:-a.delta};case"setExhaustion":return{op:"setExhaustion",value:t.exhaustion};default:return null}}var B=new Map;async function Z(a){if(B.has(a))return B.get(a);let t=fetch(a,{cache:"default"}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).catch(r=>{throw B.delete(a),r});return B.set(a,t),t}function G(a){return Z(a)}function $e(){return Z("/data/play/conditions.json")}var ge={bard:"bard",cleric:"cleric",ranger:"ranger",warlock:"warlock",wizard:"wizard",rogue:"wizard",fighter:"wizard"};function we(a){let t=a&&a.classes||[];for(let r of t){let n=String(r.identifier||r.name||"").toLowerCase();if(ge[n])return ge[n]}return null}async function ke(a){if(!a)return null;try{return await Z(`/data/play/spells-${a}.json`)}catch{return null}}function Se(a,t){if(!a||!Array.isArray(a.prepared)||!t)return null;let r=a.prepared[t-1];return typeof r=="number"?r:null}function xe(){return G("/data/play/masquerade.json")}function Ce(){return G("/data/play/forms.json")}function K(a,t){if(!a||!t)return[];let r=new Set((a.features||[]).map(n=>(n.name||"").toLowerCase()).filter(n=>n.startsWith("maschera ")).map(n=>n.split(" ")[1]));return Object.values(t.masks).filter(n=>r.has(n.key)).sort((n,o)=>n.name.localeCompare(o.name))}function _(a){return a&&a.level>=6?3:1}function Q(a,t,r){return!a||!t||!t.type?[]:(a[t.type]||[]).filter(n=>n.crValue<=r)}function Ee(a,t){let r=[],n=t&&t.spellcasting&&t.spellcasting.dc,o=t&&(t.abilities||[]).find(i=>i.key==="int")||null;return o&&a.abilities&&a.abilities.int!==o.score&&r.push({label:"Intelligence",value:`${o.score} (${o.mod>=0?"+":""}${o.mod})`,why:"Yours \u2014 only Intelligence, memories and alignment stay."}),n&&r.push({label:"Save DC",value:String(n),why:"Any DC in this creature's abilities uses your spell save DC."}),r.push({label:"Bardic Inspiration",value:"kept",why:"Retained in any form. You cannot cast unless the form can."}),r}function Ke(a){return a.replace(/@[A-Za-z]+\[((?:[^[\]]|\[[^\]]*\])*)\](?:\{([^}]*)\})?/g,(t,r,n)=>{if(n)return n;let o=String(r).split("|"),i=o.length===3&&o[2].trim()?o[2]:o[0];return i.split(".").pop()||i})}function Qe(a){return a.replace(/&(?:amp;)?Reference\[([^\]]*)\](?:\{([^}]*)\})?/gi,(t,r,n)=>n||String(r).split("=").pop().trim().replace(/([a-z0-9])([A-Z])/g,"$1 $2"))}function Xe(a){let t={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};return a.replace(/\[\[\/([a-z]+)([^\]]*)\]\](?:\{([^}]*)\})?/gi,(r,n,o,i)=>{if(i)return i;let p=String(o).trim(),v=n.toLowerCase();if(v==="check"||v==="save"||v==="skill"||v==="concentration"){let g=p.match(/dc=(\d+)/i),P=p.match(/(?:ability|skill)=([a-z]+)/i),y=P?t[P[1].toLowerCase()]||P[1]:"",W=v==="save"||v==="concentration"?"save":"check";return[g?`DC ${g[1]}`:"",y,W].filter(Boolean).join(" ")}let S=p.replace(/\b\w+=[^\s]+/g,"").trim(),w=p.match(/type=([a-z]+)/i);return[S,w?w[1]:""].filter(Boolean).join(" ")})}var et={h:"Hit: ",hom:"Hit or Miss: ",actsavefail:"Failure: ",actsavesuccess:"Success: ",actsavesuccessorfail:"Success or Failure: "},tt={mw:"Melee Weapon Attack:",rw:"Ranged Weapon Attack:","mw,rw":"Melee or Ranged Weapon Attack:",ms:"Melee Spell Attack:",rs:"Ranged Spell Attack:","ms,rs":"Melee or Ranged Spell Attack:",m:"Melee Attack Roll:",r:"Ranged Attack Roll:","m,r":"Melee or Ranged Attack Roll:"},at={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};function nt(a){return a.replace(/\{@([a-zA-Z]+)(?: ([^{}]*))?\}/g,(t,r,n="")=>{let o=r.toLowerCase(),i=et[o];if(i!==void 0)return i;if(o==="recharge")return`(Recharge ${n?`${n}\u20136`:"6"})`;if(o==="atk"||o==="atkr")return tt[n.replace(/\s/g,"")]??n;if(o==="hit")return/^[+-]/.test(n.trim())?n.trim():`+${n.trim()}`;if(o==="dc")return`DC ${n.trim()}`;if(o==="actsave")return`${at[n.trim().toLowerCase()]??n} Saving Throw:`;let p=n.split("|");return p.length===3&&p[2].trim()?p[2]:p[0]})}function Le(a){let t=String(a??"");return t=nt(t),t=Ke(t),t=Qe(t),t=Xe(t),t}var st=[1,2,3,4,5,6,7,8,10,12,15,20],ot=12;function Ae(a){let t=a.root,r=a.onState,n=a.playerName||null,o=a.model||null,i=a.state,p=a.limits,v=!1,S=null,w=null,g=null;function P(){if(navigator.vibrate)try{navigator.vibrate(ot)}catch{}}async function y(s,{undoable:e=!0}={}){if(v)return!1;v=!0;let l=i;P();let c=ve(i,s,p);c&&(i=c,r(i,{optimistic:!0}));try{let u=await O(s,n);return i=u.state,p=u.limits||p,r(i,{note:u.note}),e&&W(s,l,u.note),!0}catch(u){return i=l,r(i,{error:u.message}),k(u.message,{tone:"error"}),!1}finally{v=!1}}function W(s,e,l){let c=be(s,e);k(l||"Done",{action:c?{label:"Undo",run:()=>y(c,{undoable:!1})}:null})}let L=null,ne=null;function k(s,{tone:e="",action:l=null}={}){if(L||(L=document.createElement("div"),L.className="vos-play-toast",L.setAttribute("role","status"),document.body.appendChild(L)),L.className=`vos-play-toast is-on${e?` is-${e}`:""}`,L.innerHTML='<span class="vos-play-toast-text"></span>',L.querySelector(".vos-play-toast-text").textContent=s,l){let c=document.createElement("button");c.type="button",c.className="vos-play-toast-action",c.textContent=l.label,c.addEventListener("click",()=>{z(),l.run()}),L.appendChild(c)}clearTimeout(ne),ne=setTimeout(z,l?6e3:3e3)}function z(){L&&L.classList.remove("is-on")}let A=null;function C(s,e,l){$(),A=document.createElement("div"),A.className="vos-play-sheet",A.innerHTML=`
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${s}">
        <div class="vos-play-sheet-head">
          <span>${s}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">\u2715</button>
        </div>
        <div class="vos-play-sheet-body">${e}</div>
      </div>`,document.body.appendChild(A),A.addEventListener("click",u=>{u.target.closest("[data-close]")&&$()}),l&&l(A);let c=A.querySelector("button:not([data-close])");c&&c.focus()}function $(){A&&(A.remove(),A=null)}function se(){let s=p&&p.maxHp||0,e=i.hp.current!=null?i.hp.current:s,l=st.map(c=>`<button type="button" class="vos-play-num" data-amount="${c}">${c}</button>`).join("");C("Hit points",`
      <div class="vos-play-hp">
        <span class="vos-play-hp-now">${e}<i>/${s||"\u2014"}</i></span>
        ${i.hp.temp?`<span class="vos-play-hp-temp">+${i.hp.temp} temp</span>`:""}
      </div>
      <div class="vos-play-mode" role="group" aria-label="Damage or healing">
        <button type="button" class="is-on" data-mode="damage">Damage</button>
        <button type="button" data-mode="heal">Heal</button>
      </div>
      <div class="vos-play-nums">${l}</div>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="999" placeholder="Other" aria-label="Amount">
        <button type="submit">Apply</button>
      </form>
      <label class="vos-play-check"><input type="checkbox" data-critical> Critical hit</label>
      <div class="vos-play-row">
        <button type="button" class="vos-play-secondary" data-temp>Set temp HP</button>
        <button type="button" class="vos-play-secondary" data-full>Full</button>
      </div>
    `,c=>{let u="damage";c.querySelectorAll("[data-mode]").forEach(h=>{h.addEventListener("click",()=>{u=h.dataset.mode,c.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("is-on",b===h))})});let m=()=>!!c.querySelector("[data-critical]").checked,f=h=>{h>0&&($(),y(u==="heal"?{op:"heal",amount:h}:{op:"damage",amount:h,critical:m()}))};c.querySelectorAll("[data-amount]").forEach(h=>{h.addEventListener("click",()=>f(Number(h.dataset.amount)))}),c.querySelector(".vos-play-custom").addEventListener("submit",h=>{h.preventDefault(),f(Number(h.target.querySelector("input").value))}),c.querySelector("[data-full]").addEventListener("click",()=>{$(),y({op:"setHp",value:s})}),c.querySelector("[data-temp]").addEventListener("click",()=>{let h=Number(window.prompt("Temporary hit points",String(i.hp.temp||0)));$(),Number.isFinite(h)&&h>=0&&y({op:"setTempHp",value:h,keepHigher:!1})})})}function Re(){let s=Number(i.hitDiceSpent||0),e=p&&p.hitDice||0;C("Hit dice",`
      <p class="vos-play-note">${Math.max(0,e-s)} of ${e} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `,l=>{l.querySelector(".vos-play-custom").addEventListener("submit",c=>{c.preventDefault();let u=Number(c.target.querySelector("input").value)||0;$(),y({op:"spendHitDie",healed:u})}),l.querySelector("[data-nothing]").addEventListener("click",()=>{$(),y({op:"spendHitDie"})})})}function Me(){let s=o&&o.pactRecovery;if(!s||!(p&&p.pact))return"";let e=Math.max(0,s.uses.max-Number((i.uses||{})[s.id]||0));return`<button type="button" class="vos-play-rest" data-pact-rite${e?"":" disabled"}>
      <b>${d(s.name)}</b><span>${e?"A 1-minute rite. Regain up to half your pact slots, rounded up.":"Spent \u2014 a long rest brings it back."}</span>
    </button>`}async function Pe(){let s=o.pactRecovery,e=Number(i.pact||0);if(!e){k("No pact slots are spent.",{tone:"warn"});return}let l=Math.min(e,Math.ceil((p.pact||0)/2));if(await y({op:"useCharge",feature:s.id,max:s.uses.max},{undoable:!1})){for(let c=0;c<l;c+=1)await y({op:"restorePactSlot"},{undoable:!1});k(`${s.name} \u2014 ${l} pact slot${l===1?"":"s"} regained.`)}}function qe(){C("Rest",`
      <button type="button" class="vos-play-rest" data-rest="shortRest">
        <b>Short rest</b><span>30 minutes. Spend hit dice one at a time.</span>
      </button>
      <button type="button" class="vos-play-rest" data-rest="fieldRest">
        <b>Field rest</b><span>8 hours somewhere unsafe. Hit dice heal for their maximum.</span>
      </button>
      <button type="button" class="vos-play-rest is-long" data-rest="longRest">
        <b>Long rest</b><span>Everything back, and one point of exhaustion clears.</span>
      </button>
      ${Me()}
      <p class="vos-play-note">A long rest needs your own bed or a Secure place \u2014 or three
      quiet nights to establish a haven. Never inside the fog.</p>
    `,s=>{s.querySelectorAll("[data-rest]").forEach(l=>{l.addEventListener("click",()=>{let c=l.dataset.rest;c==="longRest"&&!window.confirm("Take a long rest?")||($(),y({op:c}))})});let e=s.querySelector("[data-pact-rite]");e&&e.addEventListener("click",()=>{$(),Pe()})})}let De=["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];async function oe(){let s=new Set(i.conditions||[]),e={};try{e=await $e()}catch{}let l=De.map(m=>{let f=e[m]||{};return`<div class="vos-play-cond-row${s.has(m)?" is-on":""}">
        <button type="button" class="vos-play-cond" data-condition="${m}">${d(f.name||m.charAt(0).toUpperCase()+m.slice(1))}</button>
        ${f.text?`<details class="vos-play-cond-rules">
          <summary>What it does${f.houseRuled?" <em>house rule</em>":""}</summary>
          <p>${d(f.text)}</p>
        </details>`:""}
      </div>`}).join(""),c=i.concentration,u=`<div class="vos-play-conc">
      ${c?`<span>Concentrating on <b>${d(c.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`:`<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;C("Conditions",u+`<div class="vos-play-conds is-rows">${l}</div>`,m=>{m.querySelectorAll("[data-condition]").forEach(b=>{b.addEventListener("click",()=>{let x=b.dataset.condition,H=b.closest(".vos-play-cond-row"),J=!H.classList.contains("is-on");H.classList.toggle("is-on",J),y({op:J?"addCondition":"removeCondition",condition:x})})});let f=m.querySelector("[data-break]");f&&f.addEventListener("click",()=>{$(),y({op:"breakConcentration"})});let h=m.querySelector("[data-concentrate]");h&&h.addEventListener("click",()=>{let b=window.prompt("Concentrating on which spell?");$(),b&&b.trim()&&y({op:"concentrate",spell:b.trim()})})})}function d(s){return String(s??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}async function je(){let s=o&&o.spells||[];if(!s.length){k("This character has no spells.",{tone:"error"});return}let e=await Ie(),l=new Set(i.prepared||[]),c=s.map(m=>{let f=m.spells.map(h=>{let b=h.always||h.level===0,x=b||l.has(h.id),H=[h.school,...h.meta].filter(Boolean).join(" \xB7 ");return`<label class="vos-play-spell${x?" is-on":""}${b?" is-fixed":""}"
                       data-name="${d(h.name.toLowerCase())}">
          <input type="checkbox" data-spell="${d(h.id)}"${x?" checked":""}${b?" disabled":""}>
          <span class="vos-play-spell-name">${d(h.name)}${b?'<i title="Always available">always</i>':""}</span>
          <span class="vos-play-spell-meta">${d(H)}</span>
        </label>`}).join("");return`<h4 class="vos-play-spell-level">${d(m.label)}</h4>${f}`}).join(""),u=re();C("Prepare spells",`
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${u}${e?` / ${e}`:""}</span>
        <input type="search" class="vos-play-search" placeholder="Search your spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Your spellbook. Cantrips and always-prepared spells do not
      count against the total.${e?` Your class prepares ${e} at this level; going over
      is allowed if something says so.`:""}</p>
      <div class="vos-play-spells">${c}</div>
    `,m=>{let f=m.querySelector("[data-count]");m.querySelectorAll("[data-spell]").forEach(b=>{b.addEventListener("change",()=>{b.closest(".vos-play-spell").classList.toggle("is-on",b.checked),y({op:"togglePrepared",spell:b.dataset.spell},{undoable:!1});let x=re(m);f.textContent=e?`${x} / ${e}`:String(x),f.classList.toggle("is-over",!!(e&&x>e))})});let h=m.querySelector(".vos-play-search");h.addEventListener("input",()=>{let b=h.value.trim().toLowerCase();m.querySelectorAll(".vos-play-spell").forEach(x=>{x.hidden=!!b&&!x.dataset.name.includes(b)})})})}function re(s){if(s)return s.querySelectorAll("[data-spell]:checked:not(:disabled)").length;let e=new Set;return(o&&o.spells||[]).forEach(l=>l.spells.forEach(c=>{(c.always||c.level===0)&&e.add(c.id)})),(i.prepared||[]).filter(l=>!e.has(l)).length}async function Ie(){return S||(S=await ke(we(o)).catch(()=>null)),Se(S,o&&o.level||0)}async function j(){return w||(w=await xe().catch(()=>null)),g||(g=await Ce().catch(()=>null)),!!w}async function ie(){if(!await j()){k("Could not load the masks.",{tone:"error"});return}let s=K(o,w);if(!s.length){k("This character has no masks.",{tone:"error"});return}let e=i.mask,l=le(),c=s.map(u=>`
      <button type="button" class="vos-play-mask${e&&e.key===u.key?" is-on":""}"
              data-mask="${d(u.key)}">
        <b>${d(u.name)}</b>
        <span>${d(u.type)} \xB7 ${Q(g,u,_(o)).length} forms available</span>
      </button>`).join("");C("The Masquerade",`
      ${e?`<p class="vos-play-note">Wearing <b>${d(e.key)}</b>.</p>`:""}
      ${l!=null?`<p class="vos-play-note">${l} of ${o.maskUses.uses.max} donnings left today.</p>`:""}
      ${c}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      <div class="vos-play-row">
        <button type="button" class="vos-play-secondary" data-browse-all>Browse the forms</button>
        ${e?'<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>':""}
      </div>
    `,u=>{u.querySelector("[data-browse-all]").addEventListener("click",()=>V()),u.querySelectorAll("[data-mask]").forEach(f=>{f.addEventListener("click",async()=>{let h=f.dataset.mask;if($(),le()===0){k("No mask donnings left \u2014 a long rest brings them back.",{tone:"warn"});return}let b=(o.abilities||[]).find(q=>q.key==="cha"),x=(o.classes||[]).filter(q=>String(q.identifier).toLowerCase()==="bard").reduce((q,Je)=>q+(Je.levels||0),0)||o.level||0,H=b?Math.max(0,b.mod+x):0;await y({op:"donMask",mask:h,tempHp:H})&&o.maskUses&&y({op:"useCharge",feature:o.maskUses.id,max:o.maskUses.uses.max},{undoable:!1})})});let m=u.querySelector("[data-remove]");m&&m.addEventListener("click",()=>{$(),y({op:"removeMask"})})})}function le(){let s=o&&o.maskUses;return s?Math.max(0,s.uses.max-Number((i.uses||{})[s.id]||0)):null}async function Fe(){if(!i.mask){ie();return}if(!await j())return;let s=w.masks[i.mask.key],e=_(o),l=Q(g,s,e);if(!l.length){k("No forms available for this mask.",{tone:"error"});return}let c=l.map((u,m)=>`
      <button type="button" class="vos-play-form" data-form="${m}">
        <b>${d(u.name)}</b>
        <span class="vos-play-form-cr">CR ${d(u.cr)}</span>
        <span class="vos-play-form-meta">AC ${d(u.ac)} \xB7 ${d(u.hp)} HP \xB7 ${d(u.speed)}</span>
      </button>`).join("");C(`Assume a form \u2014 ${d(s.name)}`,`
      <p class="vos-play-note">Challenge Rating ${e} or lower${o.level<6?", rising to 3 at sixth level":""}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${c}</div>
    `,u=>{u.querySelectorAll("[data-form]").forEach(m=>{m.addEventListener("click",()=>{let f=l[Number(m.dataset.form)];$(),y({op:"assumeForm",creature:f.name,source:f.source,cr:f.cr,hp:f.hp})})})})}function ce(s,e){let l=Ee(s,o).map(u=>`
      <div class="vos-play-override">
        <b>${d(u.label)}</b><span>${d(u.value)}</span><i>${d(u.why)}</i>
      </div>`).join(""),c=(u,m)=>u.length?`
      <h4 class="vos-play-form-h">${m}</h4>
      ${u.map(f=>`<p class="vos-play-form-entry"><b>${d(f.name)}.</b> ${d(Le(f.text))}</p>`).join("")}`:"";return`
      <article class="vos-play-formblock">
        <header>
          <h3>${d(s.name)}</h3>
          <p>${d(s.size)} ${d(s.type)} \xB7 CR ${d(s.cr)}</p>
        </header>
        <div class="vos-play-form-vitals">
          <span><b>${d(s.ac)}</b>AC</span>
          <span>${e}</span>
          <span><b>${d(s.speed)}</b>Speed</span>
        </div>
        <div class="vos-play-overrides">${l}</div>
        ${c(s.traits,"Traits")}
        ${c(s.actions,"Actions")}
      </article>`}async function Oe(){if(!i.form||!await j())return"";let s=w.masks[i.mask?i.mask.key:""],l=(g&&s&&g[s.type]||[]).find(c=>c.name===i.form.creature);return l?ce(l,`<b>${d(i.form.hp)}</b>/${d(i.form.maxHp)} HP`):""}async function V(){if(!await j()){k("Could not load the masks.",{tone:"error"});return}let s=K(o,w);if(!s.length){k("This character has no masks.",{tone:"error"});return}let e=_(o),l=s.map(c=>{let m=(g&&g[c.type]||[]).map((f,h)=>`
        <button type="button" class="vos-play-form${f.crValue>e?" is-locked":""}"
                data-browse-form="${d(c.type)}:${h}">
          <b>${d(f.name)}</b>
          <span class="vos-play-form-cr">CR ${d(f.cr)}${f.crValue>e?" \xB7 from level 6":""}</span>
          <span class="vos-play-form-meta">AC ${d(f.ac)} \xB7 ${d(f.hp)} HP \xB7 ${d(f.speed)}</span>
        </button>`).join("");return`<h4 class="vos-play-form-h">${d(c.name)}</h4>
        <div class="vos-play-forms">${m}</div>`}).join("");C("The forms",`
      <p class="vos-play-note">Reading, not becoming \u2014 nothing here spends a use.
      Tap a creature for its full block.</p>
      ${l}
    `,c=>{c.querySelectorAll("[data-browse-form]").forEach(u=>{u.addEventListener("click",()=>{let[m,f]=u.dataset.browseForm.split(":");Be(m,Number(f))})})})}function Be(s,e){let l=(g&&g[s]||[])[e];l&&C(l.name,`
      ${ce(l,`<b>${d(l.hp)}</b>HP`)}
      <button type="button" class="vos-play-secondary" data-back>All the forms</button>
    `,c=>{c.querySelector("[data-back]").addEventListener("click",()=>V())})}function ue(s){return(o&&o.activatable||[]).find(e=>e.id===s)||null}function pe(s){return!!(i.active||{})[s]}function de(s){let e=Number((i.uses||{})[s.id]||0);return Math.max(0,s.uses.max-e)}function _e(s){let e=ue(s);if(e){if(pe(s)){Y(s);return}if(!de(e)){k(`No uses of ${e.name} left \u2014 a rest brings them back.`,{tone:"warn"});return}y({op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})}}function Y(s){let e=ue(s);if(!e)return;let l=pe(s),c=de(e);C(e.name,`
      <p class="vos-play-feature-state">${l?"Active now.":`${c} of ${e.uses.max} uses left${e.uses.recovery?`, back on a ${d(e.uses.recovery)}`:""}${e.activation?` \xB7 ${d(e.activation)}`:""}.`}</p>
      <ul class="vos-play-feature-grants">${e.grants.map(u=>`<li>${d(u)}</li>`).join("")}</ul>
      ${(e.related||[]).length?`<p class="vos-play-note">Riding on it: ${e.related.map(u=>`<b>${d(u.name)}</b>`).join(", ")} \u2014 their text is under Features.</p>`:""}
      ${l?'<button type="button" class="vos-play-btn is-danger" data-feature-act="end">End it</button>':`<button type="button" class="vos-play-btn is-primary" data-feature-act="start"${c?"":" disabled"}>${c?`Use ${d(e.name)}`:"No uses left"}</button>`}
    `,u=>{let m=u.querySelector("[data-feature-act]");m&&m.addEventListener("click",()=>{$(),y(m.dataset.featureAct==="end"?{op:"endFeature",feature:e.id}:{op:"activateFeature",feature:e.id,name:e.name,max:e.uses.max})})})}function I(s,e){return Math.max(0,e-Number((i.uses||{})[s]||0))}function Ue({id:s,name:e,max:l,tempHp:c}){if(!I(s,l)){k(`No uses of ${e} left \u2014 a rest brings them back.`,{tone:"warn"});return}let u={op:"useCharge",feature:s,max:l};c&&(u.tempHp=c),y(u)}function me(s){return(o&&o.freeCasts||[]).find(e=>e.id===s)||null}function fe(s){let e=i.concentration;return!!(s.concentration&&e&&e.spell===s.spellName)}async function he(s){let e=me(s);if(e){if(fe(e)||!I(e.id,e.uses.max)){ye(s);return}e.concentration&&!await y({op:"concentrate",spell:e.spellName},{undoable:!1})||(await y({op:"useCharge",feature:e.id,max:e.uses.max},{undoable:!1}),k(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`))}}function We(s){return!s.spellLevel||!(o&&o.spellcasting)?null:(o.spellcasting.slots||[]).filter(e=>!e.pact&&e.level>=s.spellLevel).find(e=>Math.max(0,e.max-Number((i.slots||{})[String(e.level)]||0))>0)||null}function ze(s){for(let e of o&&o.spells||[]){let l=e.spells.find(c=>c.id===s);if(l)return l.description||""}return""}function ye(s){let e=me(s);if(!e)return;let l=fe(e),c=I(e.id,e.uses.max),u=!l&&!c?We(e):null;C(e.spellName,`
      <p class="vos-play-feature-state">${l?`Active now \u2014 concentrating on ${d(e.spellName)}.`:`${c} of ${e.uses.max} free casts left${e.uses.recovery?`, back on a ${d(e.uses.recovery)}`:""} \u2014 ${d(e.featureName)}.`}</p>
      ${l?`<button type="button" class="vos-play-btn is-danger" data-cast-act="end">End ${d(e.spellName)}</button>`:`<button type="button" class="vos-play-btn is-primary" data-cast-act="free"${c?"":" disabled"}>${c?"Cast \u2014 no slot spent":"No free casts left"}</button>`}
      ${u?`<button type="button" class="vos-play-btn" data-cast-act="slot"
          data-level="${u.level}">Cast with a level ${u.level} slot</button>`:""}
      <div class="vos-play-rules">${ze(e.spellId)}</div>
    `,m=>{m.querySelectorAll("[data-cast-act]").forEach(f=>{f.addEventListener("click",async()=>{let h=f.dataset.castAct;if($(),h==="end"){y({op:"breakConcentration"});return}if(h==="free"){he(s);return}if(h==="slot"){if(!await y({op:"spendSlot",level:Number(f.dataset.level)},{undoable:!1}))return;e.concentration&&await y({op:"concentrate",spell:e.spellName},{undoable:!1}),k(`${e.spellName} is up${e.concentration?" \u2014 concentrating":""}.`)}})})})}function Ve(s){let e=(o&&o.features||[]).find(l=>l.id===s);e&&C(e.name,`
      <p class="vos-play-feature-state">Once per turn \u2014 no uses to spend.</p>
      <div class="vos-play-rules">${e.description||""}</div>
    `)}async function Ye(){let s=o&&o.zeroHpRescue;!s||!I(s.id,s.uses.max)||await y({op:"useCharge",feature:s.id,max:s.uses.max},{undoable:!1})&&(await y({op:"heal",amount:1},{undoable:!1}),await y({op:"adjustExhaustion",delta:-1},{undoable:!1}),k(`${s.name} \u2014 up at 1 hit point.`))}function F(s){let e=s.target.closest("[data-play]");if(!(!e||!t.contains(e))&&!(s.type==="keydown"&&!["Enter"," "].includes(s.key)))switch(s.type==="keydown"&&s.preventDefault(),e.dataset.play){case"hp":se();break;case"hitdice":Re();break;case"slot":{let l=Number(e.dataset.level),c=e.dataset.spent==="1";y({op:c?"restoreSlot":"spendSlot",level:l});break}case"pact":{y({op:e.dataset.spent==="1"?"restorePactSlot":"spendPactSlot"});break}case"charge":{let l=e.dataset.feature;if(!l)return;y({op:"useCharge",feature:l,max:Number(e.dataset.max)||void 0});break}case"charge-pip":{let l=e.dataset.feature;if(!l)return;y(e.dataset.spent==="1"?{op:"restoreCharge",feature:l}:{op:"useCharge",feature:l,max:Number(e.dataset.max)||void 0});break}case"feature":Y(e.dataset.feature);break;case"end-feature":y({op:"endFeature",feature:e.dataset.feature});break;case"exhaustion":{let l=Number(e.dataset.value);y({op:"setExhaustion",value:l===i.exhaustion?l-1:l});break}case"conditions":case"condition":oe();break;default:break}}return t.addEventListener("click",F),t.addEventListener("keydown",F),{apply:y,openHpPad:se,openRests:qe,openConditions:oe,openPrepare:je,openMasks:ie,openForms:Fe,openFormCatalog:V,openFeature:Y,activateFeature:_e,spendCharge:Ue,castFreeSpell:he,openFreeCast:ye,openPerTurnRule:Ve,rescueFromZero:Ye,formStatblockHtml:Oe,setState(s,e){i=s,e&&(p=e)},destroy(){t.removeEventListener("click",F),t.removeEventListener("keydown",F),$(),z()}}}var rt=["run","prepare","players","npcs","review"];function it(){return Array.from(document.querySelectorAll("[data-table-panel]"))}function Ne(){return Array.from(document.querySelectorAll("[data-table-area]"))}var N="run";function X(a,{keepUrl:t=!1}={}){if(N=rt.includes(a)?a:"run",it().forEach(r=>{r.hidden=r.dataset.tablePanel!==N}),Ne().forEach(r=>{let n=r.dataset.tableArea===N;r.classList.toggle("is-active",n),r.setAttribute("aria-selected",String(n)),r.tabIndex=n?0:-1}),t)return N;try{let r=new URL(window.location.href);r.searchParams.set("area",N),window.history.replaceState({},"",r.toString())}catch{}return N}function lt(){let a=window.VOS_PWA;return a&&a.authHeaders?a.authHeaders():{}}async function ct(){let a=document.getElementById("vos-table-review-list"),t=document.getElementById("vos-table-review-empty"),r=document.getElementById("vos-table-review-count");if(!a||!t)return;let n=[];try{let i=await fetch("/api/admin/lore-submissions",{cache:"no-store",headers:lt()});i.ok&&(n=((await i.json()).submissions||[]).filter(v=>["submitted","drafting","needs_review"].includes(v.status)))}catch{}a.innerHTML="",n.forEach(i=>{let p=document.createElement("li"),v=document.createElement("a");v.className="vos-row-chip",v.href=`/dm/?view=lore&submission=${encodeURIComponent(i.id)}`,v.innerHTML='<span></span><span class="vos-row-chip-arrow" aria-hidden="true">\u203A</span>';let S=v.querySelector("span"),w=document.createElement("span");w.className="vos-row-chip-title",w.textContent=i.title||i.name||"Untitled submission";let g=document.createElement("span");g.className="vos-row-chip-meta",g.textContent=[i.player_name,i.status].filter(Boolean).join(" \xB7 "),S.append(w,g),p.appendChild(v),a.appendChild(p)}),a.hidden=!n.length,t.hidden=!!n.length,r&&(r.textContent=n.length>9?"9+":String(n.length),r.hidden=!n.length);let o=document.querySelector("[data-vos-table-badge]");o&&(o.textContent=n.length>9?"9+":String(n.length),o.hidden=!n.length)}async function ut(){let a=document.getElementById("vos-table-roster");if(!a)return;let t=[];try{let n=await fetch("/data/players.json",{cache:"default"});n.ok&&(t=await n.json())}catch{}a.innerHTML="";let r=(Array.isArray(t)?t:[]).filter(n=>n.name&&n.name!=="DM");if(!r.length){a.innerHTML='<div class="vos-table-empty">No roster to preview.</div>';return}r.forEach(n=>{let o=document.createElement("button");o.type="button",o.className="vos-table-preview-seat",o.innerHTML='<span class="vos-table-preview-name"></span><span class="vos-table-preview-verb">Preview</span>',o.querySelector(".vos-table-preview-name").textContent=n.display||n.name,o.setAttribute("aria-label",`Preview the app as ${n.display||n.name}`),o.addEventListener("click",async()=>{let i=window.VOS_PWA;if(!(!i||!i.beginPreview)){o.disabled=!0;try{await i.beginPreview(n.name)}catch(p){o.disabled=!1;let v=document.createElement("span");v.className="vos-table-preview-error",v.textContent=p.message||"Could not open that seat.",o.after(v)}}}),a.appendChild(o)})}function He(){let a=document.getElementById("vos-table-areas");if(!a)return;a.addEventListener("click",r=>{let n=r.target.closest("[data-table-area]");n&&X(n.dataset.tableArea)}),a.addEventListener("keydown",r=>{if(r.key!=="ArrowLeft"&&r.key!=="ArrowRight")return;let n=Ne(),o=n.findIndex(v=>v.dataset.tableArea===N),i=r.key==="ArrowRight"?1:-1,p=n[(o+i+n.length)%n.length];p&&(r.preventDefault(),X(p.dataset.tableArea),p.focus())});let t="run";try{t=(new URLSearchParams(window.location.search).get("area")||"run").toLowerCase()}catch{}X(t,{keepUrl:!0}),ut(),ct()}var pt=12e3,M=document.getElementById("vos-party-root"),ee=document.getElementById("vos-party-status"),U=[],te=null,T=!1;function E(a){return String(a??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}function dt(a=6e3){return new Promise(t=>{let r=Date.now();(function n(){if(window.VOS_PWA)return t(window.VOS_PWA);if(Date.now()-r>a)return t(null);setTimeout(n,80)})()})}function mt(a){let t=window.VOS_PWA;return t&&t.authHeaders?t.authHeaders(a||{}):a||{}}async function ft(){let a=await fetch("/api/play/party",{cache:"no-store",headers:mt()}),t=await a.json().catch(()=>({}));if(!a.ok){let r=new Error(t.error||`HTTP ${a.status}`);throw r.status=a.status,r}return t.party||[]}function ht(a,t){if(!t||a==null)return"";let r=a/t;return a===0?"is-down":r<=.25?"is-bloodied":r<=.5?"is-hurt":""}function yt(a){let t=a.limits&&a.limits.slots||{},r=a.state.slots||{},n=Object.keys(t).sort();return n.length?n.map(o=>{let i=t[o],p=Math.max(0,i-(r[o]||0));return`<span class="vos-party-slot${p?"":" is-empty"}">
      <i>${E(o)}</i>${p}<b>/${i}</b></span>`}).join(""):""}function vt(a){let t=a.state,r=a.limits&&a.limits.maxHp||0,n=t.hp.current!=null?t.hp.current:r,o=r?Math.max(0,Math.min(100,n/r*100)):0,i=(t.conditions||[]).includes("dying"),p=(t.conditions||[]).filter(S=>S!=="dying"),v=Math.max(0,(a.limits&&a.limits.hitDice||0)-(t.hitDiceSpent||0));return a.hasStatblock?`<article class="vos-party-card ${ht(n,r)}${i?" is-dying":""}"
                   data-player="${E(a.playerName)}">
    <header class="vos-party-head">
      <h2>${E(a.character)}</h2>
      <span class="vos-party-class">${E(a.classLine||"")}</span>
      ${a.ac!=null?`<span class="vos-party-ac">AC ${E(a.ac)}</span>`:""}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${E(a.character)} hit points ${n} of ${r}">
      <span class="vos-party-hp-fill" style="width:${o}%"></span>
      <span class="vos-party-hp-text">
        <b>${n}</b><i>/${r||"\u2014"}</i>
        ${t.hp.temp?`<em>+${t.hp.temp}</em>`:""}
      </span>
      ${i?'<span class="vos-party-dying">Dying</span>':""}
    </button>

    ${t.exhaustion?`<div class="vos-party-exh" title="\u2212${t.exhaustion*2} to d20 tests, \u2212${t.exhaustion*5} ft">
      ${Array.from({length:6},(S,w)=>`<span class="${w<t.exhaustion?"is-on":""}"></span>`).join("")}
      <b>Exhaustion ${t.exhaustion}</b>
    </div>`:""}

    ${t.mask?`<div class="vos-party-mask">
      ${E(t.form?t.form.creature:t.mask.key)}
    </div>`:""}

    ${t.concentration?`<div class="vos-party-conc">Concentrating: ${E(t.concentration.spell)}</div>`:""}

    ${Object.keys(t.active||{}).length?`<div class="vos-party-active">${Object.values(t.active).map(S=>E(S.name)).join(" \xB7 ")}</div>`:""}

    <div class="vos-party-row">
      ${yt(a)}
      ${v?`<span class="vos-party-hd">${v} HD</span>`:""}
    </div>

    <div class="vos-party-conds">
      ${p.length?p.map(S=>`<span>${E(S)}</span>`).join(""):'<span class="is-empty">\u2014</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <button type="button" class="vos-party-view" data-act="preview"
              data-player="${E(a.playerName)}"
              title="Open the app as they see it">Preview</button>
      <a class="vos-party-view" href="/profile/?p=${encodeURIComponent(a.playerName)}"
         title="Open their profile">Profile</a>
    </div>
  </article>`:`<article class="vos-party-card is-missing">
      <h2>${E(a.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`}function ae(){M.innerHTML=U.map(vt).join("")}function R(a,t=""){ee&&(ee.textContent=a,ee.className=`vos-party-status${t?` is-${t}`:""}`)}function bt(a){let t=U.find(r=>r.playerName===a);return t?Ae({root:M,playerName:a,state:t.state,limits:t.limits,onState(r){t.state=r,ae()}}):null}async function gt(a,t){let r=t==="heal"?"Heal":"Damage",n=Number(window.prompt(`${r} ${a.character} by how much?`,"5"));if(!(!Number.isFinite(n)||n<=0))try{let o=await O({op:t==="heal"?"heal":"damage",amount:n},a.playerName);a.state=o.state,a.limits=o.limits||a.limits,ae()}catch(o){R(o.message,"error")}}function $t(a){let t=a.target.closest("[data-act]");if(!t)return;let r=t.closest("[data-player]");if(!r)return;let n=U.find(p=>p.playerName===r.dataset.player);if(!n)return;let o=t.dataset.act;if(o==="damage"||o==="heal"){gt(n,o);return}if(o==="preview"){let p=window.VOS_PWA;if(!p||!p.beginPreview)return;t.disabled=!0,p.beginPreview(n.playerName).catch(v=>{t.disabled=!1,R(v.message||"Could not open that seat.","error")});return}let i=bt(n.playerName);i&&(o==="hp"&&i.openHpPad(),o==="conditions"&&i.openConditions())}async function D({quiet:a=!1}={}){a||R("Refreshing\u2026");try{U=await ft(),ae(),R(`Updated ${new Date().toLocaleTimeString()}`)}catch(t){if(t.status===401||t.status===403){R("DM only.","error"),Te();return}R(`Could not refresh \u2014 ${t.message}`,"error")}}function wt(){Te(),te=setInterval(()=>{!T&&!document.hidden&&D({quiet:!0})},pt)}function Te(){clearInterval(te),te=null}document.addEventListener("visibilitychange",()=>{document.hidden||D({quiet:!0})});async function kt(){let a=await dt(),t=a&&a.getPlayerName?a.getPlayerName():null;if(!t){M.innerHTML='<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';return}if(!(t==="DM"||a&&a.isDm&&a.isDm())){M.innerHTML='<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';return}M.addEventListener("click",$t);let r=document.getElementById("vos-party-pause");r&&r.addEventListener("click",()=>{T=!T,r.textContent=T?"Resume updates":"Pause updates",r.setAttribute("aria-pressed",String(T)),T||D()});let n=document.getElementById("vos-party-refresh");n&&n.addEventListener("click",()=>D()),await D(),wt()}He();M&&kt();})();
