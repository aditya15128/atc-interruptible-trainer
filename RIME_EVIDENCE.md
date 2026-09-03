# RIME_EVIDENCE.md

## Hard Voice Claim

**Conversation continuity during tool work**: The ATC Voice Simulator cancels in-flight tool calls (flight/hotel search simulating phraseology retrieval + LLM composition) when a pilot interrupts mid-turn, fences stale results so they never re-enter the conversation, preserves session context (step index, resolved slots, transcript), and speaks only the final corrected response via **Rime TTS** (`mist` model, `grove` speaker).

This is distinct from simple interruption handling — the agent must:
1. Cancel the *correct* in-flight tool (not just stop TTS)
2. Prevent cancelled tool results from being spoken if they complete after cancellation
3. Maintain conversation state consistent with what the user *actually heard*
4. Handle rapid successive interrupts without state corruption

## Acceptance Test (Defined Before Demo)

| Test ID | Scenario | Procedure | Pass Criteria |
|---------|----------|-----------|---------------|
| **T1** | Interrupt during flight search | 1. Pilot: "Book flight from Boston to Tokyo Nov 15"<br>2. At ~1.5s (during `search_flights`), pilot: "Actually business class"<br>3. Observe agent response | • Original `search_flights` cancelled (log shows `CancelledError`)<br>• New `search_flights` starts with `cabin: "business"`<br>• Rime speaks only business class results<br>• Zero economy results spoken |
| **T2** | Interrupt during hotel search | 1. Pilot: "Find hotels in Paris for Dec 1-5"<br>2. At ~2s (during `search_hotels`), pilot: "Say again"<br>3. Observe agent response | • `search_hotels` cancelled<br>• `generalAnswer` repeats last clearance/summary<br>• No duplicate TTS for cancelled search |
| **T3** | Rapid successive interrupts | 1. Pilot: "Book flight to London"<br>2. At 1s: "Change to Paris"<br>3. At 2s: "Make it first class"<br>4. At 3s: "Actually economy"<br>5. Observe final result | • Only 1 `search_flights` completes (final: Paris, economy)<br>• 3 cancellations logged<br>• Rime speaks once with final params |
| **T4** | Status query during tool work | 1. Pilot: "Book flight to Sydney"<br>2. At ~2s: "Controller, status?"<br>3. Observe agent response | • `search_flights` continues (no cancellation)<br>• Agent responds "Still searching flights..."<br>• Context preserved, search completes normally |

## Test Procedure

### Setup
```bash
# 1. Start agent
cd agent && python -m agent.main

# 2. Start frontend
cd frontend && npm run dev

# 3. Generate LiveKit token (valid 1h)
lk token create --api-key $LIVEKIT_API_KEY --api-secret $LIVEKIT_API_SECRET \
  --identity pilot-test --room atc-test --ttl 1h

# 4. Set VITE_LIVEKIT_TOKEN in frontend/.env.local
# 5. Open http://localhost:3000, connect
```

### Execution (Per Test Case)
1. Connect to simulator
2. Trigger the test scenario via Push-to-Talk
3. Observe:
   - Agent console logs (tool start/cancel/complete)
   - Frontend ToolStatus panel (active/completed/cancelled)
   - Transcript (what was spoken)
   - Provider badge (🟢 Rime throughout)
4. Record: Pass/Fail, any anomalies
5. Repeat 5× per test case

### Measurement
- **Tool calls started** vs **completed** (should match final intents only)
- **Stale audio count** (should be 0)
- **Interrupt-to-first-word latency** (target <2s including STT+LLM+TTS)
- **State consistency**: Transcript matches what user heard

## Results Template

| Test Case | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Pass Rate | Notes |
|-----------|-------|-------|-------|-------|-------|-----------|-------|
| T1: Interrupt flight search | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | % | |
| T2: Interrupt hotel search | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | % | |
| T3: Rapid interrupts | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | % | |
| T4: Status query | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | % | |

### Example Log Output (Passing T1)

```
[agent] Tool started: search_flights
[agent] User interrupted: "Actually business class"
[agent] Tool cancelled: search_flights (CancelledError)
[agent] Tool started: search_flights (cabin=business)
[agent] Tool completed: search_flights
[tts] Rime synthesized 24k bytes: "Found three business class options..."
[transcript] CTL: "Found three business class options. First, United..."
```

## Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **Simulated APIs** | Flight/hotel tools use `asyncio.sleep` not real APIs | Representative latency (3-5s); cancellation logic identical |
| **Non-streaming Rime** | REST + base64 MP3 adds ~650ms vs streaming | Documented; WebSocket streaming would improve |
| **Single voice tested** | Only `grove` speaker evaluated | Rime catalog supports others; not tested |
| **Network-dependent interrupt** | Data channel latency ~50-150ms | Measured in results; acceptable for demo |
| **Fallback not tested under load** | OpenAI TTS fallback only triggers on Rime failure | Badge discloses active provider |
| **English only** | `en-US` only; no multilingual test | Scope limited to single language |
| **Mistral not used** | Reference ATC project uses Mistral; this uses GPT-4o | GPT-4o has native function calling for tools |

## Reproducibility Artifacts

- **Agent logs**: Console output with timestamps for each tool event
- **Frontend state**: ToolStatus component shows real-time tool state
- **Transcript**: Complete conversation history with role/timestamp/meta
- **Provider badge**: Visual confirmation of active TTS provider
- **Environment**: `.env.example` documents exact config (no secrets)

## Verification Command

```bash
# After deployment, run automated verification
cd agent && python -c "
import asyncio
from agent.tools.flights import flight_search_tool
from agent.tools.hotels import hotel_search_tool

async def test_cancellation():
    # Test flight search cancellation
    task = asyncio.create_task(flight_search_tool.search_flights('BOS', 'NRT', '2025-11-15'))
    await asyncio.sleep(1.5)
    task.cancel()
    try:
        await task
        print('FAIL: Task should have been cancelled')
    except asyncio.CancelledError:
        print('PASS: Flight search cancelled correctly')
    
    # Test hotel search cancellation
    task = asyncio.create_task(hotel_search_tool.search_hotels('Paris', '2025-12-01', '2025-12-05'))
    await asyncio.sleep(1.5)
    task.cancel()
    try:
        await task
        print('FAIL: Task should have been cancelled')
    except asyncio.CancelledError:
        print('PASS: Hotel search cancelled correctly')

asyncio.run(test_cancellation())
"
```