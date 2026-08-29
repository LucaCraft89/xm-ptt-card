# XM Push-to-Talk Card 🎙️

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

## Requirements

- The [xm-cam-talk](https://github.com/LucaCraft89/xm-cam-talk) bridge running
  and reachable from the browser at `bridge` over **HTTPS** (needed for the mic
  and, if remote, so the WebSocket isn't mixed-content).
- Home Assistant opened over **HTTPS** (secure context for `getUserMedia`).

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
