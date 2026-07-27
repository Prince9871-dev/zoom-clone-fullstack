'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export function useMedia() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Retrieve list of connected cameras
  const fetchCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      if (cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(cameras[0].deviceId);
      }
    } catch (err) {
      console.warn('[Media] Could not enumerate devices:', err);
    }
  }, [selectedCamera]);

  // Request camera and microphone tracks
  const startLocalStream = useCallback(async (cameraDeviceId?: string) => {
    // Stop any existing tracks before initializing
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    const videoConstraints: MediaTrackConstraints | boolean = cameraDeviceId 
      ? { deviceId: { exact: cameraDeviceId } }
      : true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(true);
      setIsMicOn(true);
      
      // Update device list once permissions are granted
      await fetchCameras();
      
      return stream;
    } catch (err: any) {
      console.warn('[Media] Camera/Mic access denied or unavailable, trying audio-only...', err);
      toast.warning('Camera permission denied or camera unavailable. Trying audio-only.');
      
      try {
        // Fallback to audio-only if camera fails
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        setIsCameraOn(false);
        setIsMicOn(true);
        return audioStream;
      } catch (audioErr: any) {
        console.error('[Media] Audio permission also denied:', audioErr);
        toast.error('Microphone access denied. You will join the room as a silent viewer.');
        
        // Return empty stream placeholder
        const emptyStream = new MediaStream();
        localStreamRef.current = emptyStream;
        setLocalStream(emptyStream);
        setIsCameraOn(false);
        setIsMicOn(false);
        return emptyStream;
      }
    }
  }, [fetchCameras]);

  // Toggle video tracks on/off
  const toggleCamera = useCallback((onStateChange?: (enabled: boolean) => void) => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length === 0 && !isCameraOn) {
        // Re-request camera if it was completely closed
        startLocalStream(selectedCamera).then(() => {
          if (onStateChange) onStateChange(true);
        });
        return;
      }
      
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      
      const newCameraState = videoTracks.length > 0 ? videoTracks[0].enabled : false;
      setIsCameraOn(newCameraState);
      if (onStateChange) onStateChange(newCameraState);
    }
  }, [selectedCamera, startLocalStream, isCameraOn]);

  // Toggle audio tracks on/off
  const toggleMic = useCallback((onStateChange?: (enabled: boolean) => void) => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      
      const newMicState = audioTracks.length > 0 ? audioTracks[0].enabled : false;
      setIsMicOn(newMicState);
      if (onStateChange) onStateChange(newMicState);
    }
  }, []);

  // Request display media for screen sharing
  const startScreenShare = useCallback(async (onStarted?: () => void, onEndedCallback?: () => void) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsSharingScreen(true);
      
      if (onStarted) onStarted();

      // Listen for the browser's native "Stop Sharing" floating button click
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
          if (onEndedCallback) onEndedCallback();
        };
      }

      return stream;
    } catch (err: any) {
      console.warn('[Media] Screen share permission denied or aborted:', err);
      toast.warning('Screen sharing aborted or permission denied.');
      return null;
    }
  }, []);

  // Terminate screen share stream
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsSharingScreen(false);
      console.log('[Media] Screen sharing stopped.');
    }
  }, []);

  // Change camera device mid-call
  const changeCamera = useCallback(async (deviceId: string) => {
    setSelectedCamera(deviceId);
    if (isCameraOn) {
      const stream = await startLocalStream(deviceId);
      return stream;
    }
    return null;
  }, [isCameraOn, startLocalStream]);

  // Clean up all tracks on exit
  const cleanUpMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }
    setIsCameraOn(false);
    setIsMicOn(false);
    setIsSharingScreen(false);
    console.log('[Media] Resources cleaned up.');
  }, []);

  useEffect(() => {
    return () => {
      // Do not clean up globally automatically to prevent drops on layout shifts, 
      // but expose it for manual page cleanups.
    };
  }, []);

  return {
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
  };
}
