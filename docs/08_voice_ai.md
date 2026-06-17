# YakPack — Voice Layer (MAI-Voice & MAI-Transcribe)

> Give **Pemba a voice**, and let you talk back. Built on Microsoft's **MAI** speech models, served through
> the **Azure Speech** service / Microsoft Foundry — the same SDK as Azure neural voices, so it slots
> cleanly onto the AI layer in `07_ai_integration.md`. Like everything AI here, it's **optional with a
> graceful fallback** (browser Web Speech API, or text-only) and gated by a flag.

## 1. What it adds

1. **Pemba speaks** (TTS — **MAI-Voice-1 / -2**) — a ▶︎ on the daily Briefing and on chat replies reads them
   aloud in a warm voice. Optional "auto-narrate my morning brief." Perfect for the road when you're not
   looking at the screen.
2. **Talk to Pemba** (STT — **MAI-Transcribe-1 / 1.5**) — a 🎙️ in Ask Pemba: speak your question
   ("what do I wear tomorrow?") hands-free — ideal with gloves on or on a bumpy drive. (MAI-Transcribe-1.5
   supports 43 languages, so Hindi/Hinglish questions work too.)
3. **Voice mode (optional, stretch)** — a near real-time back-and-forth with Pemba via the **Azure Voice
   Live API**, which pipes STT → LLM → TTS in one low-latency stream.

## 2. Access & models

Per Microsoft Foundry, the MAI speech models run on the **Azure Speech** service — existing Azure Speech
SDK/REST, just different model/voice names. You need a **Speech (Foundry) resource** (key + region).

```
# .env (server only)
VOICE_ENABLED=true
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
AZURE_TTS_VOICE=MAI-Voice-1          # swap to MAI-Voice-2 when available
AZURE_STT_MODEL=MAI-Transcribe-1.5   # or MAI-Transcribe-1
```

- **TTS** = `MAI-Voice-1/2` via the Speech SDK (`SpeechSynthesizer`) — generates ~60s of audio in <1s, so
  briefings narrate near-instantly.
- **STT** = `MAI-Transcribe-1/1.5` via the LLM Speech API / Speech SDK (`SpeechRecognizer`).
- Models are **env-swappable** — bump versions without code changes.

## 3. Architecture (keys server-side)

```
Briefing/chat text ──► /api/voice/tts  ──► Azure Speech (MAI-Voice) ──► audio stream ──► <audio> in UI
Mic (user) ──► /api/voice/stt (audio) ──► Azure Speech (MAI-Transcribe) ──► text ──► Ask-Pemba (/api/ai/chat)
```

- **Route Handlers** `/api/voice/tts` and `/api/voice/stt`; the Azure Speech key stays server-side. Stream
  audio back to a hidden `<audio>` element; capture mic with `MediaRecorder` and POST the blob to `/stt`.
- TTS audio for the **daily briefing is cached** (per leg+date) alongside the briefing text — one synth,
  replayable, and available offline once cached.
- Optional **Voice Live API** for the real-time mode (its own WebSocket session).

### Sketch — TTS
```ts
// app/api/voice/tts/route.ts  (server)
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
export async function POST(req: Request) {
  if (process.env.VOICE_ENABLED !== 'true') return new Response(null, { status: 204 });
  const { text } = await req.json();
  const cfg = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY!, process.env.AZURE_SPEECH_REGION!);
  cfg.speechSynthesisVoiceName = process.env.AZURE_TTS_VOICE!;     // MAI-Voice-1
  // synthesize → return audio/mpeg stream
}
```

## 4. UX

- **Briefing card:** a small ▶︎ (Pemba speaks) + an "auto-narrate" toggle in settings. While playing,
  Pemba's avatar gets a subtle talking animation.
- **Ask Pemba:** a 🎙️ mic button; hold-to-talk or tap-to-toggle, live waveform, then the transcribed text
  drops into the chat and streams a reply (which can auto-speak if voice-out is on).
- **Accessibility win:** voice-out doubles as a screen-reader-friendly path; respect mute + `prefers-reduced-motion`.

## 5. Fallback & offline

- If `VOICE_ENABLED=false` or no Azure Speech key → hide voice controls, **or** fall back to the browser
  **Web Speech API** (`speechSynthesis` + `SpeechRecognition`) for a free, lower-quality voice so the
  feature still demos.
- **Offline caveat:** live STT/TTS needs network — so it's a *pre-trip / signal-available* feature. Mitigate
  by **pre-caching the briefing audio** while online; in Spiti's dead zones, cached audio still plays.

## 6. Cost & safety

- Cache briefing audio; rate-limit `/tts` and `/stt`; cap input length. Voice inherits the AI layer's
  **medical-caution** system prompt (Pemba won't dose Diamox, defers to a doctor).
- Keys server-side only; mic audio is transcribed and discarded (don't persist raw audio).

## 7. Build order

Layer on **after** the text AI (M8). Suggested **M9 — Voice:** TTS on the briefing first (cache it),
then mic-STT into Ask-Pemba, then (optional) the Voice Live real-time mode. Keep the text path fully usable
throughout.
