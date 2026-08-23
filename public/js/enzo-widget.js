(()=>{(function(){let c=["localhost","127.0.0.1",""].includes(location.hostname),r=location.pathname.replace(/\/$/,"")==="/enzo",o=document.createElement("link");if(o.rel="stylesheet",o.href="/css/chatbot.css",document.head.appendChild(o),!c){if(window.LOREMASTER_API_URL=location.origin+"/api/chat",r)try{localStorage.setItem("loreMasterOpen","true")}catch{}let a=document.createElement("script");a.src="/js/chatbot.js",a.defer=!0,document.body.appendChild(a);return}function t(){try{return JSON.parse(localStorage.getItem("loreMasterOpen"))}catch{return null}}function e(a){try{localStorage.setItem("loreMasterOpen",JSON.stringify(a))}catch{}}let s=r||t()===!0,n=document.getElementById("chatbot-container");if(!n)return;n.innerHTML=`
    <div id="chatbot-widget" class="${s?"":"chatbot-collapsed"}">
      <div class="chatbot-header" id="vos-stub-header">
        <img src="/images/maskicon2.png" alt="" class="chatbot-avatar-header">
        <span>Enzo</span>
        <span class="toggle-icon">\u25BC</span>
      </div>
      <div class="chatbot-body">
        <div id="chat-messages">
          <div id="chat-empty-state" class="chat-empty-state">
            <div class="chat-empty-title">Ask Enzo</div>
            <div class="chat-empty-chips" aria-label="Suggested prompts">
              <span>Who is\u2026</span>
              <span>Where is\u2026</span>
              <span>Rules question\u2026</span>
            </div>
          </div>
        </div>
        <div class="chat-mode-controls" aria-label="Enzo response mode">
          <button class="chat-mode-button is-active" type="button" data-chat-mode="lore" aria-pressed="true">Lore</button>
          <button class="chat-mode-button" type="button" data-chat-mode="rules" aria-pressed="false">Rules</button>
          <button class="chat-mode-button" type="button" data-chat-mode="brainstorm" aria-pressed="false">Brainstorm</button>
        </div>
        <div class="chat-input-area">
          <textarea id="chat-input" placeholder="Ask about NPCs, lore, locations\u2026" rows="1"></textarea>
          <button id="chat-send-btn" type="button" aria-label="Send message" title="Send">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;let u=document.getElementById("chatbot-widget");document.getElementById("vos-stub-header").addEventListener("click",()=>{let a=u.classList.toggle("chatbot-collapsed");e(!a)}),n.querySelectorAll("[data-chat-mode]").forEach(a=>{a.addEventListener("click",()=>{n.querySelectorAll("[data-chat-mode]").forEach(l=>{let d=l===a;l.classList.toggle("is-active",d),l.setAttribute("aria-pressed",d?"true":"false")});let i=document.getElementById("chat-input");i&&i.focus()})})})();(function(){function c(t){let e=()=>{t.style.height="auto";let s=parseFloat(getComputedStyle(t).lineHeight||"20")*4+22;t.style.height=`${Math.min(t.scrollHeight,s)}px`};t.addEventListener("input",e),e()}function r(){let t=document.getElementById("chat-input");if(!t)return!1;if(t.tagName==="TEXTAREA")return c(t),!0;let e=document.createElement("textarea");return e.id="chat-input",e.placeholder=t.placeholder||"",e.setAttribute("autocomplete","off"),e.rows=1,t.parentNode.replaceChild(e,t),c(e),e.addEventListener("keydown",s=>{if(s.key==="Enter"&&!s.shiftKey){s.preventDefault();let n=document.getElementById("chat-send-btn");n&&n.click()}}),!0}let o=setInterval(()=>{r()&&clearInterval(o)},100);setTimeout(()=>clearInterval(o),1e4)})();})();
