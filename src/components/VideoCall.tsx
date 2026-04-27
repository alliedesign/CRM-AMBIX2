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

export function VideoCall({ clientName, onClose, callId: initialCallId, sessionId, isAdmin = false, onCallCreated }: VideoCallProps & { sessionId?: string }) {
  const roomName = initialCallId || sessionId || `ambix-allie-session-${Math.random().toString(36).substring(7)}`;
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Support for Jitsi as a Service (JaaS)
  const appId = (import.meta as any).env.VITE_JITSI_APP_ID;
  const domain = appId ? '8x8.vc' : 'meet.jit.si';
  
  useEffect(() => {
    if (!initialCallId && roomName && onCallCreated && isAdmin) {
      onCallCreated(roomName);
    }
  }, [initialCallId, roomName, onCallCreated, isAdmin]);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch('/api/jitsi-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            userName: isAdmin ? 'Allie (Host)' : (clientName || 'Client'),
            isAdmin
          })
        });
        const data = await response.json();
        if (data.token) {
          setToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Jitsi token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [roomName, clientName, isAdmin]);

  useEffect(() => {
    if (isLoading) return;

    const displayName = isAdmin ? 'Allie (Host)' : (clientName || 'Client');
    const script = document.createElement('script');
    
    // For JaaS, the script is located at https://8x8.vc/<appId>/external_api.js
    script.src = appId ? `https://8x8.vc/${appId}/external_api.js` : `https://meet.jit.si/external_api.js`;
    script.async = true;
    
    script.onload = () => {
      if (jitsiContainerRef.current) {
        // Clear previous instance if any
        if (jitsiApiRef.current) {
          jitsiApiRef.current.dispose();
        }

        const options = {
          roomName: appId ? `${appId}/${roomName}` : roomName,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainerRef.current,
          jwt: token,
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: false,
            enableLobbyChat: true,
            toolbarButtons: [
               'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
               'fittowindow', 'hangup', 'profile', 'chat', 'recording',
               'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
               'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
               'tileview', 'videobackground', 'help', 'mute-everyone', 'videopreview',
               'download', 'localrecording', 'selfview'
            ],
          },
          interfaceConfigOverwrite: {
            TILE_VIEW_MAX_COLUMNS: 4,
          },
          userInfo: {
            displayName: displayName
          }
        };

        const jitsiDomain = appId ? '8x8.vc' : 'meet.jit.si';
        jitsiApiRef.current = new (window as any).JitsiMeetExternalAPI(jitsiDomain, options);

        // Add event listeners
        jitsiApiRef.current.addEventListeners({
          readyToClose: () => onClose(),
          videoConferenceTerminated: () => onClose()
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [domain, roomName, appId, isAdmin, clientName, onClose, token, isLoading]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div className="absolute top-4 left-4 z-[110] flex items-center space-x-3">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onClose}
          className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-800 backdrop-blur-md"
        >
          <X className="h-4 w-4 mr-2" />
          Leave Session
        </Button>
        <Badge className="bg-blue-600/80 text-white border-none backdrop-blur-md">
          {isAdmin ? 'Host Portal' : 'Live Session'}
        </Badge>
      </div>
      
      {isLoading ? (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-4 bg-slate-900">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium tracking-wide">Connecting to secure session...</p>
        </div>
      ) : (
        <div ref={jitsiContainerRef} className="w-full h-full" />
      )}
    </div>
  );
}
