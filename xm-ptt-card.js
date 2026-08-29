// XM PTT custom Lovelace card — runs in HA's origin so the mic works (no iframe).
class XmPttCard extends HTMLElement {
  setConfig(cfg){
    if(!cfg.bridge) throw new Error("xm-ptt-card: 'bridge' (host) is required");
    this._cfg=cfg; this._on=false; this._render();
  }
  getCardSize(){ return 3; }
  _url(scheme){
    const b=this._cfg.bridge.replace(/^https?:\/\//,"").replace(/\/$/,"");
    return scheme+"://"+b;
  }
  _render(){
    const cams=this._cfg.cameras||(this._cfg.camera?[this._cfg.camera]:[]);
    if(!this.shadowRoot) this.attachShadow({mode:"open"});
    const root=this.shadowRoot;
    root.innerHTML=`
      <ha-card header="${this._cfg.title||"Push-to-Talk"}">
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
          ${cams.length>1?`<select id=cam style="padding:.6em;border-radius:.6em;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font:inherit">
             ${cams.map(c=>`<option>${c}</option>`).join("")}</select>`:``}
          <button id=ptt style="border:0;border-radius:.8em;padding:1.1em;font:600 1.05rem system-ui;color:#fff;background:#c0392b;user-select:none;touch-action:none;cursor:pointer">
            🎙️ Hold to Talk${cams.length===1?` — ${cams[0]}`:``}</button>
          <div id=log style="font-size:.85rem;color:var(--secondary-text-color);min-height:1.2em">ready</div>
        </div>
      </ha-card>`;
    const $=id=>root.getElementById(id);
    this._els={ptt:$("ptt"),log:$("log"),cam:$("cam")};
    const camOf=()=> this._els.cam? this._els.cam.value : cams[0];
    const b=this._els.ptt;
    b.addEventListener("pointerdown",e=>{e.preventDefault();this._start(camOf());});
    b.addEventListener("pointerup",e=>{e.preventDefault();this._stop();});
    b.addEventListener("pointercancel",()=>this._stop());
    b.addEventListener("pointerleave",()=>{if(this._on)this._stop();});
  }
  async _start(cam){
    if(this._on)return; this._on=true;
    const L=this._els.log,B=this._els.ptt;
    B.style.background="#27ae60"; B.textContent="🔴 Talking…"; L.textContent="connecting…";
    try{
      this._stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      this._ctx=new (window.AudioContext||window.webkitAudioContext)();
      const src=this._ctx.createMediaStreamSource(this._stream);
      const tok=this._cfg.token?("&token="+encodeURIComponent(this._cfg.token)):"";
      this._ws=new WebSocket(this._url("wss")+"/ws?cam="+encodeURIComponent(cam)+tok);
      this._ws.binaryType="arraybuffer";
      this._ws.onopen=()=>{L.textContent="live → "+cam;};
      this._ws.onerror=()=>{L.textContent="connection error";};
      this._node=this._ctx.createScriptProcessor(2048,1,1);
      this._node.onaudioprocess=e=>{
        if(!this._on||!this._ws||this._ws.readyState!=1)return;
        const inp=e.inputBuffer.getChannelData(0),r=this._ctx.sampleRate/8000;
        const n=Math.floor(inp.length/r),out=new Int16Array(n);
        for(let i=0;i<n;i++){let v=inp[Math.floor(i*r)];v=Math.max(-1,Math.min(1,v));out[i]=v<0?v*32768:v*32767;}
        this._ws.send(out.buffer);
      };
      src.connect(this._node); this._node.connect(this._ctx.destination);
    }catch(err){
      let m="mic error: "+(err.name||err);
      if(err.name==="NotAllowedError") m="Microphone blocked — allow it for this site, then hold again.";
      else if(err.name==="NotFoundError") m="No microphone on this device.";
      else if(!window.isSecureContext) m="Open Home Assistant over https for the mic.";
      L.textContent=m; this._on=false; B.style.background="#c0392b";
      B.textContent="🎙️ Hold to Talk"+((this._cfg.cameras||[]).length===1?" — "+this._cfg.cameras[0]:"");
    }
  }
  _stop(){
    if(!this._on)return; this._on=false;
    const B=this._els.ptt,cams=this._cfg.cameras||[];
    B.style.background="#c0392b"; B.textContent="🎙️ Hold to Talk"+(cams.length===1?" — "+cams[0]:"");
    this._els.log.textContent="idle";
    try{this._node.disconnect();this._stream.getTracks().forEach(t=>t.stop());this._ws.close();this._ctx.close();}catch(e){}
  }
}
if(!customElements.get("xm-ptt-card")) customElements.define("xm-ptt-card", XmPttCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"xm-ptt-card",name:"XM Push-to-Talk",description:"Hold-to-talk to XM/iCSee cameras via the talk bridge"});
