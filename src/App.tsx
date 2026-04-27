/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where, limit, Timestamp } from 'firebase/firestore';
import { auth, db, signIn, logOut, signUpWithEmail, signInWithEmail, resetPassword, OperationType, handleFirestoreError } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster, toast } from 'sonner';
import { VideoCall } from './components/VideoCall';

const ADMIN_EMAILS = ['allie.pakele@gmail.com', 'allie@vibesandvolumes.com'];

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, LogOut, LayoutDashboard, Users, Briefcase, CheckSquare, Trash2, Search, Filter, Mail, Phone, Calendar, DollarSign, Video, FileText, CreditCard, MessageCircle, ExternalLink, Clock, Timer, Send, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
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
  uid?: string; // Linked Firebase UID
  createdAt: any;
  createdBy: string;
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
  projectId: string;
  status: 'Todo' | 'In Progress' | 'Done';
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
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'message' | 'session' | 'contract' | 'payment';
  link?: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');

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
  const [activeCall, setActiveCall] = useState<{ clientId?: string, clientName?: string, callId?: string, sessionId?: string } | null>(null);

  const handleCallCreated = async (callId: string) => {
    if (activeCall?.sessionId) {
      try {
        await updateDoc(doc(db, 'scheduledSessions', activeCall.sessionId), {
           callId,
           status: 'Active'
        });
      } catch (error) {
        console.error('Error updating session with callId:', error);
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
      if (latest.id !== lastNotificationId) {
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
    if (!user || !role) return;

    // Only listen for calls from the last 10 minutes to avoid stale calls
    const tenMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 1000));
    
    const callsQuery = role === 'admin' 
      ? query(collection(db, 'calls'), where('status', '==', 'pending'), where('createdAt', '>=', tenMinutesAgo), orderBy('createdAt', 'desc'), limit(1))
      : (linkedClient ? query(collection(db, 'calls'), where('clientId', '==', linkedClient.id), where('status', '==', 'pending'), where('createdAt', '>=', tenMinutesAgo), orderBy('createdAt', 'desc'), limit(1)) : null);

    if (!callsQuery) return;

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as any;
        const callData = { id: snapshot.docs[0].id, ...data };
        // Don't show if we created it
        if (callData.createdBy !== user.uid) {
          setIncomingCall(callData);
          toast.info('Incoming Video Call', {
            description: 'A live session has started.',
            duration: 10000,
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
    });

    return () => unsubscribe();
  }, [user, role, linkedClient]);

  // Data Listeners
  useEffect(() => {
    if (!user || !role) return;

    let unsubscribes: (() => void)[] = [];

    if (role === 'admin') {
      const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(clientsQuery, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients')));

      const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(projectsQuery, (snapshot) => {
        setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects')));

      const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(tasksQuery, (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks')));

      const paymentsQuery = query(collection(db, 'payments'), orderBy('date', 'desc'));
      unsubscribes.push(onSnapshot(paymentsQuery, (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments')));

      const sessionsQuery = query(collection(db, 'scheduledSessions'), orderBy('startTime', 'asc'));
      unsubscribes.push(onSnapshot(sessionsQuery, (snapshot) => {
        setScheduledSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledSession)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'scheduledSessions')));

      const messagesQuery = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
      unsubscribes.push(onSnapshot(messagesQuery, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages')));

      const notificationsQuery = query(collection(db, 'notifications'), where('userId', 'in', [user.uid, 'ADMIN_GROUP']), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(notificationsQuery, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')));

      const templatesQuery = query(collection(db, 'contractTemplates'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(templatesQuery, (snapshot) => {
        setContractTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'contractTemplates')));
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
  useEffect(() => {
    if (role === 'admin' && contractTemplates.length === 0) {
      const ndaExists = contractTemplates.some(t => t.title === 'Mutual Non-Disclosure Agreement');
      if (!ndaExists) {
        const seedNDA = async () => {
          try {
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
          } catch (error) {
            console.error('Error seeding NDA template:', error);
          }
        };
        seedNDA();
      }
    }
  }, [role, contractTemplates]);

  // Client Specific Listeners
  useEffect(() => {
    if (!user || role !== 'client' || !linkedClient) return;

    const projectsQuery = query(collection(db, 'projects'), where('clientId', '==', linkedClient.id));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));

    const contractsQuery = query(collection(db, 'contracts'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeContracts = onSnapshot(contractsQuery, (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'contracts'));

    const paymentsQuery = query(collection(db, 'payments'), where('clientId', '==', linkedClient.id), orderBy('date', 'desc'));
    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    const vitalsQuery = query(collection(db, 'vitals'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeVitals = onSnapshot(vitalsQuery, (snapshot) => {
      setVitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vital)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'vitals'));

    const messagesQuery = query(collection(db, 'messages'), where('clientId', '==', linkedClient.id), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));

    const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    const sessionsQuery = query(collection(db, 'scheduledSessions'), where('clientId', '==', linkedClient.id), orderBy('startTime', 'asc'));
    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      setScheduledSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledSession)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'scheduledSessions'));

    return () => {
      unsubscribeProjects();
      unsubscribeContracts();
      unsubscribePayments();
      unsubscribeVitals();
      unsubscribeMessages();
      unsubscribeNotifications();
      unsubscribeSessions();
    };
  }, [user, role, linkedClient]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (role === 'client') {
    return (
      <div className="min-h-screen bg-slate-50">
        <ClientPortal 
          user={user} 
          client={linkedClient} 
          projects={projects} 
          contracts={contracts} 
          payments={payments} 
          vitals={vitals}
          scheduledSessions={scheduledSessions}
          messages={messages}
          notifications={notifications}
          sendNotification={sendNotification}
          onStartCall={setActiveCall}
          incomingCall={incomingCall}
          activeTab={activeTab === 'dashboard' ? 'overview' : activeTab} // Safely map dashboard to overview for client
          setActiveTab={setActiveTab}
        />
        {activeCall && (
          <VideoCall 
            clientId={activeCall.clientId} 
            clientName={activeCall.clientName} 
            callId={activeCall.callId}
            user={user} 
            onClose={() => setActiveCall(null)} 
            isAdmin={role === 'admin'}
            onCallCreated={handleCallCreated}
          />
        )}
        <Toaster position="top-right" expand={true} richColors />
      </div>
    );
  }

  const unreadMessagesCount = messages.filter(m => !m.read && m.senderId !== user.uid).length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center border-bottom border-slate-100 px-6">
          <Briefcase className="mr-2 h-6 w-6 text-slate-900" />
          <span className="text-lg font-bold tracking-tight text-slate-900">Ambix Allie</span>
        </div>
        <nav className="mt-6 space-y-1 px-3">
          <SidebarLink 
            icon={<LayoutDashboard className="h-5 w-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
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
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <NotificationBell notifications={notifications} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-900 truncate w-24">{user.displayName || user.email?.split('@')[0]}</span>
                <span className="text-[10px] text-slate-500 truncate w-24">{user.email}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logOut} className="text-slate-400 hover:text-red-600">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-8">
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

          {activeTab === 'dashboard' && <DashboardView clients={clients} projects={projects} tasks={tasks} sessions={scheduledSessions} onStartCall={setActiveCall} incomingCall={incomingCall} setActiveTab={setActiveTab} />}
          {activeTab === 'notifications' && <NotificationsView notifications={notifications} />}
          {activeTab === 'clients' && <ClientsView clients={clients} user={user} onStartCall={setActiveCall} sendNotification={sendNotification} />}
          {activeTab === 'projects' && <ProjectsView projects={projects} clients={clients} user={user} onStartCall={setActiveCall} />}
          {activeTab === 'tasks' && <TasksView tasks={tasks} projects={projects} clients={clients} user={user} onStartCall={setActiveCall} />}
          {activeTab === 'payments' && <PaymentsAnalyticsView payments={payments} clients={clients} projects={projects} />}
          {activeTab === 'sessions' && <SessionsView sessions={scheduledSessions} clients={clients} user={user} role={role} onStartCall={setActiveCall} sendNotification={sendNotification} />}
          {activeTab === 'messages' && <MessagesView messages={messages} clients={clients} user={user} />}
          {activeTab === 'templates' && <ContractTemplatesView templates={contractTemplates} clients={clients} user={user} sendNotification={sendNotification} />}
        </AnimatePresence>
      </main>

      {activeCall && (
        <VideoCall 
          clientId={activeCall.clientId} 
          clientName={activeCall.clientName} 
          callId={activeCall.callId}
          user={user} 
          onClose={() => setActiveCall(null)} 
          isAdmin={role === 'admin'}
          onCallCreated={handleCallCreated}
        />
      )}
      <Toaster position="top-right" expand={true} richColors />
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Contract Templates</h2>
          <p className="text-slate-500 text-sm">Manage reusable legal documents and send them to clients.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white">
          <Plus className="mr-2 h-4 w-4" /> Create Template
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <Card key={template.id} className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg font-bold">{template.title}</CardTitle>
              <CardDescription className="line-clamp-3 text-xs">
                {template.content}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <div className="p-6 pt-0 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => {
                  setEditingTemplate(template);
                  setForm({ title: template.title, content: template.content });
                  setIsAddOpen(true);
                }}
              >
                Edit
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
              <Label>Contract Content</Label>
              <textarea 
                className="min-h-[300px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="Enter contract text here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-slate-900 text-white">Save Template</Button>
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
                className="min-h-[300px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"
      >
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
            <Briefcase className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? 'Sign in to access your portal.' : mode === 'signup' ? 'Join Ambix Allie CRM.' : 'Enter your email to reset your password.'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-green-50 p-3 text-xs text-green-600 border border-green-100">
            {message}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          {mode !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => setMode('forgot')}
                    className="text-xs text-blue-600 hover:underline"
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
              />
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 py-4 text-white hover:bg-slate-800"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-500">Or continue with</span>
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
          className="w-full border-slate-200 py-4 hover:bg-slate-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="mr-2 h-4 w-4" />
          Google
        </Button>

        <div className="text-center text-sm text-slate-500">
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

function SidebarLink({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active 
          ? 'bg-slate-900 text-white shadow-sm' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center">
        <span className="mr-3">{icon}</span>
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          active ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
        }`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-slate-900" />}>
        <div className="relative">
          <Mail className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>Stay updated with your latest activity.</DialogDescription>
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
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${n.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'}`}
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-[10px] uppercase">{n.type}</Badge>
                      {!n.read && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                  <h4 className="mt-1 font-bold text-sm text-slate-900">{n.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function NotificationsView({ notifications }: { notifications: Notification[] }) {
  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
        <p className="text-slate-500">Stay updated with your latest activity.</p>
      </header>

      <div className="grid gap-4">
        {notifications.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
            <div className="mb-4 rounded-full bg-slate-50 p-4">
              <Bell className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Notifications</h3>
            <p className="text-slate-500">When you have updates, they will appear here.</p>
          </Card>
        ) : (
          notifications.map(n => (
            <Card 
              key={n.id} 
              className={`transition-all cursor-pointer hover:shadow-md ${n.read ? 'bg-white opacity-80' : 'bg-white border-l-4 border-l-blue-500'}`}
              onClick={() => markAsRead(n.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2">
                      <Badge variant={n.read ? 'outline' : 'default'} className="text-[10px] uppercase">
                        {n.type}
                      </Badge>
                      {!n.read && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px]">NEW</Badge>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-900">{n.title}</h4>
                    <p className="text-sm text-slate-500">{n.message}</p>
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

function DashboardView({ clients, projects, tasks, sessions, onStartCall, incomingCall, setActiveTab }: { clients: Client[], projects: Project[], tasks: Task[], sessions: ScheduledSession[], onStartCall: (callData: any) => void, incomingCall?: any, setActiveTab: (tab: string) => void }) {
  const activeProjects = projects.filter(p => p.status !== 'Completed');
  const pendingTasks = tasks.filter(t => t.status !== 'Done');
  const sessionRequests = sessions.filter(s => s.status === 'Requested');
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview of Ambix Allie's current operations.</p>
      </header>

      {incomingCall && (
        <Card className="border-blue-200 bg-blue-50 shadow-md animate-pulse">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-blue-900 flex items-center">
              <Video className="mr-2 h-5 w-5 animate-bounce" /> Live Session Started!
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800">A client is waiting for you in a live video room.</p>
              <p className="text-xs text-blue-600 mt-1">Join now to start the session.</p>
            </div>
            <Button 
              size="lg" 
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
              onClick={() => onStartCall({ callId: incomingCall.id })}
            >
              Join Session
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard title="Total Clients" value={clients.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active Projects" value={activeProjects.length} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Pending Tasks" value={pendingTasks.length} icon={<CheckSquare className="h-5 w-5" />} />
        <StatCard title="Session Requests" value={sessionRequests.length} icon={<Video className="h-5 w-5" />} />
      </div>

      {sessionRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-amber-900 flex items-center">
              <Clock className="mr-2 h-5 w-5" /> Pending Session Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessionRequests.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.clientName} • {new Date(s.startTime).toLocaleString()}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      className="bg-slate-900 text-white"
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
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Projects</CardTitle>
            <CardDescription>Latest project updates across all types.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.slice(0, 5).map(project => (
                <div key={project.id} className="flex items-center justify-between border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{project.title}</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-slate-500">{project.clientName} • {project.type}</p>
                      {clients.find(c => c.id === project.clientId) && (
                        <div className="flex space-x-1.5">
                          <a 
                            href={`mailto:${clients.find(c => c.id === project.clientId)?.email}`}
                            className="text-slate-300 hover:text-blue-500 transition-colors"
                            title="Email"
                          >
                            <Mail className="h-2.5 w-2.5" />
                          </a>
                          {clients.find(c => c.id === project.clientId)?.phone && (
                            <a 
                              href={`tel:${clients.find(c => c.id === project.clientId)?.phone}`}
                              className="text-slate-300 hover:text-green-500 transition-colors"
                              title="Call"
                            >
                              <Phone className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                    {project.status}
                  </Badge>
                </div>
              ))}
              {projects.length === 0 && <p className="text-center text-sm text-slate-400 py-4">No projects yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Upcoming Tasks</CardTitle>
            <CardDescription>Critical tasks requiring immediate attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.filter(t => t.status !== 'Done').slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <div className={`h-2 w-2 rounded-full ${task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">Due: {task.dueDate || 'No date'}</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none">
                    {task.status}
                  </Badge>
                </div>
              ))}
              {tasks.filter(t => t.status !== 'Done').length === 0 && <p className="text-center text-sm text-slate-400 py-4">All tasks completed!</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex items-center p-6">
        <div className="mr-4 rounded-xl bg-slate-100 p-3 text-slate-900">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientsView({ clients, user, onStartCall, sendNotification }: { clients: Client[], user: User, onStartCall: (callData: any) => void, sendNotification: any }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [managingClient, setManagingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    contactPerson: '', 
    company: '', 
    email: '', 
    phone: '', 
    industry: 'Creative' as const, 
    status: 'Lead' as const,
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clients</h1>
          <p className="text-slate-500">Manage your business relationships and leads.</p>
        </div>
        <Dialog open={isAddOpen || !!editingClient} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingClient(null);
            resetForm();
          }
        }}>
          <DialogTrigger render={<Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800" />}>
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

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold">Client / Company</TableHead>
              <TableHead className="font-semibold">Contact</TableHead>
              <TableHead className="font-semibold">Industry</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(client => (
              <TableRow key={client.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{client.name}</span>
                    <span className="text-xs text-slate-500">{client.company}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-slate-700">{client.contactPerson || 'N/A'}</span>
                    <div className="flex flex-col space-y-1">
                      <a 
                        href={`mailto:${client.email}`} 
                        className="flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        title={`Email ${client.name}`}
                      >
                        <Mail className="mr-1.5 h-3 w-3" /> {client.email}
                      </a>
                      {client.phone && (
                        <a 
                          href={`tel:${client.phone}`} 
                          className="flex items-center text-xs text-slate-500 hover:text-slate-900 hover:underline transition-colors"
                          title={`Call ${client.name}`}
                        >
                          <Phone className="mr-1.5 h-3 w-3" /> {client.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                    {client.industry || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={
                    client.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                    client.status === 'Lead' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                    'bg-slate-100 text-slate-700 hover:bg-slate-100'
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
                      className="text-slate-400 hover:text-blue-600"
                      title="Go Live Video"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setManagingClient(client)} 
                      className="text-slate-400 hover:text-indigo-600"
                      title="Manage Portal Data"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(client)} className="text-slate-400 hover:text-slate-900">
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400">
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
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isAddVitalOpen, setIsAddVitalOpen] = useState(false);
  const [vitalForm, setVitalForm] = useState({
    title: '',
    category: 'Login' as const,
    instructions: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    projectId: '',
    type: 'Installment' as const,
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

    return () => {
      unsubContracts();
      unsubPayments();
      unsubProjects();
      unsubVitals();
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="vitals">Vitals</TabsTrigger>
          </TabsList>
          
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
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Search className="h-4 w-4" /></Button>
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
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-slate-900 text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add Payment
                  </Button>
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
                        <Button variant="ghost" size="icon" onClick={async () => {
                          if (confirm('Delete this payment record? Project totals will not be automatically reverted.')) {
                            await deleteDoc(doc(db, 'payments', p.id));
                          }
                        }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
              <Button 
                type="button"
                size="sm" 
                onClick={() => {
                  console.log('Toggling vital form:', !isAddVitalOpen);
                  setIsAddVitalOpen(!isAddVitalOpen);
                }} 
                className="bg-slate-900 text-white"
              >
                {isAddVitalOpen ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> Request Info</>}
              </Button>
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteDoc(doc(db, 'vitals', v.id))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProjectsView({ projects, clients, user, onStartCall }: { projects: Project[], clients: Client[], user: User, onStartCall: (callData: any) => void }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    type: 'Mobile App' as const, 
    clientId: '', 
    status: 'Planning' as const,
    paymentStatus: 'Not Paid' as const,
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
      await addDoc(collection(db, 'projects'), {
        ...formData,
        clientName: client?.name || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setIsAddOpen(false);
      resetForm();
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="text-slate-500">Track creative, business, and platform deliverables.</p>
        </div>
        <Dialog open={isAddOpen || !!editingProject} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingProject(null);
            resetForm();
          }
        }}>
          <DialogTrigger render={<Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800" />}>
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
          <Card key={project.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge className={
                  project.type === 'Creative' ? 'bg-purple-100 text-purple-700' :
                  project.type === 'Business' ? 'bg-blue-100 text-blue-700' :
                  project.type === 'Mobile App' ? 'bg-green-100 text-green-700' :
                  project.type === 'Website' ? 'bg-cyan-100 text-cyan-700' :
                  'bg-orange-100 text-orange-700'
                }>
                  {project.type}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {project.status}
                </Badge>
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">{project.title}</CardTitle>
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs">{project.clientName}</CardDescription>
                {clients.find(c => c.id === project.clientId) && (
                  <div className="flex space-x-2">
                    <a 
                      href={`mailto:${clients.find(c => c.id === project.clientId)?.email}`}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title="Email Client"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                    {clients.find(c => c.id === project.clientId)?.phone && (
                      <a 
                        href={`tel:${clients.find(c => c.id === project.clientId)?.phone}`}
                        className="text-slate-400 hover:text-green-600 transition-colors"
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
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
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
                  <div className="flex items-center text-slate-700 font-medium">
                    <DollarSign className="mr-1 h-3 w-3" />
                    <span>{project.budget?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Paid: ${project.totalPaid?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <Badge variant="outline" className={
                    project.paymentStatus === 'Fully Paid' ? 'bg-green-50 text-green-700 border-green-200' :
                    project.paymentStatus === 'Partially Paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    project.paymentStatus === 'Deposit Received' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    'bg-slate-50 text-slate-500 border-slate-200'
                  }>
                    {project.paymentStatus || 'Not Paid'}
                  </Badge>
                  {project.liveUrl && (
                    <a 
                      href={project.liveUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline font-medium mt-1"
                    >
                      View Live
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="ghost" size="icon" onClick={() => startEdit(project)} className="text-slate-400 hover:text-slate-900">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)} className="text-slate-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
            No projects yet. Create your first project to get started.
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TasksView({ tasks, projects, clients, user, onStartCall }: { tasks: Task[], projects: Project[], clients: Client[], user: User, onStartCall: (callData: any) => void }) {
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
      await updateDoc(doc(db, 'tasks', task.id), { status: nextStatus });
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tasks</h1>
          <p className="text-slate-500">Action items and project milestones.</p>
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
          onStartCall={onStartCall}
        />
        <TaskColumn 
          title="In Progress" 
          tasks={tasks.filter(t => t.status === 'In Progress')} 
          projects={projects}
          clients={clients}
          onToggle={toggleStatus} 
          onDelete={handleDelete} 
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
      </div>
    </motion.div>
  );
}

function TaskColumn({ title, tasks, projects, clients, onToggle, onDelete, onStartCall }: { title: string, tasks: Task[], projects: Project[], clients: Client[], onToggle: (t: Task) => void, onDelete: (id: string) => void, onStartCall: (callData: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h3>
        <Badge variant="secondary" className="bg-slate-200 text-slate-700">{tasks.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-250px)] rounded-xl border border-slate-200 bg-slate-100/50 p-4">
        <div className="space-y-3">
          {tasks.map(task => {
            const project = projects.find(p => p.id === task.projectId);
            const client = clients.find(c => c.id === project?.clientId);
            return (
              <motion.div 
                layout
                key={task.id} 
                className="group relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-2 flex items-start justify-between">
                  <p className={`text-sm font-semibold text-slate-900 ${task.status === 'Done' ? 'line-through opacity-50' : ''}`}>
                    {task.title}
                  </p>
                  <button onClick={() => onToggle(task)} className="text-slate-300 hover:text-slate-900 transition-colors">
                    <CheckSquare className={`h-4 w-4 ${task.status === 'Done' ? 'text-green-500' : ''}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-medium text-slate-400 uppercase">{project?.title || 'Unknown Project'}</p>
                  {client && (
                    <div className="flex space-x-1.5">
                      <a 
                        href={`mailto:${client.email}`}
                        className="text-slate-300 hover:text-blue-500 transition-colors"
                        title="Email Client"
                      >
                        <Mail className="h-2.5 w-2.5" />
                      </a>
                      {client.phone && (
                        <a 
                          href={`tel:${client.phone}`}
                          className="text-slate-300 hover:text-green-500 transition-colors"
                          title="Call Client"
                        >
                          <Phone className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                      {task.assignedTo?.charAt(0) || '?'}
                    </div>
                    <span className="text-[10px] text-slate-500">{task.assignedTo || 'Unassigned'}</span>
                  </div>
                  <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 transition-all">
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
  const [linkForm, setLinkForm] = useState({
    clientId: '',
    projectId: '',
    paythenUrl: '',
    method: 'email' as 'email' | 'sms'
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments & Analytics</h1>
          <p className="text-slate-500">Track revenue and manage client payment links.</p>
        </div>
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
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">${pendingRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{payments.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Paid Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{projects.filter(p => p.paymentStatus === 'Fully Paid').length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Client</TableHead>
              <TableHead className="font-semibold">Project</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(payment => {
              const client = clients.find(c => c.id === payment.clientId);
              return (
                <TableRow key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-xs text-slate-500">{payment.date}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{client?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-slate-500">{client?.company}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{payment.projectTitle}</TableCell>
                  <TableCell>
                    <Badge variant="ghost" className="text-[10px] uppercase">{payment.type}</Badge>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">${payment.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={
                      payment.status === 'Paid' ? 'bg-green-100 text-green-700' :
                      payment.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={async () => {
                        if (confirm('Delete this payment record? This will also update the project total.')) {
                          const project = projects.find(p => p.id === payment.projectId);
                          if (project) {
                            const newTotal = Math.max(0, (project.totalPaid || 0) - payment.amount);
                            let newStatus: Project['paymentStatus'] = project.paymentStatus;
                            
                            if (newTotal <= 0) newStatus = 'Not Paid';
                            else if (newTotal < (project.budget || 0)) newStatus = 'Partially Paid';
                            else newStatus = 'Fully Paid';

                            await updateDoc(doc(db, 'projects', project.id), {
                              totalPaid: newTotal,
                              paymentStatus: newStatus
                            });
                          }
                          await deleteDoc(doc(db, 'payments', payment.id));
                        }
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  No payment records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </motion.div>
  );
}

function SessionsView({ sessions, clients, user, role, onStartCall, sendNotification, isClientView = false }: { 
  sessions: ScheduledSession[], 
  clients: Client[], 
  user: User, 
  role: string | null,
  onStartCall: (callData: any) => void,
  sendNotification: any,
  isClientView?: boolean
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    startTime: '',
    clientId: isClientView && clients.length > 0 ? clients[0].id : '',
    duration: 30
  });

  const handleAdd = async () => {
    if (!newSession.title || !newSession.startTime || !newSession.clientId) return;
    
    const client = clients.find(c => c.id === newSession.clientId);
    
    await addDoc(collection(db, 'scheduledSessions'), {
      ...newSession,
      clientName: client?.name || 'Unknown',
      status: isClientView ? 'Requested' : 'Proposed',
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    
    setIsAddOpen(false);
    setNewSession({ title: '', startTime: '', clientId: isClientView && clients.length > 0 ? clients[0].id : '', duration: 30 });
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
          <h2 className="text-2xl font-bold text-slate-900">Live Sessions</h2>
          <p className="text-slate-500">Schedule and manage live video sessions.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="bg-slate-900 text-white hover:bg-slate-800" />}>
            <Calendar className="mr-2 h-4 w-4" /> Schedule Session
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <CardTitle>Schedule New Session</CardTitle>
              <CardDescription>Set a time for a live video session.</CardDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Session Title</Label>
                <Input 
                  placeholder="e.g., Weekly Sync, Design Review" 
                  value={newSession.title}
                  onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                />
              </div>
              {!isClientView && (
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select 
                    value={newSession.clientId} 
                    onValueChange={(val) => setNewSession({ ...newSession, clientId: val })}
                  >
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
              )}
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input 
                  type="datetime-local" 
                  value={newSession.startTime}
                  onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input 
                  type="number" 
                  value={newSession.duration}
                  onChange={(e) => setNewSession({ ...newSession, duration: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} className="bg-slate-900 text-white hover:bg-slate-800">Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map(session => (
          <Card key={session.id} className="border-slate-200 shadow-sm overflow-hidden">
            <div className={`h-2 ${
              session.status === 'Active' ? 'bg-green-500' : 
              session.status === 'Accepted' ? 'bg-blue-500' : 
              session.status === 'Requested' ? 'bg-amber-500' :
              session.status === 'Declined' ? 'bg-red-500' :
              'bg-slate-300'
            }`} />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                  {session.status}
                </Badge>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => handleDelete(session.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <CardTitle className="text-lg font-bold">{session.title}</CardTitle>
              <CardDescription>{session.clientName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-sm text-slate-500">
                <Clock className="mr-2 h-4 w-4" />
                {new Date(session.startTime).toLocaleString()}
              </div>
              <div className="flex items-center text-sm text-slate-500">
                <Timer className="mr-2 h-4 w-4" />
                {session.duration} minutes
              </div>
              
              <div className="pt-4 flex flex-col space-y-2">
                {session.status === 'Requested' && !isClientView && (
                  <div className="flex space-x-2">
                    <Button 
                      className="flex-1 bg-green-600 text-white hover:bg-green-500"
                      onClick={() => handleStatusChange(session.id, 'Accepted')}
                    >
                      Accept
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
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
                  <div className="flex space-x-2">
                    {role === 'admin' ? (
                      <Button 
                        className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => startSession(session)}
                      >
                        <Video className="mr-2 h-4 w-4" /> Start Session
                      </Button>
                    ) : (
                      <div className="flex-1 flex items-center justify-center p-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                        <Clock className="mr-2 h-3 w-3 animate-pulse" /> Waiting for Host to start
                      </div>
                    )}
                  </div>
                )}

                {session.status === 'Active' && (
                  <div className="flex space-x-2">
                    <Button 
                      className="flex-1 bg-blue-600 text-white hover:bg-blue-500"
                      onClick={() => startSession(session)}
                    >
                      <Video className="mr-2 h-4 w-4" /> Join Live Session
                    </Button>
                    {role === 'admin' && (
                      <Button variant="outline" onClick={() => handleStatusChange(session.id, 'Completed')}>
                        End
                      </Button>
                    )}
                  </div>
                )}

                {session.status === 'Proposed' && !isClientView && (
                  <div className="text-center p-2 rounded-lg bg-slate-50 text-slate-500 text-[10px] italic border border-slate-100">
                    Awaiting client acceptance...
                  </div>
                )}

                {session.status === 'Requested' && isClientView && (
                  <Button variant="outline" className="w-full" disabled>
                    Waiting for Approval
                  </Button>
                )}

                {(session.status === 'Declined' || session.status === 'Completed' || session.status === 'Cancelled') && (
                  <Button variant="outline" className="w-full" disabled>
                    Session {session.status}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {sessions.length === 0 && (
          <div className="col-span-full py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
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
    <div className="flex flex-col h-[600px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
              m.senderId === user.uid 
                ? 'bg-slate-900 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-900 rounded-tl-none'
            }`}>
              <p>{m.text}</p>
              <p className={`text-[10px] mt-1 ${m.senderId === user.uid ? 'text-slate-400' : 'text-slate-500'}`}>
                {m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <MessageCircle className="h-12 w-12 mb-2 opacity-20" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-slate-50 flex space-x-2">
        <Input 
          placeholder="Type a message..." 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="bg-white"
        />
        <Button type="submit" size="icon" className="bg-slate-900 text-white hover:bg-slate-800 shrink-0">
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
      className="grid grid-cols-12 gap-6 h-[calc(100vh-120px)]"
    >
      <div className="col-span-4 flex flex-col space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Conversations</h2>
        <ScrollArea className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-2 space-y-1">
            {clients.map(client => {
              const clientMessages = messages.filter(m => m.clientId === client.id);
              const lastMessage = clientMessages[clientMessages.length - 1];
              const unreadCount = clientMessages.filter(m => !m.read && m.senderId !== user.uid).length;
              
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all relative ${
                    selectedClientId === client.id ? 'bg-slate-900 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold truncate pr-6">{client.name}</div>
                    {unreadCount > 0 && selectedClientId !== client.id && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs truncate ${selectedClientId === client.id ? 'text-slate-400' : 'text-slate-400'} ${unreadCount > 0 && selectedClientId !== client.id ? 'font-bold text-slate-900' : ''}`}>
                    {lastMessage ? lastMessage.text : 'No messages yet'}
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
          <div className="h-full flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
            Select a conversation to start chatting
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
      <DialogTrigger render={<Button variant="outline" size="sm" className="hidden sm:flex border-blue-200 text-blue-600 hover:bg-blue-50" />}>
        <Video className="mr-2 h-4 w-4" /> Schedule Live Session
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Live Session</DialogTitle>
          <DialogDescription>Request a live session with Allie. She will review and confirm the time.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-title">Session Topic</Label>
            <Input 
              id="session-title" 
              placeholder="e.g. Project Review, Strategy Call" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-date">Date</Label>
              <Input 
                id="session-date" 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-time">Time</Label>
              <Input 
                id="session-time" 
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
                required 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-duration">Duration (minutes)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="session-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-slate-900 text-white">Request Session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientPortal({ user, client, projects, contracts, payments, vitals, scheduledSessions, messages, notifications, sendNotification, onStartCall, incomingCall, activeTab, setActiveTab }: { 
  user: User, 
  client: Client | null, 
  projects: Project[], 
  contracts: Contract[], 
  payments: Payment[], 
  vitals: Vital[],
  scheduledSessions: ScheduledSession[],
  messages: Message[],
  notifications: Notification[],
  sendNotification: any,
  onStartCall: (callData: any) => void,
  incomingCall?: any,
  activeTab: string,
  setActiveTab: (tab: string) => void
}) {

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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Client Portal</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ambix Allie</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
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
                  
                  // Notify admin
                  await sendNotification(
                    ADMIN_EMAILS[0], // Using placeholder for admin UID if not available, but better to use real UID
                    'New Session Request',
                    `${client.name} has requested a session: ${data.title}`,
                    'session'
                  );
                } catch (error) {
                  console.error('Error scheduling session:', error);
                }
              }} 
            />
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
              <NotificationBell notifications={notifications} />
              <div className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={logOut} className="text-slate-400 hover:text-red-600">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Welcome, {client.name}</h2>
          <p className="text-slate-500">Manage your projects, contracts, and payments in one place.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Overview</TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white flex items-center">
              Notifications
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-bold group-data-[state=active]:bg-white group-data-[state=active]:text-slate-900">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Products</TabsTrigger>
            <TabsTrigger value="contracts" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Contracts</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Payments</TabsTrigger>
            <TabsTrigger value="vitals" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Vitals</TabsTrigger>
            <TabsTrigger value="sessions" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Sessions</TabsTrigger>
            <TabsTrigger value="messages" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white flex items-center">
              Messages
              {unreadMessagesCount > 0 && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-bold group-data-[state=active]:bg-white group-data-[state=active]:text-slate-900">
                  {unreadMessagesCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-8">
            <NotificationsView notifications={notifications} />
          </TabsContent>

          <TabsContent value="overview" className="space-y-8">
            {incomingCall && (
              <Card className="border-blue-200 bg-blue-50 shadow-md animate-pulse">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-blue-900 flex items-center">
                    <Video className="mr-2 h-5 w-5 animate-bounce" /> Live Session Active!
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-800">Allie has started the live video session.</p>
                    <p className="text-xs text-blue-600 mt-1">Join now to participate.</p>
                  </div>
                  <Button 
                    size="lg" 
                    className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
                    onClick={() => onStartCall({ callId: incomingCall.id })}
                  >
                    Join Session
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">{projects.filter(p => p.status !== 'Completed').length}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pending Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">{payments.filter(p => p.status === 'Pending').length}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Signed Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">{contracts.filter(c => c.status === 'Signed').length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.slice(0, 3).map(p => (
                      <div key={p.id} className="flex items-center justify-between border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{p.title}</p>
                          <p className="text-xs text-slate-500">{p.status}</p>
                        </div>
                        <Badge variant="outline">{p.type}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-slate-900 text-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Need Help?</CardTitle>
                  <CardDescription className="text-slate-400">Contact Allie directly for any urgent matters.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-bold">Email</p>
                      <a href={`mailto:${ADMIN_EMAILS[0]}`} className="text-sm font-medium hover:text-blue-400 transition-colors">{ADMIN_EMAILS[0]}</a>
                    </div>
                  </div>
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
                      } catch (error) {
                        console.error('Error scheduling session:', error);
                      }
                    }} 
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map(project => (
                <Card key={project.id} className="border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="h-32 bg-slate-100 flex items-center justify-center border-b border-slate-200 relative">
                    <Briefcase className="h-12 w-12 text-slate-300" />
                    <Badge className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm text-slate-900 border-slate-200">
                      {project.paymentStatus || 'Not Paid'}
                    </Badge>
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{project.type}</Badge>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-100">{project.status}</Badge>
                    </div>
                    <CardTitle className="text-lg font-bold">{project.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <p className="text-sm text-slate-500 line-clamp-2">{project.description || 'No description provided.'}</p>
                    <div className="flex items-center justify-between text-xs font-medium pt-2 border-t border-slate-50">
                      <span className="text-slate-500">Budget: ${project.budget?.toLocaleString()}</span>
                      <span className="text-green-600">Paid: ${project.totalPaid?.toLocaleString() || '0'}</span>
                    </div>
                    {project.liveUrl && (
                      <Button 
                        render={<a href={project.liveUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" />} 
                        className="w-full bg-slate-900 text-white hover:bg-slate-800 mt-2"
                      >
                        View Live Product
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(contract => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.title}</TableCell>
                      <TableCell>
                        <Badge variant={contract.status === 'Signed' ? 'default' : 'outline'}>
                          {contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {contract.createdAt?.seconds ? new Date(contract.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
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
                                
                                // Notify admin
                                await sendNotification(
                                  ADMIN_EMAILS[0],
                                  'Contract Signed',
                                  `${client.name} has signed the contract: ${contract.title}`,
                                  'contract'
                                );
                              } catch (error) {
                                console.error('Error signing contract:', error);
                              }
                            }}
                          />
                        )}
                        {contract.fileUrl && (
                          <Button variant="ghost" size="sm" render={<a href={contract.fileUrl} target="_blank" rel="noopener noreferrer" />}>
                            View PDF
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {contracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-400">No contracts found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-slate-500 text-sm">{payment.date}</TableCell>
                      <TableCell className="font-medium">{payment.projectTitle}</TableCell>
                      <TableCell><Badge variant="ghost" className="text-[10px]">{payment.type}</Badge></TableCell>
                      <TableCell className="font-bold">${payment.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={
                          payment.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          payment.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[200px] truncate" title={payment.notes}>
                        {payment.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">No payment records found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="vitals" className="space-y-6">
            <div className="grid gap-6">
              {vitals.map(v => (
                <Card key={v.id} className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{v.category || 'Other'}</Badge>
                      <Badge variant={v.status === 'Provided' ? 'default' : 'outline'} className={v.status === 'Pending' ? 'animate-pulse' : ''}>
                        {v.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900">{v.title}</CardTitle>
                    {v.instructions && (
                      <div className="mt-2 flex items-start space-x-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                        <Clock className="h-3.5 w-3.5 mt-0.5" />
                        <span><span className="font-bold non-italic">How to find this:</span> {v.instructions}</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {v.status === 'Pending' ? (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`vital-${v.id}`}>Provide Details</Label>
                          <textarea 
                            id={`vital-${v.id}`}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 min-h-[100px]"
                            placeholder="Enter the requested information here..."
                            onBlur={async (e) => {
                              const val = e.target.value;
                              if (!val) return;
                              if (confirm('Submit this information? It will be securely stored for your developer.')) {
                                try {
                                  await updateDoc(doc(db, 'vitals', v.id), {
                                    value: val,
                                    status: 'Provided',
                                    updatedAt: serverTimestamp()
                                  });
                                  toast.success('Information provided successfully.');
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, 'vitals');
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Secure Value</p>
                        <p className="text-sm text-slate-700 leading-relaxed font-mono break-all">
                          {v.value}
                        </p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="mt-2 h-auto p-0 text-xs text-blue-600"
                          onClick={() => {
                            const newVal = prompt('Update this information:', v.value);
                            if (newVal !== null && newVal !== v.value) {
                              updateDoc(doc(db, 'vitals', v.id), {
                                value: newVal,
                                updatedAt: serverTimestamp()
                              });
                            }
                          }}
                        >
                          Edit Information
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {vitals.length === 0 && (
                <div className="text-center py-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <CheckSquare className="h-6 w-6 text-slate-300" />
                  </div>
                  <h3 className="font-bold text-slate-600">All Vitals Clear</h3>
                  <p className="text-sm">No technical information has been requested yet.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <SessionsView sessions={scheduledSessions} clients={client ? [client] : []} user={user} role="client" onStartCall={onStartCall} sendNotification={sendNotification} isClientView={true} />
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
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-slate-500">© 2026 Ambix Allie. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CRMApp />
    </ErrorBoundary>
  );
}

