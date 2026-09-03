import React, { useRef, useState, useEffect, useCallback } from 'react';

interface PushToTalkProps {
  room: any;
  connected: boolean;
  onIntercept: (transcript: string) => void;
  addTranscript: (role: 'controller' | 'user' | 'system', text: string, meta?: Record<string, any>) => void;
}

export function PushToTalk({ room, connected, onIntercept, addTranscript }: PushToTalkProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const longPressThreshold = 500; // ms for long press = interrupt

  const startRecording = useCallback(async () => {
    if (!room || !connected) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        // Send to agent via data channel
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            type: 'audio',
            data: base64,
          })),
          { reliable: true }
        );

        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      addTranscript('system', `Microphone error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [room, connected, addTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

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
    };
  }, [pressTimer]);

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