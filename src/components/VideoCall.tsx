import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, doc, addDoc, onSnapshot, updateDoc, serverTimestamp, setDoc, getDoc, query, orderBy } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, StopCircle, PlayCircle, X, Copy, Check, PhoneOff, PhoneCall, Send, Link as LinkIcon, MessageSquare, ExternalLink, Plus, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface VideoCallProps {
  clientId?: string;
  clientName?: string;
  user: User;
  onClose: () => void;
  callId?: string; // If provided, we are joining a call
  isAdmin?: boolean;
  onCallCreated?: (callId: string) => void;
}

export function VideoCall({ clientId, clientName, user, onClose, callId: initialCallId, isAdmin = false, onCallCreated }: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [callId, setCallId] = useState<string | null>(initialCallId || null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [sessionLinks, setSessionLinks] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const servers = {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.error('Error playing remote video:', e));
    }
  }, [remoteStream]);

  // 1. Initial Media Acquisition
  useEffect(() => {
    let unmounted = false;
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }, 
          audio: true 
        });
        if (unmounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        setLocalStream(stream);
        
        if (initialCallId) {
          joinCall(initialCallId, stream);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    init();

    return () => {
      unmounted = true;
    };
  }, []);

  // 2. Cleanup on Final Unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [localStream]);

  // 3. Content Listeners (Messages & Links)
  useEffect(() => {
    if (!callId) return;

    const messagesRef = collection(db, 'calls', callId, 'messages');
    const linksRef = collection(db, 'calls', callId, 'links');

    const unsubMessages = onSnapshot(query(messagesRef, orderBy('createdAt', 'asc')), (snapshot) => {
      setSessionMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLinks = onSnapshot(query(linksRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setSessionLinks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubMessages();
      unsubLinks();
    };
  }, [callId]);

  const createCall = async () => {
    if (!localStream) return;
    setStatus('calling');

    const pc = new RTCPeerConnection(servers);
    peerConnection.current = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    
    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
         // Optionally handle disconnect
      }
    };

    pc.ontrack = (event) => {
      console.log('Caller got remote track:', event.track.kind, event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setStatus('connected');
      } else {
        // Fallback for some browsers
        const inboundStream = new MediaStream();
        inboundStream.addTrack(event.track);
        setRemoteStream(inboundStream);
        setStatus('connected');
      }
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
    if (onCallCreated) onCallCreated(callDoc.id);

    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
        console.log('Admin: Set remote description from answer');
        toast.success(`${clientName || 'Client'} has joined the session!`);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (pc.currentRemoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error('Error adding answer candidate:', e));
          } else {
            // Queue candidate for later
            const interval = setInterval(() => {
              if (pc.currentRemoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error('Error adding answer candidate after delay:', e));
                clearInterval(interval);
              }
            }, 500);
          }
        }
      });
    });
  };

  const joinCall = async (id: string, streamOverride?: MediaStream) => {
    const stream = streamOverride || localStream;
    if (!stream) return;
    setStatus('calling');

    const pc = new RTCPeerConnection(servers);
    peerConnection.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.oniceconnectionstatechange = () => {
      console.log('Joiner ICE state:', pc.iceConnectionState);
    };

    pc.ontrack = (event) => {
      console.log('Joiner got remote track:', event.track.kind, event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setStatus('connected');
      } else {
        const inboundStream = new MediaStream();
        inboundStream.addTrack(event.track);
        setRemoteStream(inboundStream);
        setStatus('connected');
      }
    };

    const callDoc = doc(db, 'calls', id);
    const answerCandidates = collection(callDoc, 'calleeCandidates');
    const offerCandidates = collection(callDoc, 'callerCandidates');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    };

    const docSnapshot = await getDoc(callDoc);
    const callData = docSnapshot.data();
    if (!callData) {
      console.error('No call data found for join');
      return;
    }

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
          if (pc.currentRemoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error('Error adding offer candidate:', e));
          } else {
            const interval = setInterval(() => {
              if (pc.currentRemoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error('Error adding offer candidate after delay:', e));
                clearInterval(interval);
              }
            }, 500);
          }
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !callId) return;

    await addDoc(collection(db, 'calls', callId, 'messages'), {
      text: newMessage,
      senderId: user.uid,
      senderName: user.displayName || user.email,
      createdAt: serverTimestamp()
    });
    setNewMessage('');
  };

  const shareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkUrl.trim() || !callId) return;

    await addDoc(collection(db, 'calls', callId, 'links'), {
      url: newLinkUrl,
      title: newLinkTitle || newLinkUrl,
      senderId: user.uid,
      senderName: user.displayName || user.email,
      createdAt: serverTimestamp()
    });
    setNewLinkUrl('');
    setNewLinkTitle('');
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
                  className={`w-full h-full object-cover transition-opacity duration-500 ${remoteStream ? 'opacity-100' : 'opacity-0'}`}
                />
                
                {!remoteStream && status === 'calling' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-900">
                    <div className="h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                    <div className="text-center">
                      <p className="text-white text-lg font-bold">Connecting Live Session...</p>
                      <p className="text-slate-400 text-sm">{isAdmin ? 'Waiting for client to connect' : 'Establishing connection with host'}</p>
                    </div>
                  </div>
                )}
                
                {!remoteStream && status === 'idle' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                    <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center">
                      <VideoOff className="h-8 w-8 text-slate-600" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      {isAdmin ? 'Start a call to begin session' : 'Waiting for host to start the call...'}
                    </p>
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
                  isAdmin ? (
                    <Button 
                      onClick={createCall}
                      className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20"
                    >
                      <PhoneCall className="mr-2 h-5 w-5" /> Start Call
                    </Button>
                  ) : (
                    <div className="h-12 flex items-center px-6 rounded-full bg-slate-800 text-slate-400 text-sm font-medium border border-slate-700">
                      <Clock className="mr-2 h-4 w-4 animate-pulse" /> Waiting for Host...
                    </div>
                  )
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
            <div className="space-y-6 flex flex-col h-full max-h-[600px]">
              <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
                <TabsList className="bg-slate-900 border border-slate-800 p-1">
                  <TabsTrigger value="chat" className="data-[state=active]:bg-slate-800">Chat</TabsTrigger>
                  <TabsTrigger value="links" className="data-[state=active]:bg-slate-800">Links</TabsTrigger>
                  <TabsTrigger value="info" className="data-[state=active]:bg-slate-800">Info</TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-4">
                  <ScrollArea className="flex-1 pr-4 mb-4">
                    <div className="space-y-3">
                      {sessionMessages.map((m) => (
                        <div key={m.id} className={`flex flex-col ${m.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                          <span className="text-[10px] text-slate-500 mb-1">{m.senderName}</span>
                          <div className={`px-3 py-2 rounded-2xl text-xs max-w-[80%] ${m.senderId === user.uid ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <form onSubmit={sendMessage} className="flex space-x-2">
                    <Input 
                      value={newMessage} 
                      onChange={(e) => setNewMessage(e.target.value)} 
                      placeholder="Type a message..." 
                      className="bg-slate-900 border-slate-800 text-white text-xs h-9"
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 bg-blue-600 hover:bg-blue-500 shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="links" className="flex-1 flex flex-col min-h-0 mt-4">
                  <ScrollArea className="flex-1 pr-4 mb-4">
                    <div className="space-y-3">
                      {sessionLinks.map((l) => (
                        <div key={l.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 group relative">
                          <p className="text-xs font-bold text-white truncate pr-6">{l.title}</p>
                          <a 
                            href={l.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] text-blue-400 hover:underline truncate block mt-1"
                          >
                            {l.url}
                          </a>
                          <span className="text-[8px] text-slate-500 mt-2 block italic">Shared by {l.senderName}</span>
                          <a 
                            href={l.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                      {sessionLinks.length === 0 && (
                        <div className="py-8 text-center text-slate-500">
                          <LinkIcon className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-xs">No links shared yet</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <form onSubmit={shareLink} className="space-y-2">
                    <Input 
                      value={newLinkTitle} 
                      onChange={(e) => setNewLinkTitle(e.target.value)} 
                      placeholder="Link title (optional)" 
                      className="bg-slate-900 border-slate-800 text-white text-xs h-8"
                    />
                    <div className="flex space-x-2">
                      <Input 
                        value={newLinkUrl} 
                        onChange={(e) => setNewLinkUrl(e.target.value)} 
                        placeholder="Paste URL here..." 
                        className="bg-slate-900 border-slate-800 text-white text-xs h-9"
                        required
                      />
                      <Button type="submit" size="icon" className="h-9 w-9 bg-blue-600 hover:bg-blue-500 shrink-0">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="info" className="flex-1 space-y-4 mt-4">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Session Details</h4>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Client</p>
                        <p className="text-sm font-medium text-white">{clientName || 'Direct Session'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Host</p>
                        <p className="text-sm font-medium text-white">{user.displayName || user.email}</p>
                      </div>
                    </div>
                  </div>

                  {callId && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Share Access</h4>
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
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recording Info</h4>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Recording captures both audio and video streams. The file will be downloaded automatically when you stop recording.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
