'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SocketStatus } from './use-socket';

interface PresenceData {
  user_id: number;
  connection_id: string;
  meeting_id: string;
  display_name: string;
  joined_at: number;
  camera_enabled: boolean;
  microphone_enabled: boolean;
  screen_sharing: boolean;
  connection_state: string;
}

interface UseWebRTCOptions {
  meetingId: string;
  connectionId: string | null;
  socketStatus: SocketStatus;
  send: (type: string, payload: any, targetId?: string) => void;
  onMessage: (type: string, handler: (payload: any) => void) => () => void;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
}

export function useWebRTC({
  meetingId,
  connectionId,
  socketStatus,
  send,
  onMessage,
  localStream,
  screenStream
}: UseWebRTCOptions) {
  // Store remote streams (connection_id -> MediaStream)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  // Store participant presences (connection_id -> PresenceData)
  const [presences, setPresences] = useState<Map<string, PresenceData>>(new Map());

  // RTCPeerConnections registry (connection_id -> RTCPeerConnection)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Sync refs to avoid re-subscription runs
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const cleanUpPeer = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      console.log(`[WebRTC] Closing peer connection for: ${peerId}`);
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    setPresences(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const closeAllPeers = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, peerId) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    setRemoteStreams(new Map());
    setPresences(new Map());
    console.log('[WebRTC] Closed all peer connections.');
  }, []);

  // Set up peer connection
  const createPeerConnection = useCallback(async (peerId: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(peerId)) {
      console.log(`[WebRTC] Peer connection already exists for: ${peerId}`);
      return peerConnectionsRef.current.get(peerId)!;
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for: ${peerId} (Initiator: ${isInitiator})`);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnectionsRef.current.set(peerId, pc);

    // Attach local media tracks (prioritize screen share if active)
    const streamToAttach = screenStreamRef.current || localStreamRef.current;
    if (streamToAttach) {
      streamToAttach.getTracks().forEach(track => {
        pc.addTrack(track, streamToAttach);
      });
    }

    // ICE candidates event handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send('ice-candidate', event.candidate, peerId);
      }
    };

    // Connection state changes handler
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${peerId} changed to: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanUpPeer(peerId);
      }
    };

    // Remote track added handler
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track received from ${peerId}:`, event.track.kind);
      const remoteStream = event.streams[0] || new MediaStream();
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(peerId, remoteStream);
        return next;
      });
    };

    // If initiator, negotiate by creating SDP offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send('offer', offer, peerId);
      } catch (err) {
        console.error(`[WebRTC] Failed to create offer for ${peerId}:`, err);
      }
    }

    return pc;
  }, [send, cleanUpPeer]);

  // Handle incoming SDP offers
  const handleOffer = useCallback(async (senderId: string, offer: RTCSessionDescriptionInit) => {
    try {
      const pc = await createPeerConnection(senderId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send('answer', answer, senderId);
    } catch (err) {
      console.error(`[WebRTC] Error handling offer from ${senderId}:`, err);
    }
  }, [createPeerConnection, send]);

  // Handle incoming SDP answers
  const handleAnswer = useCallback(async (senderId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnectionsRef.current.get(senderId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.warn(`[WebRTC] Received answer but no peer connection found for: ${senderId}`);
      }
    } catch (err) {
      console.error(`[WebRTC] Error setting remote description from answer:`, err);
    }
  }, []);

  // Handle incoming ICE candidates
  const handleIceCandidate = useCallback(async (senderId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionsRef.current.get(senderId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.warn(`[WebRTC] Received ICE candidate but no peer connection found for: ${senderId}`);
      }
    } catch (err) {
      console.error('[WebRTC] Error adding ICE candidate:', err);
    }
  }, []);

  // Optimal replaceTrack wrapper for webcam toggling / screen sharing
  const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
    const promises: Promise<void>[] = [];
    peerConnectionsRef.current.forEach((pc, peerId) => {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        console.log(`[WebRTC] Replacing video track on peer: ${peerId}`);
        promises.push(videoSender.replaceTrack(newTrack));
      }
    });
    await Promise.all(promises);
  }, []);

  // Set up socket message listener event subscriptions
  useEffect(() => {
    if (socketStatus !== 'connected' || !connectionId) return;

    // A. Participant joined notification
    const unsubJoin = onMessage('join', async (msg) => {
      const peerPresence = msg.payload as PresenceData;
      const peerId = msg.senderId;
      console.log(`[WebRTC] Participant joined signaling: ${peerPresence.display_name} (${peerId})`);
      
      setPresences(prev => {
        const next = new Map(prev);
        next.set(peerId, peerPresence);
        return next;
      });

      // Existing user initiates the SDP handshake
      await createPeerConnection(peerId, true);
    });

    // B. Participant list handshake initial setup
    const unsubList = onMessage('participant-list', (msg) => {
      const serverList = msg.payload.participants as Record<string, PresenceData>;
      console.log('[WebRTC] Received active presence map from server:', Object.keys(serverList).length);
      
      setPresences(prev => {
        const next = new Map(prev);
        Object.entries(serverList).forEach(([peerId, data]) => {
          next.set(peerId, data);
        });
        return next;
      });
      
      // Wait for existing users to call/offer. Do not initiate to avoid glares.
    });

    // C. Handle signaling details (offer, answer, ICE)
    const unsubOffer = onMessage('offer', async (msg) => {
      await handleOffer(msg.senderId, msg.payload);
    });

    const unsubAnswer = onMessage('answer', async (msg) => {
      await handleAnswer(msg.senderId, msg.payload);
    });

    const unsubIce = onMessage('ice-candidate', async (msg) => {
      await handleIceCandidate(msg.senderId, msg.payload);
    });

    // D. State changes (mute/camera toggles)
    const unsubCamera = onMessage('camera-state', (msg) => {
      setPresences(prev => {
        const next = new Map(prev);
        const presence = next.get(msg.senderId);
        if (presence) {
          presence.camera_enabled = msg.payload.enabled;
        }
        return next;
      });
    });

    const unsubMic = onMessage('microphone-state', (msg) => {
      setPresences(prev => {
        const next = new Map(prev);
        const presence = next.get(msg.senderId);
        if (presence) {
          presence.microphone_enabled = msg.payload.enabled;
        }
        return next;
      });
    });

    const unsubShareStart = onMessage('screen-share-start', (msg) => {
      setPresences(prev => {
        const next = new Map(prev);
        const presence = next.get(msg.senderId);
        if (presence) {
          presence.screen_sharing = true;
        }
        return next;
      });
    });

    const unsubShareStop = onMessage('screen-share-stop', (msg) => {
      setPresences(prev => {
        const next = new Map(prev);
        const presence = next.get(msg.senderId);
        if (presence) {
          presence.screen_sharing = false;
        }
        return next;
      });
    });

    // E. Participant left event
    const unsubLeave = onMessage('participant-left', (msg) => {
      console.log(`[WebRTC] Participant left signaling: ${msg.senderId}`);
      cleanUpPeer(msg.senderId);
    });

    return () => {
      unsubJoin();
      unsubList();
      unsubOffer();
      unsubAnswer();
      unsubIce();
      unsubCamera();
      unsubMic();
      unsubShareStart();
      unsubShareStop();
      unsubLeave();
    };

  }, [socketStatus, connectionId, onMessage, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, cleanUpPeer]);

  // Clean up peers on unmount
  useEffect(() => {
    return () => {
      closeAllPeers();
    };
  }, [closeAllPeers]);

  return {
    remoteStreams,
    presences,
    replaceVideoTrack,
    closeAllPeers
  };
}
