/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { auth, db, signIn, logOut, signUpWithEmail, signInWithEmail, resetPassword, OperationType, handleFirestoreError } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VideoCall } from './components/VideoCall';
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
import { Plus, LogOut, LayoutDashboard, Users, Briefcase, CheckSquare, Trash2, Search, Filter, Mail, Phone, Calendar, DollarSign, Video, FileText, CreditCard, MessageCircle, ExternalLink, Clock, Timer, Send } from 'lucide-react';
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
  startDate?: string;
  estimatedEndDate?: string;
  actualEndDate?: string;
  budget?: number;
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
  fileUrl?: string;
  createdAt: any;
}

interface Payment {
  id: string;
  amount: number;
  clientId: string;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';
  date: string;
  description?: string;
}

interface QnA {
  id: string;
  question: string;
  answer?: string;
  clientId: string;
  category?: string;
  createdAt: any;
}

interface ScheduledSession {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  startTime: any;
  duration?: number;
  status: 'Scheduled' | 'Active' | 'Completed' | 'Cancelled';
  createdAt: any;
  createdBy: string;
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
  const [qnas, setQnas] = useState<QnA[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeCall, setActiveCall] = useState<{ clientId?: string, clientName?: string, callId?: string } | null>(null);

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
        if (currentUser.email === 'allie.pakele@gmail.com') {
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

      const sessionsQuery = query(collection(db, 'scheduledSessions'), orderBy('startTime', 'asc'));
      unsubscribes.push(onSnapshot(sessionsQuery, (snapshot) => {
        setScheduledSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledSession)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'scheduledSessions')));

      const messagesQuery = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
      unsubscribes.push(onSnapshot(messagesQuery, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages')));
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

      const sessionsQuery = query(collection(db, 'scheduledSessions'), where('clientId', '==', user.uid));
      unsubscribes.push(onSnapshot(sessionsQuery, (snapshot) => {
        setScheduledSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledSession)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'scheduledSessions')));
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, role]);

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

    const qnaQuery = query(collection(db, 'qna'), where('clientId', '==', linkedClient.id), orderBy('createdAt', 'desc'));
    const unsubscribeQna = onSnapshot(qnaQuery, (snapshot) => {
      setQnas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QnA)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'qna'));

    const messagesQuery = query(collection(db, 'messages'), where('clientId', '==', linkedClient.id), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));

    return () => {
      unsubscribeProjects();
      unsubscribeContracts();
      unsubscribePayments();
      unsubscribeQna();
      unsubscribeMessages();
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
          qnas={qnas}
          scheduledSessions={scheduledSessions}
          messages={messages}
          onStartCall={setActiveCall}
        />
        {activeCall && (
          <VideoCall 
            clientId={activeCall.clientId} 
            clientName={activeCall.clientName} 
            callId={activeCall.callId}
            user={user} 
            onClose={() => setActiveCall(null)} 
          />
        )}
      </div>
    );
  }

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
          />
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-100 p-4">
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
          {activeTab === 'dashboard' && <DashboardView clients={clients} projects={projects} tasks={tasks} onStartCall={setActiveCall} />}
          {activeTab === 'clients' && <ClientsView clients={clients} user={user} onStartCall={setActiveCall} />}
          {activeTab === 'projects' && <ProjectsView projects={projects} clients={clients} user={user} onStartCall={setActiveCall} />}
          {activeTab === 'tasks' && <TasksView tasks={tasks} projects={projects} clients={clients} user={user} onStartCall={setActiveCall} />}
          {activeTab === 'sessions' && <SessionsView sessions={scheduledSessions} clients={clients} user={user} onStartCall={setActiveCall} />}
          {activeTab === 'messages' && <MessagesView messages={messages} clients={clients} user={user} />}
        </AnimatePresence>
      </main>

      {activeCall && (
        <VideoCall 
          clientId={activeCall.clientId} 
          clientName={activeCall.clientName} 
          callId={activeCall.callId}
          user={user} 
          onClose={() => setActiveCall(null)} 
        />
      )}
    </div>
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

function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active 
          ? 'bg-slate-900 text-white shadow-sm' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </button>
  );
}

function DashboardView({ clients, projects, tasks, onStartCall }: { clients: Client[], projects: Project[], tasks: Task[], onStartCall: (callData: any) => void }) {
  const activeProjects = projects.filter(p => p.status !== 'Completed');
  const pendingTasks = tasks.filter(t => t.status !== 'Done');
  
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

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard title="Total Clients" value={clients.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active Projects" value={activeProjects.length} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Pending Tasks" value={pendingTasks.length} icon={<CheckSquare className="h-5 w-5" />} />
      </div>

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
                          <button 
                            onClick={() => onStartCall({ clientId: project.clientId, clientName: project.clientName })}
                            className="text-slate-300 hover:text-blue-500 transition-colors"
                            title="Go Live Video"
                          >
                            <Video className="h-2.5 w-2.5" />
                          </button>
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

function ClientsView({ clients, user, onStartCall }: { clients: Client[], user: User, onStartCall: (callData: any) => void }) {
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
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="mr-2 h-4 w-4" /> Add Client
            </Button>
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
        />
      )}
    </motion.div>
  );
}

