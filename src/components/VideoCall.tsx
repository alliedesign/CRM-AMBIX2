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
  
  // Support for Jitsi as a Service (JaaS)
  const appId = (import.meta as any).env.VITE_JITSI_APP_ID;
  const domain = appId ? '8x8.vc' : 'meet.jit.si';
  
  useEffect(() => {
    if (!initialCallId && roomName && onCallCreated && isAdmin) {
      onCallCreated(roomName);
    }
  }, [initialCallId, roomName, onCallCreated, isAdmin]);

  useEffect(() => {
    const displayName = isAdmin ? 'Allie (Host)' : (clientName || 'Client');
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
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
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: false,
            enableLobbyChat: true,
          },
          interfaceConfigOverwrite: {
            TILE_VIEW_MAX_COLUMNS: 2,
          },
          userInfo: {
            displayName: displayName
          }
        };

        jitsiApiRef.current = new (window as any).JitsiMeetExternalAPI(domain, options);

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
      document.body.removeChild(script);
    };
  }, [domain, roomName, appId, isAdmin, clientName, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-0 sm:p-4">
      <Card className="w-full h-full sm:h-[90vh] max-w-6xl bg-slate-950 border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-900/50 py-3 px-4">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Video className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white">
                Live with {clientName || 'Client'}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-slate-700 text-slate-400">
                  {isAdmin ? 'HOST' : 'CLIENT'} PORTAL {appId ? '(PRIVATE JAAS)' : '(SECURE PUBLIC)'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5 mr-1" /> Close
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 relative bg-black">
          <div ref={jitsiContainerRef} className="w-full h-full" />
        </CardContent>
      </Card>
    </div>
  );
}
