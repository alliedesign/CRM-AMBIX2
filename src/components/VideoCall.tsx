import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, doc, addDoc, onSnapshot, updateDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, StopCircle, PlayCircle, X, Copy, Check, PhoneOff, PhoneCall 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoCallProps {
  clientId?: string;
  clientName?: string;
  user: User;
  onClose: () => void;
  callId?: string; // If provided, we are joining a call
}

export function VideoCall({ clientId, clientName, user, onClose, callId: initialCallId }: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [callId, setCallId] = useState<string | null>(initialCallId || null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (initialCallId) {
          joinCall(initialCallId);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    init();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      peerConnection.current?.close();
    };
  }, []);

  const createCall = async () => {
    if (!localStream) return;
    setStatus('calling');

    const pc = new RTCPeerConnection(servers);
    peerConnection.current = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setStatus('connected');
    };

    const callDoc = doc(collection(db, 'calls'));
    const offerCandidates = collection(callDoc, 'callerCandidates');
    const answerCandidates = collection(callDoc, 'calleeCandidates');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(offerCandidates, event.candidate.toJSON());
      }
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDoc, { 
      offer, 
      clientId: clientId || null,
      status: 'pending',
      createdAt: serverTimestamp(),
      createdBy: user.uid 
    });

    setCallId(callDoc.id);

    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  };

  const joinCall = async (id: string) => {
    if (!localStream) return;
    setStatus('calling');

    const pc = new RTCPeerConnection(servers);
    peerConnection.current = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setStatus('connected');
    };

    const callDoc = doc(db, 'calls', id);
    const answerCandidates = collection(callDoc, 'calleeCandidates');
    const offerCandidates = collection(callDoc, 'callerCandidates');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    };

    const callData = (await getDoc(callDoc)).data();
    if (!callData) return;

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDoc, { answer, status: 'active' });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const shareScreen = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const videoTrack = screenStream.getVideoTracks()[0];

        if (peerConnection.current) {
          const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        videoTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  };

  const stopScreenShare = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (peerConnection.current) {
        const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
    }
  };

  const startRecording = () => {
    if (!remoteStream && !localStream) return;

    // Combine tracks for recording
    const tracks = [
      ...(localStream?.getTracks() || []),
      ...(remoteStream?.getTracks() || [])
    ];
    const combinedStream = new MediaStream(tracks);

    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    mediaRecorder.current = new MediaRecorder(combinedStream, options);

    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };

    mediaRecorder.current.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `call-recording-${new Date().toISOString()}.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      recordedChunks.current = [];
    };

    mediaRecorder.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const endCall = async () => {
    if (callId) {
      await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
    }
    peerConnection.current?.close();
    localStream?.getTracks().forEach(track => track.stop());
    setStatus('ended');
    onClose();
  };

  const copyLink = () => {
    const url = `${window.location.origin}?callId=${callId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
      <Card className="w-full max-w-5xl bg-slate-950 border-slate-800 shadow-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-900/50 py-4">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Video className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white">
                {status === 'connected' ? `Live with ${clientName || 'Client'}` : 'Video Session'}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-slate-700 text-slate-400">
                  {status}
                </Badge>
                {isRecording && (
                  <Badge className="bg-red-500/20 text-red-500 border-red-500/30 animate-pulse text-[10px] uppercase tracking-wider">
                    Recording
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Area */}
            <div className="lg:col-span-3 space-y-4">
              <div className="relative aspect-video bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                {/* Remote Video */}
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {!remoteStream && status === 'calling' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                    <div className="h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Waiting for client to join...</p>
                  </div>
                )}
                {!remoteStream && status === 'idle' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                    <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center">
                      <VideoOff className="h-8 w-8 text-slate-600" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Start a call to begin session</p>
                  </div>
                )}

                {/* Local Video (Picture-in-Picture) */}
                <div className="absolute bottom-4 right-4 w-48 aspect-video bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-xl">
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                  {isVideoOff && (
                    <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                      <VideoOff className="h-6 w-6 text-slate-600" />
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center space-x-4 py-4">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={toggleMute}
                  className={`h-12 w-12 rounded-full border-slate-700 ${isMuted ? 'bg-red-500/10 text-red-500 border-red-500/50' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={toggleVideo}
                  className={`h-12 w-12 rounded-full border-slate-700 ${isVideoOff ? 'bg-red-500/10 text-red-500 border-red-500/50' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                >
                  {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={shareScreen}
                  className={`h-12 w-12 rounded-full border-slate-700 ${isScreenSharing ? 'bg-blue-500/10 text-blue-500 border-blue-500/50' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                >
                  <Monitor className="h-5 w-5" />
                </Button>
                
                {status === 'idle' ? (
                  <Button 
                    onClick={createCall}
                    className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20"
                  >
                    <PhoneCall className="mr-2 h-5 w-5" /> Start Call
                  </Button>
                ) : (
                  <Button 
                    onClick={endCall}
                    className="h-12 px-8 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-500/20"
                  >
                    <PhoneOff className="mr-2 h-5 w-5" /> End Call
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={status !== 'connected'}
                  className={`h-12 w-12 rounded-full border-slate-700 ${isRecording ? 'bg-red-500/10 text-red-500 border-red-500/50 animate-pulse' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                >
                  {isRecording ? <StopCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            {/* Sidebar / Info */}
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Session Details</h4>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Client</p>
                    <p className="text-sm font-medium text-white">{clientName || 'Direct Session'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Host</p>
                    <p className="text-sm font-medium text-white">{user.displayName}</p>
                  </div>
                </div>
              </div>

              {callId && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Share Access</h4>
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                    <p className="text-[10px] text-blue-400 font-medium">Send this link to the client to join the session.</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-slate-950 border border-slate-800 rounded-md p-2 text-[10px] text-slate-400 truncate">
                        {`${window.location.origin}?callId=${callId}`}
                      </div>
                      <Button size="icon" variant="ghost" onClick={copyLink} className="h-8 w-8 text-slate-400 hover:text-white">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Recording Info</h4>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Recording captures both audio and video streams. The file will be downloaded automatically when you stop recording.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
