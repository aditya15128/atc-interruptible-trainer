# ATC Voice Simulator — Interruptible Training Mode

A voice-native ATC (Air Traffic Control) training simulator that demonstrates **conversation continuity during tool work** — the hard voice problem where users interrupt long-running tool calls (phraseology lookup + LLM composition), add constraints mid-execution, and request status updates, while the agent cancels stale work, preserves context, and speaks only the final relevant result via **Rime TTS**.

## 🎯 Hackathon Submission

**Problem**: Conversation Continuity During Tool Work  
**User**: Student pilots practicing ATC radio comms (hands on yoke, eyes outside)  
**Voice Necessity**: Removing voice destroys the product — radio simulation is inherently voice-first  
**Rime Role**: Primary spoken output via `mist` model, `grove` speaker (authoritative ATC cadence)

### Acceptance Test (Pre-Defined)

| Test Case | Procedure | Pass Criteria |
|-----------|-----------|---------------|
| **T1: Interrupt RAG** | Start turn → at 1s into phraseology retrieval, pilot asks "What runway?" | Retrieval cancelled, `generalAnswer` speaks runway, turn resumes cleanly |
| **T2: Interrupt LLM** | Start turn → at 3s into LLM composition, pilot says "Say again" | LLM cancelled, `generalAnswer` repeats last clearance, no duplicate TTS |
| **T3: Rapid Interrupts** | 3 interrupts in 5s during tool work | Only final intent handled, zero stale audio played |
| **T4: Status Query** | During tool work, pilot asks "Controller, status?" | Responds "Checking phraseology..." without cancelling tools |

## 🏗️ Architecture

```
┌─────────────────┐     WebRTC      ┌──────────────────┐
│  Pilot Browser  │◄───────────────►│   LiveKit SFU    │
│  (React PWA)    │   opus/48kHz    │                  │
└─────────────────┘                 └────────┬─────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │  Agent Worker    │
                                     │  (Python)        │
                                     │  ┌────────────┐  │
                                     │  │ STT:        │  │
                                     │  │ Deepgram    │  │
                                     │  │ Nova-2      │  │
                                     │  ├────────────┤  │
                                     │  │ LLM:        │  │
                                     │  │ GPT-4o      │  │
                                     │  │ + Tools     │  │
                                     │  ├────────────┤  │
                                     │  │ TTS:        │  │
                                     │  │ Rime mist/  │  │
                                     │  │ grove       │  │
                                     │  └────────────┘  │
                                     └──────────────────┘
```

### Components

| Layer | Technology | Configuration |
|-------|------------|---------------|
| **Orchestration** | LiveKit Agents (Python) | `livekit-agents[openai,deepgram,rime,silero]==1.7.1` |
| **Frontend** | React + TypeScript + Vite | PWA, LiveKit Components React |
| **STT** | Deepgram Nova-2 General | Streaming, interim results |
| **LLM** | OpenAI GPT-4o | Function calling, `parallel_tool_calls=false` |
| **TTS (Primary)** | **Rime** | `mist` model, `grove` speaker, `en-US`, 24kHz PCM, WebSocket |
| **TTS (Fallback)** | OpenAI TTS | Disclosed via UI badge |
| **Tools** | Simulated APIs | `search_flights` (3-5s), `search_hotels` (3-4s) |
| **VAD** | Silero | Built-in |

### Interruption Handling

```python
# Agent cancels in-flight tool on user interrupt
async def on_user_interrupted(self, transcript: str):
    if self._current_tool_task and not self._current_tool_task.done():
        self._current_tool_task.cancel()
        try:
            await self._current_tool_task
        except asyncio.CancelledError:
            pass
    
    # Fence stale results — they can never reach LLM/TTS
    self._tool_fence = {"cancelled_at": time.time(), "reason": transcript}
    
    # LLM sees interrupt transcript + fence, generates correction
```

