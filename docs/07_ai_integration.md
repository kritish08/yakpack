# YakPack — AI Integration (Azure OpenAI)

> The intelligence layer. It turns raw data — live weather + the itinerary + your real packing state —
> into grounded, conversational, *personalised* guidance, spoken by **Pemba**. AI is an **enhancement,
> not a dependency**: if no Azure key is configured (`AI_ENABLED=false`), the app silently falls back to
> the rule-based Today logic and hides the AI UI. Nothing breaks.

## 1. What the AI does (4 features)

1. **Pemba's Daily Briefing** (Today screen) — one short, friendly, *grounded* morning brief that fuses
   today's live weather + current leg + tomorrow + **your unpacked gaps**:
   _"Morning! Kaza today — 14°C, blazing UV, sunset 7:42. Sunscreen's a must and you still haven't packed
   it 👀. Tonight you camp at Chandratal, sub-zero — dig the down jacket out before you leave Kaza."_ (streamed)
2. **Ask Pemba** (chat) — context-aware assistant grounded in itinerary + live weather + packing state.
   _"What do I wear at Chandratal tomorrow?" · "I forgot thermals — what's a substitute?" · "Is Day 6
   risky for altitude?"_ Streaming, with tool-calling so answers use real data, not guesses.
3. **Smart Gap Alerts** — AI cross-checks the **forecast + itinerary + what's still unpacked / un-bought**
   and surfaces risks: _"No rain layer packed and Day 2 shows 60% rain"_, _"Chandratal is −2°C and your
   down jacket is still in the To-Buy list."_ Shown as chips on Today + To-Buy.
4. **Natural-language add** (optional) — type _"add a sleeping-bag liner and 2 spare power banks"_ →
   AI structures it into items (name, category, assignee, qty) → inserted behind a one-tap confirm.

## 2. Principles

- **Server-only key.** The Azure key never reaches the browser. All calls go through Next.js Route Handlers.
- **Grounded, not generative-guessing.** Always pass the real context; use **tool calling** so the model
  pulls live weather / packing state / itinerary on demand. If data's missing, Pemba says so.
- **Streaming** everywhere user-facing (briefing + chat) for a realtime feel.
- **Graceful + optional.** `AI_ENABLED` flag; full rule-based fallback; never a hard dependency.
- **Cheap + safe.** Cache briefings, rate-limit chat, cap tokens, medical caution (see §7).

## 3. Stack

- **Vercel AI SDK** (`ai`) + **`@ai-sdk/azure`** — streaming, tool calls, model-agnostic.
- Model is **swappable via env** — point the deployment at `gpt-5.5`, `gpt-5.4`, `gpt-4o`, whatever your
  Azure resource has. No code change to switch.

```
# .env (server only)
AI_ENABLED=true
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-5.5          # your Azure deployment name
AZURE_OPENAI_API_VERSION=2024-10-21       # or current
```

## 4. Endpoints (Route Handlers)

| Route | Method | Purpose |
|---|---|---|
| `/api/ai/briefing` | GET | Daily briefing for the current leg (cached per leg+date) |
| `/api/ai/chat` | POST | Streaming "Ask Pemba" chat with tool calling |
| `/api/ai/gaps` | GET | Structured list of packing risks vs forecast/itinerary |
| `/api/ai/parse-item` | POST | NL → structured item(s) for confirm-then-insert |

### Sketch — provider + briefing

```ts
// lib/ai.ts
import { createAzure } from '@ai-sdk/azure';
export const azure = createAzure({
  resourceName: process.env.AZURE_OPENAI_ENDPOINT!,    // or baseURL
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
});
export const model = azure(process.env.AZURE_OPENAI_DEPLOYMENT!);

// app/api/ai/briefing/route.ts
import { generateText } from 'ai';
export async function GET() {
  if (process.env.AI_ENABLED !== 'true') return Response.json({ fallback: true });
  const ctx = await buildContext();           // leg + weather + tomorrow + packing summary
  const { text } = await generateText({
    model, system: PEMBA_SYSTEM, prompt: briefingPrompt(ctx), maxTokens: 220,
  });
  return Response.json({ text });              // cache via unstable_cache / revalidate
}
```

