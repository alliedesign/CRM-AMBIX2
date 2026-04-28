/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where, limit, Timestamp, getDocs } from 'firebase/firestore';
import { auth, db, signIn, logOut, signUpWithEmail, signInWithEmail, resetPassword, OperationType, handleFirestoreError } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster, toast } from 'sonner';
import { VideoCall } from './components/VideoCall';

const ADMIN_EMAILS = ['allie.pakele@gmail.com', 'allie@vibesandvolumes.com'];

const LOGO_LIGHT = "https://www.dropbox.com/scl/fi/5odwkx48d4etw27599sze/ChatGPT-Image-Apr-28-2026-Logo-for-AMBIX-ALLIE-edited.png?rlkey=86btrqkbhlp1axky8xgfri4n0&st=9ym7iv3k&raw=1";
const LOGO_DARK = "https://www.dropbox.com/scl/fi/h20fwvj0rxbum9hsbglcv/ChatGPT-Image-Apr-28-2026-from-AMBIX-ALLIE-edited.png?rlkey=gyjvlo65c9gx8bsniyzmtcm9i&st=czf4t6ub&raw=1";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, LogOut, LayoutDashboard, Users, Briefcase, CheckSquare, Trash2, Search, Filter, Mail, Phone, Calendar, DollarSign, Video, FileText, CreditCard, MessageCircle, ExternalLink, Clock, Timer, Send, Bell, Moon, Sun, Menu, ChevronDown, Box, Star, ArrowRight, CheckCircle2, HelpCircle, Edit3, ShieldCheck, TrendingUp, XCircle, Play, Share2, Sparkles, Lock as LockIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'client' | 'project' | 'task' | 'lead' | 'campaign' | 'payment' | 'customer' | 'session' | 'message';
  tab: string;
  metadata?: any;
}

interface Client {
  id: string;
  name: string;
  contactPerson?: string;
  company: string;
  email: string;
  phone?: string;
  industry?: 'Creative' | 'Business' | 'Platforms';
  status: 'Active' | 'Lead' | 'Inactive';
  notes?: string;
  features?: {
    emailCampaigns: boolean;
    smsCampaigns: boolean;
    liveSessions: boolean;
    leads: boolean;
    marketingTools: boolean;
  };
  lastActive?: any;
  uid?: string; // Linked Firebase UID
  createdAt: any;
  createdBy: string;
}

interface ClientCustomer {
  id: string;
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  createdAt: any;
}

interface ClientPayment {
  id: string;
  clientId: string;
  customerId: string;
  projectId?: string;
  amount: number;
  currency: string;
  status: 'Paid' | 'Refunded' | 'Failed';
  description?: string;
  date: string;
  createdAt: any;
}

interface Lead {
  id: string;
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status: 'New' | 'Contacted' | 'Interested' | 'Converted' | 'Lost';
  type: 'Lead' | 'Appointment';
  cost?: number;
  isPaid?: boolean;
  pricePaid?: number;
  notes?: string;
  createdAt: any;
}

interface Campaign {
  id: string;
  clientId: string;
  title: string;
  type: 'Email' | 'SMS';
  content: string;
  status: 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Failed';
  scheduledAt?: any;
  recipientCount?: number;
  recipientsCount?: number;
  openRate?: number;
  clickRate?: number;
  createdAt: any;
}

interface Project {
  id: string;
  title: string;
  type: 'Mobile App' | 'Website' | 'Business' | 'Creative' | 'Platform';
  clientId: string;
  clientName: string;
  status: 'Planning' | 'In Progress' | 'Review' | 'Completed' | 'On Hold';
  paymentStatus?: 'Not Paid' | 'Deposit Received' | 'Partially Paid' | 'Fully Paid';
  startDate?: string;
  estimatedEndDate?: string;
  actualEndDate?: string;
  budget?: number;
  totalPaid?: number;
  liveUrl?: string;
  description?: string;
  createdAt: any;
  createdBy: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string | 'Global';
  clientId?: string;
  clientName?: string;
  priority?: 'Low' | 'Medium' | 'High';
  status: 'Todo' | 'In Progress' | 'Done' | 'Declined';
  dueDate?: string;
  assignedTo?: string;
  createdAt: any;
  createdBy: string;
}

interface Contract {
  id: string;
  title: string;
  clientId: string;
  status: 'Draft' | 'Sent' | 'Signed' | 'Expired';
  content?: string;
  fileUrl?: string;
  initials?: string;
  signature?: string;
  dateSigned?: string;
  signedAt?: any;
  createdAt: any;
}

interface ContractTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: any;
}

interface Payment {
  id: string;
  amount: number;
  clientId: string;
  projectId: string;
  projectTitle?: string;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';
  type?: 'Deposit' | 'Installment' | 'Final Payment' | 'Other';
  date: string;
  description?: string;
  notes?: string;
  createdAt: any;
}

interface Vital {
  id: string;
  title: string;
  value?: string;
  clientId: string;
  category?: 'Login' | 'API Key' | 'Environment Variable' | 'Link' | 'Other';
  instructions?: string;
  status: 'Pending' | 'Provided';
  isRequestedByAdmin?: boolean;
  createdAt: any;
  updatedAt?: any;
}

interface ScheduledSession {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  startTime: any;
  duration?: number;
  status: 'Requested' | 'Accepted' | 'Declined' | 'Active' | 'Completed' | 'Cancelled' | 'Proposed';
  createdAt: any;
  createdBy: string;
  callId?: string;
  meetingLink?: string;
  recordingUrl?: string;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'message' | 'session' | 'contract' | 'payment';
  link?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: any;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  clientId: string;
  timestamp: any;
  read?: boolean;
}

