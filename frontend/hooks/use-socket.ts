'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseSocketProps {
  meetingId: string;
  token: string | null;
}

export function useSocket({ meetingId, token }: UseSocketProps) {
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const listenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());

  // Subscribe to specific message types
  const onMessage = useCallback((type: string, handler: (payload: any) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(handler);
    
    return () => {
      const handlers = listenersRef.current.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  const send = useCallback((type: string, payload: any = {}, targetId?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send message, socket not connected:', type);
      return;
    }

    const message = {
      id: crypto.randomUUID(),
      type,
      meetingId,
      senderId: connectionId || 'pending',
      targetId,
      timestamp: Date.now() / 1000,
      payload
    };

    socketRef.current.send(JSON.stringify(message));
  }, [meetingId, connectionId]);

  const disconnect = useCallback(() => {
    // Clear timers
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    
    if (socketRef.current) {
      console.log('[WS] Disconnecting socket manually...');
      socketRef.current.close(1000, 'Normal closure');
      socketRef.current = null;
    }
    
    setStatus('disconnected');
    setConnectionId(null);
  }, []);

  const connect = useCallback(() => {
    if (!token || !meetingId) return;

    if (socketRef.current) {
      disconnect();
    }

    setStatus('connecting');
    console.log(`[WS] Connecting to meeting ${meetingId}...`);

    let wsHost = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsHost) {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiHost.startsWith('https://')) {
        wsHost = apiHost.replace(/^https:\/\//, 'wss://');
      } else {
        wsHost = apiHost.replace(/^http:\/\//, 'ws://');
      }
    }
      
    const url = `${wsHost}/ws/${meetingId}?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connection established successfully.');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;

        // Start heartbeat ping checks every 30 seconds
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
          send('heartbeat');
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          // Track when server returns connection metadata details
          if (msg.type === 'participant-list' && msg.targetId) {
            setConnectionId(msg.targetId);
          } else if (msg.type === 'join' && !connectionId && msg.payload?.connection_id) {
            // Backup connection mapping fallback
          }

          // Trigger handlers for this message type
          const handlers = listenersRef.current.get(msg.type);
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(msg);
              } catch (err) {
                console.error(`[WS] Error in handler for type ${msg.type}:`, err);
              }
            });
          }
        } catch (err) {
          console.error('[WS] Failed to parse signaling message JSON:', err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WS] Connection closed (code: ${event.code}, reason: ${event.reason || 'None'}, clean: ${event.wasClean})`);
        setStatus('disconnected');
        setConnectionId(null);

        // Terminate timers
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

        // Handle specific handshake failures and do NOT attempt reconnection
        if (event.code === 1008) {
          toast.error(event.reason || 'Authentication failed. Please log in again.');
          return;
        }
        if (event.code === 3000) {
          toast.error(event.reason || 'Meeting is either finished or not found.');
          return;
        }

        // Implement exponential backoff reconnection if not a normal close
        if (event.code !== 1000) {
          const attempts = reconnectAttemptsRef.current;
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Max 30s
          reconnectAttemptsRef.current += 1;
          
          console.log(`[WS] Attempting reconnect in ${delay / 1000}s (Attempt #${reconnectAttemptsRef.current})...`);
          
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (event) => {
        // Do not print websocket errors if closed cleanly by the server with code 1008/3000
        if (ws.readyState === WebSocket.CLOSED) {
          return;
        }
        console.error("[WS] Error Event", event);
        setStatus('error');
      };

    } catch (err) {
      console.error('[WS] Failed to instantiate WebSocket client:', err);
      setStatus('error');
    }
  }, [meetingId, token, disconnect, send, connectionId]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [meetingId, token]);

  return {
    status,
    connectionId,
    send,
    onMessage,
    connect,
    disconnect
  };
}
