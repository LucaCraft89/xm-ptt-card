# XM Push-to-Talk Card 🎙️

![XM Push-to-Talk Card](banner.png)

A Home Assistant **custom Lovelace card** that turns a dashboard button into
live **push-to-talk** for XM / iCSee cameras. Hold the button, talk, and your
voice comes out the camera's speaker.

It pairs with the **[xm-cam-talk](https://github.com/LucaCraft89/xm-cam-talk)**
bridge (which speaks the cameras' DVRIP `OPTalk` protocol). The card captures
your microphone and streams it to the bridge over WebSocket.

Because it's a native card it runs in Home Assistant's own origin, so the
microphone works — unlike an `<iframe>`, where browsers block the mic.

## Install (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repo, category **Dashboard**.
2. Install **XM Push-to-Talk Card**, then reload your browser / restart the app.
3. Add the card to a dashboard:

```yaml
type: custom:xm-ptt-card
title: Push-to-Talk
bridge: talk.example.com     # your talk-bridge host, behind an HTTPS reverse proxy
token: your-talk-token       # only if the bridge sets TALK_TOKEN
cameras: [cam2, cam3, cam4]  # or a single: camera: cam3
```

Hold **Hold to Talk** and speak. First use prompts for microphone permission —
allow it for your Home Assistant URL.

## Dependency: the xm-cam-talk bridge + integration

This card is only the front-end button. It does **nothing on its own** — it
streams your mic to the **[xm-cam-talk](https://github.com/LucaCraft89/xm-cam-talk)**
project, which does the actual talking to the cameras. Set that up **first**:

1. **Run the bridge** (Docker) from
   [xm-cam-talk](https://github.com/LucaCraft89/xm-cam-talk#1-run-the-bridge)
   and point it at your cameras (`CAMS`), optionally with a `TALK_TOKEN`.
2. **Expose the bridge over HTTPS** with a reverse proxy (e.g.
   `talk.example.com`) — required so the browser will grant the microphone and
   the WebSocket isn't mixed-content. See
   [xm-cam-talk → Securing internet access](https://github.com/LucaCraft89/xm-cam-talk#4-securing-internet-access).
3. *(Recommended)* Install the **xm-cam-talk Home Assistant integration** too —
   it adds `notify.<camera>` entities for **text-to-speech**, complementing this
   card's live push-to-talk.
4. **Then** install this card and point `bridge` (and `token`) at that same
   bridge.

Home Assistant itself must also be opened over **HTTPS** (secure context for
`getUserMedia`).

## Options

| Option | Required | Description |
|--------|----------|-------------|
| `bridge` | yes | Bridge host, e.g. `talk.example.com` (no scheme). |
| `token` | no | `TALK_TOKEN` if the bridge is protected. |
| `cameras` | one of | List of camera names → shows a dropdown. |
| `camera` | these | A single camera name (no dropdown). |
| `title` | no | Card header text. |

## License

MIT. Not affiliated with XM, iCSee, or Home Assistant.
