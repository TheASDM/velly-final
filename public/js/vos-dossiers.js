(()=>{var O=[{label:"Owes",key:"P1 - who you owe"},{label:"3am person",key:"P1 - your 3am person"},{label:"Mask",key:"P1 - your mask"},{label:"Tell",key:"P1 - your tell"},{label:"Vice",key:"P1 - your vice"},{label:"Wants",key:"P1 - what you want"}],K="#D0AE5E";function D(e){let s=window.VOS_PWA;return s&&s.authHeaders?s.authHeaders(e||{}):e||{}}async function P(e,s){let t=await fetch(e,{cache:"no-store",...s||{}});if(!t.ok){let n=await t.json().catch(()=>({})),l=new Error(n.error||`HTTP ${t.status}`);throw l.status=t.status,l}return t.json()}function R(e){let s=Object.values(e)[0];return s?s.vitals.map(t=>({label:t.group,fields:t.fields.map(n=>({key:n.key,label:n.label}))})):[]}function _(e){let s={};return e.part1.forEach(t=>{s[t.key]=t.prompt}),Object.values(e.characters).forEach(t=>{t.part2.forEach(n=>{s[n.key]=n.prompt})}),s[e.codaKey]=e.codaPrompt,s}function S(e){let s={};return e.vitals.forEach(t=>{t.fields.forEach(n=>{n.onFile&&n.value&&(s[n.key]=n.value)})}),s}function B(e,s,t){let n=S(s),l=[...e.part1.map(a=>a.key),...s.part2.map(a=>a.key),...s.vitals.flatMap(a=>a.fields.map(i=>i.key)),e.codaKey],r=0;return l.forEach(a=>{let i=(t[a]||"").trim();(i||!i&&n[a])&&(r+=1)}),{answered:r,total:l.length}}async function L(){let[e,s,t]=await Promise.all([P("/api/questionnaire/definitions",{headers:D()}),P("/data/players.json"),P("/api/questionnaire/all",{headers:D()})]),n={};(t.records||[]).forEach(a=>{n[a.playerName]=a});let l={};s.forEach(a=>{l[a.name]=a});let r=Object.keys(e.characters).map(a=>{let i=e.characters[a],d=n[i.player]||{},p=d.answers||{},m=l[i.player]||{},{answered:w,total:V}=B(e,i,p);return{id:a,player:i.player,name:i.name,short:m.display||i.name.split(" ")[0].replace(/[“”"]/g,""),role:i.role||"",color:m.color||K,status:d.status||"draft",submitted:d.submitted_at||null,updated:d.updated_at||null,answers:p,onFile:S(i),p2:i.part2.map(F=>F.key),answered:w,total:V}});return{p1:e.part1.map(a=>a.key),codaKey:e.codaKey,prompts:_(e),vitalsGroups:R(e.characters),characters:r}}function o(e){return String(e??"").replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[s])}function v(e){return String(e||"").replace(/^P1 - /,"").replace(/^P2 - /,"").replace(/^vitals - /,"")}function u(e,s){return((e.answers||{})[s]||"").trim()}function T(e){if(!e)return"\u2014";let s=new Date(e);return Number.isNaN(s.getTime())?"\u2014":s.toISOString().slice(0,10)}function g(e,s){return s?Math.round(e/s*100):0}function N(e,s){let t=s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return o(e).replace(new RegExp("("+t+")","ig"),"<mark>$1</mark>")}var W={2:"two",3:"three",4:"four",5:"five",6:"six",7:"seven",8:"eight"},G=["P1 - who you owe","P1 - your 3am person","P1 - an unspoken fear","P1 - what you want"];function Y(e){let s=G.map(t=>{let n=u(e,t);return`<dt>${o(v(t))}</dt><dd${n?"":' class="none"'}>${n?o(n):"\u2014"}</dd>`}).join("");return`<button class="card" data-char="${o(e.id)}" style="--c:${o(e.color)}">
    <h3>${o(e.name)}</h3>
    <div class="role">${o(e.role)}</div>
    <dl>${s}</dl>
    <div class="foot">
      <span class="meter"><i style="width:${g(e.answered,e.total)}%"></i></span>
      <span>${e.answered}/${e.total} \xB7 ${o(e.status)}</span>
    </div>
  </button>`}function A(e){let s=e.characters,t=s.filter(r=>r.status==="submitted").length,n=s.reduce((r,a)=>r+a.answered,0),l=s.reduce((r,a)=>r+a.total,0);return`
  <div class="dossier-head">
    <div class="eyebrow">The table \xB7 ${s.length} questionnaires</div>
    <h2>All ${W[s.length]||s.length}</h2>
    <p class="lede">Every answer the players submitted, laid side by side. Open a name for the
      full dossier, or use Cross-reference to hear everyone answer the same question.</p>
    <div class="totals">
      <div><b>${s.length}</b> players</div>
      <div><b>${t}</b> submitted</div>
      <div><b>${s.length-t}</b> still draft</div>
      <div><b>${n}</b> answers of ${l}</div>
    </div>
  </div>
  <div class="ov">${s.map(Y).join("")}</div>`}function C(e,s,t,n,l){let r=u(s,t);if(!r&&!l)return"";let a=e.prompts[t]||"";return`<div class="qa${r?"":" empty"}">
    <div class="label">${o(n)}</div>
    <div class="q">${o(v(t))}</div>
    ${a?`<div class="prompt">${o(a)}</div>`:""}
    <div class="a${r?"":" none"}">${r?o(r):"No answer yet"}</div>
  </div>`}function z(e,s,t){let n=u(e,s.key),l=(e.onFile[s.key]||"").trim();if(!n&&!l&&!t)return"";let r="\u2014",a="",i=!0;return n&&l&&n!==l?(r=n,a=`changed from on file: ${l}`,i=!1):n?(r=n,i=!1):l&&(r=l,a="on file, unchanged",i=!1),`<div class="vrow">
    <dt>${o(s.label)}</dt>
    <dd${i?' class="none"':""}>${o(r)}${a?`<span class="chg">${o(a)}</span>`:""}</dd>
  </div>`}function J(e,s,t){return e.vitalsGroups.map(l=>{let r=l.fields.map(a=>z(s,a,t)).join("");return r.trim()?`<div class="vgroup">
      <h4>${o(l.label)}</h4>
      <dl class="vgrid">${r}</dl>
    </div>`:""}).join("")||'<div class="empty-state">Nothing filled in yet.</div>'}function M(e,s,t){let n=e.p1.filter(i=>u(s,i)).length,l=s.p2.filter(i=>u(s,i)).length,r=u(s,e.codaKey),a=O.map(i=>{let d=u(s,i.key);return`<div class="cell">
      <div class="k">${o(i.label)}</div>
      <div class="v${d?"":" none"}">${d?o(d):"not answered"}</div>
    </div>`}).join("");return`
  <div class="dossier-head">
    <div class="eyebrow">${o(s.player)} \xB7 dossier</div>
    <h2>${o(s.name)}</h2>
    <div class="role">${o(s.role)}</div>
    <div class="tags">
      <span class="tag ${s.status==="submitted"?"done":"draft"}">${o(s.status)}</span>
      <span class="tag"><b>${s.answered}/${s.total}</b> answered</span>
      <span class="tag">submitted <b>${T(s.submitted)}</b></span>
      <span class="tag">updated <b>${T(s.updated)}</b></span>
    </div>
    <div class="jump">
      <a href="#s-table">At the table</a><a href="#s-vitals">Vitals</a>
      <a href="#s-p1">Part One</a><a href="#s-p2">Part Two</a>
    </div>
  </div>

  <section class="sec" id="s-table">
    <div class="sec-head"><h3>At the table</h3><span class="line"></span>
      <span class="count">the six that come up most</span></div>
    <div class="strip">${a}</div>
  </section>

  <section class="sec" id="s-vitals">
    <div class="sec-head"><h3>Vitals</h3><span class="line"></span>
      <span class="count">quick reference</span></div>
    ${J(e,s,t)}
  </section>

  <section class="sec" id="s-p1">
    <div class="sec-head"><h3>Part One \xB7 everyone answers these</h3><span class="line"></span>
      <span class="count">${n}/${e.p1.length}</span></div>
    ${e.p1.map(i=>C(e,s,i,"Part One",t)).join("")||'<div class="empty-state">No answers here.</div>'}
  </section>

  <section class="sec" id="s-p2">
    <div class="sec-head"><h3>Part Two \xB7 ${o(s.short)}\u2019s own questions</h3>
      <span class="line"></span><span class="count">${l}/${s.p2.length}</span></div>
    ${s.p2.map(i=>C(e,s,i,"Part Two",t)).join("")||'<div class="empty-state">No answers here.</div>'}
  </section>

  ${r?`<section class="sec">
    <div class="sec-head"><h3>One more thing</h3><span class="line"></span></div>
    <div class="qa"><div class="q">Anything else</div><div class="a">${o(r)}</div></div>
  </section>`:""}`}function j(e){let s=e.p1.map(t=>({key:t,group:"Part One"}));return e.vitalsGroups.forEach(t=>{t.fields.forEach(n=>{s.push({key:n.key,group:"Vitals \xB7 "+t.label})})}),s}function I(e,s,t){let n=j(e),l=[...new Set(n.map(p=>p.group))],r=e.prompts[s]||"",a=e.characters.filter(p=>u(p,s)).length,i=l.map(p=>{let m=n.filter(w=>w.group===p).map(w=>`<option value="${o(w.key)}"${w.key===s?" selected":""}>${o(v(w.key))}</option>`).join("");return`<optgroup label="${o(p)}">${m}</optgroup>`}).join(""),d=e.characters.map(p=>{let m=u(p,s);return!m&&!t?"":`<div class="voice" style="--c:${o(p.color)}">
      <div class="who">${o(p.short)}</div>
      <div class="txt${m?"":" none"}">${m?o(m):"no answer"}</div>
    </div>`}).join("");return`
  <div class="dossier-head">
    <div class="eyebrow">One question \xB7 ${e.characters.length} voices</div>
    <h2>Cross-reference</h2>
    <p class="lede">Pick a shared question and read every answer at once. Useful for spotting
      overlaps, contradictions, and who left the same blank.</p>
    <div class="picker">
      <label class="hint" for="vos-dossier-chorus">Question</label>
      <select id="vos-dossier-chorus">${i}</select>
      <span class="hint">${a} of ${e.characters.length} answered</span>
    </div>
  </div>
  <div class="chorus-prompt">${o(v(s))}</div>
  ${r?`<div class="chorus-sub">${o(r)}</div>`:""}
  <div class="voices">${d||'<div class="empty-state">Nobody answered this one.</div>'}</div>`}function H(e,s){let t=s.trim().toLowerCase(),n=[];e.characters.forEach(a=>{Object.keys(a.answers||{}).forEach(i=>{let d=(a.answers[i]||"").trim();if(!d)return;`${d} ${v(i)} ${e.prompts[i]||""}`.toLowerCase().includes(t)&&n.push({character:a,key:i,value:d})})});let l=new Set(n.map(a=>a.character.id)).size,r=n.length?e.characters.map(a=>{let i=n.filter(d=>d.character.id===a.id);return i.length?`<section class="sec">
        <div class="sec-head">
          <h3 style="color:${o(a.color)}">${o(a.name)}</h3>
          <span class="line"></span>
          <span class="count">${i.length} hit${i.length>1?"s":""}</span>
        </div>
        ${i.map(d=>`<div class="hit" style="--c:${o(a.color)}">
          <div class="who">${o(v(d.key))}</div>
          <div class="a">${N(d.value,s.trim())}</div>
        </div>`).join("")}
      </section>`:""}).join(""):`<div class="empty-state"><b>Nothing matches that.</b>
        Try a name, a district, or a fragment of a phrase.</div>`;return`<div class="dossier-head">
    <div class="eyebrow">Search</div>
    <h2>${o(s.trim())}</h2>
    <p class="lede">${n.length} match${n.length===1?"":"es"} across
      ${l} dossier${l===1?"":"s"}.</p>
  </div>${r}`}var f=document.getElementById("vos-dossiers-root"),k=document.getElementById("vos-dossiers-roster"),y=document.getElementById("vos-dossiers-q"),q=document.getElementById("vos-dossiers-blanks"),E=document.getElementById("vos-dossiers-toolbar"),h=null,c={view:"overview",id:null,chorusKey:null,query:"",blanks:!0};function Q(e=6e3){return new Promise(s=>{let t=Date.now();(function n(){if(window.VOS_PWA)return s(window.VOS_PWA);if(Date.now()-t>e)return s(null);setTimeout(n,80)})()})}function b(e,s){E&&(E.hidden=!0),k&&(k.innerHTML=""),f.innerHTML=`<div class="empty-state"><b>${o(e)}</b>${o(s||"")}</div>`}function U(){k&&(k.innerHTML=h.characters.map(e=>`<button class="nav-item${c.view==="dossier"&&c.id===e.id&&!c.query?" is-on":""}" data-char="${o(e.id)}"
      style="--c:${o(e.color)}">
      <span class="nav-row">
        <span class="nav-name">${o(e.short)}</span>
        <span class="nav-meta">${e.answered}/${e.total}</span>
      </span>
      <span class="nav-role">${o(e.role.split("\xB7")[0].trim())}</span>
      <span class="meter"><i style="width:${g(e.answered,e.total)}%"></i></span>
    </button>`).join(""),document.querySelectorAll(".nav-item[data-view]").forEach(e=>{e.classList.toggle("is-on",c.view===e.dataset.view&&!c.query)}))}function X(){return h.characters.find(e=>e.id===c.id)||h.characters[0]}function $(){let e=c.view==="overview"||c.view==="chorus";f.classList.toggle("is-wide",e&&!c.query),c.query.trim()?f.innerHTML=H(h,c.query):c.view==="dossier"?f.innerHTML=M(h,X(),c.blanks):c.view==="chorus"?f.innerHTML=I(h,c.chorusKey,c.blanks):f.innerHTML=A(h),U()}function x(){c.query="",y&&(y.value="")}function Z(){if(document.addEventListener("click",e=>{let s=e.target.closest("[data-char]");if(s){c.view="dossier",c.id=s.dataset.char,x(),$(),f.scrollIntoView({block:"start"});return}let t=e.target.closest("[data-view]");t&&(c.view=t.dataset.view,x(),$(),f.scrollIntoView({block:"start"}))}),document.addEventListener("change",e=>{e.target.id==="vos-dossier-chorus"&&(c.chorusKey=e.target.value,$())}),q&&q.addEventListener("change",()=>{c.blanks=q.checked,$()}),y){let e;y.addEventListener("input",s=>{clearTimeout(e);let t=s.target.value;e=setTimeout(()=>{c.query=t,$()},140)})}document.addEventListener("keydown",e=>{let s=/input|select|textarea/i.test(e.target.tagName);e.key==="/"&&!s&&y&&(e.preventDefault(),y.focus()),e.key==="Escape"&&y&&(x(),y.blur(),$())})}async function ee(){let e=await Q(),s=e&&e.getPlayerName?e.getPlayerName():null;if(!s){b("Sign in to open the dossiers.","These are the players\u2019 character records \u2014 DM only.");return}if(!(s==="DM"||e&&e.isDm&&e.isDm())){b("DM only.","Your own record lives at /questionnaire/.");return}try{h=await L()}catch(t){t.status===401||t.status===403?b("That session isn\u2019t authorised.","Sign in as the DM and try again."):b("Could not load the dossiers.",t.message||"Try again in a moment.");return}if(!h.characters.length){b("No character records yet.","They appear here once players start filling them in.");return}c.chorusKey=(j(h)[0]||{}).key||null,E&&(E.hidden=!1),Z(),$()}f&&ee();})();
