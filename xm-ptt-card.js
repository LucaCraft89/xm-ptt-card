// XM Camera Talk custom Lovelace card — runs in HA's origin so mic + fetch work (no iframe).
// PTT (hold-to-talk) + optional TTS, MP3/WAV play (URL or file), broadcast, and Stop.
// Verbose: status shown to the user + console.debug("[xm-ptt] ...") for debugging.
// Backward compatible: a PTT-only config (bridge + cameras) behaves exactly as before.
class XmPttCard extends HTMLElement {
  setConfig(cfg){
    if(!cfg.bridge) throw new Error("xm-ptt-card: 'bridge' (host) is required");
    if(!cfg.cameras && !cfg.camera) throw new Error("xm-ptt-card: set 'cameras: [..]' or 'camera: ..'");
    this._cfg=cfg; this._on=false; this._render();
  }
  getCardSize(){ return 3; }
  _log(m){ try{ console.debug("%c[xm-ptt]","color:#0a8;font-weight:bold",m); }catch(e){} }
  _host(){ return this._cfg.bridge.replace(/^wss?:\/\//,"").replace(/^https?:\/\//,"").replace(/\/$/,""); }
  _https(){ return "https://"+this._host(); }
  _tq(sep){ return this._cfg.token?(sep+"token="+encodeURIComponent(this._cfg.token)):""; }
  _render(){
    const c=this._cfg;
    const cams=c.cameras||[c.camera];
    const talk=c.talk!==false;                 // PTT on by default
    const tts=!!c.tts, media=!!c.media;
    const stop=(c.stop!==undefined)?!!c.stop:(tts||media); // stop auto-on with tts/media
    const multi=cams.length>1;
    const wantAll=multi&&(tts||media||stop);   // "all" only affects say/play/stop
    if(!this.shadowRoot) this.attachShadow({mode:"open"});
    const root=this.shadowRoot;
    const inp="padding:.6em;border-radius:.6em;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font:inherit;width:100%;box-sizing:border-box";
    const btn="border:0;border-radius:.7em;padding:.9em;font:600 1rem system-ui;color:#fff;cursor:pointer;width:100%";
    root.innerHTML=`
      <ha-card header="${c.title||"Camera Talk"}">
        <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
          ${(multi)?`<select id=cam style="${inp}">
             ${wantAll?`<option value="all">🔊 All cameras</option>`:``}
             ${cams.map(x=>`<option>${x}</option>`).join("")}</select>`:``}
          ${tts?`<textarea id=txt placeholder="Type a message to speak…" style="${inp};min-height:3em;resize:vertical"></textarea>
             <button id=speak style="${btn};background:#2e7d32">📢 Speak</button>`:``}
          ${media?`<input id=url placeholder="https://…/sound.mp3" style="${inp}">
             <button id=playurl style="${btn};background:#2e7d32">▶️ Play from URL</button>
             <input id=file type=file accept="audio/*" style="${inp}">
             <button id=playfile style="${btn};background:#2e7d32">▶️ Play file</button>`:``}
          ${stop?`<button id=stop style="${btn};background:#b71c1c">⏹️ Stop</button>`:``}
          ${talk?`<button id=ptt style="${btn};background:#c0392b;user-select:none;touch-action:none">🎙️ Hold to Talk${(!multi)?` — ${cams[0]}`:``}</button>`:``}
          <div id=log style="font-size:.85rem;color:var(--secondary-text-color);min-height:1.2em;word-break:break-word">ready</div>
        </div>
      </ha-card>`;
    const $=id=>root.getElementById(id);
    this._els={ptt:$("ptt"),log:$("log"),cam:$("cam")};
    const camOf=()=> this._els.cam? this._els.cam.value : cams[0];
    // TTS
    if(tts) $("speak").addEventListener("click",()=>this._post("/say",{cam:camOf(),text:$("txt").value.trim(),voice:c.voice||"en"},"speak",()=>$("txt").value.trim()));
    // media URL
    if(media){
      $("playurl").addEventListener("click",()=>this._post("/play_url",{cam:camOf(),url:$("url").value.trim()},"play",()=>$("url").value.trim()));
      $("playfile").addEventListener("click",()=>this._playFile(camOf(),$("file").files[0]));
    }
    // stop
    if(stop) $("stop").addEventListener("click",()=>this._stop(camOf()));
    // PTT
    if(talk){
      if(!window.isSecureContext) this._els.log.textContent="⚠️ Open Home Assistant over https:// — the mic needs a secure context.";
      const b=this._els.ptt;
      b.addEventListener("pointerdown",e=>{e.preventDefault();this._start(camOf());});
      b.addEventListener("pointerup",e=>{e.preventDefault();this._end("idle");});
      b.addEventListener("pointercancel",()=>this._end("idle"));
      b.addEventListener("pointerleave",()=>{if(this._on)this._end("idle");});
    }
  }
  async _post(path,body,verb,guard){
    if(guard&&!guard()) return;
    const cam=body.cam, L=this._els.log;
    L.textContent=verb+"ing on "+cam+"…"; this._log(verb+" "+path+" cam="+cam);
    try{
      const r=await fetch(this._https()+path+this._tq("?"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      L.textContent=d.ok?("✅ played on "+cam):("⛔ "+(d.err||JSON.stringify(d)));
      this._log(verb+" result "+JSON.stringify(d));
    }catch(e){ L.textContent="⛔ "+verb+" failed: "+e; this._log(verb+" error "+e); }
  }
  async _playFile(cam,f){
    if(!f) return; const L=this._els.log;
    L.textContent="uploading + playing on "+cam+"…"; this._log("play file "+f.name+" cam="+cam);
    try{
      const r=await fetch(this._https()+"/play?cam="+encodeURIComponent(cam)+this._tq("&"),{method:"POST",body:f});
      const d=await r.json(); L.textContent=d.ok?("✅ played on "+cam):("⛔ "+(d.err||JSON.stringify(d)));
    }catch(e){ L.textContent="⛔ play failed: "+e; }
  }
  async _stop(cam){
    const L=this._els.log; this._log("stop cam="+cam);
    try{
      const r=await fetch(this._https()+"/stop?cam="+encodeURIComponent(cam)+this._tq("&"));
      const d=await r.json(); L.textContent="⏹️ stopped: "+((d.stopped||[]).join(", ")||"(nothing playing)");
    }catch(e){ L.textContent="⛔ stop failed: "+e; }
  }
  async _start(cam){
    if(cam==="all"){ const cams=this._cfg.cameras||[this._cfg.camera]; cam=cams[0]; this._log("PTT can't broadcast; using "+cam); }
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
    const url="wss://"+host+"/ws?cam="+encodeURIComponent(cam)+this._tq("&");
    L.textContent="connecting to "+host+" …"; this._log("ws connecting to "+host+(this._cfg.token?" (with token)":" (no token)"));
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
    if(this._els.ptt){
      const cams=this._cfg.cameras||[this._cfg.camera];
      this._els.ptt.style.background="#c0392b";
      this._els.ptt.textContent="🎙️ Hold to Talk"+((cams.length===1)?" — "+cams[0]:"");
    }
    if(msg&&this._els.log) this._els.log.textContent=msg;
    if(wasOn) this._log("ended"+(this._sent?(" ("+Math.floor((this._sent||0)/8000)+"s sent)"):""));
    this._sent=0;
  }
}
if(!customElements.get("xm-ptt-card")) customElements.define("xm-ptt-card", XmPttCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"xm-ptt-card",name:"XM Camera Talk",description:"Talk, TTS, media playback + push-to-talk to XM/iCSee cameras via the talk bridge"});
