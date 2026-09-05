import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { PushToTalk } from './components/PushToTalk';
import { ToolStatus } from './components/ToolStatus';
import { Transcript } from './components/Transcript';
import { ProviderBadge } from './components/ProviderBadge';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';
const LIVEKIT_TOKEN = import.meta.env.VITE_LIVEKIT_TOKEN || '';

function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transcript, setTranscript] = useState<Array<{
    role: 'controller' | 'user' | 'system';
    text: string;
    timestamp: number;
    meta?: Record<string, any>;
  }>>([]);
  const [toolStatus, setToolStatus] = useState<Array<{
    name: string;
    status: 'idle' | 'active' | 'completed' | 'cancelled';
    detail?: string;
    startTime?: number;
  }>>([]);
  const [activeProvider, setActiveProvider] = useState<'rime' | 'fallback'>('rime');
  const [error, setError] = useState<string | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [transcript, scrollToBottom]);

  const addTranscript = useCallback((role: 'controller' | 'user' | 'system', text: string, meta?: Record<string, any>) => {
    setTranscript(prev => [...prev, { role, text, timestamp: Date.now(), meta }]);
  }, []);

  const updateToolStatus = useCallback((name: string, status: 'idle' | 'active' | 'completed' | 'cancelled', detail?: string) => {
    setToolStatus(prev => {
      const existing = prev.findIndex(t => t.name === name);
      const item = { name, status, detail, startTime: status === 'active' ? Date.now() : undefined };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], ...item };
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const connect = useCallback(async () => {
    if (!LIVEKIT_TOKEN) {
      setError('LiveKit token not configured. Set VITE_LIVEKIT_TOKEN in .env');
      return;
    }
    setConnecting(true);
    setError(null);
    
    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    newRoom
      .on(RoomEvent.Connected, () => {
        setConnected(true);
        setConnecting(false);
        addTranscript('system', 'Connected to ATC Simulator. Press and hold to transmit.');
      })
      .on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setConnecting(false);
        addTranscript('system', 'Disconnected from simulator.');
      })
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          track.attach(new Audio()).play().catch(console.error);
        }
      })
      .on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          if (data.type === 'transcript') {
            addTranscript(data.role, data.text, data.meta);
          } else if (data.type === 'tool_status') {
            updateToolStatus(data.name, data.status, data.detail);
          } else if (data.type === 'provider') {
            setActiveProvider(data.provider);
          }
        } catch (e) {
          console.warn('Failed to parse data:', e);
        }
      });

    try {
      await newRoom.connect(LIVEKIT_URL, LIVEKIT_TOKEN);
      setRoom(newRoom);
    } catch (err) {
      setConnecting(false);
      setError(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [addTranscript, updateToolStatus]);

  const disconnect = useCallback(async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
    }
  }, [room]);

  const handleIntercept = useCallback((transcriptText: string) => {
    if (room) {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: 'interrupt',
          transcript: transcriptText,
        })),
        { reliable: true }
      );
    }
  }, [room]);

  const handleToolCancel = useCallback((toolName: string) => {
    if (room) {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: 'tool_cancel',
          tool: toolName,
        })),
        { reliable: true }
      );
    }
  }, [room]);

  if (!connected && !connecting) {
    return (
      <div className="app">
        <header className="header">
          <h1>✈️ ATC Voice Simulator</h1>
          <ProviderBadge provider="rime" />
        </header>
        <div className="main-content">
          <div className="card">
            <div className="instructions">
              <strong>Interruptible Training Mode</strong> — This demo proves <strong>conversation continuity during tool work</strong>.
              <br /><br />
              <strong>Normal flow:</strong> Say <kbd>"Book flight to Tokyo"</kbd> → Agent searches (3-5s) → Speaks results via Rime.
              <br /><br />
              <strong>Stress cases to try:</strong>
              <ul style={{ margin: '0.5rem 0 0 1.5rem', lineHeight: 2 }}>
                <li>During search: <kbd>"Actually business class"</kbd> — Old search cancelled, new one starts</li>
                <li>During search: <kbd>"How's it going?"</kbd> — Responds "Searching..." without cancelling</li>
                <li>Rapid: 3 corrections in 5s — Only final intent spoken</li>
              </ul>
              <br />
              <strong>Rime config:</strong> <code>mist</code> model, <code>grove</code> speaker, 24kHz PCM, WebSocket streaming.
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <button
              onClick={connect}
              disabled={connecting}
              className="ptt-button"
              style={{
                width: '100%',
                maxWidth: '320px',
                height: 'auto',
                borderRadius: 12,
                padding: '1.5rem',
                fontSize: '1.125rem',
                background: connecting ? 'var(--bg-secondary)' : 'var(--accent)',
              }}
            >
              {connecting ? 'Connecting...' : 'Connect to Simulator'}
            </button>
            {error && <div style={{ marginTop: '1rem', color: 'var(--error)' }}>{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>✈️ ATC Voice Simulator</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ProviderBadge provider={activeProvider} />
          <button
            onClick={disconnect}
            className="ptt-button"
            style={{
              width: 'auto',
              height: 'auto',
              borderRadius: 8,
              padding: '0.5rem 1rem',
              fontSize: '0.75rem',
              background: 'var(--bg-secondary)',
            }}
          >
            Disconnect
          </button>
        </div>
      </header>
        
        <div className="main-content">
          <div className="card">
            <div className="card-title">🎙️ Push-to-Talk</div>
            <PushToTalk
              room={room}
              connected={connected}
              onIntercept={handleIntercept}
              addTranscript={addTranscript}
            />
          </div>
          
          <div className="card">
            <div className="card-title">⚙️ Tool Status</div>
            <ToolStatus tools={toolStatus} onCancel={handleToolCancel} />
          </div>
        </div>

        <div className="card" style="grid-column: 1 / -1;">
          <div className="card-title">📜 Transcript</div>
          <Transcript items={transcript} />
          <div ref={transcriptEndRef} />
        </div>

        <div className="status-bar">
          <div className="status-item">
            <span className={`status-dot ${connected ? 'connected' : connecting ? 'connecting' : 'disconnected'}`} />
            <span>{connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}</span>
          </div>
          <div className="status-item">
            <span className="status-dot rime" style={{background: 'var(--rime-green)', boxShadow: '0 0 8px var(--rime-green)'}} />
            <span>Rime TTS Active</span>
          </div>
          <div className="status-item">
            <span>Tools: {toolStatus.filter(t => t.status === 'active').length} active</span>
          </div>
        </div>
      </div>
    );
  }

export default App;