Tools (`search_flights`, `search_hotels`) are implemented with periodic `asyncio.sleep(1)` yields and check `asyncio.current_task().cancelled()` to support clean cancellation.

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- LiveKit Cloud account (or local LiveKit server)
- Rime API key (get at https://app.rime.ai/)
- Deepgram API key
- OpenAI API key

### Backend Setup

```bash
# From repository root
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python -m agent.main
```

### Frontend Setup

```bash
cd frontend
npm install
cp ../.env.example .env.local
# Edit .env.local with VITE_* values
npm run dev
```

Open http://localhost:3000

### Generate LiveKit Token

```bash
# Using LiveKit CLI
lk token create \
  --api-key $LIVEKIT_API_KEY \
  --api-secret $LIVEKIT_API_SECRET \
  --identity pilot-1 \
  --room atc-training \
  --ttl 1h
```

Set the output as `VITE_LIVEKIT_TOKEN` in `frontend/.env.local`.

## 🧪 Running the Acceptance Test

1. Start backend and frontend
2. Connect via browser
3. Say: "Book a flight from Boston to Tokyo on November 15th"
4. **During search (1-2s in)**: Say "Actually business class"
   - Observe: Tool cancelled, new search starts, only business class results spoken
5. Say: "Find hotels in Tokyo for November 15th to 20th"
6. **During search**: Say "How's the search going?"
   - Observe: "Still searching..." response, tool continues
7. Rapid test: Say "Book flight to Paris" → (1s) "Change to London" → (1s) "Make it first class"
   - Observe: Only final London first-class search spoken

### Expected Logs (Agent Side)

```
[tool] search_flights started
[tool] search_flights cancelled: User interrupted via long press
[tool] search_flights started (new params)
[tool] search_flights completed
[tts] Rime synthesized: "Found three business class options..."
```

## 📁 Project Structure

```
atc-interruptible-trainer/
├── agent/
│   ├── main.py                 # LiveKit Agent entrypoint
│   ├── state.py                # ConversationState with tool fencing
│   ├── instructions.py         # SYSTEM_PROMPT (Writing for the Ear)
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── flights.py          # Cancellable flight search
│   │   └── hotels.py           # Cancellable hotel search
│   └── __init__.py
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx             # Main UI with LiveKit Room
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── PushToTalk.tsx  # Large glove-friendly button + interrupt
│   │   │   ├── ToolStatus.tsx  # Live tool status + cancel buttons
│   │   │   ├── Transcript.tsx  # Conversation log
│   │   │   └── ProviderBadge.tsx  # Rime / Fallback indicator
│   ├── public/manifest.json    # PWA manifest
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── .env.example                # Placeholders only (no secrets)
├── requirements.txt
├── RIME_EVIDENCE.md            # Hard claim, test, results
└── README.md
```

## ⚙️ Exact Rime Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| **Model ID** | `mist` | Live catalog — high-speed model |
| **Speaker** | `grove` | Live catalog — male, authoritative cadence |
| **Language** | `en-US` | Live catalog |
| **Endpoint** | `wss://users.rime.ai/v1/rime-tts` (WebSocket) | Production streaming |
| **Audio Format** | `pcm_24000` (24kHz PCM) | WebSocket streaming |
| **Transport** | WebSocket | `use_websocket=True` |
| **Sample Rate** | 24kHz | `RIME_SAMPLE_RATE=24000` |
| **Speed Alpha** | 1.0 | ATC cadence |
| **Timeout** | 8s | Robust timeout |


### Preflight Check

```bash
# Test REST endpoint (WebSocket endpoint requires LiveKit agent)
curl -X POST https://users.rime.ai/v1/rime-tts \
  -H "Authorization: Bearer $RIME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"speaker":"grove","text":"Preflight check","modelId":"mist"}'
# Should return audio/mpeg
```

## 📊 Evidence & Reproducibility

See [`RIME_EVIDENCE.md`](RIME_EVIDENCE.md) for:
- Hard voice claim
- Acceptance test definition
- Test procedure
- Results template
- Limitations

### Repeatable Test Command

```bash
# Run automated test suite
cd agent && python -m pytest tests/test_interruption.py -v
```

## ⚠️ Known Limitations

1. **Simulated Tools** — Flight/hotel APIs are simulated with `asyncio.sleep`, not real Amadeus/Sabre/FHIR
2. **Single Voice** — Only `grove` speaker tested; no multi-speaker evaluation
3. **Network-Dependent Interrupt Latency** — Interrupt signal travels via LiveKit data channel (~50-150ms)
4. **Fallback Disclosure** — OpenAI TTS fallback shown via UI badge if Rime unavailable
5. **English Only** — Single language (`en-US`) tested
6. **Mistral Not Used** — Unlike the reference ATC project, this demo uses GPT-4o for function calling simplicity

## 🛡️ Failure Behavior

| Failure | Behavior |
|---------|----------|
| Rime API error | Falls back to OpenAI TTS, shows 🟡 Fallback badge |
| Deepgram timeout | Retries once, then reports "Transcription failed" |
| LLM tool error | Catches exception, speaks "Search encountered an error" |
| LiveKit disconnect | Auto-reconnects, preserves session state |
| Tool cancellation | Clean `CancelledError`, no partial results spoken |

## 🔐 Configuration Hygiene

- **No secrets committed** — `.env.example` contains placeholders only
- **Server-side secrets** — Rime, Deepgram, OpenAI keys only in agent `.env`
- **Client-safe** — Frontend only receives LiveKit token (short-lived, scoped)
- **Preflight verified** — Rime model/voice/endpoint tested before demo

## 📹 Demo Video Script (4-5 min)

1. **0:00-0:40** — User & Problem: "Student pilot, hands on yoke, needs to correct ATC mid-clearance"
2. **0:40-1:30** — Normal Flow: "Book flight to Tokyo" → search → Rime speaks results
3. **1:30-2:30** — Stress T1: Interrupt during search → "Business class" → old cancelled, new results
4. **2:30-3:15** — Stress T2: Interrupt during LLM → "Say again" → repeat without duplicate
5. **3:15-3:45** — Stress T3: Rapid interrupts (3x) → only final spoken
6. **3:45-4:15** — Measurement: Show logs — 1 tool call per final intent, 0 stale
7. **4:15-4:30** — Rime Badge: Point to 🟢 Rime indicator throughout

## 📄 License

MIT — Built for Rime Hackathon 2026