function CRMApp() {
  console.log('CRMApp rendering...');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'client' | null>(null);
  const [linkedClient, setLinkedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clientCustomers, setClientCustomers] = useState<ClientCustomer[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Update presence
  useEffect(() => {
    if (!user || role !== 'client' || !linkedClient) return;
    
    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'clients', linkedClient.id), {
          lastActive: serverTimestamp()
        });
      } catch (e) {
        console.error('Presence error:', e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [user?.uid, role, linkedClient?.id]);

  const sendNotification = async (userId: string, title: string, message: string, type: Notification['type'], link?: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        type,
        link: link || '',
        read: false,
        createdAt: serverTimestamp()
      });

      // NOTE: To send real email notifications, you would integrate a service like Resend or SendGrid here.
      // Example:
      // await fetch('/api/send-email', { 
      //   method: 'POST', 
      //   body: JSON.stringify({ to: userEmail, subject: title, text: message }) 
      // });
      console.log(`Notification sent to ${userId}: ${title}`);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [activeCall, setActiveCall] = useState<{ clientId?: string, clientName?: string, callId?: string, sessionId?: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    console.log('ACTIVE CALL CHANGED:', activeCall);
  }, [activeCall]);

  useEffect(() => {
    console.log('ACTIVE TAB CHANGED:', activeTab);
  }, [activeTab]);

  useEffect(() => {
    console.log('CRMApp MOUNTED');
    return () => console.log('CRMApp UNMOUNTED');
  }, []);

  const [serverConfig, setServerConfig] = useState<{ dailyDomain: string | null }>({ dailyDomain: null });

  useEffect(() => {
    // Check API Health
    const apiHealthUrl = `${window.location.origin}/api/health`;
    fetch(apiHealthUrl)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('API STATUS:', data);
        if (data.status === 'ok') {
          setServerConfig({ dailyDomain: data.env.daily_domain });
          
          if (!data.env.daily_api_key_configured || !data.env.daily_domain) {
            toast.warning('Daily.co API keys are missing. Video calls will not work until configured in Settings.', {
              duration: 10000,
              id: 'daily-warn'
            });
          } else {
            // Already connected
          }
        }
      })
      .catch(err => {
        console.error('API ERROR DETAIL:', {
          message: err.message,
          stack: err.stack,
          name: err.name,
          url: apiHealthUrl
        });
        toast.error(`Video Backend Connection Failed: ${err.message}`);
      });
  }, []);

  const handleCallCreated = async (callId: string) => {
    if (activeCall?.sessionId) {
      try {
        await updateDoc(doc(db, 'scheduledSessions', activeCall.sessionId), {
           callId,
           status: 'Active'
        });
        // Update local state to reflect the callId is now set
        setActiveCall(prev => prev ? { ...prev, callId } : null);
      } catch (error) {
        console.error('Error updating session with callId:', error);
      }
    } else if (activeCall?.clientId) {
      // Ad-hoc call: find the client's user ID and send a notification AND create a call doc
      const client = clients.find(c => c.id === activeCall.clientId);
      
      try {
        // Create a 'calls' document that the client's listener (lines 287-324) is watching
        await addDoc(collection(db, 'calls'), {
          clientId: activeCall.clientId,
          id: callId,
          status: 'pending',
          createdBy: user?.uid,
          createdAt: serverTimestamp(),
          clientName: client?.name || 'Client'
        });

        if (client && client.uid) {
          sendNotification(
            client.uid,
            'Incoming Live Session',
            `${user?.displayName || 'Allie'} is inviting you to a live session. Click to join!`,
            'session',
            `?callId=${callId}`
          );
        }
      } catch (error) {
        console.error('Error creating calls record:', error);
      }
    }
  };
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  // Event listener for setting active call from child views
  useEffect(() => {
    const handleSetActiveCall = (e: any) => {
      setActiveCall(e.detail);
    };
    window.addEventListener('set-active-call', handleSetActiveCall);
    return () => window.removeEventListener('set-active-call', handleSetActiveCall);
  }, []);

  // Check for callId in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const callId = urlParams.get('callId');
    if (callId) {
      setActiveCall({ callId });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (ADMIN_EMAILS.includes(currentUser.email || '')) {
          setRole('admin');
        } else {
          setRole('client');
        }
      } else {
        setRole(null);
        setLinkedClient(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Notification Toast Trigger
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      // Only show toast if it was created in the last 15 seconds (to avoid showing old notifications on login)
      const now = Math.floor(Date.now() / 1000);
      const isNew = latest.createdAt?.seconds ? (now - latest.createdAt.seconds < 15) : true;
      
      if (latest.id !== lastNotificationId && isNew) {
        toast(latest.title, {
          description: latest.message,
          action: {
            label: 'View',
            onClick: () => {
              setActiveTab('notifications');
            }
          }
        });
        setLastNotificationId(latest.id);
      }
    }
  }, [notifications, lastNotificationId]);

  // Incoming Call Listener
  useEffect(() => {
    if (!user?.uid || !role) return;

    // Only listen for calls from the last 2 minutes to avoid stale calls
    const twoMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 1000));
    
    const callsQuery = role === 'admin' 
      ? query(collection(db, 'calls'), where('status', '==', 'pending'), where('createdAt', '>=', twoMinutesAgo), orderBy('createdAt', 'desc'), limit(1))
      : (linkedClient ? query(collection(db, 'calls'), where('clientId', '==', linkedClient.id), where('status', '==', 'pending'), where('createdAt', '>=', twoMinutesAgo), orderBy('createdAt', 'desc'), limit(1)) : null);

    if (!callsQuery) return;

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as any;
        const callData = { id: snapshot.docs[0].id, ...data };
        
        // Don't show if we created it
        if (callData.createdBy !== user.uid) {
          // Check if this specific call has been dismissed in this session
          const dismissedCalls = JSON.parse(sessionStorage.getItem('dismissed_calls') || '[]');
          if (dismissedCalls.includes(callData.id)) {
            setIncomingCall(null);
            return;
          }

          setIncomingCall(callData);
          
          // Use a ref to ensure we only toast once per call ID
          const toastId = `call-${callData.id}`;
          toast.info('Incoming Live Session', {
            id: toastId,
            description: `${callData.clientName || 'Allie'} is inviting you to a live session.`,
            duration: 15000,
            action: {
              label: 'Join',
              onClick: () => {
                setActiveCall({ callId: callData.id });
                setIncomingCall(null);
              }
            }
          });
        }
      } else {
        setIncomingCall(null);
      }
    }, (error) => {
      const err = error as any;
      // SILENTLY handle quota/rate errors for calls listener specifically to avoid constant error UI
      if (err.code === 'resource-exhausted' || err.message?.includes('Rate exceeded')) {
        console.warn('Call listener rate limited');
        return;
      }
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return () => unsubscribe();
  }, [user?.uid, role, linkedClient?.id]);

  // Data Listeners
  useEffect(() => {
    if (!user?.uid || !role) return;

    let unsubscribes: (() => void)[] = [];

    if (role === 'admin') {
      const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(clientsQuery, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Clients listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'clients');
      }));

      const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(projectsQuery, (snapshot) => {
        setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Projects listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }));

      const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(tasksQuery, (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Tasks listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      }));

      const paymentsQuery = query(collection(db, 'payments'), orderBy('date', 'desc'));
      unsubscribes.push(onSnapshot(paymentsQuery, (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Payments listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'payments');
      }));

      const sessionsQuery = query(collection(db, 'scheduledSessions'), orderBy('startTime', 'asc'));
      unsubscribes.push(onSnapshot(sessionsQuery, (snapshot) => {
        setScheduledSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledSession)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Sessions listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'scheduledSessions');
      }));

      const leadsQuery = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(leadsQuery, (snapshot) => {
        setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') return;
        handleFirestoreError(error, OperationType.LIST, 'leads');
      }));

      const campaignsQuery = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(campaignsQuery, (snapshot) => {
        setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') return;
        handleFirestoreError(error, OperationType.LIST, 'campaigns');
      }));

      const clientCustomersQuery = query(collection(db, 'clientCustomers'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(clientCustomersQuery, (snapshot) => {
        setClientCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') return;
        handleFirestoreError(error, OperationType.LIST, 'clientCustomers');
      }));

      const clientPaymentsQuery = query(collection(db, 'clientPayments'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(clientPaymentsQuery, (snapshot) => {
        setClientPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientPayment)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') return;
        handleFirestoreError(error, OperationType.LIST, 'clientPayments');
      }));

      const messagesQuery = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
      unsubscribes.push(onSnapshot(messagesQuery, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Messages listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'messages');
      }));

      const notificationsQuery = query(collection(db, 'notifications'), where('userId', 'in', [user.uid, 'ADMIN_GROUP']), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(notificationsQuery, (snapshot) => {
        // Deduplicate notifications by title and message if they are sent within 10 seconds of each other
        const rawNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        const deduplicated: Notification[] = [];
        const seen = new Set<string>();

        rawNotifications.forEach(n => {
          const key = `${n.title}-${n.message}-${Math.floor((n.createdAt?.seconds || 0) / 10)}`;
          if (!seen.has(key)) {
            deduplicated.push(n);
            seen.add(key);
          }
        });
        setNotifications(deduplicated);
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Notifications listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }));

      const templatesQuery = query(collection(db, 'contractTemplates'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(templatesQuery, (snapshot) => {
        setContractTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
      }, (error) => {
        if ((error as any).code === 'resource-exhausted') {
          console.warn('Templates listener rate limited');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'contractTemplates');
      }));
    } else {
      // Client role: find linked client by email
      const clientQuery = query(collection(db, 'clients'), where('email', '==', user.email));
      unsubscribes.push(onSnapshot(clientQuery, (snapshot) => {
        if (!snapshot.empty) {
          const found = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Client;
          setLinkedClient(found);
          // If client doesn't have a UID yet, link it
          if (!found.uid) {
            updateDoc(doc(db, 'clients', found.id), { uid: user.uid });
          }
        } else {
          setLinkedClient(null);
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients')));
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, role]);

  // Seed NDA Template
  const seedingRef = React.useRef(false);
  useEffect(() => {
    if (role === 'admin' && !seedingRef.current && contractTemplates.length === 0) {
      const seedNDA = async () => {
        seedingRef.current = true;
        try {
          const q = query(collection(db, 'contractTemplates'), where('title', '==', 'Mutual Non-Disclosure Agreement'), limit(1));
          const snap = await getDocs(q);
          if (snap.empty) {
              await addDoc(collection(db, 'contractTemplates'), {
                title: 'Mutual Non-Disclosure Agreement',
                content: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of [DATE], by and between AMBIX ALLIE ("Disclosing Party") and [CLIENT NAME] ("Receiving Party").

1. Purpose
The parties wish to explore a business opportunity of mutual interest and in connection with this opportunity, each party may disclose to the other certain confidential technical and business information.

2. Confidential Information
Confidential Information means any information disclosed by either party to the other party, either directly or indirectly, in writing, orally or by inspection of tangible objects.

3. Obligations
The Receiving Party shall:
(a) hold the Confidential Information in strict confidence;
(b) use the Confidential Information only for the Purpose;
(c) not disclose the Confidential Information to any third party without prior written consent.

4. Term
This Agreement shall remain in effect for a period of two (2) years from the date of disclosure.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first above written.

AMBIX ALLIE: ____________________
Client: ____________________`,
                createdAt: serverTimestamp()
              });
            }
          } catch (error) {
            console.error('Error seeding NDA template:', error);
            seedingRef.current = false; // Allow retry on error
          }
      };
      seedNDA();
    }
  }, [role, contractTemplates.length]);

  // Client Specific Listeners
  useEffect(() => {
    if (!user || role !== 'client' || !linkedClient) return;

    const projectsQuery = query(collection(db, 'projects'), where('clientId', '==', linkedClient.id));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const tasksQuery = query(collection(db, 'tasks'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    const leadsQuery = query(collection(db, 'leads'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'leads');
    });

    const campaignsQuery = query(collection(db, 'campaigns'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeCampaigns = onSnapshot(campaignsQuery, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'campaigns');
    });

    const customersQuery = query(collection(db, 'clientCustomers'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      setClientCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'clientCustomers');
    });

    const clientPaymentsQuery = query(collection(db, 'clientPayments'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeClientPayments = onSnapshot(clientPaymentsQuery, (snapshot) => {
      setClientPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientPayment)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'clientPayments');
    });

    const contractsQuery = query(collection(db, 'contracts'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeContracts = onSnapshot(contractsQuery, (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'contracts');
    });

    const paymentsQuery = query(collection(db, 'payments'), where('clientId', '==', linkedClient.id), orderBy('date', 'desc'));
    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });

    const vitalsQuery = query(collection(db, 'vitals'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeVitals = onSnapshot(vitalsQuery, (snapshot) => {
      setVitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vital)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'vitals');
    });

    const messagesQuery = query(collection(db, 'messages'), where('clientId', '==', linkedClient.id), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      // Deduplicate notifications by title and message if they are sent within 5 seconds of each other
      const rawNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      const deduplicated: Notification[] = [];
      const seen = new Set<string>();

      rawNotifications.forEach(n => {
        const key = `${n.title}-${n.message}-${Math.floor((n.createdAt?.seconds || 0) / 10)}`;
        if (!seen.has(key)) {
          deduplicated.push(n);
          seen.add(key);
        }
      });
      setNotifications(deduplicated);
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    const sessionsQuery = query(collection(db, 'scheduledSessions'), where('clientId', '==', linkedClient.id), orderBy('startTime', 'asc'));
    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      setScheduledSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledSession)));
    }, (error) => {
      if ((error as any).code === 'resource-exhausted') return;
      handleFirestoreError(error, OperationType.LIST, 'scheduledSessions');
    });

    return () => {
      unsubscribeProjects();
      unsubscribeTasks();
      unsubscribeContracts();
      unsubscribePayments();
      unsubscribeVitals();
      unsubscribeMessages();
      unsubscribeNotifications();
      unsubscribeSessions();
      unsubscribeLeads();
      unsubscribeCampaigns();
      unsubscribeCustomers();
      unsubscribeClientPayments();
    };
  }, [user?.uid, role, linkedClient?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-400"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (role === 'client') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <ClientPortal 
          user={user} 
          client={linkedClient} 
          projects={projects} 
          tasks={tasks}
          contracts={contracts} 
          payments={payments} 
          vitals={vitals}
          scheduledSessions={scheduledSessions}
          leads={leads}
          campaigns={campaigns}
          clientCustomers={clientCustomers}
          clientPayments={clientPayments}
          messages={messages}
          notifications={notifications}
          sendNotification={sendNotification}
          onStartCall={setActiveCall}
          incomingCall={incomingCall}
          onDismissCall={(id?: string) => {
            if (id) {
              const dismissed = JSON.parse(sessionStorage.getItem('dismissed_calls') || '[]');
              sessionStorage.setItem('dismissed_calls', JSON.stringify([...dismissed, id]));
              // Also update Firestore so it stops showing for others
              updateDoc(doc(db, 'calls', id), { status: 'dismissed' }).catch(console.error);
            }
            setIncomingCall(null);
          }}
          activeTab={activeTab === 'dashboard' ? 'overview' : activeTab} // Safely map dashboard to overview for client
          setActiveTab={setActiveTab}
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
        <GlobalSearchOverlay 
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          data={{ clients, projects, tasks, leads, campaigns, payments, clientCustomers, clientPayments, sessions: scheduledSessions, messages }}
          setActiveTab={setActiveTab}
          role={role}
        />
        {activeCall && (
          <VideoCall 
            clientId={activeCall.clientId} 
            clientName={activeCall.clientName} 
            callId={activeCall.callId}
            sessionId={activeCall.sessionId}
            user={user} 
            onClose={() => setActiveCall(null)} 
            isAdmin={false}
            onCallCreated={handleCallCreated}
            dailyDomainOverride={serverConfig.dailyDomain}
          />
        )}
      </div>
    );
  }

  const unreadMessagesCount = messages.filter(m => !m.read && m.senderId !== user.uid).length;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 transition-colors">
        <div className="flex flex-col items-center py-6 border-b border-slate-100 dark:border-slate-800">
          <motion.button 
            onClick={() => setActiveTab('dashboard')}
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
            animate={{ 
              y: [0, -8, 0],
              filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"]
            }}
            transition={{ 
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              filter: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="flex h-32 w-32 items-center justify-center group cursor-pointer mb-6"
          >
            <img 
              src={theme === 'dark' ? LOGO_DARK : LOGO_LIGHT} 
              alt="Ambix Allie Logo" 
              className="h-full w-full object-contain" 
              referrerPolicy="no-referrer" 
            />
          </motion.button>
          <div className="text-center px-4">
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Ambix Allie</span>
            <div className="flex h-6 items-center justify-center space-x-2 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Admin Mode</span>
            </div>
          </div>
          <div className="mt-4">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          </div>
        </div>
        <nav className="mt-6 space-y-1 px-3">
          <SidebarLink 
            icon={<LayoutDashboard className="h-5 w-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard' || activeTab === 'overview'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarLink 
            icon={<Bell className="h-5 w-5" />} 
            label="Notifications" 
            active={activeTab === 'notifications'} 
            onClick={() => setActiveTab('notifications')} 
            badge={notifications.filter(n => !n.read).length}
          />
          <SidebarLink 
            icon={<Users className="h-5 w-5" />} 
            label="Clients" 
            active={activeTab === 'clients'} 
            onClick={() => setActiveTab('clients')} 
          />
          <SidebarLink 
            icon={<Briefcase className="h-5 w-5" />} 
            label="Projects" 
            active={activeTab === 'projects'} 
            onClick={() => setActiveTab('projects')} 
          />
          <SidebarLink 
            icon={<CheckSquare className="h-5 w-5" />} 
            label="Tasks" 
            active={activeTab === 'tasks'} 
            onClick={() => setActiveTab('tasks')} 
          />
          <SidebarLink 
            icon={<TrendingUp className="h-5 w-5" />} 
            label="Leads" 
            active={activeTab === 'leads'} 
            onClick={() => setActiveTab('leads')} 
          />
          <SidebarLink 
            icon={<Mail className="h-5 w-5" />} 
            label="Campaigns" 
            active={activeTab === 'campaigns'} 
            onClick={() => setActiveTab('campaigns')} 
          />
          <SidebarLink 
            icon={<DollarSign className="h-5 w-5" />} 
            label="Payments" 
            active={activeTab === 'payments'} 
            onClick={() => setActiveTab('payments')} 
          />
          <SidebarLink 
            icon={<Video className="h-5 w-5" />} 
            label="Sessions" 
            active={activeTab === 'sessions'} 
            onClick={() => setActiveTab('sessions')} 
          />
          <SidebarLink 
            icon={<MessageCircle className="h-5 w-5" />} 
            label="Messages" 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')} 
            badge={unreadMessagesCount}
          />
          <SidebarLink 
            icon={<FileText className="h-5 w-5" />} 
            label="Templates" 
            active={activeTab === 'templates'} 
            onClick={() => setActiveTab('templates')} 
          />
          <SidebarLink 
            icon={<Send className="h-5 w-5" />} 
            label="Outreach" 
            active={activeTab === 'outreach'} 
            onClick={() => setActiveTab('outreach')} 
          />
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-100 dark:border-slate-800 p-4 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <NotificationBell 
              notifications={notifications} 
              setActiveTab={setActiveTab} 
              onStartCall={(data) => setActiveCall(data)} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-900 dark:text-white truncate w-24">{user.displayName || user.email?.split('@')[0]}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-24">{user.email}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logOut} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-8">
        {/* Global Search Trigger Header */}
        <div className="flex items-center justify-between mb-8">
          <div 
            onClick={() => setIsSearchOpen(true)}
            className="flex-1 max-w-md h-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 flex items-center cursor-pointer hover:border-blue-500 transition-all group shadow-sm"
          >
            <Search className="h-4 w-4 text-slate-400 group-hover:text-blue-500 mr-3" />
            <span className="text-sm text-slate-400 flex-1">Search portal...</span>
            <div className="flex space-x-1">
              <kbd className="h-5 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">⌘</kbd>
              <kbd className="h-5 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">K</kbd>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => setActiveTab('notifications')} className="rounded-xl border-slate-200 dark:border-slate-800">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Button>
          </div>
        </div>

        <GlobalSearchOverlay 
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          data={{ clients, projects, tasks, leads, campaigns, payments, clientCustomers, clientPayments, sessions: scheduledSessions, messages }}
          setActiveTab={setActiveTab}
          role={role}
        />

        <AnimatePresence mode="wait">
          {incomingCall && activeTab !== 'dashboard' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <Card className="border-blue-200 bg-blue-50 shadow-md">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center mr-4 animate-pulse">
                      <Video className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">Incoming Live Session!</p>
                      <p className="text-xs text-blue-700">Someone is waiting for you in a video room.</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => setActiveCall({ callId: incomingCall.id })}
                  >
                    Join Now
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'dashboard' && <DashboardView clients={clients} projects={projects} tasks={tasks} sessions={scheduledSessions} payments={payments} onStartCall={setActiveCall} incomingCall={incomingCall} setActiveTab={setActiveTab} />}
          {activeTab === 'notifications' && (
            <NotificationsView 
              notifications={notifications} 
              setActiveTab={setActiveTab} 
              onStartCall={(data) => setActiveCall(data)} 
            />
          )}
          {activeTab === 'clients' && <ClientsView clients={clients} user={user} onStartCall={setActiveCall} sendNotification={sendNotification} setActiveTab={setActiveTab} />}
          {activeTab === 'projects' && <ProjectsView projects={projects} clients={clients} user={user} onStartCall={setActiveCall} sendNotification={sendNotification} />}
          {activeTab === 'tasks' && <TasksView tasks={tasks} projects={projects} clients={clients} user={user} onStartCall={setActiveCall} sendNotification={sendNotification} />}
          {activeTab === 'leads' && <LeadsView leads={leads} clients={clients} user={user} />}
          {activeTab === 'campaigns' && <CampaignsView campaigns={campaigns} clients={clients} user={user} />}
          {activeTab === 'payments' && <PaymentsAnalyticsView payments={payments} clients={clients} projects={projects} />}
          {activeTab === 'sessions' && <SessionsView sessions={scheduledSessions} clients={clients} user={user} role={role} onStartCall={setActiveCall} sendNotification={sendNotification} />}
          {activeTab === 'messages' && <MessagesView messages={messages} clients={clients} user={user} />}
          {activeTab === 'templates' && <ContractTemplatesView templates={contractTemplates} clients={clients} user={user} sendNotification={sendNotification} />}
          {activeTab === 'outreach' && <AdminOutreachView clients={clients} user={user} sendNotification={sendNotification} />}
        </AnimatePresence>
      </main>

      {activeCall && (
        <VideoCall 
          clientId={activeCall.clientId} 
          clientName={activeCall.clientName} 
          callId={activeCall.callId}
          sessionId={activeCall.sessionId}
          user={user} 
          onClose={() => setActiveCall(null)} 
          isAdmin={role === 'admin'}
          onCallCreated={handleCallCreated}
          dailyDomainOverride={serverConfig.dailyDomain}
        />
      )}
    </div>
  );
}

function ContractTemplatesView({ templates, clients, user, sendNotification }: { templates: ContractTemplate[], clients: Client[], user: User, sendNotification: any }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState({ title: '', content: '' });
  const [sendForm, setSendForm] = useState({ clientId: '', content: '' });

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    try {
      if (editingTemplate) {
        await updateDoc(doc(db, 'contractTemplates', editingTemplate.id), {
          ...form
        });
      } else {
        await addDoc(collection(db, 'contractTemplates'), {
          ...form,
          createdAt: serverTimestamp()
        });
      }
      setIsAddOpen(false);
      setEditingTemplate(null);
      setForm({ title: '', content: '' });
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const handleSend = async () => {
    if (!sendForm.clientId || !sendForm.content || !sendingTemplate) return;
    const client = clients.find(c => c.id === sendForm.clientId);
    if (!client) return;

    try {
      await addDoc(collection(db, 'contracts'), {
        title: sendingTemplate.title,
        clientId: client.id,
        content: sendForm.content,
        status: 'Sent',
        createdAt: serverTimestamp()
      });

      if (client.uid) {
        await sendNotification(
          client.uid,
          'New Contract Sent',
          `A new contract "${sendingTemplate.title}" is ready for your signature.`,
          'contract'
        );
      }

      setSendingTemplate(null);
      setSendForm({ clientId: '', content: '' });
    } catch (error) {
      console.error('Error sending contract:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteDoc(doc(db, 'contractTemplates', id));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white transition-colors">Contract Templates</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm transition-colors">Manage reusable legal documents and send them to clients.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors">
          <Plus className="mr-2 h-4 w-4" /> Create Template
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <Card key={template.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col transition-colors">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white transition-colors">{template.title}</CardTitle>
              <CardDescription className="line-clamp-3 text-xs text-slate-500 dark:text-slate-400">
                {template.content}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <div className="p-6 pt-0 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors"
                onClick={() => {
                  setEditingTemplate(template);
                  setForm({ title: template.title, content: template.content });
                  setIsAddOpen(true);
                }}
              >
                Edit
              </Button>
              <Button 
                variant="outline"
                size="icon"
                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 dark:border-slate-800"
                onClick={() => handleDelete(template.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                onClick={() => {
                  setSendingTemplate(template);
                  setSendForm({ clientId: '', content: template.content });
                }}
              >
                Send
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingTemplate(null);
          setForm({ title: '', content: '' });
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Template Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Standard NDA" />
            </div>
            <div className="grid gap-2">
              <Label className="dark:text-slate-300 transition-colors">Contract Content</Label>
              <textarea 
                className="min-h-[300px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-white transition-colors"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="Enter contract text here..."
              />
            </div>
          </div>
          <DialogFooter className="dark:border-slate-800 transition-colors">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors">Cancel</Button>
            <Button onClick={handleSave} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors">Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={!!sendingTemplate} onOpenChange={(open) => !open && setSendingTemplate(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Send Contract: {sendingTemplate?.title}</DialogTitle>
            <DialogDescription>Review and edit the contract details before sending to the client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Select Client</Label>
              <Select value={sendForm.clientId} onValueChange={(v) => setSendForm({ ...sendForm, clientId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.company})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Contract Content (Final Edit)</Label>
              <textarea 
                className="min-h-[300px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                value={sendForm.content}
                onChange={e => setSendForm({ ...sendForm, content: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendingTemplate(null)}>Cancel</Button>
            <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-500 text-white">Send to Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContractSigningDialog({ contract, onSign }: { contract: Contract, onSign: (data: any) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [signingData, setSigningData] = useState({ initials: '', signature: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSign = async () => {
    if (!signingData.initials || !signingData.signature) return;
    setIsSubmitting(true);
    try {
      await onSign(signingData);
      setIsOpen(false);
    } catch (error) {
      console.error('Error signing:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">Sign Contract</Button>} />
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review & Sign: {contract.title}</DialogTitle>
          <DialogDescription>Please review the contract content below and provide your signature.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 border rounded-lg p-6 bg-slate-50 my-4">
          <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm">
            {contract.content}
          </div>
        </ScrollArea>
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div className="grid gap-2">
            <Label>Initials</Label>
            <Input 
              placeholder="e.g. JD" 
              value={signingData.initials} 
              onChange={e => setSigningData({ ...signingData, initials: e.target.value.toUpperCase() })} 
              maxLength={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Full Name (Signature)</Label>
            <Input 
              placeholder="e.g. John Doe" 
              value={signingData.signature} 
              onChange={e => setSigningData({ ...signingData, signature: e.target.value })} 
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSign} 
            disabled={isSubmitting || !signingData.initials || !signingData.signature}
            className="bg-slate-900 text-white"
          >
            {isSubmitting ? 'Signing...' : 'I Agree & Sign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setMessage('Password reset email sent! Check your inbox.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950 p-4 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900 border dark:border-slate-800">
            <Briefcase className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? 'Sign in to access your portal.' : mode === 'signup' ? 'Join Ambix Allie CRM.' : 'Enter your email to reset your password.'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-green-50 p-3 text-xs text-green-600 border border-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50">
            {message}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="dark:text-slate-300">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
            />
          </div>
          
          {mode !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="dark:text-slate-300">Password</Label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => setMode('forgot')}
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 py-4 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-800 transition-colors" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-500 dark:bg-slate-900 dark:text-slate-400">Or continue with</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={async () => {
            setError(null);
            try {
              await signIn();
            } catch (err: any) {
              console.error("Google Sign-In Error:", err);
              setError(err.message || "Failed to sign in with Google. Please ensure Google login is enabled in your Firebase console and that the domain is allowlisted.");
            }
          }} 
          className="w-full border-slate-200 py-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="mr-2 h-4 w-4" />
          Google
        </Button>

        <div className="text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button onClick={() => setMode('signup')} className="font-medium text-blue-600 hover:underline">
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="font-medium text-blue-600 hover:underline">
                Sign in
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ThemeToggle({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme}
      className="rounded-xl h-10 w-10 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

function GlobalSearchOverlay({ 
  isOpen, 
  onOpenChange, 
  data, 
  setActiveTab,
  role
}: { 
  isOpen: boolean, 
  onOpenChange: (open: boolean) => void,
  data: {
    clients: Client[],
    projects: Project[],
    tasks: Task[],
    leads: Lead[],
    campaigns: Campaign[],
    payments: Payment[],
    clientCustomers: ClientCustomer[],
    clientPayments: ClientPayment[],
    sessions: ScheduledSession[],
    messages: Message[]
  },
  setActiveTab: (tab: string) => void,
  role: string | null
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Search Clients (Admin only)
    if (role === 'admin') {
      data.clients.forEach(c => {
        if (c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
          matches.push({ id: c.id, title: c.name, subtitle: c.company, type: 'client', tab: 'clients' });
        }
      });
    }

    // Search Projects
    data.projects.forEach(p => {
      if (p.title.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q))) {
        matches.push({ id: p.id, title: p.title, subtitle: p.clientName, type: 'project', tab: 'projects' });
      }
    });

    // Search Tasks
    data.tasks.forEach(t => {
      if (t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q))) {
        matches.push({ id: t.id, title: t.title, subtitle: `Status: ${t.status}`, type: 'task', tab: 'tasks' });
      }
    });

    // Search Leads
    data.leads.forEach(l => {
      if (l.name.toLowerCase().includes(q) || (l.email?.toLowerCase().includes(q))) {
        matches.push({ id: l.id, title: l.name, subtitle: `Source: ${l.source || 'Unknown'}`, type: 'lead', tab: 'leads' });
      }
    });

    // Search Campaigns
    data.campaigns.forEach(c => {
      if (c.title.toLowerCase().includes(q) || (c.content.toLowerCase().includes(q))) {
        matches.push({ id: c.id, title: c.title, subtitle: campIcon(c.type), type: 'campaign', tab: 'campaigns' });
      }
    });

    // Search Customers (Client POV)
    data.clientCustomers.forEach(c => {
      if (c.name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q))) {
        matches.push({ id: c.id, title: c.name, subtitle: c.company, type: 'customer', tab: 'customers' });
      }
    });

    // Search Payments
    data.payments.forEach(p => {
      if (p.description?.toLowerCase().includes(q) || p.projectTitle?.toLowerCase().includes(q)) {
        matches.push({ id: p.id, title: `Payment #${p.id.slice(-6)}`, subtitle: `$${p.amount}`, type: 'payment', tab: 'payments' });
      }
    });

    setResults(matches.slice(0, 8));
  }, [query, data, role]);

  const campIcon = (type: string) => type === 'Email' ? '📧 Email' : '📱 SMS';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="h-5 w-5 text-slate-400 mr-3" />
          <input 
            autoFocus
            placeholder="Search projects, tasks, clients..." 
            className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white font-medium placeholder:text-slate-400"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex space-x-1">
            <kbd className="h-5 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">ESC</kbd>
          </div>
        </div>
        <ScrollArea className="max-h-[400px]">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((r, i) => (
                <button
                  key={`${r.id}-${i}`}
                  onClick={() => {
                    setActiveTab(r.tab);
                    onOpenChange(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group"
                >
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-4 group-hover:bg-blue-600 transition-colors">
                      {r.type === 'client' && <Users className="h-5 w-5 text-slate-400 group-hover:text-white" />}
                      {r.type === 'project' && <Briefcase className="h-5 w-5 text-slate-400 group-hover:text-white" />}
                      {r.type === 'task' && <CheckSquare className="h-5 w-5 text-slate-400 group-hover:text-white" />}
                      {r.type === 'lead' && <TrendingUp className="h-5 w-5 text-slate-400 group-hover:text-white" />}
                      {r.type === 'campaign' && <Mail className="h-5 w-5 text-slate-400 group-hover:text-white" />}
                      {r.type === 'customer' && <Users className="h-5 w-5 text-slate-400 group-hover:text-white" />}
                      {r.type === 'payment' && <DollarSign className="h-5 w-5 text-slate-400 group-hover:text-white" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{r.title}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-black opacity-60">{r.subtitle}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest opacity-40">
                    {r.type}
                  </Badge>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-12 text-center">
              <Search className="h-12 w-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-8 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4">Pro Tips</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">Slash Search</p>
                  <p className="text-[10px] text-slate-500">Search for specific status like "Todo" or "Planning"</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">Direct Go-To</p>
                  <p className="text-[10px] text-slate-500">Click a result to jump directly to that tab section</p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SidebarLink({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 outline-none ${
        active 
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 dark:bg-white dark:text-slate-900 dark:shadow-none' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      <div className="flex items-center space-x-3">
        <span className={`transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white dark:text-slate-900' : 'text-slate-400 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white'}`}>
          {icon}
        </span>
        <span className="tracking-tight">{label}</span>
      </div>
      {badge !== undefined && badge > 0 ? (
        <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ring-2 ring-white transition-colors dark:ring-slate-900 ${
          active 
            ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white' 
            : 'bg-blue-600 text-white'
        }`}>
          {badge > 9 ? '9+' : badge}
        </span>
      ) : active && (
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
      )}
    </button>
  );
}

function NotificationBell({ notifications, setActiveTab, onStartCall, onDismissCall }: { notifications: Notification[], setActiveTab?: (tab: string) => void, onStartCall?: (data: any) => void, onDismissCall?: (id: string) => void }) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    const batch = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
    await Promise.all(batch);
  };

  const deleteAll = async () => {
    const batch = notifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
    await Promise.all(batch);
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    if (!setActiveTab) return;
    
    if (n.type === 'session') {
      setActiveTab('sessions');
    } else if (n.type === 'message') {
      setActiveTab('messages');
    }

    if (n.actionUrl?.includes('callId=') && onStartCall) {
      const callId = new URLSearchParams(n.actionUrl.split('?')[1]).get('callId');
      if (callId) {
        onStartCall({ callId, clientName: 'Allie (Host)' });
      }
    }
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-slate-900" />}>
        <div className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader className="flex flex-row items-center justify-between items-start">
          <div>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>Stay updated with your latest activity.</DialogDescription>
          </div>
          <div className="flex flex-col items-end space-y-1">
            {notifications.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-6 px-2 text-[10px]">
                  Mark all read
                </Button>
                <Button variant="ghost" size="sm" onClick={deleteAll} className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600">
                  Clear all
                </Button>
              </>
            )}
          </div>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p>No notifications yet.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${n.read ? 'bg-white border-slate-100 dark:bg-slate-950 dark:border-slate-800' : 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-[10px] uppercase dark:text-slate-400 dark:border-slate-800">{n.type}</Badge>
                      {!n.read && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                  <h4 className="mt-1 font-bold text-sm text-slate-900 dark:text-white">{n.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function NotificationsView({ notifications, setActiveTab, onStartCall }: { notifications: Notification[], setActiveTab?: (tab: string) => void, onStartCall?: (data: any) => void }) {
  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    const batch = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
    await Promise.all(batch);
  };

  const deleteAll = async () => {
    const batch = notifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
    await Promise.all(batch);
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    if (!setActiveTab) return;
    
    if (n.type === 'session') {
      setActiveTab('sessions');
    } else if (n.type === 'message') {
      setActiveTab('messages');
    }

    if (n.actionUrl?.includes('callId=') && onStartCall) {
      const callId = new URLSearchParams(n.actionUrl.split('?')[1]).get('callId');
      if (callId) {
        onStartCall({ callId, clientName: 'Allie (Host)' });
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-slate-500 dark:text-slate-400">Stay updated with your latest activity.</p>
        </div>
        <div className="flex items-center space-x-3">
          {notifications.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300">
                Mark all read
              </Button>
              <Button variant="outline" size="sm" onClick={deleteAll} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30">
                Clear all
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="grid gap-4">
        {notifications.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 dark:border-slate-800 dark:bg-slate-900/50 transition-colors">
            <div className="mb-4 rounded-full bg-slate-50 dark:bg-slate-800 p-4">
              <Bell className="h-8 w-8 text-slate-300 dark:text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white transition-colors">No Notifications</h3>
            <p className="text-slate-500 dark:text-slate-400 transition-colors">When you have updates, they will appear here.</p>
          </Card>
        ) : (
          notifications.map(n => (
            <Card 
              key={n.id} 
              className={`transition-all cursor-pointer hover:shadow-md dark:border-slate-800 ${n.read ? 'bg-white dark:bg-slate-900 opacity-80' : 'bg-white dark:bg-slate-900 border-l-4 border-l-blue-500 dark:border-l-blue-600'}`}
              onClick={() => handleNotificationClick(n)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2">
                      <Badge variant={n.read ? 'outline' : 'default'} className="text-[10px] uppercase">
                        {n.type}
                      </Badge>
                      {!n.read && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 text-[10px]">NEW</Badge>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white transition-colors">{n.title}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">{n.message}</p>
                  </div>
                  <div className="flex flex-col items-end text-xs text-slate-400 shrink-0">
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
}

function DashboardView({ clients, projects, tasks, sessions, payments, onStartCall, incomingCall, setActiveTab }: { clients: Client[], projects: Project[], tasks: Task[], sessions: ScheduledSession[], payments: Payment[], onStartCall: (callData: any) => void, incomingCall?: any, setActiveTab: (tab: string) => void }) {
  const activeProjects = projects.filter(p => p.status !== 'Completed');
  const pendingTasks = tasks.filter(t => t.status !== 'Done');
  const sessionRequests = sessions.filter(s => s.status === 'Requested');
  
  const totalRevenue = payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
  const pendingRevenue = payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0);
  const totalPaidProjects = projects.filter(p => p.paymentStatus === 'Fully Paid').length;
  const pendingTransactions = payments.filter(p => p.status === 'Pending').length;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">Overview of Ambix Allie's current operations.</p>
      </header>

      {incomingCall && (
        <Card className="border-blue-200 bg-blue-50 shadow-md animate-pulse dark:bg-blue-950/20 dark:border-blue-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center">
              <Video className="mr-2 h-5 w-5 animate-bounce" /> Live Session Started!
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800 dark:text-blue-200">A client is waiting for you in a live video room.</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Join now to start the session.</p>
            </div>
            <Button 
              size="lg" 
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none"
              onClick={() => onStartCall({ callId: incomingCall.id })}
            >
              Join Session
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard title="Total Clients" value={clients.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={<DollarSign className="h-5 w-5 text-green-500" />} />
        <StatCard title="Pending Revenue" value={`$${pendingRevenue.toLocaleString()}`} icon={<Clock className="h-5 w-5 text-amber-500" />} />
        <StatCard title="Paid Projects" value={totalPaidProjects} icon={<CheckCircle2 className="h-5 w-5 text-blue-500" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard title="Active Projects" value={activeProjects.length} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Pending Tasks" value={pendingTasks.length} icon={<CheckSquare className="h-5 w-5" />} />
        <StatCard title="Session Requests" value={sessionRequests.length} icon={<Video className="h-5 w-5" />} />
        <StatCard title="Pending Trans." value={pendingTransactions} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      {sessionRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-100 flex items-center">
              <Clock className="mr-2 h-5 w-5" /> Pending Session Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessionRequests.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-100 dark:border-amber-900 shadow-sm transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{s.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.clientName} • {new Date(s.startTime).toLocaleString()}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      onClick={() => setActiveTab('sessions')}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white transition-colors">Recent Projects</CardTitle>
            <CardDescription className="dark:text-slate-400 transition-colors">Latest project updates across all types.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.slice(0, 5).map(project => (
                <div key={project.id} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white transition-colors">{project.title}</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">{project.clientName} • {project.type}</p>
                      {clients.find(c => c.id === project.clientId) && (
                        <div className="flex space-x-1.5">
                          <a 
                            href={`mailto:${clients.find(c => c.id === project.clientId)?.email}`}
                            className="text-slate-300 hover:text-blue-500 transition-colors dark:text-slate-600 dark:hover:text-blue-400"
                            title="Email"
                          >
                            <Mail className="h-2.5 w-2.5" />
                          </a>
                          {clients.find(c => c.id === project.clientId)?.phone && (
                            <a 
                              href={`tel:${clients.find(c => c.id === project.clientId)?.phone}`}
                              className="text-slate-300 hover:text-green-500 transition-colors dark:text-slate-600 dark:hover:text-green-400"
                              title="Call"
                            >
                              <Phone className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 transition-colors">
                    {project.status}
                  </Badge>
                </div>
              ))}
              {projects.length === 0 && <p className="text-center text-sm text-slate-400 py-4 transition-colors">No projects yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white transition-colors">Upcoming Tasks</CardTitle>
            <CardDescription className="dark:text-slate-400 transition-colors">Critical tasks requiring immediate attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.filter(t => t.status !== 'Done').slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <div className={`h-2 w-2 rounded-full ${task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white transition-colors">{task.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">Due: {task.dueDate || 'No date'}</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                    {task.status}
                  </Badge>
                </div>
              ))}
              {tasks.filter(t => t.status !== 'Done').length === 0 && <p className="text-center text-sm text-slate-400 py-4 transition-colors">All tasks completed!</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
      <CardContent className="flex items-center p-6">
        <div className="mr-4 rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-slate-900 dark:text-white transition-colors">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white transition-colors">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientsView({ clients, user, onStartCall, sendNotification, setActiveTab }: { clients: Client[], user: User, onStartCall: (callData: any) => void, sendNotification: any, setActiveTab?: (tab: string) => void }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [managingClient, setManagingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    contactPerson: '', 
    company: '', 
    email: '', 
    phone: '', 
    industry: 'Creative' as Client['industry'], 
    status: 'Lead' as Client['status'],
    notes: ''
  });

  const handleAdd = async () => {
    try {
      await addDoc(collection(db, 'clients'), {
        ...formData,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'clients');
    }
  };

  const handleUpdate = async () => {
    if (!editingClient) return;
    try {
      await updateDoc(doc(db, 'clients', editingClient.id), formData);
      setEditingClient(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'clients');
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      contactPerson: '', 
      company: '', 
      email: '', 
      phone: '', 
      industry: 'Creative', 
      status: 'Lead',
      notes: ''
    });
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      contactPerson: client.contactPerson || '',
      company: client.company,
      email: client.email,
      phone: client.phone || '',
      industry: client.industry || 'Creative',
      status: client.status,
      notes: client.notes || ''
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'clients');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors">Clients</h1>
          <p className="text-slate-500 dark:text-slate-400 transition-colors">Manage your business relationships and leads.</p>
        </div>
        <Dialog open={isAddOpen || !!editingClient} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingClient(null);
            resetForm();
          }
        }}>
          <DialogTrigger render={<Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all" />}>
            <Plus className="mr-2 h-4 w-4" /> Add Client
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
              <DialogDescription>Enter the details for the client profile.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh] pr-4">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Client Name</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input id="contactPerson" value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select value={formData.industry} onValueChange={(v: any) => setFormData({ ...formData, industry: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Creative">Creative</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Platforms">Platforms</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lead">Lead</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={editingClient ? handleUpdate : handleAdd} className="bg-slate-900 text-white hover:bg-slate-800">
                {editingClient ? 'Update Client' : 'Save Client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden dark:bg-slate-900 transition-colors">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950 transition-colors">
            <TableRow className="dark:border-slate-800 transition-colors">
              <TableHead className="font-semibold dark:text-slate-200 transition-colors">Client / Company</TableHead>
              <TableHead className="font-semibold dark:text-slate-200 transition-colors">Contact</TableHead>
              <TableHead className="font-semibold dark:text-slate-200 transition-colors">Industry</TableHead>
              <TableHead className="font-semibold dark:text-slate-200 transition-colors">Status</TableHead>
              <TableHead className="text-right font-semibold dark:text-slate-200 transition-colors">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(client => (
              <TableRow key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-slate-900 dark:text-white">{client.name}</span>
                      {client.lastActive && (Date.now() - (client.lastActive.seconds * 1000) < 120000) && (
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Online now" />
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{client.company}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{client.contactPerson || 'N/A'}</span>
                    <div className="flex flex-col space-y-1">
                      <a 
                        href={`mailto:${client.email}`} 
                        className="flex items-center text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
                        title={`Email ${client.name}`}
                      >
                        <Mail className="mr-1.5 h-3 w-3" /> {client.email}
                      </a>
                      {client.phone && (
                        <a 
                          href={`tel:${client.phone}`} 
                          className="flex items-center text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:underline transition-colors"
                          title={`Call ${client.name}`}
                        >
                          <Phone className="mr-1.5 h-3 w-3" /> {client.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 border-slate-200">
                    {client.industry || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={
                    client.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400' :
                    client.status === 'Lead' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400' :
                    'bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                  }>
                    {client.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onStartCall({ clientId: client.id, clientName: client.name })} 
                      className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Go Live Video"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                    {setActiveTab && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setActiveTab('outreach')} 
                        className="text-slate-400 hover:text-green-600 dark:hover:text-green-400"
                        title="Mass Outreach"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setManagingClient(client)} 
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      title="Manage Portal Data"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(client)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-400 font-medium">
                  No clients found. Start by adding your first client.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {managingClient && (
        <ManageClientDialog 
          client={managingClient} 
          onClose={() => setManagingClient(null)} 
          user={user}
          sendNotification={sendNotification}
        />
      )}
    </motion.div>
  );
}

function ManageClientDialog({ client, onClose, user, sendNotification }: { client: Client, onClose: () => void, user: User, sendNotification: any }) {
  const [activeTab, setActiveTab] = useState('contracts');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [clientRevenue, setClientRevenue] = useState<ClientPayment[]>([]);
  const [clientCusts, setClientCusts] = useState<ClientCustomer[]>([]);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isAddVitalOpen, setIsAddVitalOpen] = useState(false);
  const [vitalForm, setVitalForm] = useState({
    title: '',
    category: 'Login' as Vital['category'], 
    instructions: ''
  });
  const [featureForm, setFeatureForm] = useState<Client['features']>({
    emailCampaigns: client.features?.emailCampaigns ?? false,
    smsCampaigns: client.features?.smsCampaigns ?? false,
    liveSessions: client.features?.liveSessions ?? false,
    leads: client.features?.leads ?? false,
    marketingTools: client.features?.marketingTools ?? false
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    projectId: '',
    type: 'Installment' as Payment['type'],
    description: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const contractsQuery = query(collection(db, 'contracts'), where('clientId', '==', client.id), orderBy('createdAt', 'desc'));
    const unsubContracts = onSnapshot(contractsQuery, (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    });

    const paymentsQuery = query(collection(db, 'payments'), where('clientId', '==', client.id), orderBy('date', 'desc'));
    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const projectsQuery = query(collection(db, 'projects'), where('clientId', '==', client.id));
    const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
      setClientProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    });

    const vitalsQuery = query(collection(db, 'vitals'), where('clientId', '==', client.id), orderBy('createdAt', 'desc'));
    const unsubVitals = onSnapshot(vitalsQuery, (snapshot) => {
      setVitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vital)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'vitals'));

    const revQuery = query(collection(db, 'clientPayments'), where('clientId', '==', client.id), orderBy('date', 'desc'));
    const unsubRev = onSnapshot(revQuery, (snapshot) => {
      setClientRevenue(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientPayment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clientPayments'));

    const custQuery = query(collection(db, 'clientCustomers'), where('clientId', '==', client.id), orderBy('name', 'asc'));
    const unsubCusts = onSnapshot(custQuery, (snapshot) => {
      setClientCusts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clientCustomers'));

    return () => {
      unsubContracts();
      unsubPayments();
      unsubProjects();
      unsubVitals();
      unsubRev();
      unsubCusts();
    };
  }, [client.id]);

  const addContract = async () => {
    const title = prompt('Contract Title:');
    const fileUrl = prompt('Contract URL (optional):');
    if (!title) return;
    try {
      await addDoc(collection(db, 'contracts'), {
        title,
        clientId: client.id,
        status: 'Sent',
        fileUrl: fileUrl || '',
        createdAt: serverTimestamp()
      });

      if (client.uid) {
        await sendNotification(
          client.uid,
          'New Contract Available',
          `A new contract "${title}" has been sent to your portal.`,
          'contract'
        );
      }
    } catch (error) {
      console.error('Error adding contract:', error);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.projectId || !paymentForm.amount) return;
    
    const project = clientProjects.find(p => p.id === paymentForm.projectId);
    
    try {
      // 1. Add payment record
      await addDoc(collection(db, 'payments'), {
        ...paymentForm,
        clientId: client.id,
        projectTitle: project?.title || 'Unknown',
        status: 'Paid',
        createdAt: serverTimestamp()
      });

      // 2. Update project payment status and totalPaid
      if (project) {
        const newTotalPaid = (project.totalPaid || 0) + paymentForm.amount;
        const budget = project.budget || 0;
        
        let newPaymentStatus: Project['paymentStatus'] = 'Not Paid';
        if (newTotalPaid >= budget && budget > 0) {
          newPaymentStatus = 'Fully Paid';
        } else if (newTotalPaid > 0) {
          if (paymentForm.type === 'Deposit' && newTotalPaid < budget) {
            newPaymentStatus = 'Deposit Received';
          } else {
            newPaymentStatus = 'Partially Paid';
          }
        }

        await updateDoc(doc(db, 'projects', project.id), {
          totalPaid: newTotalPaid,
          paymentStatus: newPaymentStatus
        });
      }

      setIsAddPaymentOpen(false);
      setPaymentForm({
        amount: 0,
        projectId: '',
        type: 'Installment',
        description: '',
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  const handleAddVital = async () => {
    if (!vitalForm.title) return;
    
    try {
      await addDoc(collection(db, 'vitals'), {
        ...vitalForm,
        clientId: client.id,
        status: 'Pending',
        isRequestedByAdmin: true,
        createdAt: serverTimestamp()
      });

      if (client.uid) {
        await sendNotification(
          client.uid,
          'Information Requested',
          `Allie has requested some vital information: ${vitalForm.title}. Please provide it in your portal.`,
          'message'
        );
      }
      setIsAddVitalOpen(false);
      setVitalForm({ title: '', category: 'Login', instructions: '' });
      toast.success('Vital request sent to client.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vitals');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Manage Portal: {client.name}</DialogTitle>
          <DialogDescription>Add and manage information visible to the client in their portal.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="vitals">Vitals</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>
          
          <TabsContent value="features" className="space-y-4 py-4">
            <div className="flex flex-col space-y-4">
              <h3 className="text-sm font-medium">Toggle Client Features</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="feat-email" 
                    checked={featureForm.emailCampaigns} 
                    onChange={e => setFeatureForm({...featureForm, emailCampaigns: e.target.checked})}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <Label htmlFor="feat-email">Email Campaigns</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="feat-sms" 
                    checked={featureForm.smsCampaigns} 
                    onChange={e => setFeatureForm({...featureForm, smsCampaigns: e.target.checked})}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <Label htmlFor="feat-sms">SMS Campaigns</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="feat-live" 
                    checked={featureForm.liveSessions} 
                    onChange={e => setFeatureForm({...featureForm, liveSessions: e.target.checked})}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <Label htmlFor="feat-live">Client Live Sessions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="feat-leads" 
                    checked={featureForm.leads} 
                    onChange={e => setFeatureForm({...featureForm, leads: e.target.checked})}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <Label htmlFor="feat-leads">Leads (PPL/PPA)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="feat-marketing" 
                    checked={featureForm.marketingTools} 
                    onChange={e => setFeatureForm({...featureForm, marketingTools: e.target.checked})}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <Label htmlFor="feat-marketing">AI Marketing Tools</Label>
                </div>
              </div>
              <Button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'clients', client.id), { features: featureForm });
                    toast.success('Features updated for client');
                  } catch (error) {
                    handleFirestoreError(error, OperationType.UPDATE, 'clients');
                  }
                }}
                className="bg-slate-900 text-white"
              >
                Save Feature Access
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="contracts" className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Client Contracts</h3>
              <Button size="sm" onClick={addContract}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{c.title}</span>
                          {c.status === 'Signed' && (
                            <span className="text-[10px] text-green-600">Signed by {c.signature} on {c.dateSigned}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={c.status === 'Signed' ? 'default' : 'outline'}>{c.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Dialog>
                          <DialogTrigger render={<Button variant="ghost" size="icon" />}>
                            <Search className="h-4 w-4" />
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
                            <DialogHeader>
                              <DialogTitle>{c.title}</DialogTitle>
                              <DialogDescription>Status: {c.status}</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 border rounded p-4 bg-slate-50 my-2">
                              <div className="prose prose-slate max-w-none whitespace-pre-wrap text-xs">
                                {c.content || "No content available."}
                              </div>
                            </ScrollArea>
                            {c.status === 'Signed' && (
                              <div className="grid grid-cols-3 gap-4 border-t pt-4 text-xs">
                                <div>
                                  <p className="font-bold uppercase text-slate-400">Initials</p>
                                  <p className="text-lg font-mono">{c.initials}</p>
                                </div>
                                <div>
                                  <p className="font-bold uppercase text-slate-400">Signature</p>
                                  <p className="text-lg italic font-serif">{c.signature}</p>
                                </div>
                                <div>
                                  <p className="font-bold uppercase text-slate-400">Date Signed</p>
                                  <p className="text-lg">{c.dateSigned}</p>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'contracts', c.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Payment Records</h3>
              <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
                <DialogTrigger render={<Button size="sm" className="bg-slate-900 text-white" />}>
                    <Plus className="h-4 w-4 mr-1" /> Add Payment
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label>Project</Label>
                      <Select value={paymentForm.projectId} onValueChange={(v) => setPaymentForm({ ...paymentForm, projectId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientProjects.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.title} (${p.budget})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Amount ($)</Label>
                        <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Type</Label>
                        <Select value={paymentForm.type} onValueChange={(v: any) => setPaymentForm({ ...paymentForm, type: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Deposit">Deposit</SelectItem>
                            <SelectItem value="Installment">Installment</SelectItem>
                            <SelectItem value="Final Payment">Final Payment</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Date</Label>
                      <Input type="date" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Payment Notes (visible to client)</Label>
                      <Input 
                        placeholder="e.g. Paid via Stripe, includes tax, etc." 
                        value={paymentForm.notes} 
                        onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input value={paymentForm.description} onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddPayment} className="bg-slate-900 text-white">Save Payment</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{p.date}</TableCell>
                      <TableCell className="text-xs font-medium">{p.projectTitle}</TableCell>
                      <TableCell><Badge variant="ghost" className="text-[10px]">{p.type}</Badge></TableCell>
                      <TableCell className="font-bold">${p.amount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              const newAmount = prompt('Edit Amount:', p.amount.toString());
                              const newDate = prompt('Edit Date (YYYY-MM-DD):', p.date);
                              if (newAmount !== null && newDate !== null) {
                                updateDoc(doc(db, 'payments', p.id), { 
                                  amount: Number(newAmount), 
                                  date: newDate 
                                });
                              }
                            }}
                          >
                            <Edit3 className="h-4 w-4 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            if (confirm('Delete this payment record? Project totals will not be automatically reverted.')) {
                              await deleteDoc(doc(db, 'payments', p.id));
                            }
                          }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="vitals" className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Digital Vitals</h3>
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    const requiredVitals = [
                      { title: 'Legal Business Name', category: 'General', instructions: 'Please provide the exact legal name of your business as registered.' },
                      { title: 'EIN / Tax ID', category: 'General', instructions: 'Required for merchant processing and contracts.' }
                    ];
                    for (const v of requiredVitals) {
                      await addDoc(collection(db, 'vitals'), {
                        ...v,
                        clientId: client.id,
                        status: 'Pending',
                        isRequestedByAdmin: true,
                        createdAt: serverTimestamp()
                      });
                    }
                    if (client.uid) {
                      await sendNotification(client.uid, 'Required Vitals', 'Allie has requested your basic business vitals.', 'message');
                    }
                    toast.success('Requested required vitals');
                  }}
                  className="text-xs"
                >
                  Request Required
                </Button>
                <Button 
                  type="button"
                  size="sm" 
                  onClick={() => setIsAddVitalOpen(!isAddVitalOpen)} 
                  className="bg-slate-900 text-white"
                >
                  {isAddVitalOpen ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> Request Custom</>}
                </Button>
              </div>
            </div>

            {isAddVitalOpen && (
              <Card className="p-4 border-slate-200 bg-slate-50">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vital-title">Information Title</Label>
                      <Input 
                        id="vital-title" 
                        placeholder="e.g. Stripe API Key" 
                        value={vitalForm.title}
                        onChange={(e) => setVitalForm({...vitalForm, title: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vital-category">Category</Label>
                      <select 
                        id="vital-category"
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                        value={vitalForm.category}
                        onChange={(e) => setVitalForm({...vitalForm, category: e.target.value as any})}
                      >
                        <option value="Login">Login</option>
                        <option value="API Key">API Key</option>
                        <option value="Environment Variable">Environment Variable</option>
                        <option value="Link">Link</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vital-instructions">Instructions for Client</Label>
                    <textarea 
                      id="vital-instructions"
                      className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                      placeholder="Explain where/how the client can find this..."
                      value={vitalForm.instructions}
                      onChange={(e) => setVitalForm({...vitalForm, instructions: e.target.value})}
                    />
                  </div>
                  <Button 
                    type="button"
                    size="sm" 
                    className="w-full" 
                    onClick={() => {
                      console.log('Clicked Send Request');
                      handleAddVital();
                    }}
                  >
                    Send Request
                  </Button>
                </div>
              </Card>
            )}

            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {vitals.map(v => (
                  <div key={v.id} className="p-4 border rounded-xl relative group bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={v.status === 'Provided' ? 'default' : 'outline'} className={v.status === 'Pending' ? 'animate-pulse bg-yellow-50 text-yellow-700 border-yellow-200' : ''}>
                        {v.status}
                      </Badge>
                      <Badge variant="ghost" className="text-[10px] uppercase">{v.category}</Badge>
                    </div>
                    <p className="font-bold text-sm">{v.title}</p>
                    {v.status === 'Provided' ? (
                      <div className="mt-2 text-xs bg-slate-50 p-2 rounded-lg break-all font-mono">
                        {v.value}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-1">Waiting for client to provide details...</p>
                    )}
                    {v.instructions && (
                      <div className="mt-2 text-[10px] text-slate-400">
                        <span className="font-bold">Instructions:</span> {v.instructions}
                      </div>
                    ) }
                    <div className="flex justify-end space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const newTitle = prompt('Edit Title:', v.title);
                          const newInstructions = prompt('Edit Instructions:', v.instructions);
                          if (newTitle !== null && newInstructions !== null) {
                            updateDoc(doc(db, 'vitals', v.id), { title: newTitle, instructions: newInstructions });
                          }
                        }}
                      >
                        <Edit3 className="h-4 w-4 text-slate-400" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteDoc(doc(db, 'vitals', v.id))}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {vitals.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm italic">
                    No vitals requested yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4 py-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium">Client's Internal Revenue</h3>
              <div className="flex space-x-4">
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Made</p>
                  <p className="text-sm font-bold text-green-600">${clientRevenue.reduce((acc, p) => acc + (p.status === 'Paid' ? p.amount : 0), 0).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Refunds</p>
                  <p className="text-sm font-bold text-red-600">${clientRevenue.reduce((acc, p) => acc + (p.status === 'Refunded' ? p.amount : 0), 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRevenue.map(p => {
                    const cust = clientCusts.find(c => c.id === p.customerId);
                    const proj = clientProjects.find(pr => pr.id === p.projectId);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-[10px]">{p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : '...'}</TableCell>
                        <TableCell className="text-xs font-medium">{cust?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-xs">{proj?.title || 'External'}</TableCell>
                        <TableCell className="text-xs font-bold">${p.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'Paid' ? 'outline' : 'destructive'} className="text-[9px] uppercase">
                            {p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {clientRevenue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-xs italic">
                        No internal revenue records for this client.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProjectsView({ projects, clients, user, onStartCall, sendNotification }: { projects: Project[], clients: Client[], user: User, onStartCall: (callData: any) => void, sendNotification: any }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    type: 'Mobile App' as Project['type'], 
    clientId: '', 
    status: 'Planning' as Project['status'],
    paymentStatus: 'Not Paid' as Project['paymentStatus'],
    startDate: '',
    estimatedEndDate: '',
    actualEndDate: '',
    budget: 0,
    liveUrl: '',
    description: ''
  });

  const handleAdd = async () => {
    try {
      const client = clients.find(c => c.id === formData.clientId);
      const docRef = await addDoc(collection(db, 'projects'), {
        ...formData,
        clientName: client?.name || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      if (client?.uid) {
        await sendNotification(
          client.uid,
          'New Project Created',
          `Allie has created a new project: ${formData.title}. You can view it in your products tab.`,
          'project'
        );
      }

      setIsAddOpen(false);
      resetForm();
      toast.success('Project created and client notified');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleUpdate = async () => {
    if (!editingProject) return;
    try {
      const client = clients.find(c => c.id === formData.clientId);
      await updateDoc(doc(db, 'projects', editingProject.id), {
        ...formData,
        clientName: client?.name || 'Unknown'
      });
      setEditingProject(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'projects');
    }
  };

  const resetForm = () => {
    setFormData({ 
      title: '', 
      type: 'Mobile App', 
      clientId: '', 
      status: 'Planning', 
      paymentStatus: 'Not Paid',
      startDate: '',
      estimatedEndDate: '',
      actualEndDate: '',
      budget: 0,
      liveUrl: '',
      description: '' 
    });
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      type: project.type,
      clientId: project.clientId,
      status: project.status,
      paymentStatus: project.paymentStatus || 'Not Paid',
      startDate: project.startDate || '',
      estimatedEndDate: project.estimatedEndDate || '',
      actualEndDate: project.actualEndDate || '',
      budget: project.budget || 0,
      liveUrl: project.liveUrl || '',
      description: project.description || ''
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'projects');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors">Projects</h1>
          <p className="text-slate-500 dark:text-slate-400 transition-colors">Track creative, business, and platform deliverables.</p>
        </div>
          <Dialog open={isAddOpen || !!editingProject} onOpenChange={(open) => {
            if (!open) {
              setIsAddOpen(false);
              setEditingProject(null);
              resetForm();
            }
          }}>
            <DialogTrigger render={<Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all font-black uppercase text-xs tracking-widest px-6 h-11 rounded-xl" />}>
                <Plus className="mr-2 h-4 w-4" /> New Project
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
              <DialogDescription>Define the project scope and associate it with a client.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh] pr-4">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Project Name</Label>
                  <Input id="title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mobile App">Mobile App</SelectItem>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Creative">Creative</SelectItem>
                        <SelectItem value="Platform">Platform</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="client">Client</Label>
                    <Select value={formData.clientId} onValueChange={(v: any) => setFormData({ ...formData, clientId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name} ({c.company})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Planning">Planning</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Review">Review</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="paymentStatus">Payment Status</Label>
                    <Select value={formData.paymentStatus} onValueChange={(v: any) => setFormData({ ...formData, paymentStatus: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Paid">Not Paid</SelectItem>
                        <SelectItem value="Deposit Received">Deposit Received</SelectItem>
                        <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                        <SelectItem value="Fully Paid">Fully Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="estimatedEndDate">Estimated End Date</Label>
                    <Input id="estimatedEndDate" type="date" value={formData.estimatedEndDate} onChange={e => setFormData({ ...formData, estimatedEndDate: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="actualEndDate">Actual End Date</Label>
                    <Input id="actualEndDate" type="date" value={formData.actualEndDate} onChange={e => setFormData({ ...formData, actualEndDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget ($)</Label>
                  <Input id="budget" type="number" value={formData.budget} onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="liveUrl">Live URL (Website/App)</Label>
                  <Input id="liveUrl" value={formData.liveUrl} onChange={e => setFormData({ ...formData, liveUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={editingProject ? handleUpdate : handleAdd} className="bg-slate-900 text-white hover:bg-slate-800">
                {editingProject ? 'Update Project' : 'Create Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(project => (
          <Card key={project.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge className={
                  project.type === 'Creative' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' :
                  project.type === 'Business' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' :
                  project.type === 'Mobile App' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                  project.type === 'Website' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400' :
                  'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                }>
                  {project.type}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider dark:border-slate-700 dark:text-slate-400">
                  {project.status}
                </Badge>
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white transition-colors">{project.title}</CardTitle>
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">{project.clientName}</CardDescription>
                {clients.find(c => c.id === project.clientId) && (
                  <div className="flex space-x-2">
                    <a 
                      href={`mailto:${clients.find(c => c.id === project.clientId)?.email}`}
                      className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Email Client"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                    {clients.find(c => c.id === project.clientId)?.phone && (
                      <a 
                        href={`tel:${clients.find(c => c.id === project.clientId)?.phone}`}
                        className="text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        title="Call Client"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center">
                  <Calendar className="mr-1 h-3 w-3" />
                  <span>Start: {project.startDate || 'N/A'}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="mr-1 h-3 w-3" />
                  <span>End: {project.estimatedEndDate || 'N/A'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <div className="flex items-center text-slate-700 dark:text-slate-300 font-medium">
                    <DollarSign className="mr-1 h-3 w-3" />
                    <span>{project.budget?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Paid: ${project.totalPaid?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <Badge variant="outline" className={
                    project.paymentStatus === 'Fully Paid' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50' :
                    project.paymentStatus === 'Partially Paid' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50' :
                    project.paymentStatus === 'Deposit Received' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50' :
                    'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }>
                    {project.paymentStatus || 'Not Paid'}
                  </Badge>
                  {project.liveUrl && (
                    <a 
                      href={project.liveUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1"
                    >
                      View Live
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="ghost" size="icon" onClick={() => startEdit(project)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-400 font-medium transition-colors">
            No projects yet. Create your first project to get started.
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TasksView({ tasks, projects, clients, user, onStartCall, sendNotification }: { tasks: Task[], projects: Project[], clients: Client[], user: User, onStartCall: (callData: any) => void, sendNotification: any }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    title: '', 
    projectId: '', 
    status: 'Todo' as const,
    dueDate: '',
    assignedTo: ''
  });

  const handleAdd = async () => {
    try {
      await addDoc(collection(db, 'tasks'), {
        ...formData,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setIsAddOpen(false);
      setFormData({ title: '', projectId: '', status: 'Todo', dueDate: '', assignedTo: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'Todo' ? 'In Progress' : task.status === 'In Progress' ? 'Done' : 'Todo';
    try {
      await updateDoc(doc(db, 'tasks', task.id), { 
        status: nextStatus,
        updatedAt: serverTimestamp() 
      });
      
      if (nextStatus === 'Done' && (task.clientId || task.projectId)) {
        const client = task.clientId 
          ? clients.find(c => c.id === task.clientId)
          : clients.find(c => c.id === projects.find(p => p.id === task.projectId)?.clientId);

        if (client && client.uid) {
          await sendNotification(
            client.uid,
            'Task Completed',
            `Allie has finished your task: ${task.title}`,
            'contract'
          );
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const handleDecline = async (task: Task) => {
    if (!confirm('Decline this task request?')) return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), { 
        status: 'Declined',
        updatedAt: serverTimestamp()
      });
      
      if (task.clientId) {
        const client = clients.find(c => c.id === task.clientId);
        if (client && client.uid) {
          await sendNotification(
            client.uid,
            'Task Declined',
            `The task request "${task.title}" could not be completed at this time.`,
            'message'
          );
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors">Tasks</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">Action items and project milestones.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="bg-slate-900 text-white hover:bg-slate-800" />}>
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
              <DialogDescription>Assign a task to a project and team member.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="task-title">Task Title</Label>
                <Input id="task-title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-project">Project</Label>
                <Select value={formData.projectId} onValueChange={(v: any) => setFormData({ ...formData, projectId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input id="due-date" type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="assigned">Assigned To</Label>
                  <Input id="assigned" value={formData.assignedTo} onChange={e => setFormData({ ...formData, assignedTo: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} className="bg-slate-900 text-white hover:bg-slate-800">Save Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-8 md:grid-cols-3">
        <TaskColumn 
          title="Todo" 
          tasks={tasks.filter(t => t.status === 'Todo')} 
          projects={projects}
          clients={clients}
          onToggle={toggleStatus} 
          onDelete={handleDelete} 
          onDecline={handleDecline}
          onStartCall={onStartCall}
        />
        <TaskColumn 
          title="In Progress" 
          tasks={tasks.filter(t => t.status === 'In Progress')} 
          projects={projects}
          clients={clients}
          onToggle={toggleStatus} 
          onDelete={handleDelete} 
          onDecline={handleDecline}
          onStartCall={onStartCall}
        />
        <TaskColumn 
          title="Done" 
          tasks={tasks.filter(t => t.status === 'Done')} 
          projects={projects}
          clients={clients}
          onToggle={toggleStatus} 
          onDelete={handleDelete} 
          onStartCall={onStartCall}
        />
        <TaskColumn 
          title="Declined" 
          tasks={tasks.filter(t => t.status === 'Declined')} 
          projects={projects}
          clients={clients}
          onToggle={toggleStatus} 
          onDelete={handleDelete} 
          onStartCall={onStartCall}
        />
      </div>
    </motion.div>
  );
}

function TaskColumn({ title, tasks, projects, clients, onToggle, onDelete, onDecline, onStartCall }: { 
  title: string, 
  tasks: Task[], 
  projects: Project[], 
  clients: Client[], 
  onToggle: (t: Task) => void, 
  onDelete: (id: string) => void, 
  onDecline?: (t: Task) => void,
  onStartCall: (callData: any) => void 
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{tasks.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-250px)] rounded-xl border border-slate-200 bg-slate-100/50 dark:bg-slate-900/50 dark:border-slate-800 p-4 transition-colors">
        <div className="space-y-3">
          {tasks.map(task => {
            const project = task.projectId !== 'Global' ? projects.find(p => p.id === task.projectId) : null;
            const client = task.clientId ? clients.find(c => c.id === task.clientId) : (project ? clients.find(c => c.id === project.clientId) : null);
            return (
              <motion.div 
                layout
                key={task.id} 
                className={`group relative rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow ${task.clientId ? 'border-l-4 border-l-blue-500' : ''}`}
              >
                {task.clientId && (
                  <div className="mb-2 flex items-center space-x-1">
                    <Badge className="bg-blue-600 text-[8px] uppercase tracking-tighter h-3.5 px-1 font-black text-white">Client Request</Badge>
                  </div>
                )}
                <div className="mb-2 flex items-start justify-between">
                  <p className={`text-sm font-semibold text-slate-900 dark:text-white transition-colors ${task.status === 'Done' ? 'line-through opacity-50' : ''}`}>
                    {task.title}
                  </p>
                  <div className="flex space-x-1">
                    {onDecline && task.status === 'Todo' && (
                      <button onClick={() => onDecline(task)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => onToggle(task)} className="text-slate-300 hover:text-slate-900 dark:text-slate-600 dark:hover:text-white transition-colors">
                      <CheckSquare className={`h-4 w-4 ${task.status === 'Done' ? 'text-green-500' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col mb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-slate-400 uppercase dark:text-slate-500">{project?.title || 'General Task'}</p>
                    {client && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{client.name}</span>
                    )}
                  </div>
                  {task.createdAt && (
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Submitted: {task.createdAt?.seconds ? new Date(task.createdAt.seconds * 1000).toLocaleString() : 'Recently'}
                    </p>
                  )}
                  {task.dueDate && (
                    <p className="text-[9px] text-blue-500 dark:text-blue-400 font-bold mt-0.5">
                      Needed by: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 dark:text-slate-400">
                      {task.assignedTo?.charAt(0) || '?'}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{task.assignedTo || 'Unassigned'}</span>
                  </div>
                  <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400 transition-all">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
          {tasks.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No tasks in this column.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PaymentsAnalyticsView({ payments, clients, projects }: { payments: Payment[], clients: Client[], projects: Project[] }) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [linkForm, setLinkForm] = useState({
    clientId: '',
    projectId: '',
    paythenUrl: '',
    method: 'email' as 'email' | 'sms'
  });

  const [editForm, setEditForm] = useState({
    amount: 0,
    status: 'Pending' as Payment['status'],
    date: '',
    notes: '',
    projectTitle: ''
  });

  const totalRevenue = payments
    .filter(p => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingRevenue = payments
    .filter(p => p.status === 'Pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const handleSendLink = () => {
    const client = clients.find(c => c.id === linkForm.clientId);
    if (!client || !linkForm.paythenUrl) return;

    const message = `Hi ${client.name}, here is the payment link for your project: ${linkForm.paythenUrl}`;
    
    if (linkForm.method === 'email') {
      window.location.href = `mailto:${client.email}?subject=Payment Link&body=${encodeURIComponent(message)}`;
    } else {
      window.location.href = `sms:${client.phone}?body=${encodeURIComponent(message)}`;
    }
    setIsLinkDialogOpen(false);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;
    try {
      await updateDoc(doc(db, 'payments', editingPayment.id), editForm);
      setEditingPayment(null);
      toast.success('Payment updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'payments');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (confirm('Are you sure you want to delete this payment record?')) {
      try {
        await deleteDoc(doc(db, 'payments', id));
        toast.success('Payment deleted');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'payments');
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Payments & Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400">Track revenue and manage client payment records.</p>
        </div>
        <div className="flex space-x-3">
          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <DialogTrigger render={<Button className="bg-slate-900 text-white hover:bg-slate-800" />}>
              <Send className="mr-2 h-4 w-4" /> Send Payment Link
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Paythen Link</DialogTitle>
                <DialogDescription>Send a payment link to your client via email or text.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label>Client</Label>
                  <Select value={linkForm.clientId} onValueChange={(v) => setLinkForm({ ...linkForm, clientId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.company})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Paythen URL</Label>
                  <Input 
                    placeholder="https://paythen.co/..." 
                    value={linkForm.paythenUrl} 
                    onChange={e => setLinkForm({ ...linkForm, paythenUrl: e.target.value })} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Method</Label>
                  <Select value={linkForm.method} onValueChange={(v: any) => setLinkForm({ ...linkForm, method: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">Text (SMS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSendLink} className="bg-slate-900 text-white w-full">
                  Send via {linkForm.method === 'email' ? 'Email' : 'SMS'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue</h3>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">${totalRevenue.toLocaleString()}</div>
        </Card>
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Revenue</h3>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">${pendingRevenue.toLocaleString()}</div>
        </Card>
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Transactions</h3>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{payments.length}</div>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h2>
        </div>
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950">
            <TableRow className="dark:border-slate-800">
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(payment => {
              const client = clients.find(c => c.id === payment.clientId);
              return (
                <TableRow key={payment.id} className="dark:border-slate-800">
                  <TableCell className="text-sm text-slate-500 dark:text-slate-400">{payment.date}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="font-medium text-slate-900 dark:text-white">{client?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-slate-500">{payment.projectTitle}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white">${payment.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={payment.status === 'Paid' ? 'default' : 'outline'} className={
                      payment.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                      payment.status === 'Overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setEditingPayment(payment);
                          setEditForm({
                            amount: payment.amount,
                            status: payment.status,
                            date: payment.date,
                            notes: payment.notes || '',
                            projectTitle: payment.projectTitle || ''
                          });
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(payment.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                  No payment records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Amount ($)</Label>
                <Input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v: any) => setEditForm({...editForm, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdatePayment} className="bg-slate-900 text-white w-full">Update Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function LeadsView({ leads, clients, user }: { leads: Lead[], clients: Client[], user: User }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({
    clientId: '',
    name: '',
    email: '',
    phone: '',
    source: '',
    type: 'Lead' as Lead['type'],
    notes: '',
    pricePaid: 0
  });

  const handleSave = async () => {
    if (!form.clientId || !form.name) return;
    try {
      if (editingLead) {
        await updateDoc(doc(db, 'leads', editingLead.id), {
          ...form,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'leads'), {
          ...form,
          status: 'New',
          createdAt: serverTimestamp()
        });
      }
      setIsAddOpen(false);
      setEditingLead(null);
      setForm({ clientId: '', name: '', email: '', phone: '', source: '', type: 'Lead', notes: '', pricePaid: 0 });
      toast.success('Lead saved');
    } catch (error) {
      console.error('Error saving lead:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    await deleteDoc(doc(db, 'leads', id));
  };

  const handleStatusChange = async (id: string, status: Lead['status']) => {
    await updateDoc(doc(db, 'leads', id), { status });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Leads Management</h2>
          <p className="text-slate-500 text-sm">Manage Pay Per Lead and Pay Per Appointment cycles.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Plus className="mr-2 h-4 w-4" /> Add Lead
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {leads.map(lead => {
          const client = clients.find(c => c.id === lead.clientId);
          return (
            <Card key={lead.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest">{lead.type}</Badge>
                  <Select value={lead.status} onValueChange={(v: any) => handleStatusChange(lead.id, v)}>
                    <SelectTrigger className="h-7 w-auto text-[10px] font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Contacted">Contacted</SelectItem>
                      <SelectItem value="Qualified">Qualified</SelectItem>
                      <SelectItem value="Appointment Set">Appt Set</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                      <SelectItem value="Lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardTitle className="mt-2 text-lg font-bold">{lead.name}</CardTitle>
                <p className="text-xs text-slate-500 font-medium">{client?.name || 'Assigned to Private Client'}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                  <Mail className="mr-2 h-3 w-3" /> {lead.email}
                </div>
                {lead.phone && (
                  <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                    <Phone className="mr-2 h-3 w-3" /> {lead.phone}
                  </div>
                )}
                <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                  <TrendingUp className="mr-2 h-3 w-3" /> Source: {lead.source || 'Direct'}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revenue Impact</span>
                  <span className="font-bold text-green-600">${(lead.pricePaid || 0).toLocaleString()}</span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                  setEditingLead(lead);
                  setForm({
                    clientId: lead.clientId,
                    name: lead.name,
                    email: lead.email || '',
                    phone: lead.phone || '',
                    source: lead.source || '',
                    type: lead.type,
                    notes: lead.notes || '',
                    pricePaid: lead.pricePaid || 0
                  });
                  setIsAddOpen(true);
                }}>Edit</Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => handleDelete(lead.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Assigned Client</Label>
              <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Lead Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Source</Label>
                <Input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="e.g. FB Ads" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Appointment">Appointment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Price Paid (Cycle Revenue)</Label>
                <Input type="number" value={form.pricePaid} onChange={e => setForm({ ...form, pricePaid: parseFloat(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="bg-slate-900 text-white w-full">Save Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignsView({ campaigns, clients, user }: { campaigns: Campaign[], clients: Client[], user: User }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState({
    clientId: '',
    title: '',
    type: 'Email' as Campaign['type'],
    content: '',
    scheduledAt: '',
    recipientCount: 0
  });

  const handleSave = async () => {
    if (!form.clientId || !form.title) return;
    try {
      if (editingCampaign) {
        await updateDoc(doc(db, 'campaigns', editingCampaign.id), { ...form });
      } else {
        await addDoc(collection(db, 'campaigns'), {
          ...form,
          status: 'Draft',
          createdAt: serverTimestamp()
        });
      }
      setIsAddOpen(false);
      setEditingCampaign(null);
      setForm({ clientId: '', title: '', type: 'Email', content: '', scheduledAt: '', recipientCount: 0 });
      toast.success('Campaign saved');
    } catch (error) {
      console.error(error);
    }
  };

  const handleSend = async (id: string) => {
    await updateDoc(doc(db, 'campaigns', id), { status: 'Sent' });
    toast.success('Campaign moved to delivery queue');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Marketing Campaigns</h2>
          <p className="text-slate-500 text-sm">Launch email and SMS campaigns for your clients.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white">
          <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {campaigns.map(camp => (
          <Card key={camp.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <Badge variant="secondary" className="text-[10px] uppercase font-black tracking-widest">{camp.type}</Badge>
                <Badge className={camp.status === 'Sent' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>{camp.status}</Badge>
              </div>
              <CardTitle className="mt-4">{camp.title}</CardTitle>
              <CardDescription className="line-clamp-2">{camp.content}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-slate-500 space-x-4">
                <div className="flex items-center"><Users className="mr-1.5 h-3.5 w-3.5" /> {camp.recipientCount || 0} Recipients</div>
                {camp.scheduledAt && <div className="flex items-center"><Calendar className="mr-1.5 h-3.5 w-3.5" /> {new Date(camp.scheduledAt).toLocaleDateString()}</div>}
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                setEditingCampaign(camp);
                setForm({
                  clientId: camp.clientId,
                  title: camp.title,
                  type: camp.type,
                  content: camp.content,
                  scheduledAt: camp.scheduledAt || '',
                  recipientCount: camp.recipientCount || 0
                });
                setIsAddOpen(true);
              }}>Edit</Button>
              {camp.status !== 'Sent' && (
                <Button className="flex-1 bg-blue-600 text-white" onClick={() => handleSend(camp.id)}>Send Now</Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Client Assignment</Label>
              <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Which client is this for?" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Campaign Title</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Message Content</Label>
              <textarea 
                className="min-h-[150px] w-full rounded-xl border border-input p-3 text-sm"
                value={form.content} 
                onChange={e => setForm({ ...form, content: e.target.value })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="bg-slate-900 text-white w-full">Save Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function MarketingToolsView({ clientId, client }: { clientId: string, client: Client }) {
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      // Logic for AI Generation would go here
      // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      // ...
      setTimeout(() => {
        setGeneratedContent(`Generated high-converting marketing copy for: ${prompt}\n\n[Sample AI Output would appear here based on the client's brand and goal]`);
        setIsGenerating(false);
        toast.success('Content generated successfully');
      }, 1500);
    } catch (error) {
      toast.error('AI Generation failed');
      setIsGenerating(false);
    }
  };

  if (!client.features?.marketingTools) {
    return <FeatureDisabledView featureName="AI Marketing Tools" />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white">AI Marketing Suite</h2>
        <p className="text-slate-500 font-medium">Create high-converting copy, ads, and emails with Allie AI.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="rounded-[2.5rem] border-slate-200 shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <CardHeader className="p-8">
            <CardTitle className="text-xl font-black">Content Laboratory</CardTitle>
            <CardDescription className="font-medium">What should Allie write for you today?</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-6">
            <div className="grid gap-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Campaign Objective</Label>
              <textarea 
                className="w-full min-h-[150px] rounded-2xl border-2 border-slate-100 p-4 font-medium dark:border-slate-800 dark:bg-slate-950 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g. Write a 3-part email sequence for a new SaaS product launch aimed at small business owners..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !prompt}
              className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-2xl transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <div className="flex items-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white mr-2" /> Generating...</div>
              ) : 'Ignite AI Creation'}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/20 overflow-hidden min-h-[400px] flex flex-col">
          <CardHeader className="p-8">
            <CardTitle className="text-xl font-black flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-amber-500" /> Output
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8 flex-1">
            {generatedContent ? (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-inner h-full min-h-[300px] whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-300">
                {generatedContent}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                <FileText className="h-16 w-16 mb-4" />
                <p className="font-bold">Waiting for input...</p>
                <p className="text-xs uppercase tracking-widest mt-1">Generated content will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureDisabledView({ featureName }: { featureName: string }) {
  return (
    <Card className="border-slate-200 border-dashed bg-slate-50/50 dark:bg-slate-900/50 dark:border-slate-800 py-32 rounded-[3.5rem]">
      <div className="flex flex-col items-center justify-center text-center px-4">
        <div className="h-20 w-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl mb-6">
          <LockIcon className="h-10 w-10 text-slate-300" />
        </div>
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{featureName} Locked</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-3 font-medium">This feature is not currently enabled for your account. Please contact Allie to upgrade your plan.</p>
        <Button variant="outline" className="mt-8 rounded-xl font-black uppercase text-[10px] tracking-widest">
          Request Access
        </Button>
      </div>
    </Card>
  );
}

function SessionsView({ 
  sessions, 
  clients, 
  user, 
  role,
  onStartCall,
  sendNotification,
  isClientView = false
}: { 
  sessions: ScheduledSession[], 
  clients: Client[], 
  user: User, 
  role: string | null,
  onStartCall: (callData: any) => void,
  sendNotification: any,
  isClientView?: boolean
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSession, setNewSession] = useState<{
    title: string;
    startTime: string;
    clientId: string;
    duration: number;
    meetingLink: string;
  }>({
    title: '',
    startTime: '',
    clientId: isClientView && clients.length > 0 ? clients[0].id : '',
    duration: 30,
    meetingLink: ''
  });

  const handleAdd = async () => {
    if (!newSession.title || !newSession.startTime || !newSession.clientId) return;
    
    const client = clients.find(c => c.id === newSession.clientId);
    
    await addDoc(collection(db, 'scheduledSessions'), {
      ...newSession,
      clientName: client?.name || 'Unknown',
      status: isClientView ? 'Requested' : 'Proposed',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      meetingLink: (newSession as any).meetingLink || ''
    });
    
    setIsAddOpen(false);
    setNewSession({ 
      title: '', 
      startTime: '', 
      clientId: isClientView && clients.length > 0 ? clients[0].id : '', 
      duration: 30,
      meetingLink: ''
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'scheduledSessions', id), { status });
      
      const session = sessions.find(s => s.id === id);
      if (!session) return;

      if (status === 'Accepted' || status === 'Declined') {
        const client = clients.find(c => c.id === session.clientId);
        if (client && client.uid) {
          await sendNotification(
            client.uid,
            `Session ${status}`,
            `Your session request "${session.title}" has been ${status.toLowerCase()}.`,
            'session'
          );
        }
      } else if (status === 'Active') {
        if (role === 'client') {
          // Notify admin - we'll find an admin UID if possible, otherwise use a placeholder that the global listener will pick up
          await sendNotification(
            'ADMIN_GROUP',
            'Client Started Session',
            `${session.clientName} is starting the session: ${session.title}`,
            'session'
          );
        } else {
          // Notify client
          const client = clients.find(c => c.id === session.clientId);
          if (client && client.uid) {
            await sendNotification(
              client.uid,
              'Session Started',
              `Allie is starting your session: ${session.title}. Click to join!`,
              'session'
            );
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'scheduledSessions');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'scheduledSessions', id));
  };

  const startSession = (session: ScheduledSession) => {
    if (session.status !== 'Active') {
      handleStatusChange(session.id, 'Active');
    }
    onStartCall({ 
      clientId: session.clientId, 
      clientName: session.clientName, 
      sessionId: session.id,
      callId: session.callId 
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Live Sessions</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Schedule and manage live video interactions.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl font-black uppercase text-xs tracking-widest px-6 h-11" />}>
            <Calendar className="mr-2 h-4 w-4" /> Schedule New
          </DialogTrigger>
          <DialogContent className="dark:bg-slate-900 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden sm:max-w-md">
            <div className="bg-slate-50 dark:bg-slate-950 p-8 border-b border-slate-100 dark:border-slate-800">
              <DialogHeader>
                <CardTitle className="text-2xl font-black dark:text-white tracking-tight">Schedule New Session</CardTitle>
                <CardDescription className="dark:text-slate-400 text-slate-500 font-medium pt-1">Set a time for an integrated video meeting.</CardDescription>
              </DialogHeader>
            </div>
            <div className="space-y-5 p-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1">Session Title</Label>
                <Input 
                  placeholder="e.g., Weekly Sync, Strategy Review" 
                  value={newSession.title}
                  onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                  className="rounded-xl h-11 dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:ring-blue-500/20"
                />
              </div>
              {!isClientView && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1">Assign Client</Label>
                  <Select 
                    value={newSession.clientId} 
                    onValueChange={(val) => setNewSession({ ...newSession, clientId: val })}
                  >
                    <SelectTrigger className="rounded-xl h-11 dark:bg-slate-950 dark:border-slate-800 dark:text-white">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id} className="dark:text-slate-100">{c.name} • {c.company}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1">Start Time</Label>
                  <Input 
                    type="datetime-local" 
                    value={newSession.startTime}
                    onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })}
                    className="rounded-xl h-11 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1">Duration (Min)</Label>
                  <Input 
                    type="number" 
                    value={newSession.duration}
                    onChange={(e) => setNewSession({ ...newSession, duration: parseInt(e.target.value) })}
                    className="rounded-xl h-11 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1">External Meeting Link (Optional)</Label>
                <Input 
                  placeholder="https://zoom.us/j/..."
                  value={(newSession as any).meetingLink || ''}
                  onChange={(e) => setNewSession({ ...newSession, meetingLink: e.target.value })}
                  className="rounded-xl h-11 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="p-8 pt-0 flex space-x-3">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} className="flex-1 h-11 rounded-xl font-black uppercase text-xs tracking-widest dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</Button>
              <Button onClick={handleAdd} className="flex-1 h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-black uppercase text-xs tracking-widest">Schedule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map(session => (
          <Card key={session.id} className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900 rounded-[2rem] transition-all hover:shadow-xl hover:translate-y-[-4px] group">
            <div className={`h-1.5 transition-all group-hover:h-2.5 ${
              session.status === 'Active' ? 'bg-green-500' : 
              session.status === 'Accepted' ? 'bg-blue-500' : 
              session.status === 'Requested' ? 'bg-amber-500' :
              session.status === 'Declined' ? 'bg-red-500' :
              'bg-slate-300 dark:bg-slate-700'
            }`} />
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 dark:border-slate-700 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                  {session.status}
                </Badge>
                {!isClientView && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all opacity-0 group-hover:opacity-100" onClick={() => handleDelete(session.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">{session.title}</CardTitle>
              <CardDescription className="dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest pt-1">{session.clientName}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="space-y-2 mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 ring-1 ring-slate-100 dark:ring-slate-800">
                <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                  <div className="h-6 w-6 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center mr-3 shadow-sm">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  {new Date(session.startTime).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
                <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                  <div className="h-6 w-6 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center mr-3 shadow-sm">
                    <Timer className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  {session.duration} Minutes
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                {session.status === 'Requested' && !isClientView && (
                  <div className="flex space-x-2">
                    <Button 
                      className="flex-1 h-10 rounded-xl bg-green-600 text-white hover:bg-green-500 font-black uppercase text-[10px] tracking-widest shadow-sm"
                      onClick={() => handleStatusChange(session.id, 'Accepted')}
                    >
                      Accept
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() => handleStatusChange(session.id, 'Declined')}
                    >
                      Decline
                    </Button>
                  </div>
                )}

                {session.status === 'Proposed' && isClientView && (
                  <div className="flex space-x-2">
                    <Button 
                      className="flex-1 bg-green-600 text-white hover:bg-green-500"
                      onClick={() => handleStatusChange(session.id, 'Accepted')}
                    >
                      Accept Appointment
                    </Button>
                  </div>
                )}

                {session.status === 'Accepted' && (
                  <div className="flex flex-col space-y-2">
                    {session.meetingLink ? (
                      <Button 
                        className="w-full bg-blue-600 text-white hover:bg-blue-500"
                        onClick={() => window.open(session.meetingLink, '_blank')}
                      >
                        <Video className="mr-2 h-4 w-4" /> Join Zoom/External Meeting
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        {role === 'admin' ? (
                          <Button 
                            className="flex-1 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                            onClick={() => startSession(session)}
                          >
                            <Video className="mr-2 h-4 w-4" /> Start Live Session
                          </Button>
                        ) : (
                          <div className="flex-1 flex items-center justify-center p-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                            <Clock className="mr-2 h-3 w-3 animate-pulse" /> Waiting for Host to start
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {session.status === 'Active' && (
                  <div className="flex space-x-2">
                    {session.meetingLink ? (
                      <Button 
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-500"
                        onClick={() => window.open(session.meetingLink, '_blank')}
                      >
                        <Video className="mr-2 h-4 w-4" /> Join Zoom Meeting
                      </Button>
                    ) : (
                      <Button 
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-500"
                        onClick={() => startSession(session)}
                      >
                        <Video className="mr-2 h-4 w-4" /> Join Live Session
                      </Button>
                    )}
                    {role === 'admin' && (
                      <Button variant="outline" className="dark:border-slate-700 dark:text-slate-300" onClick={() => handleStatusChange(session.id, 'Completed')}>
                        End
                      </Button>
                    )}
                  </div>
                )}

                {session.status === 'Proposed' && !isClientView && (
                  <div className="text-center p-2 rounded-lg bg-slate-50 text-slate-500 text-[10px] italic border border-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-800">
                    Awaiting client acceptance...
                  </div>
                )}

                {session.status === 'Requested' && isClientView && (
                  <Button variant="outline" className="w-full dark:border-slate-800 dark:text-slate-500" disabled>
                    Waiting for Approval
                  </Button>
                )}

                {(session.status === 'Declined' || session.status === 'Completed' || session.status === 'Cancelled') && (
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full dark:border-slate-800 dark:text-slate-500" disabled>
                      Session {session.status}
                    </Button>
                    {session.recordingUrl && (
                      <Button 
                        variant="outline" 
                        className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                        onClick={() => window.open(session.recordingUrl, '_blank')}
                      >
                        <Play className="mr-2 h-3.5 w-3.5 mr-2" /> View Recording
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {isClientView && clients[0]?.features?.liveSessions && (
          <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-900/50 rounded-[2rem] flex flex-col items-center justify-center p-8 text-center transition-all hover:bg-blue-50 dark:hover:bg-blue-950/20">
            <div className="h-16 w-16 rounded-3xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg mb-4 text-blue-600">
              <Video className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">External Video Meeting</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6 max-w-[200px]">Launch a private meeting room for your own clients or team.</p>
            <div className="flex flex-col w-full space-y-2">
              <Button 
                onClick={() => {
                  const roomName = `private-room-${Math.random().toString(36).substring(7)}`;
                  const link = `https://daily.co/${roomName}`; // Simulated link
                  navigator.clipboard.writeText(link);
                  toast.success('Meeting link copied to clipboard!');
                  window.open(link, '_blank');
                }}
                className="w-full bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-11"
              >
                Launch Instant Room
              </Button>
              <Button 
                variant="ghost"
                onClick={() => {
                  const link = `https://daily.co/allie-meeting-${Math.random().toString(36).substring(7)}`;
                  navigator.clipboard.writeText(link);
                  toast.success('Invitation link copied!');
                }}
                className="w-full text-blue-600 dark:text-blue-400 font-bold text-xs"
              >
                <Share2 className="h-3.5 w-3.5 mr-2" /> Share Link
              </Button>
            </div>
          </Card>
        )}
        {sessions.length === 0 && (
          <div className="col-span-full py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <Video className="mx-auto h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No sessions scheduled</p>
            <p className="text-sm">Schedule a live session to get started.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ChatWindow({ messages, clientId, user, onSendMessage }: { 
  messages: Message[], 
  clientId: string, 
  user: User,
  onSendMessage: (text: string) => void
}) {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    onSendMessage(newMessage);
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
              m.senderId === user.uid 
                ? 'bg-slate-900 text-white rounded-tr-none dark:bg-white dark:text-slate-900' 
                : 'bg-slate-100 text-slate-900 rounded-tl-none dark:bg-slate-800 dark:text-slate-100'
            }`}>
              <p className="leading-relaxed">{m.text}</p>
              <p className={`text-[10px] mt-1 ${m.senderId === user.uid ? 'text-slate-400 dark:text-slate-400' : 'text-slate-500 dark:text-slate-300'}`}>
                {m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-400">
            <MessageCircle className="h-12 w-12 mb-2 opacity-20" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-slate-50 flex space-x-2 dark:bg-slate-950 dark:border-slate-800">
        <Input 
          placeholder="Type a message..." 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
        />
        <Button type="submit" size="icon" className="bg-slate-900 text-white hover:bg-slate-800 shrink-0 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function ChatWindowWrapper({ messages, clientId, user, clientName }: { messages: Message[], clientId: string, user: User, clientName: string }) {
  // Mark messages as read when client opens chat
  useEffect(() => {
    const unreadFromAdmin = messages.filter(m => !m.read && m.senderId !== user.uid);
    unreadFromAdmin.forEach(async (m) => {
      try {
        await updateDoc(doc(db, 'messages', m.id), { read: true });
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });
  }, [messages.length, user.uid]);

  const handleSendMessage = async (text: string) => {
    try {
      await addDoc(collection(db, 'messages'), {
        text,
        senderId: user.uid,
        senderName: clientName,
        clientId: clientId,
        timestamp: serverTimestamp(),
        read: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <ChatWindow 
      messages={messages} 
      clientId={clientId} 
      user={user} 
      onSendMessage={handleSendMessage} 
    />
  );
}

function MessagesView({ messages, clients, user }: { messages: Message[], clients: Client[], user: User }) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients.length > 0 ? clients[0].id : null);

  const filteredMessages = messages.filter(m => m.clientId === selectedClientId);

  // Mark messages as read when admin opens a chat
  useEffect(() => {
    if (selectedClientId) {
      const unreadFromThisClient = filteredMessages.filter(m => !m.read && m.senderId !== user.uid);
      unreadFromThisClient.forEach(async (m) => {
        try {
          await updateDoc(doc(db, 'messages', m.id), { read: true });
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      });
    }
  }, [selectedClientId, filteredMessages.length, user.uid]);

  const handleSendMessage = async (text: string) => {
    if (!selectedClientId) return;
    try {
      await addDoc(collection(db, 'messages'), {
        text,
        senderId: user.uid,
        senderName: user.displayName || 'Admin',
        clientId: selectedClientId,
        timestamp: serverTimestamp(),
        read: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-12 gap-6 h-[calc(100vh-160px)]"
    >
      <div className="col-span-4 flex flex-col space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white px-2">Conversations</h2>
        <ScrollArea className="flex-1 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900/50">
          <div className="p-3 space-y-2">
            {clients.map(client => {
              const clientMessages = messages.filter(m => m.clientId === client.id);
              const lastMessage = clientMessages[clientMessages.length - 1];
              const unreadCount = clientMessages.filter(m => !m.read && m.senderId !== user.uid).length;
              
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`group w-full text-left p-4 rounded-2xl transition-all relative outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring ${
                    selectedClientId === client.id 
                      ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900' 
                      : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-bold truncate pr-6">{client.name}</div>
                    {unreadCount > 0 && selectedClientId !== client.id && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className={`text-[11px] truncate leading-tight ${
                    selectedClientId === client.id 
                      ? 'text-slate-400 dark:text-slate-400' 
                      : unreadCount > 0 ? 'text-slate-900 font-bold dark:text-white' : 'text-slate-400 dark:text-slate-400'
                  }`}>
                    {lastMessage ? lastMessage.text : 'No messages yet...'}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      <div className="col-span-8">
        {selectedClientId ? (
          <ChatWindow 
            messages={filteredMessages} 
            clientId={selectedClientId} 
            user={user} 
            onSendMessage={handleSendMessage} 
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 p-12 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-6 dark:bg-slate-800">
              <MessageCircle className="h-8 w-8 text-slate-300 dark:text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select a Client</h3>
            <p className="text-sm text-center max-w-xs">Pick a conversation from the left to start collaborating in real-time.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ScheduleSessionDialog({ clientId, clientName, onScheduled }: { clientId: string, clientName: string, onScheduled: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startTime = new Date(`${date}T${time}`);
    onScheduled({ title, startTime, duration: parseInt(duration) });
    setOpen(false);
    setTitle('');
    setDate('');
    setTime('');
    setDuration('30');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="hidden sm:flex border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/30" />}>
        <Video className="mr-2 h-4 w-4" /> Schedule Live Session
      </DialogTrigger>
      <DialogContent className="dark:bg-slate-900 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Schedule Live Session</DialogTitle>
          <DialogDescription className="dark:text-slate-400">Request a live session with Allie. She will review and confirm the time.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-title" className="dark:text-slate-300">Session Topic</Label>
            <Input 
              id="session-title" 
              placeholder="e.g. Project Review, Strategy Call" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
              className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-date" className="dark:text-slate-300">Date</Label>
              <Input 
                id="session-date" 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
                className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-time" className="dark:text-slate-300">Time</Label>
              <Input 
                id="session-time" 
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
                required 
                className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-duration" className="dark:text-slate-300">Duration (minutes)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="session-duration" className="dark:bg-slate-950 dark:border-slate-800 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="15" className="dark:text-slate-100">15 minutes</SelectItem>
                <SelectItem value="30" className="dark:text-slate-100">30 minutes</SelectItem>
                <SelectItem value="45" className="dark:text-slate-100">45 minutes</SelectItem>
                <SelectItem value="60" className="dark:text-slate-100">60 minutes</SelectItem>
                <SelectItem value="90" className="dark:text-slate-100">90 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">Request Session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskRequestDialog({ clientId, clientName, projects, onRequested }: { clientId: string, clientName: string, projects: Project[], onRequested: (data: any) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    projectId: 'Global',
    dueDate: '',
    description: ''
  });

  const handleSubmit = async () => {
    if (!formData.title) return;
    setIsSubmitting(true);
    try {
      await onRequested(formData);
      setIsOpen(false);
      setFormData({ title: '', projectId: 'Global', dueDate: '', description: '' });
      toast.success('Task request submitted successfully');
    } catch (error) {
      toast.error('Failed to submit task request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 shadow-lg" />}>
        <Plus className="mr-2 h-4 w-4" /> Request a Task
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Request a Task</DialogTitle>
          <DialogDescription className="font-medium">Allie will be notified of your request.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-6 font-geist">
          <div className="grid gap-2">
            <Label htmlFor="req-task-title" className="font-bold uppercase text-[10px] tracking-widest text-slate-400 dark:text-slate-400">What do you need help with?</Label>
            <Input 
              id="req-task-title" 
              placeholder="e.g. Update logo on homepage, Add new team section..." 
              value={formData.title} 
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="h-12 text-base rounded-xl"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="req-description" className="font-bold uppercase text-[10px] tracking-widest text-slate-400 dark:text-slate-400">Additional Details (Optional)</Label>
            <textarea 
              id="req-description"
              className="flex min-h-[100px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950/50"
              placeholder="Provide more context for Allie..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="req-project" className="font-bold uppercase text-[10px] tracking-widest text-slate-400 dark:text-slate-400">Related Project</Label>
              <Select value={formData.projectId} onValueChange={v => setFormData({ ...formData, projectId: v })}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Global">General Inquiry / All Projects</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="req-due-date" className="font-bold uppercase text-[10px] tracking-widest text-slate-400 dark:text-slate-400">When do you need it by?</Label>
              <Input 
                id="req-due-date" 
                type="date" 
                value={formData.dueDate} 
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                className="h-12 rounded-xl"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            disabled={isSubmitting || !formData.title} 
            onClick={handleSubmit} 
            className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-black uppercase tracking-widest text-xs dark:bg-white dark:text-slate-900"
          >
            {isSubmitting ? 'Sending...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientTaskRequestsView({ tasks, projects, clientId, clientName, onRequested, onUpdate, onDelete }: { tasks: Task[], projects: Project[], clientId: string, clientName: string, onRequested: (data: any) => Promise<void>, onUpdate: (id: string, data: any) => Promise<void>, onDelete: (id: string) => Promise<void> }) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const clientTasks = tasks.filter(t => t.clientId === clientId);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Task Requests</h2>
          <p className="text-slate-500 font-medium dark:text-slate-400">Submit and track your requests to Allie.</p>
        </div>
        <TaskRequestDialog 
          clientId={clientId} 
          clientName={clientName} 
          projects={projects} 
          onRequested={onRequested} 
        />
      </header>

      <div className="grid gap-6">
        {clientTasks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {clientTasks.map(task => {
              const project = projects.find(p => p.id === task.projectId);
              return (
                <Card key={task.id} className="border-slate-200 shadow-sm overflow-hidden rounded-3xl dark:border-slate-800 dark:bg-slate-900 group transition-all hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-2xl ${
                        task.status === 'Done' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 
                        task.status === 'In Progress' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'
                      }`}>
                        {task.status === 'Done' ? <CheckCircle2 className="h-6 w-6" /> : <Timer className="h-6 w-6" />}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white" onClick={() => setEditingTask(task)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-red-500" onClick={() => onDelete(task.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Badge className={`font-black uppercase text-[10px] tracking-widest px-3 py-1 ${
                          task.status === 'Done' ? 'bg-green-600 text-white' : 
                          task.status === 'In Progress' ? 'bg-blue-600 text-white' : 
                          'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        }`}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{task.title}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{project?.title || 'General Request'}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t border-slate-50 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Requested On</p>
                        <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {task.createdAt?.seconds ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Needed By</p>
                        <p className={`text-xs font-mono font-bold ${task.dueDate ? 'text-blue-600' : 'text-slate-400'}`}>
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800 text-center">
            <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-6">
              <CheckSquare className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">No task requests yet</h3>
            <p className="text-slate-500 max-w-sm mt-2">Need something done? Submit your first task request for Allie to review.</p>
            <TaskRequestDialog 
              clientId={clientId} 
              clientName={clientName} 
              projects={projects} 
              onRequested={onRequested} 
            />
          </div>
        )}
      </div>

      {editingTask && (
        <EditTaskDialog 
          task={editingTask} 
          projects={projects}
          onClose={() => setEditingTask(null)}
          onUpdate={(data) => onUpdate(editingTask.id, data)}
        />
      )}
    </div>
  );
}

function EditTaskDialog({ task, projects, onClose, onUpdate }: { task: Task, projects: Project[], onClose: () => void, onUpdate: (data: any) => Promise<void> }) {
  const [formData, setFormData] = useState({
    title: task.title,
    projectId: task.projectId || 'Global',
    dueDate: task.dueDate || '',
    description: task.description || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Edit Task Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid gap-2">
            <Label className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Task Title</Label>
            <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="h-12 rounded-xl" />
          </div>
          <div className="grid gap-2">
            <Label className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Description</Label>
            <textarea 
              className="min-h-[100px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
              value={formData.description} 
              onChange={e => setFormData({ ...formData, description: e.target.value })} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Project</Label>
              <Select value={formData.projectId} onValueChange={v => setFormData({ ...formData, projectId: v })}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Global">General</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Due Date</Label>
              <Input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="h-12 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white rounded-xl">
              {isSubmitting ? 'Saving...' : 'Update Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientCustomersView({ customers, clientId, clientName }: { customers: ClientCustomer[], clientId: string, clientName: string }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ClientCustomer | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' });

  const handleSave = async () => {
    if (!form.name) return;
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'clientCustomers', editingCustomer.id), { ...form });
      } else {
        await addDoc(collection(db, 'clientCustomers'), {
          ...form,
          clientId,
          createdAt: serverTimestamp()
        });
      }
      setIsAddOpen(false);
      setEditingCustomer(null);
      setForm({ name: '', email: '', phone: '', company: '', notes: '' });
      toast.success('Customer saved');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    await deleteDoc(doc(db, 'clientCustomers', id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white">Customer CRM</h2>
          <p className="text-slate-500 font-medium tracking-tight">Manage your own client list for campaigns and outreach.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white rounded-2xl h-12 px-6 font-black uppercase text-xs tracking-widest">
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl overflow-hidden dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
            <TableRow className="border-none">
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Name / Company</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Contact Info</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map(c => (
              <TableRow key={c.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <TableCell className="p-6">
                  <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-widest">{c.company}</div>
                </TableCell>
                <TableCell className="p-6 space-y-1">
                  <div className="flex items-center text-sm font-medium"><Mail className="mr-2 h-3.5 w-3.5 text-slate-400" /> {c.email}</div>
                  {c.phone && <div className="flex items-center text-sm font-medium"><Phone className="mr-2 h-3.5 w-3.5 text-slate-400" /> {c.phone}</div>}
                </TableCell>
                <TableCell className="p-6 text-right space-x-2">
                  <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 dark:hover:text-white" onClick={() => {
                    setEditingCustomer(c);
                    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', company: c.company || '', notes: c.notes || '' });
                    setIsAddOpen(true);
                  }}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-red-500" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if(!o) setEditingCustomer(null); }}>
        <DialogContent className="sm:max-w-[500px] rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingCustomer ? 'Edit' : 'Add'} Customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company</Label>
              <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="h-12 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full bg-slate-900 text-white rounded-2xl h-14 font-black uppercase tracking-widest">
              Save Customer Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientRevenueView({ payments, customers, projects, clientId }: { payments: ClientPayment[], customers: ClientCustomer[], projects: Project[], clientId: string }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    projectId: '',
    amount: 0,
    status: 'Paid' as ClientPayment['status'],
    description: ''
  });

  const handleAdd = async () => {
    if (!form.customerId || !form.amount) return;
    try {
      await addDoc(collection(db, 'clientPayments'), {
        ...form,
        clientId,
        currency: 'USD',
        createdAt: serverTimestamp()
      });
      setIsAddOpen(false);
      setForm({ customerId: '', projectId: '', amount: 0, status: 'Paid', description: '' });
      toast.success('Payment recorded');
    } catch (error) {
      console.error(error);
    }
  };

  const handleRefund = async (id: string) => {
    if (!confirm('Refund this payment?')) return;
    await updateDoc(doc(db, 'clientPayments', id), { status: 'Refunded' });
  };

  const totalRevenue = payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
  const totalRefunds = payments.filter(p => p.status === 'Refunded').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Revenue Laboratory</h2>
          <p className="text-slate-500 font-medium">Track your income, handle refunds, and manage your card processor activity.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white rounded-2xl h-12 px-6 font-black uppercase text-xs tracking-widest">
          <CreditCard className="mr-2 h-4 w-4" /> Record Sale
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="rounded-[2.5rem] bg-slate-900 text-white p-8 border-none shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Net Intake</p>
          <p className="text-5xl font-black leading-none">${(totalRevenue - totalRefunds).toLocaleString()}</p>
        </Card>
        <Card className="rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 border-slate-200 dark:border-slate-800 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Gross Sales</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">${totalRevenue.toLocaleString()}</p>
        </Card>
        <Card className="rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 border-slate-200 dark:border-slate-800 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Refunds Processed</p>
          <p className="text-3xl font-black text-red-500">-${totalRefunds.toLocaleString()}</p>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl overflow-hidden dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
            <TableRow className="border-none">
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Customer / Project</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Amount</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Status</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Date</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(p => {
              const customer = customers.find(c => c.id === p.customerId);
              const project = projects.find(pr => pr.id === p.projectId);
              return (
                <TableRow key={p.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <TableCell className="p-6">
                    <div className="font-bold text-slate-900 dark:text-white">{customer?.name || 'Unknown Customer'}</div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-widest">{project?.title || 'Direct Payment'}</div>
                  </TableCell>
                  <TableCell className="p-6">
                    <div className="font-black text-lg text-slate-900 dark:text-white tracking-tight">${p.amount.toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="p-6">
                    <Badge className={`font-black uppercase text-[9px] tracking-widest ${
                      p.status === 'Paid' ? 'bg-green-600' : p.status === 'Refunded' ? 'bg-red-500' : 'bg-slate-500'
                    }`}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-6 text-slate-500 font-medium font-mono text-xs">
                    {p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : '...'}
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    {p.status === 'Paid' && (
                      <Button variant="ghost" size="sm" className="text-red-500 font-black uppercase text-[10px] tracking-widest" onClick={() => handleRefund(p.id)}>
                        Refund Sale
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Record External Sale</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Customer</Label>
              <Select value={form.customerId} onValueChange={v => setForm({ ...form, customerId: v })}>
                <SelectTrigger className="h-12 rounded-xl text-xs font-bold uppercase tracking-widest"><SelectValue placeholder="Which customer paid?" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link to Project (Optional)</Label>
              <Select value={form.projectId} onValueChange={v => setForm({ ...form, projectId: v })}>
                <SelectTrigger className="h-12 rounded-xl text-xs font-bold uppercase tracking-widest"><SelectValue placeholder="Direct Payment" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">None (Direct)</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sale Amount (USD)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) })} className="h-14 text-2xl font-black rounded-2xl" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} className="w-full bg-slate-900 text-white rounded-2xl h-14 font-black uppercase tracking-widest">
              Confirm Record Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminOutreachView({ clients, user, sendNotification }: { clients: Client[], user: User, sendNotification: any }) {
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const toggleClient = (id: string) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSend = async () => {
    if (selectedClients.length === 0 || !message) return;
    setIsSending(true);
    try {
      for (const clientId of selectedClients) {
        const client = clients.find(c => c.id === clientId);
        if (client && client.uid) {
          await sendNotification(client.uid, subject || 'Message from Allie', message, 'message');
        }
      }
      toast.success('Messages sent successfully');
      setSelectedClients([]);
      setSubject('');
      setMessage('');
    } catch (error) {
      toast.error('Failed to send outreach');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white">Admin Outreach Suite</h2>
        <p className="text-slate-500 font-medium">Broadcast messages and notifications to your private clients.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="rounded-[2.5rem] border-slate-200 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="p-8">
            <CardTitle className="text-xl font-black">Compose Message</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-6">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Announcement Subject" className="h-12 rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Broadcast Content</Label>
              <textarea 
                className="w-full min-h-[200px] rounded-2xl border-2 border-slate-100 p-4 font-medium dark:border-slate-800 dark:bg-slate-950 focus:border-blue-500 outline-none transition-all"
                placeholder="Type your message here..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>
            <Button onClick={handleSend} disabled={isSending || selectedClients.length === 0} className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs">
              {isSending ? 'Sending Broadcast...' : `Dispatch to ${selectedClients.length} Recipients`}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-slate-200 shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col">
          <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-black">Recipeints</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedClients(selectedClients.length === clients.length ? [] : clients.map(c => c.id))} className="text-[10px] font-black uppercase tracking-widest">
              {selectedClients.length === clients.length ? 'Deselect All' : 'Select All'}
            </Button>
          </CardHeader>
          <CardContent className="px-8 pb-8 flex-1 overflow-auto max-h-[500px]">
            <div className="space-y-2">
              {clients.map(client => (
                <div 
                  key={client.id} 
                  onClick={() => toggleClient(client.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer border-2 transition-all ${
                    selectedClients.includes(client.id) ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-4">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{client.name}</p>
                      <p className="text-xs text-slate-500">{client.email}</p>
                    </div>
                  </div>
                  {selectedClients.includes(client.id) && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClientPortal({ user, client, projects, tasks, contracts, payments, vitals, scheduledSessions, leads, campaigns, clientCustomers, clientPayments, messages, notifications, sendNotification, onStartCall, incomingCall, onDismissCall, activeTab, setActiveTab, theme, toggleTheme, onOpenSearch }: { 
  user: User, 
  client: Client | null, 
  projects: Project[], 
  tasks: Task[],
  contracts: Contract[], 
  payments: Payment[], 
  vitals: Vital[],
  scheduledSessions: ScheduledSession[],
  leads: Lead[],
  campaigns: Campaign[],
  clientCustomers: ClientCustomer[],
  clientPayments: ClientPayment[],
  messages: Message[],
  notifications: Notification[],
  sendNotification: any,
  onStartCall: (callData: any) => void,
  incomingCall?: any,
  onDismissCall: (id?: string) => void,
  activeTab: string,
  setActiveTab: (tab: string) => void,
  theme: 'light' | 'dark',
  toggleTheme: () => void,
  onOpenSearch: () => void
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!client) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 rounded-full bg-slate-100 p-6">
          <Users className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Portal Not Linked</h2>
        <p className="mt-2 max-w-md text-slate-500">
          Your email ({user.email}) is not linked to a client profile in our system. 
          Please contact Allie at <a href={`mailto:${ADMIN_EMAILS[0]}`} className="text-blue-600 hover:underline">{ADMIN_EMAILS[0]}</a> to gain access.
        </p>
        <Button onClick={logOut} variant="outline" className="mt-8">
          Sign Out
        </Button>
      </div>
    );
  }

  const unreadMessagesCount = messages.filter(m => !m.read && m.senderId !== user.uid).length;
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  const handleTaskRequest = async (data: any) => {
    console.log('--- handleTaskRequest START ---', { data, clientId: client.id });
    try {
      if (!client?.id) {
        throw new Error('Client ID is missing. Portal may not be correctly linked.');
      }

      const taskData = {
        title: data.title,
        description: data.description || '',
        projectId: data.projectId || 'Global',
        clientId: client.id,
        clientName: client.name,
        status: 'Todo',
        dueDate: data.dueDate || '',
        createdAt: serverTimestamp(),
        createdBy: user.uid
      };

      console.log('Submitting task to Firestore:', taskData);
      const docRef = await addDoc(collection(db, 'tasks'), taskData);
      console.log('Task submitted SUCCESS:', docRef.id);

      await sendNotification(
        'ADMIN_GROUP',
        'New Task Requested',
        `${client.name} has requested a new task: ${data.title}`,
        'message'
      );
      toast.success('Task request submitted successfully');
    } catch (error) {
      console.error('CRITICAL: Error requesting task:', error);
      toast.error('Failed to submit task request');
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
      throw error;
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task request?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      toast.success('Task request deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks');
    }
  };

  const handleTaskUpdate = async (taskId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success('Task updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const NavItems = () => (
    <>
      <div className="space-y-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">Navigation</p>
        <SidebarLink 
          icon={<LayoutDashboard className="h-5 w-5" />} 
          label="Overview" 
          active={activeTab === 'overview'} 
          onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<Bell className="h-5 w-5" />} 
          label="Notifications" 
          active={activeTab === 'notifications'} 
          onClick={() => { setActiveTab('notifications'); setIsMobileMenuOpen(false); }} 
          badge={unreadNotificationsCount}
        />
        <SidebarLink 
          icon={<MessageCircle className="h-5 w-5" />} 
          label="Messages" 
          active={activeTab === 'messages'} 
          onClick={() => { setActiveTab('messages'); setIsMobileMenuOpen(false); }} 
          badge={unreadMessagesCount}
        />
      </div>

      <div className="pt-6 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">Project Hub</p>
        <SidebarLink 
          icon={<Briefcase className="h-5 w-5" />} 
          label="Products" 
          active={activeTab === 'projects'} 
          onClick={() => { setActiveTab('projects'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<FileText className="h-5 w-5" />} 
          label="Contracts" 
          active={activeTab === 'contracts'} 
          onClick={() => { setActiveTab('contracts'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<DollarSign className="h-5 w-5" />} 
          label="Payments" 
          active={activeTab === 'payments'} 
          onClick={() => { setActiveTab('payments'); setIsMobileMenuOpen(false); }} 
        />
      </div>

      <div className="pt-6 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">Resources</p>
        <SidebarLink 
          icon={<CheckSquare className="h-5 w-5" />} 
          label="Tasks" 
          active={activeTab === 'tasks'} 
          onClick={() => { setActiveTab('tasks'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<CheckSquare className="h-5 w-5" />} 
          label="Vitals" 
          active={activeTab === 'vitals'} 
          onClick={() => { setActiveTab('vitals'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<Calendar className="h-5 w-5" />} 
          label="Sessions" 
          active={activeTab === 'sessions'} 
          onClick={() => { setActiveTab('sessions'); setIsMobileMenuOpen(false); }} 
        />
      </div>

      <div className="pt-6 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">Growth</p>
        <SidebarLink 
          icon={<TrendingUp className="h-5 w-5" />} 
          label="Leads" 
          active={activeTab === 'leads'} 
          onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<Mail className="h-5 w-5" />} 
          label="Campaigns" 
          active={activeTab === 'campaigns'} 
          onClick={() => { setActiveTab('campaigns'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<Users className="h-5 w-5" />} 
          label="Customers" 
          active={activeTab === 'customers'} 
          onClick={() => { setActiveTab('customers'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<CreditCard className="h-5 w-5" />} 
          label="Revenue" 
          active={activeTab === 'revenue'} 
          onClick={() => { setActiveTab('revenue'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarLink 
          icon={<Sparkles className="h-5 w-5" />} 
          label="AI Tools" 
          active={activeTab === 'marketing'} 
          onClick={() => { setActiveTab('marketing'); setIsMobileMenuOpen(false); }} 
        />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop & Mobile */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col items-center border-b border-slate-100 px-6 py-6 dark:border-slate-800">
          <motion.button 
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            animate={{ 
              y: [0, -4, 0],
              filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"]
            }}
            transition={{ 
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              filter: { duration: 5, repeat: Infinity, ease: "easeInOut" }
            }}
            className="mb-4"
          >
            <img 
              src={theme === 'dark' ? LOGO_DARK : LOGO_LIGHT} 
              alt="Ambix Allie Logo" 
              className="h-32 w-32 object-contain" 
              referrerPolicy="no-referrer" 
            />
          </motion.button>
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <span className="font-black tracking-tight text-lg uppercase">Client Portal</span>
          </div>
          <div className="mt-4 w-full">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          </div>
        </div>
        <div className="h-[calc(100vh-64px)] overflow-y-auto px-4 py-8">
          <NavItems />
        </div>
      </aside>

      {/* Content wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="mr-4 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div 
              onClick={onOpenSearch}
              className="hidden md:flex items-center space-x-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-500 transition-all text-slate-400 min-w-[200px]"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs font-medium">Search portal...</span>
              <kbd className="hidden lg:inline-flex h-5 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900">⌘K</kbd>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="hidden md:flex items-center space-x-1 px-3 py-1 bg-slate-100 rounded-full dark:bg-slate-800">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight dark:text-slate-400">System Online</span>
            </div>

            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

            <NotificationBell 
              notifications={notifications} 
              setActiveTab={setActiveTab} 
              onStartCall={(data) => onStartCall(data)} 
              onDismissCall={(id) => onDismissCall(id)}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer">
                  <div className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden dark:border-slate-800 dark:bg-slate-800">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">{client.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{user.email}</p>
                  </div>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <div className="flex items-center space-x-3 p-3 mb-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                   <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center dark:bg-slate-700">
                     <Users className="h-5 w-5 text-slate-500" />
                   </div>
                   <div className="flex-1 overflow-hidden">
                     <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{client.name}</p>
                     <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                   </div>
                </div>
                <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">Quick Links</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setActiveTab('overview')} className="rounded-md">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Overview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('messages')} className="rounded-md">
                  <MessageCircle className="mr-2 h-4 w-4" /> Messages
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('sessions')} className="rounded-md">
                  <Calendar className="mr-2 h-4 w-4" /> Schedule Session
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem onClick={logOut} className="text-red-600 dark:text-red-400 focus:text-red-600 rounded-md">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="mx-auto w-full max-w-7xl">
            <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center space-x-5">
                <motion.button 
                  onClick={() => setActiveTab('overview')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    y: [0, -6, 0]
                  }}
                  transition={{ 
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    default: { duration: 0.5 }
                  }}
                  className="flex h-32 w-32 items-center justify-center group cursor-pointer"
                >
                  <img 
                    src={theme === 'dark' ? LOGO_DARK : LOGO_LIGHT} 
                    alt="Ambix Allie" 
                    className="h-full w-full object-contain transition-transform duration-700 group-hover:rotate-12"
                    referrerPolicy="no-referrer"
                  />
                </motion.button>
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Ambix Allie</h1>
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Hub Active</span>
                  </div>
                </div>
              </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">

          <TabsContent value="tasks" className="space-y-8">
            <ClientTaskRequestsView 
              tasks={tasks} 
              projects={projects} 
              clientId={client.id} 
              clientName={client.name} 
              onRequested={handleTaskRequest} 
              onUpdate={handleTaskUpdate}
              onDelete={handleTaskDelete}
            />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-8">
            <NotificationsView 
              notifications={notifications} 
              setActiveTab={setActiveTab} 
              onStartCall={(data) => onStartCall(data)} 
            />
          </TabsContent>

          <TabsContent value="overview" className="space-y-8">
            {incomingCall && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden"
              >
                <Card className="border-blue-200 bg-blue-50 shadow-lg dark:border-blue-900/50 dark:bg-blue-950/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-200 flex items-center">
                      <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                        <Video className="h-4 w-4 text-white animate-pulse" />
                      </div>
                      Live Session in Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-blue-800 dark:text-blue-300">Allie is waiting for you in a live video session.</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Join now to review your project details and next steps.</p>
                    </div>
                    <div className="flex space-x-3 w-full sm:w-auto">
                      <Button 
                        variant="outline"
                        className="flex-1 sm:flex-initial border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-400"
                        onClick={() => updateDoc(doc(db, 'calls', incomingCall.id), { status: 'dismissed' })}
                      >
                        Ignore
                      </Button>
                      <Button 
                        size="lg" 
                        className="flex-1 sm:flex-initial bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none"
                        onClick={() => onStartCall({ callId: incomingCall.id })}
                      >
                        Join Call Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Action Items Section */}
            {(contracts.filter(c => c.status === 'Sent').length > 0 || payments.filter(p => (p as any).status === 'Pending').length > 0) && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Action Required</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {contracts.filter(c => c.status === 'Sent').map(contract => (
                    <Card key={contract.id} className="border-amber-100 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900/30">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center dark:bg-amber-900/50">
                            <FileText className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold dark:text-white">Contract Signature Needed</p>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{contract.title}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => setActiveTab('contracts')} className="bg-amber-600 hover:bg-amber-700 text-white border-none text-xs">
                          Sign Now
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {payments.filter(p => p.status === 'Pending').map(payment => (
                    <Card key={payment.id} className="border-indigo-100 bg-indigo-50/30 dark:bg-indigo-950/10 dark:border-indigo-900/30">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center dark:bg-indigo-900/50">
                            <DollarSign className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold dark:text-white">Payment Due</p>
                            <p className="text-xs text-slate-500">${payment.amount.toLocaleString()}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => setActiveTab('payments')} className="bg-indigo-600 hover:bg-indigo-700 text-white border-none text-xs">
                          Pay Now
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
              <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Briefcase className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Procucts</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <h4 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{projects.length}</h4>
                  <span className="text-xs font-medium text-green-600">{projects.filter(p => p.status === 'Completed').length} Completed</span>
                </div>
              </div>

              <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">In Progress</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <h4 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{projects.filter(p => p.status === 'In Progress' || p.status === 'Planning').length}</h4>
                  <span className="text-xs font-medium text-blue-600">Active Pipeline</span>
                </div>
              </div>

              <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Sessions</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <h4 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{scheduledSessions.filter(s => s.status === 'Accepted').length}</h4>
                  <span className="text-xs font-medium text-emerald-600">Upcoming</span>
                </div>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 dark:border-slate-800">
                  <CardTitle className="text-lg font-bold dark:text-white">Recent Activity</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('projects')} className="text-xs text-blue-600">View All</Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-50 dark:divide-slate-800">
                    {projects.length > 0 ? projects.slice(0, 4).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-transparent hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/50">
                        <div className="flex items-center space-x-3">
                           <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center dark:bg-slate-800">
                             <Box className="h-5 w-5 text-slate-500" />
                           </div>
                           <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{p.title}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.type}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-bold dark:bg-slate-800 dark:text-slate-300">
                          {p.status}
                        </Badge>
                      </div>
                    )) : (
                      <div className="p-8 text-center">
                        <p className="text-sm text-slate-500">No activity yet.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-slate-900 bg-slate-900 text-white rounded-3xl shadow-xl dark:bg-slate-950 dark:border-slate-800">
                  <CardHeader>
                    <div className="flex items-center space-x-3 mb-2">
                       <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center animate-pulse">
                         <Star className="h-5 w-5 text-white" />
                       </div>
                       <div>
                         <CardTitle className="text-lg font-bold">Priority Support</CardTitle>
                         <CardDescription className="text-slate-400 text-xs">Direct access to Allie</CardDescription>
                       </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Need help or have a question? You can reach out directly via messages or book a live session.
                    </p>
                    <div className="flex flex-col space-y-2">
                       <Button onClick={() => setActiveTab('messages')} className="bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                         <MessageCircle className="mr-2 h-4 w-4" /> Send Message
                       </Button>
                       <ScheduleSessionDialog 
                        clientId={client.id} 
                        clientName={client.name} 
                        onScheduled={async (data) => {
                          try {
                            const sessionData = {
                              clientId: client.id,
                              clientName: client.name,
                              title: data.title,
                              startTime: data.startTime.toISOString(),
                              duration: data.duration,
                              status: 'Requested',
                              createdAt: serverTimestamp(),
                              createdBy: user.uid
                            };
                            await addDoc(collection(db, 'scheduledSessions'), sessionData);
                            await sendNotification(
                              ADMIN_EMAILS[0],
                              'New Session Request',
                              `${client.name} has requested a session: ${data.title}`,
                              'session'
                            );
                            toast.success('Session request sent to Allie');
                          } catch (error) {
                            console.error('Error scheduling session:', error);
                            toast.error('Failed to request session');
                          }
                        }} 
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between p-6 rounded-3xl bg-blue-600 text-white shadow-lg overflow-hidden relative group cursor-pointer" onClick={() => setActiveTab('vitals')}>
                   <div className="relative z-10">
                     <p className="text-xs font-bold uppercase tracking-widest opacity-80">Health Check</p>
                     <h5 className="text-xl font-bold mt-1">Submit Your Vitals</h5>
                     <p className="text-xs opacity-70 mt-1 flex items-center">
                       Keep your project on track <ArrowRight className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                     </p>
                   </div>
                   <div className="relative z-10 h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                     <CheckSquare className="h-6 w-6" />
                   </div>
                   <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-all"></div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map(project => (
                <Card key={project.id} className="border-slate-200 shadow-sm overflow-hidden flex flex-col dark:border-slate-800 dark:bg-slate-900 rounded-[2rem] transition-all hover:shadow-xl hover:translate-y-[-4px]">
                  <div className="h-40 bg-slate-50 dark:bg-slate-950 flex items-center justify-center border-b border-slate-100 dark:border-slate-800 relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Briefcase className="h-16 w-16 text-slate-200 dark:text-slate-800 group-hover:scale-110 transition-transform duration-500" />
                    <Badge className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-slate-900 border-slate-100 font-black uppercase text-[9px] tracking-widest px-3 py-1 dark:bg-slate-900/90 dark:text-slate-100 dark:border-slate-800 shadow-sm">
                      {project.paymentStatus?.toUpperCase() || 'NOT PAID'}
                    </Badge>
                  </div>
                  <CardHeader className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest dark:border-slate-700 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 px-2.5 py-0.5">{project.type}</Badge>
                      <Badge className={`font-black uppercase text-[10px] tracking-widest px-2.5 py-0.5 ${
                        project.status === 'In Progress' ? 'bg-green-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      }`}>{project.status}</Badge>
                    </div>
                    <CardTitle className="text-xl font-black text-slate-900 dark:text-white leading-tight">{project.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 pt-0 flex-1 flex flex-col">
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 font-medium leading-relaxed">{project.description || 'No description provided.'}</p>
                    <div className="mt-6 pt-5 border-t border-slate-50 dark:border-slate-800 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Budget</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight">${project.budget?.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Paid Amount</p>
                        <p className="text-lg font-black text-green-600 dark:text-green-400 tracking-tight">${project.totalPaid?.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                    {project.liveUrl && (
                      <Button 
                        render={<a href={project.liveUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="w-full h-full flex items-center justify-center" />}
                        className="w-full h-11 bg-slate-900 text-white hover:bg-slate-800 mt-6 rounded-xl font-black uppercase tracking-widest text-xs dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md hover:shadow-lg transition-all"
                      >
                        View Live Instance
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 rounded-[2rem] overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-sm">
                  <TableRow className="dark:border-slate-800 border-none">
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-8">Contract Details</TableHead>
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-8">Status</TableHead>
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-8">Date Published</TableHead>
                    <TableHead className="text-right dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(contract => (
                    <TableRow key={contract.id} className="dark:border-slate-800/50 border-slate-100 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <TableCell className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-slate-500" />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white text-base">{contract.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-8 py-5">
                        <Badge variant={contract.status === 'Signed' ? 'default' : 'outline'} className={`font-black uppercase text-[9px] tracking-widest px-3 py-1 rounded-full ${contract.status === 'Signed' ? 'bg-green-600' : 'dark:border-slate-700 dark:text-slate-400'}`}>
                          {contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 py-5 text-slate-500 text-sm dark:text-slate-400 font-medium font-mono">
                        {contract.createdAt?.seconds ? new Date(contract.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Pending...'}
                      </TableCell>
                      <TableCell className="px-8 py-5 text-right space-x-2">
                        {contract.status === 'Sent' && (
                          <ContractSigningDialog 
                            contract={contract} 
                            onSign={async (signingData) => {
                              try {
                                await updateDoc(doc(db, 'contracts', contract.id), {
                                  ...signingData,
                                  status: 'Signed',
                                  signedAt: serverTimestamp(),
                                  dateSigned: new Date().toISOString().split('T')[0]
                                });
                                
                                await sendNotification(
                                  ADMIN_EMAILS[0],
                                  'Contract Signed',
                                  `${client.name} has signed the contract: ${contract.title}`,
                                  'contract'
                                );
                                toast.success('Contract Signed Electronically');
                              } catch (error) {
                                console.error('Error signing contract:', error);
                              }
                            }}
                          />
                        )}
                        {contract.fileUrl && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            render={<a href={contract.fileUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="w-full h-full flex items-center justify-center" />}
                            className="rounded-xl font-black uppercase text-[10px] tracking-widest dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 shadow-sm"
                          >
                            Download PDF
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {contracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-24 text-slate-400 dark:text-slate-400">
                        <div className="flex flex-col items-center">
                          <FileText className="h-12 w-12 mb-4 opacity-10" />
                          <p className="font-black text-lg tracking-tight">No Contracts Published</p>
                          <p className="text-xs uppercase tracking-widest mt-1 opacity-60">Allie will post agreements here for you</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden rounded-3xl">
              <Table>
                <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-sm">
                  <TableRow className="dark:border-slate-800 border-none">
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-6">Date</TableHead>
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-6">Product</TableHead>
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-6">Type</TableHead>
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-6">Amount</TableHead>
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-6">Status</TableHead>
                    <TableHead className="dark:text-slate-400 font-black uppercase text-[10px] tracking-widest py-5 px-6">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow key={payment.id} className="dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-slate-100">
                      <TableCell className="text-slate-500 text-sm dark:text-slate-400 font-medium px-6">{payment.date}</TableCell>
                      <TableCell className="font-bold text-slate-900 dark:text-white px-6">{payment.projectTitle}</TableCell>
                      <TableCell className="px-6"><Badge variant="outline" className="text-[10px] font-black dark:border-slate-700 dark:text-slate-400 tracking-wider">{(payment.type || 'Standard').toUpperCase()}</Badge></TableCell>
                      <TableCell className="font-black text-slate-900 dark:text-white px-6 text-base">${payment.amount.toLocaleString()}</TableCell>
                      <TableCell className="px-6">
                        <Badge className={`font-black tracking-widest text-[9px] px-2 py-0.5 rounded-full ${
                          payment.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                          payment.status === 'Overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {payment.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[200px] truncate dark:text-slate-400 font-medium italic px-6" title={payment.notes}>
                        {payment.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-24 text-slate-400 dark:text-slate-400">
                        <div className="flex flex-col items-center">
                          <CheckCircle2 className="h-12 w-12 mb-4 opacity-10" />
                          <p className="font-black text-lg tracking-tight">No Financial Records</p>
                          <p className="text-xs uppercase tracking-widest mt-1 opacity-60">All clear on your side</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="vitals" className="space-y-6">
            <div className="grid gap-6">
              {vitals.map(v => (
                <Card key={v.id} className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 rounded-[2.5rem] overflow-hidden transition-all hover:shadow-xl hover:translate-y-[-2px] duration-300">
                  <header className="px-8 pt-8 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em] font-black dark:border-slate-700 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/30">{v.category || 'System'}</Badge>
                    <Badge variant={v.status === 'Provided' ? 'default' : 'outline'} className={`font-black tracking-widest text-[9px] px-3 py-1 rounded-full ${v.status === 'Pending' ? 'animate-pulse bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : v.status === 'Provided' ? 'bg-blue-600 text-white' : 'dark:border-slate-700 dark:text-slate-400'}`}>
                      {v.status.toUpperCase()}
                    </Badge>
                  </header>
                  <CardHeader className="pt-4 px-8">
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{v.title}</CardTitle>
                    {v.instructions && (
                      <div className="mt-4 flex items-start space-x-4 text-sm text-slate-600 bg-slate-50/80 p-5 rounded-2xl ring-1 ring-slate-100 dark:bg-slate-950 dark:ring-slate-800 dark:text-slate-400 transition-colors">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                          <HelpCircle className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <span className="font-black text-slate-900 dark:text-user-accent uppercase text-[10px] tracking-widest block mb-1">Vital Instructions</span>
                          <p className="leading-relaxed font-medium">{v.instructions}</p>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="px-8 pb-8 pt-2">
                    {v.status === 'Pending' ? (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`vital-${v.id}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400 mb-1 ml-1">Secure Vault Entry</Label>
                          <textarea 
                            id={`vital-${v.id}`}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-white px-5 py-4 text-sm transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none min-h-[140px] dark:border-slate-800 dark:bg-slate-950 dark:text-white placeholder:text-slate-400 font-medium"
                            placeholder="Safely paste the requested credentials or technical details here..."
                            onBlur={async (e) => {
                              const val = e.target.value;
                              if (!val) return;
                              if (confirm('Verify: Move this information to the secure vault? Only Allie will have access.')) {
                                try {
                                  await updateDoc(doc(db, 'vitals', v.id), {
                                    value: val,
                                    status: 'Provided',
                                    updatedAt: serverTimestamp()
                                  });
                                  toast.success('Successfully Vaulted');
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, 'vitals');
                                }
                              }
                            }}
                          />
                          <p className="text-[10px] text-slate-400 italic px-1">Your data is stored in an encrypted Firestore collection accessible only by authenticated staff.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-1 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-800">
                        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 shadow-inner">
                          <p className="text-[10px] text-slate-400 uppercase font-black mb-3 tracking-[0.2em] dark:text-slate-400">Encrypted Record</p>
                          <div className="relative">
                            <p className="text-sm text-slate-700 leading-relaxed font-mono break-all dark:text-slate-300 py-3 border-l-4 border-blue-500 pl-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-r-lg">
                              {v.value}
                            </p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-4 h-9 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-all"
                              onClick={() => {
                                const newVal = prompt('Edit vaulted record:', v.value);
                                if (newVal !== null && newVal !== v.value) {
                                  updateDoc(doc(db, 'vitals', v.id), {
                                    value: newVal,
                                    updatedAt: serverTimestamp()
                                  });
                                  toast.success('Vault Updated');
                                }
                              }}
                            >
                              <Edit3 className="mr-2 h-3.5 w-3.5" /> Modify Record
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {vitals.length === 0 && (
                <div className="text-center py-32 rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/30 text-slate-400 dark:border-slate-800 dark:bg-slate-900/20">
                  <div className="mx-auto w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-xl shadow-slate-100 dark:bg-slate-800 dark:shadow-none">
                    <ShieldCheck className="h-10 w-10 text-slate-200 dark:text-slate-400" />
                  </div>
                  <h3 className="font-black text-2xl text-slate-900 dark:text-white mb-2 tracking-tight">Security Clear</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs mx-auto">No technical vitals or credentials have been requested for your active projects.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <SessionsView sessions={scheduledSessions} clients={client ? [client] : []} user={user} role="client" onStartCall={onStartCall} sendNotification={sendNotification} isClientView={true} />
          </TabsContent>

          <TabsContent value="leads" className="space-y-6">
            <LeadsView leads={leads.filter(l => l.clientId === client.id)} clients={[client]} user={user} />
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <CampaignsView campaigns={campaigns.filter(c => c.clientId === client.id)} clients={[client]} user={user} />
          </TabsContent>

          <TabsContent value="marketing" className="space-y-6">
            <MarketingToolsView clientId={client.id} client={client} />
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <ClientCustomersView customers={clientCustomers} clientId={client.id} clientName={client.name} />
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <ClientRevenueView payments={clientPayments} customers={clientCustomers} projects={projects} clientId={client.id} />
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <ChatWindowWrapper 
              messages={messages} 
              clientId={client.id} 
              user={user} 
              clientName={client.name}
            />
          </TabsContent>
        </Tabs>

        <footer className="mt-12 border-t border-slate-200 py-8 dark:border-slate-800">
          <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">© 2026 Ambix Allie CRM. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </main>

    {/* Floating Call Invitation */}
    <AnimatePresence>
      {incomingCall && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm px-4 sm:px-0">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="rounded-2xl border border-blue-200 bg-white p-6 shadow-2xl shadow-blue-200/50 dark:border-blue-900 dark:bg-slate-900 dark:shadow-none"
          >
            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white animate-pulse">
                <Video className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Live Session Invitation</h3>
                <p className="mt-1 text-sm text-slate-500 italic dark:text-slate-400">
                  Allie is inviting you to a live video session right now.
                </p>
                <div className="mt-4 flex space-x-3">
                  <Button 
                    className="flex-1 bg-blue-600 text-white hover:bg-blue-700" 
                    onClick={() => onStartCall({ callId: incomingCall.id, clientName: 'Allie (Host)' })}
                  >
                    Join Now
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                    onClick={() => onDismissCall(incomingCall.id)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
</div>
  );
}

export default function App() {
  console.log('App root rendering...');
  return (
    <ErrorBoundary>
      <CRMApp />
      <Toaster position="top-right" expand={true} richColors />
    </ErrorBoundary>
  );
}

