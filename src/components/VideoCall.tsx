import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import DailyIframe from '@daily-co/daily-js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface VideoCallProps {
  clientId?: string;
  clientName?: string;
  user: User;
  onClose: () => void;
  callId?: string;
  isAdmin?: boolean;
  onCallCreated?: (callId: string) => void;
}

export function VideoCall({ clientName, onClose, callId: initialCallId, sessionId, isAdmin = false, onCallCreated }: VideoCallProps & { sessionId?: string }) {
  const roomName = initialCallId || sessionId || `session-${Math.random().toString(36).substring(7)}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const dailyDomain = import.meta.env.VITE_DAILY_DOMAIN;

  useEffect(() => {
    if (!initialCallId && roomName && onCallCreated && isAdmin) {
      onCallCreated(roomName);
    }
  }, [initialCallId, roomName, onCallCreated, isAdmin]);

  useEffect(() => {
    const fetchDailyAccess = async () => {
      try {
        const response = await fetch('/api/daily-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            userName: isAdmin ? 'Allie (Host)' : (clientName || 'Client'),
            isAdmin
          })
        });
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Non-JSON response received:', text.substring(0, 200));
          throw new Error('Server returned non-JSON response. Check server logs.');
        }

        const data = await response.json();
        if (data.roomUrl) {
          setRoomUrl(data.roomUrl);
          setToken(data.token);
        } else {
          console.error('Failed to get Daily room URL:', data.error, data.details || data.message);
          toast.error(data.error || 'Daily.co configuration missing.');
        }
      } catch (error) {
        console.error('Error fetching Daily access:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to connect to video session.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyAccess();
  }, [roomName, clientName, isAdmin]);

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return;

    // Create call frame
    const callFrame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
      },
      showLeaveButton: false, // We use our own leave button
      showFullscreenButton: true,
    });

    callFrameRef.current = callFrame;

    // Add event listeners
    callFrame
      .on('left-meeting', () => onClose())
      .on('error', (e) => {
        console.error('Daily error:', e);
        toast.error('A video error occurred.');
      });

    // Join the meeting
    callFrame.join({
      url: roomUrl,
      token: token || undefined,
    });

    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [roomUrl, token, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950">
      <div className="absolute top-4 left-4 z-[110] flex items-center space-x-3">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onClose}
          className="bg-slate-900/80 border-slate-700 text-white hover:bg-slate-800 backdrop-blur-md shadow-xl"
        >
          <X className="h-4 w-4 mr-2" />
          End Session
        </Button>
        <Badge className={`${token ? 'bg-indigo-600/90' : 'bg-slate-700/90'} text-white border-none backdrop-blur-md px-3 py-1`}>
          {isAdmin ? (
            <span className="flex items-center">
              <ShieldCheck className="h-3 w-3 mr-1.5" />
              Secure Host Portal
            </span>
          ) : (
            'Live Video Session'
          )}
        </Badge>
        {!token && isAdmin && dailyDomain && (
          <Badge variant="outline" className="bg-amber-900/40 text-amber-200 border-amber-800 text-[10px]">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Moderator Access Restricted
          </Badge>
        )}
      </div>
      
      {isLoading ? (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-4 bg-slate-950">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-indigo-500/20 rounded-full"></div>
            <div className="absolute top-0 left-0 h-16 w-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg tracking-tight">Initializing Daily.co</p>
            <p className="text-slate-400 text-sm">Preparing your secure video environment...</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}
    </div>
  );
}
