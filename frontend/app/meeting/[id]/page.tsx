'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/use-socket';
import { useMedia } from '@/hooks/use-media';
import { useWebRTC } from '@/hooks/use-webrtc';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Users, 
  Info, 
  Copy,
  Monitor,
  MonitorOff,
  ChevronRight,
  Camera,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  
  const meetingId = params.id as string;
  const [meetingTitle, setMeetingTitle] = useState('Loading meeting...');
  const [meetingDesc, setMeetingDesc] = useState('');
  const [meetingHost, setMeetingHost] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  // Sidebar Toggles
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Pinned layout control (connectionId of the pinned participant, or 'local', or null)
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);

  // Live Sync Timers & Recording states
  const [meetingStartedAt, setMeetingStartedAt] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<string | null>(null);
  
  const [elapsedTimeStr, setElapsedTimeStr] = useState('00:00:00');
  const [recordingTimeStr, setRecordingTimeStr] = useState('00:00:00');

  // 1. Local Device & Tracks Hook
  const {
    localStream,
    screenStream,
    isCameraOn,
    isMicOn,
    isSharingScreen,
    availableCameras,
    selectedCamera,
    startLocalStream,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
    changeCamera,
    cleanUpMedia
  } = useMedia();

  // 2. WebSocket Signaling Hook
  const {
    status: socketStatus,
    connectionId,
    send,
    onMessage
  } = useSocket({ meetingId, token });

  // 3. WebRTC Peer Connections & Streams Coordinator Hook
  const {
    remoteStreams,
    presences,
    replaceVideoTrack,
    closeAllPeers
  } = useWebRTC({
    meetingId,
    connectionId,
    socketStatus,
    send,
    onMessage,
    localStream,
    screenStream
  });

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch meeting metadata details
  useEffect(() => {
    async function fetchMeetingDetails() {
      if (!token) return;
      try {
        const res = await api.get(`/meetings/${meetingId}`);
        const data = res.data;
        setMeetingTitle(data.title);
        setMeetingDesc(data.description || '');
        setMeetingHost(data.host_name);
        setInviteLink(data.invite_link);
        
        // Initialize timer start and recording states
        setMeetingStartedAt(data.meeting_started_at);
        setIsRecording(data.is_recording);
        setRecordingStartedAt(data.recording_started_at);
      } catch (err) {
        console.error('Error fetching meeting details:', err);
        toast.error('Failed to retrieve meeting details.');
      }
    }
    fetchMeetingDetails();
  }, [meetingId, token]);

  // Request media streams on mount
  useEffect(() => {
    startLocalStream();
    return () => {
      cleanUpMedia();
    };
  }, [startLocalStream, cleanUpMedia]);

  // Bind local webcam stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Swap video track in peer connections when screen sharing starts/stops
  useEffect(() => {
    const activeStream = screenStream || localStream;
    if (activeStream) {
      const videoTrack = activeStream.getVideoTracks()[0] || null;
      replaceVideoTrack(videoTrack);
    } else {
      replaceVideoTrack(null);
    }
  }, [screenStream, localStream, replaceVideoTrack]);

  // Handle local microphone toggle click
  const handleMicToggle = () => {
    toggleMic((enabled) => {
      send('microphone-state', { enabled });
    });
  };

  // Handle local camera toggle click
  const handleCameraToggle = () => {
    toggleCamera((enabled) => {
      send('camera-state', { enabled });
    });
  };

  // Handle screen share start / stop click
  const handleScreenShareToggle = async () => {
    if (isSharingScreen) {
      stopScreenShare();
      send('screen-share-stop');
      if (localStream) {
        const webcamTrack = localStream.getVideoTracks()[0] || null;
        await replaceVideoTrack(webcamTrack);
      }
    } else {
      await startScreenShare(
        () => {
          send('screen-share-start');
        },
        async () => {
          send('screen-share-stop');
          if (localStream) {
            const webcamTrack = localStream.getVideoTracks()[0] || null;
            await replaceVideoTrack(webcamTrack);
          }
        }
      );
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied to clipboard!');
    }
  };

  const handleLeave = () => {
    closeAllPeers();
    cleanUpMedia();
    toast.info('Left meeting room.');
    router.replace('/');
  };

  // 1. Auto-start meeting session timer if host connects
  useEffect(() => {
    if (meetingHost && user?.full_name === meetingHost && !meetingStartedAt) {
      api.post(`/meetings/${meetingId}/start`)
        .then((res) => {
          setMeetingStartedAt(res.data.meeting_started_at);
        })
        .catch((err) => console.error("Error starting meeting session:", err));
    }
  }, [meetingHost, user?.full_name, meetingStartedAt, meetingId]);

  // 2. Synchronized Meeting Duration Timer
  useEffect(() => {
    if (!meetingStartedAt) {
      setElapsedTimeStr('00:00:00');
      return;
    }

    const startEpoch = new Date(meetingStartedAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, now - startEpoch);

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const pad = (n: number) => n.toString().padStart(2, '0');
      setElapsedTimeStr(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [meetingStartedAt]);

  // 3. Synchronized Recording Duration Timer
  useEffect(() => {
    if (!isRecording || !recordingStartedAt) {
      setRecordingTimeStr('00:00:00');
      return;
    }

    const startEpoch = new Date(recordingStartedAt).getTime();

    const updateRecTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, now - startEpoch);

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const pad = (n: number) => n.toString().padStart(2, '0');
      setRecordingTimeStr(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateRecTimer();
    const interval = setInterval(updateRecTimer, 1000);
    return () => clearInterval(interval);
  }, [isRecording, recordingStartedAt]);

  // Host Action: toggle recording on/off
  const handleRecordingToggle = async () => {
    try {
      if (isRecording) {
        await api.post(`/meetings/${meetingId}/recording/stop`);
        setIsRecording(false);
        setRecordingStartedAt(null);
        send('recording-stop', { hostName: user?.full_name || 'Host' });
        toast.info('Recording stopped.');
      } else {
        const res = await api.post(`/meetings/${meetingId}/recording/start`);
        setIsRecording(true);
        setRecordingStartedAt(res.data.recording_started_at);
        send('recording-start', { hostName: user?.full_name || 'Host', startedAt: res.data.recording_started_at });
        toast.success('Recording started.');
      }
    } catch (err: any) {
      console.error('Error toggling recording:', err);
      toast.error('Failed to change recording state.');
    }
  };

  // Listen for host control signals
  useEffect(() => {
    if (socketStatus !== 'connected') return;

    // A. Muted by host signal
    const unsubMuteAll = onMessage('mute-all', () => {
      if (isMicOn) {
        toggleMic((enabled) => {
          send('microphone-state', { enabled });
        });
        toast.warning('You have been muted by the host.');
      }
    });

    // B. Ejected by host signal
    const unsubEjected = onMessage('ejected', () => {
      toast.error('You have been removed from this meeting by the host.');
      handleLeave();
    });

    // C. Recording start signal from host
    const unsubRecStart = onMessage('recording-start', (msg) => {
      setIsRecording(true);
      setRecordingStartedAt(msg.payload.startedAt);
      toast.info(`${msg.payload.hostName} started recording`);
    });

    // D. Recording stop signal from host
    const unsubRecStop = onMessage('recording-stop', (msg) => {
      setIsRecording(false);
      setRecordingStartedAt(null);
      toast.info(`${msg.payload.hostName} stopped recording`);
    });

    return () => {
      unsubMuteAll();
      unsubEjected();
      unsubRecStart();
      unsubRecStop();
    };
  }, [socketStatus, onMessage, isMicOn, toggleMic, send]);

  const getConnectionStatusText = () => {
    switch (socketStatus) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected. Retrying...';
      case 'error': return 'Interrupted. Reconnecting...';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#09090B] text-[#F4F4F5] overflow-hidden relative">
      {/* 1. Header Information Panel */}
      <div className="h-14 border-b border-[rgba(255,255,255,0.06)] px-5 flex items-center justify-between z-10 shrink-0 bg-[#09090B]/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-bold text-xs text-indigo-400 shrink-0 uppercase tracking-wider">Zoom Clone Room</span>
          <span className="h-3 w-px bg-zinc-800 shrink-0" />
          <h2 className="text-xs font-bold text-zinc-300 truncate max-w-[150px] sm:max-w-[300px]">{meetingTitle}</h2>
          
          {/* Recording indicator pill */}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold select-none shrink-0 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span>Recording</span>
              <span className="font-mono text-[9px] font-semibold">{recordingTimeStr}</span>
            </div>
          )}

          <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            socketStatus === 'connected' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' 
              : 'bg-yellow-500/10 text-yellow-450 border-yellow-500/10 animate-pulse'
          }`}>
            {getConnectionStatusText()}
          </span>
        </div>
        
        {/* Dynamic header live indicators: Participant count and synchronized elapsed meeting duration */}
        <div className="flex items-center gap-4 shrink-0 select-none">
          {/* Live Participants Indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold" title="Participants">
            <span>👥</span>
            <span>{presences.size + 1} Participants</span>
          </div>

          {/* Synchronized Meeting Duration Timer */}
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold" title="Meeting Duration">
            <span>⏱</span>
            <span className="font-mono">{elapsedTimeStr}</span>
          </div>

          <span className="h-3 w-px bg-zinc-800" />

          <span className="text-[10px] text-zinc-500 font-mono tracking-wider font-semibold select-all">
            Code: {meetingId}
          </span>
        </div>
      </div>

      {/* 2. Main Video Grid Area */}
      <div className="flex-1 flex overflow-hidden relative bg-zinc-950/20">
        <div className="flex-1 p-5 flex flex-col items-center justify-center overflow-y-auto min-w-0 relative">
          
          {pinnedParticipantId && (remoteStreams.has(pinnedParticipantId) || pinnedParticipantId === 'local') ? (
            // PINNED VIEW LAYOUT: Pinned stream dominates center
            <div className="w-full h-full flex flex-col gap-4">
              <div className="flex-1 min-h-0 bg-zinc-900 border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden relative flex items-center justify-center">
                {pinnedParticipantId === 'local' ? (
                  <div className="w-full h-full relative">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    <div className="absolute bottom-3 left-3 bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-[rgba(255,255,255,0.06)] text-[10px] font-bold">
                      You (Pinned)
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <VideoFeed 
                      stream={remoteStreams.get(pinnedParticipantId)!} 
                      displayName={presences.get(pinnedParticipantId)?.display_name || 'Participant'} 
                      isMuted={!presences.get(pinnedParticipantId)?.microphone_enabled}
                      isCameraOff={!presences.get(pinnedParticipantId)?.camera_enabled}
                    />
                    <div className="absolute bottom-3 left-3 bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-[rgba(255,255,255,0.06)] text-[10px] font-bold">
                      {presences.get(pinnedParticipantId)?.display_name} (Pinned)
                    </div>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => setPinnedParticipantId(null)}
                  className="absolute top-3 right-3 bg-zinc-950/90 hover:bg-zinc-900 border border-[rgba(255,255,255,0.06)] text-[10px] font-bold h-7.5 px-3 rounded-lg"
                >
                  Unpin View
                </Button>
              </div>

              {/* Strip layout list below pinned content */}
              <div className="h-28 shrink-0 flex gap-3 overflow-x-auto py-0.5">
                {pinnedParticipantId !== 'local' && (
                  <div 
                    onClick={() => setPinnedParticipantId('local')}
                    className="w-36 h-full bg-zinc-900 border border-[rgba(255,255,255,0.06)] hover:border-zinc-700/80 rounded-xl overflow-hidden relative cursor-pointer shrink-0"
                  >
                    <video
                      ref={(el) => {
                        if (el && localStream) el.srcObject = localStream;
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    <div className="absolute bottom-2 left-2 bg-zinc-950/80 px-2 py-0.5 rounded text-[9px] font-bold border border-[rgba(255,255,255,0.04)]">
                      You
                    </div>
                  </div>
                )}

                {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
                  if (peerId === pinnedParticipantId) return null;
                  const pres = presences.get(peerId);
                  return (
                    <div 
                      key={peerId}
                      onClick={() => setPinnedParticipantId(peerId)}
                      className="w-36 h-full bg-zinc-900 border border-[rgba(255,255,255,0.06)] hover:border-zinc-700/80 rounded-xl overflow-hidden relative cursor-pointer shrink-0"
                    >
                      <VideoFeed 
                        stream={stream} 
                        displayName={pres?.display_name || 'Guest'} 
                        isMuted={!pres?.microphone_enabled}
                        isCameraOff={!pres?.camera_enabled}
                      />
                      <div className="absolute bottom-2 left-2 bg-zinc-950/80 px-2 py-0.5 rounded text-[9px] font-bold border border-[rgba(255,255,255,0.04)] truncate max-w-[120px]">
                        {pres?.display_name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // GRID VIEW LAYOUT: Grid tiles scale responsively based on room occupant counts
            <div className={`grid gap-4 w-full h-full max-w-4xl max-h-[70vh] ${
              (remoteStreams.size + 1) === 1 ? 'grid-cols-1 max-w-2xl' :
              (remoteStreams.size + 1) === 2 ? 'grid-cols-1 sm:grid-cols-2' :
              (remoteStreams.size + 1) <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
            }`}>
              
              {/* Local Webcam tile */}
              <Card className="relative overflow-hidden bg-zinc-900 border-[rgba(255,255,255,0.06)] rounded-xl flex flex-col items-center justify-center group aspect-video shadow-sm">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${!isCameraOn ? 'hidden' : ''}`}
                />
                
                {!isCameraOn && (
                  <div className="flex flex-col items-center gap-2.5 select-none">
                    <div className="h-12 w-12 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 text-sm font-bold text-zinc-350">
                      {user?.full_name.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Camera Off</span>
                  </div>
                )}

                {/* Status indicator badges */}
                <div className="absolute bottom-3 left-3 flex gap-1.5 items-center z-15">
                  <span className="text-[10px] bg-zinc-950/85 px-2.5 py-1 rounded-lg border border-[rgba(255,255,255,0.06)] text-zinc-200 font-bold">
                    You {isSharingScreen ? '(Screen Sharing)' : ''}
                  </span>
                </div>
                
                <div className="absolute top-3 right-3 flex gap-1.5 z-15">
                  {!isMicOn && (
                    <div className="bg-red-650 p-1.5 rounded-lg border border-red-500/20 text-white shadow-sm shadow-red-650/10">
                      <MicOff className="h-3 w-3" />
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPinnedParticipantId('local')}
                    className="h-6 w-6 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-[rgba(255,255,255,0.06)] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Pin Stream"
                  >
                    <ChevronRight className="h-3 w-3 rotate-45" />
                  </Button>
                </div>
              </Card>

              {/* Remote Participant tiles */}
              {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
                const pres = presences.get(peerId);
                const name = pres?.display_name || 'Guest';
                const isCameraEnabled = pres?.camera_enabled ?? true;
                const isMicEnabled = pres?.microphone_enabled ?? true;

                return (
                  <Card 
                    key={peerId}
                    className="relative overflow-hidden bg-zinc-900 border-[rgba(255,255,255,0.06)] rounded-xl flex flex-col items-center justify-center group aspect-video shadow-sm"
                  >
                    <VideoFeed 
                      stream={stream} 
                      displayName={name}
                      isMuted={!isMicEnabled}
                      isCameraOff={!isCameraEnabled}
                    />

                    <div className="absolute bottom-3 left-3 flex gap-1.5 items-center z-15">
                      <span className="text-[10px] bg-zinc-950/85 px-2.5 py-1 rounded-lg border border-[rgba(255,255,255,0.06)] text-zinc-200 font-bold truncate max-w-[130px]">
                        {name} {pres?.screen_sharing ? '(Screen Share)' : ''}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 flex gap-1.5 z-15">
                      {!isMicEnabled && (
                        <div className="bg-red-650 p-1.5 rounded-lg border border-red-500/20 text-white shadow-sm shadow-red-650/10">
                          <MicOff className="h-3 w-3" />
                        </div>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPinnedParticipantId(peerId)}
                        className="h-6 w-6 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-[rgba(255,255,255,0.06)] opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Pin Stream"
                      >
                        <ChevronRight className="h-3 w-3 rotate-45" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Sidebar Panel: Active participants */}
        {showParticipants && (
          <div className="w-72 border-l border-[rgba(255,255,255,0.06)] bg-[#0C0C0E] z-10 p-4 flex flex-col shrink-0">
            <h3 className="text-xs font-bold text-zinc-250 mb-4 flex items-center justify-between uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-indigo-400" />
                Room list ({presences.size + 1})
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-500 hover:text-zinc-300" onClick={() => setShowParticipants(false)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </h3>
            
            {user?.full_name === meetingHost && presences.size > 0 && (
              <div className="mb-3.5 shrink-0">
                <Button 
                  onClick={() => send('mute-all', {})}
                  className="w-full bg-red-500/10 hover:bg-red-500/15 border border-red-500/25 text-red-500 font-bold text-[10px] h-7.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MicOff className="h-3.5 w-3.5" />
                  Mute All Participants
                </Button>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {/* Local client checklist */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300 border border-zinc-700 shrink-0">
                    {user?.full_name.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-zinc-250 truncate">{user?.full_name} (You)</span>
                </div>
                <div className="flex gap-1.5 text-zinc-500 shrink-0">
                  {isMicOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3 text-red-500" />}
                  {isCameraOn ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3 text-red-500" />}
                </div>
              </div>

              {/* Remote client list */}
              {Array.from(presences.entries()).map(([peerId, pres]) => (
                <div key={peerId} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/30 border border-[rgba(255,255,255,0.02)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 border border-zinc-700 shrink-0">
                      {pres.display_name.charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-zinc-300 truncate">{pres.display_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex gap-1.5 text-zinc-500">
                      {pres.microphone_enabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3 text-red-500" />}
                      {pres.camera_enabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3 text-red-500" />}
                    </div>
                    {user?.full_name === meetingHost && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to remove ${pres.display_name} from this meeting?`)) {
                            send('remove-participant', {}, peerId);
                          }
                        }}
                        className="h-6 w-6 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md cursor-pointer ml-0.5"
                        title={`Remove ${pres.display_name}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Sidebar Panel: Room details information */}
        {showInfo && (
          <div className="w-72 border-l border-[rgba(255,255,255,0.06)] bg-[#0C0C0E] z-10 p-4 flex flex-col shrink-0 space-y-4">
            <h3 className="text-xs font-bold text-zinc-250 flex items-center justify-between uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Info className="h-4 w-4 text-indigo-400" />
                Information
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-500 hover:text-zinc-300" onClick={() => setShowInfo(false)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wide">Title</span>
                <p className="font-bold text-zinc-300 mt-1 leading-snug">{meetingTitle}</p>
              </div>
              {meetingDesc && (
                <div>
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wide">Agenda</span>
                  <p className="text-zinc-450 mt-1 leading-relaxed text-[11px]">{meetingDesc}</p>
                </div>
              )}
              <div>
                <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wide">Meeting Host</span>
                <p className="font-bold text-zinc-300 mt-1 leading-snug">{meetingHost}</p>
              </div>
              <div className="pt-2.5 border-t border-[rgba(255,255,255,0.06)]">
                <Button 
                  size="sm" 
                  onClick={handleCopyLink}
                  className="w-full bg-zinc-950 hover:bg-zinc-900 border border-[rgba(255,255,255,0.06)] text-zinc-300 text-xs font-bold rounded-lg py-2"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5 text-zinc-500" />
                  Copy Invite Link
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Bottom Controls Bar */}
      <div className="h-16 border-t border-[rgba(255,255,255,0.06)] px-5 flex items-center justify-between bg-[#0C0C0E] z-10 shrink-0">
        
        {/* Left section controls */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowInfo(!showInfo);
              setShowParticipants(false);
            }}
            className={`h-9 w-9 rounded-lg border ${
              showInfo 
                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' 
                : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900'
            }`}
            title="Meeting Details"
          >
            <Info className="h-4.5 w-4.5" />
          </Button>

          {/* Camera switcher devices list */}
          {availableCameras.length > 1 && (
            <div className="relative group">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
                title="Choose Camera"
              >
                <Camera className="h-4.5 w-4.5" />
              </Button>
              <div className="absolute bottom-11 left-0 hidden group-hover:flex flex-col bg-[#1E1E22] border border-[rgba(255,255,255,0.06)] rounded-lg shadow-xl p-1 z-50 w-44">
                {availableCameras.map((cam) => (
                  <Button
                    key={cam.deviceId}
                    variant="ghost"
                    size="sm"
                    onClick={() => changeCamera(cam.deviceId)}
                    className={`justify-start text-left text-[10px] truncate w-full px-2 py-1 h-7.5 font-bold ${
                      selectedCamera === cam.deviceId ? 'bg-indigo-600/15 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {cam.label || `Webcam ${cam.deviceId.slice(0, 4)}`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Central video conferencing toggles */}
        <div className="flex items-center gap-2.5">
          {/* Mic toggler */}
          <Button
            onClick={handleMicToggle}
            className={`h-9.5 w-9.5 rounded-lg flex items-center justify-center transition-all duration-150 border ${
              isMicOn 
                ? 'bg-zinc-900 border-[rgba(255,255,255,0.06)] text-zinc-300 hover:bg-zinc-800'
                : 'bg-red-650 text-white hover:bg-red-750 border-red-500/10 shadow-sm shadow-red-650/15' 
            }`}
            title={isMicOn ? 'Mute' : 'Unmute'}
          >
            {isMicOn ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
          </Button>

          {/* Camera toggler */}
          <Button
            onClick={handleCameraToggle}
            className={`h-9.5 w-9.5 rounded-lg flex items-center justify-center transition-all duration-150 border ${
              isCameraOn 
                ? 'bg-zinc-900 border-[rgba(255,255,255,0.06)] text-zinc-300 hover:bg-zinc-800'
                : 'bg-red-650 text-white hover:bg-red-750 border-red-500/10 shadow-sm shadow-red-650/15' 
            }`}
            title={isCameraOn ? 'Stop Video' : 'Start Video'}
          >
            {isCameraOn ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
          </Button>

          {/* Screen Share toggler */}
          <Button
            onClick={handleScreenShareToggle}
            className={`h-9.5 w-9.5 rounded-lg flex items-center justify-center transition-all duration-150 border ${
              isSharingScreen 
                ? 'bg-indigo-650 text-white hover:bg-indigo-755 border-indigo-500/15 shadow-sm shadow-indigo-650/15' 
                : 'bg-zinc-900 border-[rgba(255,255,255,0.06)] text-zinc-300 hover:bg-zinc-800'
            }`}
            title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
          >
            {isSharingScreen ? <MonitorOff className="h-4.5 w-4.5" /> : <Monitor className="h-4.5 w-4.5" />}
          </Button>

          {/* Host Recording toggle button shortcut */}
          {user?.full_name === meetingHost && (
            <Button
              onClick={handleRecordingToggle}
              className={`h-9.5 w-9.5 rounded-lg flex items-center justify-center transition-all duration-150 border cursor-pointer ${
                isRecording 
                  ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' 
                  : 'bg-zinc-900 border-[rgba(255,255,255,0.06)] text-zinc-350 hover:bg-zinc-800'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              <span className={`h-2 w-2 rounded-full bg-red-500 ${isRecording ? 'animate-pulse' : ''}`} />
            </Button>
          )}

          {/* Leave CTA button */}
          <Button
            onClick={handleLeave}
            className="bg-red-650 hover:bg-red-750 border border-red-500/10 text-white rounded-lg h-9.5 px-4 font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-red-650/10"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="hidden sm:inline">Leave Room</span>
          </Button>
        </div>

        {/* Right section controls */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowInfo(false);
            }}
            className={`h-9 w-9 rounded-lg border ${
              showParticipants 
                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' 
                : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900'
            }`}
            title="Participants List"
          >
            <Users className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper VideoFeed component to bind source objects cleanly
interface VideoFeedProps {
  stream: MediaStream;
  displayName: string;
  isMuted: boolean;
  isCameraOff: boolean;
}

function VideoFeed({ stream, displayName, isCameraOff }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
      />
      {isCameraOff && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950/80 absolute inset-0 gap-2.5 select-none">
          <div className="h-12 w-12 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 text-sm font-bold text-zinc-350">
            {displayName.charAt(0)}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Camera Off</span>
        </div>
      )}
    </div>
  );
}