function ManageClientDialog({ client, onClose, user }: { client: Client, onClose: () => void, user: User }) {
  const [activeTab, setActiveTab] = useState('contracts');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [qnas, setQnas] = useState<QnA[]>([]);

  useEffect(() => {
    const contractsQuery = query(collection(db, 'contracts'), where('clientId', '==', client.id), orderBy('createdAt', 'desc'));
    const unsubContracts = onSnapshot(contractsQuery, (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    });

    const paymentsQuery = query(collection(db, 'payments'), where('clientId', '==', client.id), orderBy('date', 'desc'));
    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const qnaQuery = query(collection(db, 'qna'), where('clientId', '==', client.id), orderBy('createdAt', 'desc'));
    const unsubQna = onSnapshot(qnaQuery, (snapshot) => {
      setQnas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QnA)));
    });

    return () => {
      unsubContracts();
      unsubPayments();
      unsubQna();
    };
  }, [client.id]);

  const addContract = async () => {
    const title = prompt('Contract Title:');
    if (!title) return;
    await addDoc(collection(db, 'contracts'), {
      title,
      clientId: client.id,
      status: 'Draft',
      createdAt: serverTimestamp()
    });
  };

  const addPayment = async () => {
    const amount = Number(prompt('Amount ($):'));
    const description = prompt('Description:');
    if (!amount) return;
    await addDoc(collection(db, 'payments'), {
      amount,
      description,
      clientId: client.id,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const addQna = async () => {
    const question = prompt('Question:');
    const answer = prompt('Answer:');
    if (!question) return;
    await addDoc(collection(db, 'qna'), {
      question,
      answer,
      clientId: client.id,
      category: 'General',
      createdAt: serverTimestamp()
    });
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
            <TabsTrigger value="qna">Q&A</TabsTrigger>
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
                      <TableCell>{c.title}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell className="text-right">
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
              <Button size="sm" onClick={addPayment}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.description}</TableCell>
                      <TableCell>${p.amount}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'payments', p.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="qna" className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Q&A Items</h3>
              <Button size="sm" onClick={addQna}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {qnas.map(q => (
                  <div key={q.id} className="p-3 border rounded-lg relative group">
                    <p className="font-bold text-sm">Q: {q.question}</p>
                    <p className="text-sm text-slate-600">A: {q.answer || 'No answer yet'}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteDoc(doc(db, 'qna', q.id))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
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
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
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
                <div className="flex items-center text-slate-700 font-medium">
                  <DollarSign className="mr-1 h-3 w-3" />
                  <span>{project.budget?.toLocaleString() || '0'}</span>
                </div>
                {project.liveUrl && (
                  <a 
                    href={project.liveUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline font-medium"
                  >
                    View Live
                  </a>
                )}
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onStartCall({ clientId: project.clientId, clientName: project.clientName })} 
                  className="text-slate-400 hover:text-blue-600"
                  title="Go Live Video"
                >
                  <Video className="h-4 w-4" />
                </Button>
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
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="mr-2 h-4 w-4" /> Add Task
            </Button>
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
                      <button 
                        onClick={() => onStartCall({ clientId: client.id, clientName: client.name })}
                        className="text-slate-300 hover:text-blue-500 transition-colors"
                        title="Go Live Video"
                      >
                        <Video className="h-2.5 w-2.5" />
                      </button>
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

function SessionsView({ sessions, clients, user, onStartCall, isClientView = false }: { 
  sessions: ScheduledSession[], 
  clients: Client[], 
  user: User, 
  onStartCall: (callData: any) => void,
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
      status: 'Scheduled',
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    
    setIsAddOpen(false);
    setNewSession({ title: '', startTime: '', clientId: isClientView && clients.length > 0 ? clients[0].id : '', duration: 30 });
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateDoc(doc(db, 'scheduledSessions', id), { status });
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'scheduledSessions', id));
  };

  const startSession = (session: ScheduledSession) => {
    if (session.status !== 'Active') {
      handleStatusChange(session.id, 'Active');
    }
    onStartCall({ clientId: session.clientId, clientName: session.clientName });
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
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white hover:bg-slate-800">
              <Calendar className="mr-2 h-4 w-4" /> Schedule Session
            </Button>
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
              session.status === 'Scheduled' ? 'bg-blue-500' : 
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
              
              <div className="pt-4 flex space-x-2">
                {session.status === 'Scheduled' || session.status === 'Active' ? (
                  <Button 
                    className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                    onClick={() => startSession(session)}
                  >
                    <Video className="mr-2 h-4 w-4" /> {session.status === 'Active' ? 'Join Session' : 'Start Session'}
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1" disabled>
                    Session {session.status}
                  </Button>
                )}
                
                {session.status === 'Active' && (
                  <Button variant="outline" onClick={() => handleStatusChange(session.id, 'Completed')}>
                    End
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

function MessagesView({ messages, clients, user }: { messages: Message[], clients: Client[], user: User }) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients.length > 0 ? clients[0].id : null);

  const filteredMessages = messages.filter(m => m.clientId === selectedClientId);

  const handleSendMessage = async (text: string) => {
    if (!selectedClientId) return;
    await addDoc(collection(db, 'messages'), {
      text,
      senderId: user.uid,
      senderName: user.displayName || 'Admin',
      clientId: selectedClientId,
      timestamp: serverTimestamp(),
      read: false
    });
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
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all ${
                    selectedClientId === client.id ? 'bg-slate-900 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="font-bold truncate">{client.name}</div>
                  <div className={`text-xs truncate ${selectedClientId === client.id ? 'text-slate-400' : 'text-slate-400'}`}>
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

function ClientPortal({ user, client, projects, contracts, payments, qnas, scheduledSessions, messages, onStartCall }: { 
  user: User, 
  client: Client | null, 
  projects: Project[], 
  contracts: Contract[], 
  payments: Payment[], 
  qnas: QnA[],
  scheduledSessions: ScheduledSession[],
  messages: Message[],
  onStartCall: (callData: any) => void 
}) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!client) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 rounded-full bg-slate-100 p-6">
          <Users className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Portal Not Linked</h2>
        <p className="mt-2 max-w-md text-slate-500">
          Your email ({user.email}) is not linked to a client profile in our system. 
          Please contact Allie at <a href="mailto:allie.pakele@gmail.com" className="text-blue-600 hover:underline">allie.pakele@gmail.com</a> to gain access.
        </p>
        <Button onClick={logOut} variant="outline" className="mt-8">
          Sign Out
        </Button>
      </div>
    );
  }

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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onStartCall({ clientId: client.id, clientName: client.name })}
              className="hidden sm:flex border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Video className="mr-2 h-4 w-4" /> Live Session
            </Button>
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
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
            <TabsTrigger value="projects" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Products</TabsTrigger>
            <TabsTrigger value="contracts" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Contracts</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Payments</TabsTrigger>
            <TabsTrigger value="qna" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Q&A</TabsTrigger>
            <TabsTrigger value="sessions" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Sessions</TabsTrigger>
            <TabsTrigger value="messages" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
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
                      <a href="mailto:allie.pakele@gmail.com" className="text-sm font-medium hover:text-blue-400 transition-colors">allie.pakele@gmail.com</a>
                    </div>
                  </div>
                  <Button 
                    onClick={() => onStartCall({ clientId: client.id, clientName: client.name })}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  >
                    <Video className="mr-2 h-4 w-4" /> Start Live Session
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map(project => (
                <Card key={project.id} className="border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="h-32 bg-slate-100 flex items-center justify-center border-b border-slate-200">
                    <Briefcase className="h-12 w-12 text-slate-300" />
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
                    {project.liveUrl && (
                      <Button asChild className="w-full bg-slate-900 text-white hover:bg-slate-800">
                        <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                          View Live Product
                        </a>
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
                      <TableCell className="text-right">
                        {contract.fileUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={contract.fileUrl} target="_blank" rel="noopener noreferrer">View PDF</a>
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
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.description}</TableCell>
                      <TableCell className="font-bold">${payment.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{payment.date}</TableCell>
                      <TableCell>
                        <Badge className={
                          payment.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          payment.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-400">No payment records found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="qna" className="space-y-6">
            <div className="grid gap-6">
              {qnas.map(q => (
                <Card key={q.id} className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{q.category || 'General'}</Badge>
                      <span className="text-[10px] text-slate-400">{q.createdAt?.seconds ? new Date(q.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900">Q: {q.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-sm text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-900 mr-2">A:</span>
                        {q.answer || <span className="italic text-slate-400">Waiting for response...</span>}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {qnas.length === 0 && (
                <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
                  No Q&A items yet.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <SessionsView sessions={scheduledSessions} clients={client ? [client] : []} user={user} onStartCall={onStartCall} isClientView={true} />
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <ChatWindow 
              messages={messages} 
              clientId={client.id} 
              user={user} 
              onSendMessage={async (text) => {
                await addDoc(collection(db, 'messages'), {
                  text,
                  senderId: user.uid,
                  senderName: client.name,
                  clientId: client.id,
                  timestamp: serverTimestamp(),
                  read: false
                });
              }} 
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

