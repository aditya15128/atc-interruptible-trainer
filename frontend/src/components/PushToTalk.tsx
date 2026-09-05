import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Room } from 'livekit-client';

interface PushToTalkProps {
  room: Room | null;
  connected: boolean;
  onIntercept: (transcript: string) => void;
  addTranscript: (role: 'controller' | 'user' | 'system', text: string, meta?: Record<string, any>) => void;
}

export function PushToTalk({ room, connected, onIntercept, addTranscript }: PushToTalkProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressThreshold = 500; // ms for long press = interrupt

  const startRecording = useCallback(async () => {
    if (!room || !connected) return;
    
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsRecording(true);
      addTranscript('system', '🎙️ Microphone active — speak now');
    } catch (err) {
      console.error('Failed to enable microphone:', err);
      addTranscript('system', `Microphone error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [room, connected, addTranscript]);

  const stopRecording = useCallback(async () => {
    if (!room || !isRecording) return;
    
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      setIsRecording(false);
    } catch (err) {
      console.error('Failed to disable microphone:', err);
    }
  }, [room, isRecording]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const timer = setTimeout(() => {
      // Long press detected - this is an interrupt
      if (isRecording) {
        stopRecording();
        setIsProcessing(true);
        addTranscript('system', '⚡ Interrupt detected — stopping current operation');
        onIntercept('User interrupted via long press');
        setTimeout(() => setIsProcessing(false), 500);
      }
    }, longPressThreshold);
    setPressTimer(timer);
    startRecording();
  }, [startRecording, stopRecording, onIntercept, addTranscript, isRecording]);

  const handleMouseUp = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    if (isRecording && !isProcessing) {
      stopRecording();
    }
  }, [isRecording, isProcessing, pressTimer, stopRecording]);

  const handleMouseLeave = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, pressTimer, stopRecording]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown(e as any);
  }, [handleMouseDown]);

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  useEffect(() => {
    return () => {
      if (pressTimer) clearTimeout(pressTimer);
      // Ensure mic is off on unmount
      if (room && isRecording) {
        room.localParticipant.setMicrophoneEnabled(false).catch(console.error);
      }
    };
  }, [pressTimer, room, isRecording]);

  return (
    <div className="push-to-talk">
      <button
        ref={buttonRef}
        className={`ptt-button ${isRecording ? 'active' : ''} ${isProcessing ? 'processing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={!connected || isProcessing}
        aria-label={isRecording ? 'Release to send' : 'Press and hold to speak'}
      >
        <span className="mic-icon">{isRecording ? '🔴' : '🎙️'}</span>
        <span className="ptt-label">
          {isProcessing ? 'INTERRUPT' : isRecording ? 'RECORDING' : 'HOLD TO SPEAK'}
        </span>
      </button>
      <p className="ptt-hint">
        {isProcessing 
          ? 'Interrupt sent — agent will respond to new input' 
          : isRecording 
            ? 'Speak now... Release to send. Hold 500ms+ to interrupt.' 
            : 'Press and hold the button to transmit. Hold 500ms+ during agent speech to interrupt.'}
      </p>
    </div>
  );
}