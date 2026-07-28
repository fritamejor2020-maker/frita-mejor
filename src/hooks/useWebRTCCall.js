import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useChatStore } from '../store/useChatStore';

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
 * Hook de Audio de Voz en Vivo WebRTC Full-Duplex (Llamada Telefónica Real)
 * ─────────────────────────────────────────────────────────────────────────────
 * Establece conexión P2P bidireccional continua de audio con cola de candidatos ICE
 * y reintento de señales SDP para garantizar audio en vivo continuo de alta calidad.
 */
export function useWebRTCCall(currentUserId, domAudioRef) {
  const activeCall = useChatStore((state) => state.activeCall);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const offerIntervalRef = useRef(null);

  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined') return;

    let channel = supabase.channel('public_chat_channel');

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

    // Inicializar WebRTC PeerConnection
    const initPeer = async () => {
      if (pcRef.current) return;

      try {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Reproducir flujo remoto en vivo de audio en el elemento <audio> del DOM
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

        // Capturar micrófono local full-duplex HD
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

        // Si soy el llamador y la llamada se conectó, crear la oferta SDP y reintentar la transmisión
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
            await processPendingCandidates();
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