### Sketch — streaming chat with tools

```ts
// app/api/ai/chat/route.ts
import { streamText, tool } from 'ai';
import { z } from 'zod';
export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model, system: PEMBA_SYSTEM, messages,
    tools: {
      getCurrentLeg:   tool({ parameters: z.object({}), execute: getCurrentLeg }),
      getWeather:      tool({ parameters: z.object({ legDay: z.number() }), execute: getWeather }),
      getPackingState: tool({ parameters: z.object({ filter: z.enum(['unpacked','to_buy','all']) }), execute: getPackingState }),
    },
  });
  return result.toDataStreamResponse();
}
```

## 5. Grounding context (assembled server-side)

```ts
type Ctx = {
  today: { day:number; leg:string; altitude:number; warnings:string; network:string };
  weather: { temp:number; min:number; max:number; uv:number; precipProb:number; sunrise:string; sunset:string; code:number };
  tomorrow: { leg:string; min:number; prep:string };
  packing: { packedPct:number; perPerson:Record<string,number>;
             stillUnpacked:string[]; stillToBuy:string[] };   // names, capped to ~15 each
};
```
Pass a compact JSON of `Ctx` to the model (system or first tool result). Keep it small — names + numbers,
not the whole DB.

## 6. Tools (function calling)

- `getCurrentLeg()` · `getWeather(legDay)` · `getItinerary()` · `getPackingState(filter)` — read-only.
- `addItems(items[])` — **write**, only for NL-add and **gated behind a confirm sheet** in the UI.
- Tools keep answers truthful: the model fetches real numbers instead of inventing them.

## 7. Safety, privacy, cost

- **Key server-side only**; never in client bundles or logs.
- **Medical caution:** for altitude/AMS/Diamox questions, Pemba gives general guidance and **defers to a
  doctor** — never prescribes doses. Bake this into `PEMBA_SYSTEM`.
- **No sensitive PII** leaves the app — only trip data (legs, weather, item names). Two users only.
- **Cost guardrails:** cache the briefing (per leg+date), `maxTokens` caps, rate-limit `/chat`
  (e.g. 20 msgs/min/user), and only call AI on the Today/Chat screens (not on every render).
- **Reliability:** wrap calls in try/catch → on error, fall back to the rule-based briefing + a quiet toast.

## 8. Pemba system prompt (starter)

```
You are Pemba, a warm, witty Himalayan yak guiding two friends (Kritish & partner) on a 9-day Spiti trip.
You help them pack smart and stay safe. Rules:
- Be concise, friendly, a little playful — but always accurate.
- Ground every recommendation in the provided context / tools (weather, itinerary, packing state).
  If you lack data, call a tool or say you're not sure — never invent facts, temperatures, or distances.
- Prioritise safety: cold nights → warm layers; high UV → sun protection; rain → rain layer;
  high altitude → hydration, slow pace, and for any medical/AMS/Diamox question, advise consulting a
  doctor and do NOT give drug doses.
- Reference their actual unpacked / to-buy items by name when relevant ("you still haven't packed X").
- Keep briefings ≤ 60 words; chat replies tight unless asked to elaborate.
```

## 9. Where it shows (UI)

- **Today:** a **Briefing card** (Pemba avatar + streamed text + "Ask a follow-up →" opens chat) and
  **Gap-alert chips** under the carry strip.
- **Ask Pemba:** a chat screen/sheet (5th tab or a floating Pemba button) — streamed bubbles, suggested
  prompts ("What do I wear tomorrow?", "What am I still missing?"), grounded by tools.
- **To-Buy / Pack:** the NL-add bar ("add … in plain English") + gap alerts.
- All AI UI is hidden when `AI_ENABLED=false`.

## 10. Build order (fits the milestones)

- Wire after the rule-based Today works (M4). Suggested **M8 — AI layer**: provider + `/briefing` first
  (biggest payoff), then `/chat` with tools, then `/gaps`, then NL-add. Keep the fallback path green throughout.
