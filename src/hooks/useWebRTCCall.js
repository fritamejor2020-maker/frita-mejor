import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useChatStore } from '../store/useChatStore';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

/**
 * Hook de Audio de Voz en Vivo WebRTC con Servidores TURN de Relevo (Full-Duplex)
 * ─────────────────────────────────────────────────────────────────────────────
 * Utiliza servidores TURN de relevo para atravesar redes móviles (3G/4G/5G CGNAT)
 * y un elemento <audio> desbloqueado en el DOM para reproducir la voz sin cortes.
 */
export function useWebRTCCall(currentUserId, domAudioRef) {
  const activeCall = useChatStore((state) => state.activeCall);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined') return;

    let channel = supabase.channel('public_chat_channel');

    const cleanupWebRTC = () => {
      if (localStreamRef.current) {
        try {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        localStreamRef.current = null;
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch (_) {}
        pcRef.current = null;
      }
      if (domAudioRef?.current) {
        try {
          domAudioRef.current.pause();
          domAudioRef.current.srcObject = null;
        } catch (_) {}
      }
    };

    if (!activeCall || activeCall.status === 'ended') {
      cleanupWebRTC();
      return;
    }

    const isCaller = activeCall.callerId === currentUserId;
    const isReceiver =
      activeCall.receiverId === currentUserId ||
      (String(currentUserId).toLowerCase() === 'dejador' && String(activeCall.receiverId).toLowerCase() === 'dejador');

    if (!isCaller && !isReceiver) return;

    const initPeer = async () => {
      if (pcRef.current) return;

      try {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Conectar el flujo remoto de audio al elemento <audio> del DOM
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0] && domAudioRef?.current) {
            const audioEl = domAudioRef.current;
            audioEl.srcObject = event.streams[0];
            audioEl.play().catch((err) => console.warn('[WebRTC] Audio play error:', err));
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: 'broadcast',
              event: 'webrtc_candidate',
              payload: { candidate: event.candidate, fromUserId: currentUserId, callId: activeCall.id },
            }).catch(() => {});
          }
        };

        // Capturar micrófono local
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          localStreamRef.current = stream;
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        } catch (err) {
          console.warn('[WebRTC] Mic access error:', err);
        }

        // Si soy el llamador y la llamada está conectada, crear la oferta SDP
        if (isCaller && activeCall.status === 'connected') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'webrtc_offer',
            payload: { offer, fromUserId: currentUserId, callId: activeCall.id },
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('[WebRTC] initPeer error:', err);
      }
    };

    // Escuchar eventos WebRTC vía Supabase Broadcast Channel
    channel
      .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }) => {
        if (!payload || payload.callId !== activeCall.id || payload.fromUserId === currentUserId) return;
        try {
          if (!pcRef.current) await initPeer();
          const pc = pcRef.current;
          if (pc && pc.signalingState !== 'closed') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'webrtc_answer',
              payload: { answer, fromUserId: currentUserId, callId: activeCall.id },
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('[WebRTC] Offer handling error:', e);
        }
      })
      .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }) => {
        if (!payload || payload.callId !== activeCall.id || payload.fromUserId === currentUserId) return;
        try {
          const pc = pcRef.current;
          if (pc && (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer')) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          }
        } catch (e) {
          console.warn('[WebRTC] Answer handling error:', e);
        }
      })
      .on('broadcast', { event: 'webrtc_candidate' }, async ({ payload }) => {
        if (!payload || payload.callId !== activeCall.id || payload.fromUserId === currentUserId) return;
        try {
          const pc = pcRef.current;
          if (pc && payload.candidate && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        } catch (e) {
          console.warn('[WebRTC] Candidate handling error:', e);
        }
      })
      .subscribe();

    if (activeCall.status === 'connected') {
      initPeer();
    }

    return () => {
      cleanupWebRTC();
    };
  }, [activeCall?.status, activeCall?.id, currentUserId, domAudioRef]);
}
