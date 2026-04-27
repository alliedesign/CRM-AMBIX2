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

export function VideoCall({ clientName, onClose, callId: initialCallId, isAdmin = false }: VideoCallProps) {
  const roomName = initialCallId || `ambix-allie-session-${Math.random().toString(36).substring(7)}`;
  const jitsiUrl = `https://meet.jit.si/${roomName}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","closedcaptions","desktop","fullscreen","fittowindow","hangup","profile","chat","recording","livestreaming","etherpad","sharedvideo","settings","raisehand","videoquality","filmstrip","invite","feedback","stats","shortcuts","tileview","videobackground","help","mute-everyone","videopreview","download","localrecording","selfview"]`;

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
                  {isAdmin ? 'HOST' : 'CLIENT'} PORTAL
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
          <iframe 
            src={jitsiUrl}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            className="w-full h-full border-none"
            title="Live Session"
          />
        </CardContent>
      </Card>
    </div>
  );
}
