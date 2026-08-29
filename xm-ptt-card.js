// XM PTT custom Lovelace card — runs in HA's origin so the mic works (no iframe).
// Verbose: status shown to the user + console.debug("[xm-ptt] ...") for debugging.
class XmPttCard extends HTMLElement {
  setConfig(cfg){
    if(!cfg.bridge) throw new Error("xm-ptt-card: 'bridge' (host) is required");
    if(!cfg.cameras && !cfg.camera) throw new Error("xm-ptt-card: set 'cameras: [..]' or 'camera: ..'");
    this._cfg=cfg; this._on=false; this._render();
  }
  getCardSize(){ return 3; }
  _log(m){ try{ console.debug("%c[xm-ptt]","color:#0a8;font-weight:bold",m); }catch(e){} }
  _host(){ return this._cfg.bridge.replace(/^wss?:\/\//,"").replace(/^https?:\/\//,"").replace(/\/$/,""); }
  _render(){
    const cams=this._cfg.cameras||[this._cfg.camera];
    if(!this.shadowRoot) this.attachShadow({mode:"open"});
    const root=this.shadowRoot;
    root.innerHTML=`
      <ha-card header="${this._cfg.title||"Push-to-Talk"}">
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
          ${cams.length>1?`<select id=cam style="padding:.6em;border-radius:.6em;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font:inherit">
             ${cams.map(c=>`<option>${c}</option>`).join("")}</select>`:``}
          <button id=ptt style="border:0;border-radius:.8em;padding:1.1em;font:600 1.05rem system-ui;color:#fff;background:#c0392b;user-select:none;touch-action:none;cursor:pointer">
            🎙️ Hold to Talk${cams.length===1?` — ${cams[0]}`:``}</button>
          <div id=log style="font-size:.85rem;color:var(--secondary-text-color);min-height:1.2em;word-break:break-word">ready</div>
        </div>
      </ha-card>`;
    const $=id=>root.getElementById(id);
    this._els={ptt:$("ptt"),log:$("log"),cam:$("cam")};
    if(!window.isSecureContext) this._els.log.textContent="⚠️ Open Home Assistant over https:// — the mic needs a secure context.";
    const camOf=()=> this._els.cam? this._els.cam.value : cams[0];
    const b=this._els.ptt;
    b.addEventListener("pointerdown",e=>{e.preventDefault();this._start(camOf());});
    b.addEventListener("pointerup",e=>{e.preventDefault();this._end("idle");});
    b.addEventListener("pointercancel",()=>this._end("idle"));
    b.addEventListener("pointerleave",()=>{if(this._on)this._end("idle");});
  }
  async _start(cam){
    if(this._on) return; this._on=true; this._opened=false;
    const L=this._els.log,B=this._els.ptt,host=this._host();
    B.style.background="#e67e22"; B.textContent="⏳ starting…";
    L.textContent="requesting microphone…"; this._log("start cam="+cam+" host="+host);
    try{
      this._stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      this._log("microphone granted");
    }catch(err){
      const nm=(err&&err.name)||err; this._log("mic error: "+nm);
      let m="mic error: "+nm;
      if(nm==="NotAllowedError") m="🔒 Microphone blocked. Allow it for this site (address-bar lock → Microphone → Allow), then hold again.";
      else if(nm==="NotFoundError") m="No microphone found on this device.";
      else if(!window.isSecureContext||!navigator.mediaDevices) m="⚠️ Not a secure context — open HA over https://.";
      L.textContent=m; this._end(); return;
    }
    const tok=this._cfg.token?("&token="+encodeURIComponent(this._cfg.token)):"";
    const url="wss://"+host+"/ws?cam="+encodeURIComponent(cam)+tok;
    L.textContent="connecting to "+host+" …"; this._log("ws connecting to "+host+(tok?" (with token)":" (no token)"));
    try{ this._ws=new WebSocket(url); }
    catch(e){ this._log("ws ctor failed: "+e); L.textContent="⛔ Bad bridge address: "+host; this._end(); return; }
    this._ws.binaryType="arraybuffer";
    this._timer=setTimeout(()=>{
      if(this._opened) return;
      this._log("ws OPEN timeout (8s) — bridge unreachable");
      L.textContent="⚠️ No response from the bridge ("+host+"). On home Wi-Fi this is usually DNS/hairpin — see the card README. On mobile data it should connect.";
      this._end();
    },8000);
    this._ws.onopen=()=>{ this._opened=true; clearTimeout(this._timer); this._log("ws OPEN → streaming");
      B.style.background="#27ae60"; B.textContent="🔴 Talking…"; L.textContent="🔴 live → "+cam+" — talk now"; this._pipe(); };
    this._ws.onerror=()=>{ this._log("ws error event"); };
    this._ws.onclose=(e)=>{ clearTimeout(this._timer); this._log("ws CLOSE code="+e.code+" reason="+(e.reason||"(none)")+" opened="+this._opened);
      if(!this._opened){
        let m="⚠️ Connection failed (code "+e.code+").";
        if(e.code===1006) m="⚠️ Can't reach the bridge ("+host+") — network/hairpin. On Wi-Fi add a local DNS rewrite for this host (see README).";
        else if(e.code===1008||e.code===4401||e.code===4403) m="⛔ Unauthorized — check the card 'token' matches the bridge TALK_TOKEN.";
        L.textContent=m;
      }
      if(this._on) this._end();
    };
  }
  _pipe(){
    this._ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(this._ctx.state==="suspended"){ this._ctx.resume().catch(()=>{}); }
    const src=this._ctx.createMediaStreamSource(this._stream);
    this._node=this._ctx.createScriptProcessor(2048,1,1);
    this._sent=0;
    this._node.onaudioprocess=e=>{
      if(!this._on||!this._ws||this._ws.readyState!=1) return;
      const inp=e.inputBuffer.getChannelData(0),r=this._ctx.sampleRate/8000;
      const n=Math.floor(inp.length/r),out=new Int16Array(n);
      for(let i=0;i<n;i++){let v=inp[Math.floor(i*r)];v=Math.max(-1,Math.min(1,v));out[i]=v<0?v*32768:v*32767;}
      this._ws.send(out.buffer);
      const before=this._sent; this._sent+=n;
      if(Math.floor(this._sent/8000)>Math.floor(before/8000)) this._log("streamed "+Math.floor(this._sent/8000)+"s");
    };
    src.connect(this._node); this._node.connect(this._ctx.destination);
    this._log("audio pipeline @"+this._ctx.sampleRate+"Hz");
  }
  _end(msg){
    const wasOn=this._on; this._on=false;
    try{this._timer&&clearTimeout(this._timer);}catch(e){}
    try{this._node&&this._node.disconnect();}catch(e){}
    try{this._stream&&this._stream.getTracks().forEach(t=>t.stop());}catch(e){}
    try{this._ws&&this._ws.close();}catch(e){}
    try{this._ctx&&this._ctx.close();}catch(e){}
    const cams=this._cfg.cameras||[];
    this._els.ptt.style.background="#c0392b";
    this._els.ptt.textContent="🎙️ Hold to Talk"+(cams.length===1?" — "+cams[0]:"");
    if(msg) this._els.log.textContent=msg;
    if(wasOn) this._log("ended"+(this._sent?(" ("+Math.floor((this._sent||0)/8000)+"s sent)"):""));
    this._sent=0;
  }
}
if(!customElements.get("xm-ptt-card")) customElements.define("xm-ptt-card", XmPttCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"xm-ptt-card",name:"XM Push-to-Talk",description:"Hold-to-talk to XM/iCSee cameras via the talk bridge"});
