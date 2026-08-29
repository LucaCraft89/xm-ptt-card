# XM Push-to-Talk Card 🎙️

![XM Push-to-Talk Card](banner.png)

A Home Assistant **custom Lovelace card** for talking to XM / iCSee cameras.
Hold to talk live (**push-to-talk**), speak **text-to-speech**, play an **MP3/WAV**
(from a URL or a file), **broadcast** to all cameras at once, and **stop**
playback mid-way — all from one card. Push-to-talk is enabled by default; the
rest are opt-in flags (see Options).

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
title: Camera Talk
bridge: talk.example.com     # your talk-bridge host, behind an HTTPS reverse proxy
token: your-talk-token       # only if the bridge sets TALK_TOKEN
cameras: [cam2, cam3, cam4]  # or a single: camera: cam3
tts: true                    # add a text-to-speech box + Speak button
media: true                  # add play-from-URL + play-file buttons
stop: true                   # add a Stop button (default on when tts/media set)
# talk: false                # hide push-to-talk (it's on by default)
```

For a **push-to-talk-only** card, just set `bridge` + `cameras` — the extra
features stay hidden. With multiple cameras and any of `tts`/`media`/`stop`, the
dropdown gains an **All cameras** option (broadcast); push-to-talk itself is
always single-camera. First use prompts for microphone permission — allow it for
your Home Assistant URL.

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
| `title` | no | Card header text (default `Camera Talk`). |
| `talk` | no | Push-to-talk button. Default `true`. |
| `tts` | no | Text-to-speech box + Speak button. Default `false`. |
| `media` | no | Play-from-URL + play-file buttons. Default `false`. |
| `stop` | no | Stop button. Default `true` when `tts`/`media` are set. |
| `voice` | no | espeak-ng voice for TTS. Default `en`. |

## Troubleshooting

The card's **status line** always shows what's happening, and it logs every
step to the browser **dev-tools Console** with a `[xm-ptt]` prefix. Common
statuses:

| Status | Meaning / fix |
|--------|---------------|
| `requesting microphone…` then `🔒 Microphone blocked` | Allow the mic for your HA site (address-bar lock → Microphone → Allow). Not the HA in-app browser. |
| stuck on `connecting to <host> …` then `⚠️ No response from the bridge` | The browser can't reach the bridge host. On home Wi-Fi this is a DNS/hairpin issue — add a local DNS rewrite so `bridge` resolves to your reverse proxy's LAN IP. On mobile data it should connect. |
| `⛔ Unauthorized` | The card `token` doesn't match the bridge `TALK_TOKEN`. |
| `🔴 live → cam — talk now` | Connected; you're talking. |

The console shows the WebSocket close **code** (`1006` = network/unreachable,
`1008/4401` = auth) to pinpoint the cause. The bridge side logs the matching
`ws OPEN/CLOSE` lines (`docker logs -f talk-bridge`).

## License

MIT. Not affiliated with XM, iCSee, or Home Assistant.
