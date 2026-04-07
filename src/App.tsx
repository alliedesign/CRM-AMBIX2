/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, db, signIn, logOut, OperationType, handleFirestoreError } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import { Plus, LogOut, LayoutDashboard, Users, Briefcase, CheckSquare, Trash2, Search, Filter, Mail, Phone, Calendar, DollarSign } from 'lucide-react';
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

function CRMApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients'));

    const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));

    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    return () => {
      unsubscribeClients();
      unsubscribeProjects();
      unsubscribeTasks();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-10 shadow-xl"
        >
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <Briefcase className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Ambix Allie CRM</h1>
            <p className="mt-2 text-slate-600">Secure access for the creative, business, and platform teams.</p>
          </div>
          <Button 
            onClick={signIn} 
            className="w-full bg-slate-900 py-6 text-lg font-medium text-white hover:bg-slate-800"
          >
            Sign in with Google
          </Button>
        </motion.div>
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
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={user.photoURL || ''} alt="" className="h-8 w-8 rounded-full border border-slate-200" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-900 truncate w-24">{user.displayName}</span>
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
          {activeTab === 'dashboard' && <DashboardView clients={clients} projects={projects} tasks={tasks} />}
          {activeTab === 'clients' && <ClientsView clients={clients} user={user} />}
          {activeTab === 'projects' && <ProjectsView projects={projects} clients={clients} user={user} />}
          {activeTab === 'tasks' && <TasksView tasks={tasks} projects={projects} clients={clients} user={user} />}
        </AnimatePresence>
      </main>
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

function DashboardView({ clients, projects, tasks }: { clients: Client[], projects: Project[], tasks: Task[] }) {
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

function ClientsView({ clients, user }: { clients: Client[], user: User }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
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
    </motion.div>
  );
}

function ProjectsView({ projects, clients, user }: { projects: Project[], clients: Client[], user: User }) {
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

function TasksView({ tasks, projects, clients, user }: { tasks: Task[], projects: Project[], clients: Client[], user: User }) {
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
        />
        <TaskColumn 
          title="In Progress" 
          tasks={tasks.filter(t => t.status === 'In Progress')} 
          projects={projects}
          clients={clients}
          onToggle={toggleStatus} 
          onDelete={handleDelete} 
        />
        <TaskColumn 
          title="Done" 
          tasks={tasks.filter(t => t.status === 'Done')} 
          projects={projects}
          clients={clients}
          onToggle={toggleStatus} 
          onDelete={handleDelete} 
        />
      </div>
    </motion.div>
  );
}

function TaskColumn({ title, tasks, projects, clients, onToggle, onDelete }: { title: string, tasks: Task[], projects: Project[], clients: Client[], onToggle: (t: Task) => void, onDelete: (id: string) => void }) {
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

export default function App() {
  return (
    <ErrorBoundary>
      <CRMApp />
    </ErrorBoundary>
  );
}

