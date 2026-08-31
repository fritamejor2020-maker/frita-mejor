import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useChatStore, getChatRealtimeChannel } from '../store/useChatStore';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

/**
 * Hook de Audio de Voz en Vivo WebRTC Full-Duplex BIDIRECCIONAL (Llamada Telefónica Real)
 * ─────────────────────────────────────────────────────────────────────────────
 * Garantiza captura de micrófono local previa a la generación de SDP offer/answer
 * para que el audio fluya en ambas direcciones (bidireccional) sin silencios.
 */
export function useWebRTCCall(currentUserId, domAudioRef) {
  const activeCall = useChatStore((state) => state.activeCall);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const offerIntervalRef = useRef(null);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined') return;

    if (!activeCall || activeCall.status === 'ended') {
      return;
    }

    const isCaller = activeCall.callerId === currentUserId;
    const isReceiver =
      activeCall.receiverId === currentUserId ||
      (String(currentUserId).toLowerCase() === 'dejador' && String(activeCall.receiverId).toLowerCase() === 'dejador');

    if (!isCaller && !isReceiver) return;

    const channel = getChatRealtimeChannel() || supabase.channel('public_chat_channel');

    const cleanupWebRTC = () => {
      if (offerIntervalRef.current) {
        clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = null;
      }
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
      pendingCandidatesRef.current = [];
      isInitializingRef.current = false;
    };

    // Procesar candidatos ICE acumulados en la cola
    const processPendingCandidates = async () => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
      while (pendingCandidatesRef.current.length > 0) {
        const cand = pendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (_) {}
      }
    };

    const addOrQueueCandidate = async (candidate) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    // Inicializar WebRTC PeerConnection con micrófono bidireccional
    const initPeer = async () => {
      if (pcRef.current || isInitializingRef.current) return;
      isInitializingRef.current = true;

      try {
        // 1. Obtener micrófono local PRIMERO para garantizar pista de salida bidireccional
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          localStreamRef.current = stream;
        } catch (err) {
          console.warn('[WebRTC] Mic access error:', err);
        }

        // 2. Crear PeerConnection y conectar elemento <audio> del DOM
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

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

        // 3. Adjuntar pistas del micrófono local a la conexión peer
        if (stream) {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        }

        // 4. Si soy el llamador y la llamada está conectada, crear oferta SDP bidireccional
        if (isCaller && activeCall.status === 'connected') {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);

          const sendOffer = () => {
            if (pcRef.current && pcRef.current.signalingState === 'have-local-offer') {
              channel.send({
                type: 'broadcast',
                event: 'webrtc_offer',
                payload: { offer, fromUserId: currentUserId, callId: activeCall.id },
              }).catch(() => {});
            }
          };

          sendOffer();
          if (offerIntervalRef.current) clearInterval(offerIntervalRef.current);
          offerIntervalRef.current = setInterval(sendOffer, 1500);
        }
      } catch (err) {
        console.warn('[WebRTC] initPeer error:', err);
      } finally {
        isInitializingRef.current = false;
      }
    };

    // Escuchar eventos WebRTC vía Supabase Broadcast Channel
    channel
      .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }) => {
        if (!payload || payload.callId !== activeCall.id || payload.fromUserId === currentUserId) return;
        try {
          if (!pcRef.current) {
            await initPeer();
          }
          const pc = pcRef.current;
          if (pc && pc.signalingState !== 'closed') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            await processPendingCandidates();

            // Garantizar que las pistas locales estén agregadas antes de responder
            if (localStreamRef.current && pc.getSenders().length === 0) {
              localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
            }

            const answer = await pc.createAnswer({ offerToReceiveAudio: true });
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
          if (offerIntervalRef.current) {
            clearInterval(offerIntervalRef.current);
            offerIntervalRef.current = null;
          }
          if (pc && (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer')) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            await processPendingCandidates();
          }
        } catch (e) {
          console.warn('[WebRTC] Answer handling error:', e);
        }
      })
      .on('broadcast', { event: 'webrtc_candidate' }, async ({ payload }) => {
        if (!payload || payload.callId !== activeCall.id || payload.fromUserId === currentUserId) return;
        if (payload.candidate) {
          await addOrQueueCandidate(payload.candidate);
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
