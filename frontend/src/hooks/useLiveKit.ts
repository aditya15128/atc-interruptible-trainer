import { useCallback, useRef, useState } from 'react';
import { Room, LocalAudioTrack, Track } from 'livekit-client';

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const connect = useCallback(async (url: string, token: string) => {
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    
    roomRef.current = room;
    
    await room.connect(url, token);
    
    const audioTrack = await LocalAudioTrack.create({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    
    await room.localParticipant.publishTrack(audioTrack);
    setLocalAudioTrack(audioTrack);
    
    return room;
  }, []);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      setLocalAudioTrack(null);
    }
  }, [localAudioTrack]);

  const toggleMute = useCallback(() => {
    if (localAudioTrack) {
      const muted = !isMuted;
      localAudioTrack.mute(muted);
      setIsMuted(muted);
    }
  }, [localAudioTrack, isMuted]);

  const publishData = useCallback((data: any, reliable = true) => {
    if (roomRef.current) {
      roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(data)),
        { reliable }
      );
    }
  }, []);

  return {
    room: roomRef.current,
    localAudioTrack,
    isMuted,
    connect,
    disconnect,
    toggleMute,
    publishData,
  };
}