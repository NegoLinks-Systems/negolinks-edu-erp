import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { Routes, Route, NavLink, Navigate, useParams, useLocation } from 'react-router-dom';
import {
  Loader2, LogOut, Menu, ChevronDown, LayoutDashboard, GraduationCap, Users,
  BookOpen, ClipboardCheck, FileQuestion, Wallet, Boxes, ShieldCheck,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import { BRAND, copyrightLine } from './lib/brand';
import { useAuth, useTenant } from './providers/app-providers';
import { isTertiary } from './features/academics/academics-api';
import type { AppRole } from './lib/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NotificationBell from './features/comms/NotificationBell';

/* ------------------------------ lazy pages ------------------------------ */
const L = (f: () => Promise<{ default: ComponentType<any> }>) => lazy(f);

const Dashboard = L(() => import('./features/portal/StudentDashboardPage'));
const Students = L(() => import('./features/people/StudentsPage'));
const Staff = L(() => import('./features/people/StaffPage'));
const Sessions = L(() => import('./features/academics/SessionsPage'));
const Structure = L(() => import('./features/academics/StructurePage'));
const TeachingAssignments = L(() => import('./features/academics/TeachingAssignmentsPage'));
const Enrollment = L(() => import('./features/attendance/EnrollmentPage'));
const Attendance = L(() => import('./features/attendance/AttendancePage'));
const StaffAttendance = L(() => import('./features/attendance/StaffAttendancePage'));
const AssessmentSetup = L(() => import('./features/results/AssessmentSetupPage'));
const ScoreSheet = L(() => import('./features/results/ScoreSheetPage'));
const ResultApproval = L(() => import('./features/results/ResultApprovalPage'));
const MyResults = L(() => import('./features/results/StudentResultsPage'));
const FeeSetup = L(() => import('./features/finance/FeeSetupPage'));
const Billing = L(() => import('./features/finance/BillingPage'));
const Scholarships = L(() => import('./features/finance/ScholarshipsPage'));
const MyFees = L(() => import('./features/finance/StudentFinancePage'));
const FinanceReport = L(() => import('./features/finance/FinanceReportPage'));
const QuestionBank = L(() => import('./features/cbt/QuestionBankPage'));
const Exams = L(() => import('./features/cbt/ExamsPage'));
const TakeExams = L(() => import('./features/cbt/StudentExamsPage'));
const ExamResults = L(() => import('./features/cbt/ExamResultsPage'));
const LibraryCatalog = L(() => import('./features/library/LibraryCatalogPage'));
const LibraryLoans = L(() => import('./features/library/LibraryLoansPage'));
const MyLibrary = L(() => import('./features/library/MyLibraryPage'));
const Hostels = L(() => import('./features/hostel/HostelsPage'));
const MyHostel = L(() => import('./features/hostel/MyHostelPage'));
const Vehicles = L(() => import('./features/transport/VehiclesPage'));
const TransportRoutes = L(() => import('./features/transport/RoutesPage'));
const MyTransport = L(() => import('./features/transport/MyTransportPage'));
const Inventory = L(() => import('./features/inventory/InventoryPage'));
const Transcript = L(() => import('./features/transcript/TranscriptPage'));
const Admissions = L(() => import('./features/admissions/AdmissionsPage'));
const Coursework = L(() => import('./features/elearning/CourseworkPage'));
const Learn = L(() => import('./features/elearning/LearnPage'));
const Inbox = L(() => import('./features/comms/InboxPage'));
const Announcements = L(() => import('./features/comms/AnnouncementsPage'));
const Intelligence = L(() => import('./features/intelligence/IntelligencePage'));
const Provisioning = L(() => import('./features/provisioning/ProvisioningPage'));
const Settings = L(() => import('./features/settings/SettingsPage'));
const Admin = L(() => import('./features/admin/AdminDashboardPage'));
const Apply = L(() => import('./features/admissions/ApplyPage'));
const Verify = L(() => import('./features/results/VerifyPage'));

/* ------------------------------ role groups ----------------------------- */
const ADMIN: AppRole[] = ['institution_admin', 'principal', 'vice_principal', 'rector', 'provost', 'proprietor', 'registrar'];
const ACADEMIC: AppRole[] = [...ADMIN, 'dean', 'head_of_department', 'academic_officer', 'lecturer', 'teacher', 'class_teacher'];
const FINANCE: AppRole[] = [...ADMIN, 'bursar', 'accountant'];
const OPS: AppRole[] = [...ADMIN, 'librarian', 'hostel_manager'];
const PEOPLE: AppRole[] = [...ADMIN, 'admissions_officer'];
const LEARNER: AppRole[] = ['student', 'parent', 'guardian'];
const ANY_STAFF: AppRole[] = Array.from(new Set([...ACADEMIC, ...FINANCE, ...OPS, ...PEOPLE]));

type NavLinkItem = { to: string; label: string };
type NavSection = { id: string; title: string; icon: ComponentType<any>; roles?: AppRole[]; links: NavLinkItem[] };

function buildNav(type?: string): NavSection[] {
  const tertiary = isTertiary(type);
  const learners = type === 'primary_school' ? 'Pupils' : 'Students';
  const assessment: NavLinkItem[] = [
    { to: '/assessment-setup', label: 'Assessment setup' },
    { to: '/score-sheet', label: 'Score sheet' },
    { to: '/result-approval', label: 'Result approval' },
    ...(tertiary ? [{ to: '/transcript', label: 'Transcripts' }] : []),
    { to: '/coursework', label: 'Coursework' },
  ];
  return [
    { id: 'home', title: 'Home', icon: LayoutDashboard, links: [
      { to: '/dashboard', label: 'Dashboard' }, { to: '/inbox', label: 'Inbox' },
    ] },
    { id: 'me', title: 'My space', icon: GraduationCap, roles: LEARNER, links: [
      { to: '/my-results', label: 'My results' }, { to: '/my-fees', label: 'My fees' },
      { to: '/take-exams', label: 'My exams' }, { to: '/learn', label: 'Learn' },
      { to: '/my-library', label: 'My library' }, { to: '/my-hostel', label: 'My hostel' },
      { to: '/my-transport', label: 'My transport' },
    ] },
    { id: 'people', title: 'People', icon: Users, roles: PEOPLE, links: [
      { to: '/students', label: learners }, { to: '/staff', label: 'Staff' },
      { to: '/admissions', label: 'Admissions' }, { to: '/provisioning', label: 'Accounts' },
    ] },
    { id: 'academics', title: 'Academics', icon: BookOpen, roles: ACADEMIC, links: [
      { to: '/sessions', label: 'Sessions & terms' },
      { to: '/structure', label: tertiary ? 'Faculties & programmes' : 'Classes & subjects' },
      { to: '/teaching-assignments', label: 'Teaching assignments' },
      { to: '/enrollment', label: 'Enrolment' }, { to: '/attendance', label: 'Attendance' },
      { to: '/staff-attendance', label: 'Staff attendance' },
    ] },
    { id: 'assessment', title: 'Assessment', icon: ClipboardCheck, roles: ACADEMIC, links: assessment },
    { id: 'cbt', title: 'Exams (CBT)', icon: FileQuestion, roles: ACADEMIC, links: [
      { to: '/question-bank', label: 'Question bank' }, { to: '/exams', label: 'Exams' },
      { to: '/exam-results', label: 'Exam results' },
    ] },
    { id: 'finance', title: 'Finance', icon: Wallet, roles: FINANCE, links: [
      { to: '/fees-setup', label: 'Fee setup' }, { to: '/billing', label: 'Billing' },
      { to: '/scholarships', label: 'Scholarships' }, { to: '/finance/reports', label: 'Finance reports' },
    ] },
    { id: 'ops', title: 'Operations', icon: Boxes, roles: OPS, links: [
      { to: '/library', label: 'Library' }, { to: '/library/loans', label: 'Loans' },
      { to: '/hostels', label: 'Hostels' }, { to: '/vehicles', label: 'Vehicles' },
      { to: '/routes', label: 'Routes' }, { to: '/inventory', label: 'Inventory' },
    ] },
    { id: 'admin', title: 'Administration', icon: ShieldCheck, roles: ADMIN, links: [
      { to: '/admin', label: 'Dashboard' }, { to: '/announcements', label: 'Announcements' },
      { to: '/intelligence', label: 'Intelligence Engine' }, { to: '/settings', label: 'Settings' },
    ] },
  ];
}

const prettyType = (t?: string) => (t ? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
const FullSpinner = () => <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
const Spinner = () => <div className="flex h-full w-full items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

/* -------------------------------- login --------------------------------- */
function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. If email confirmation is on, check your inbox; otherwise sign in.');
        setMode('in');
      }
    } catch (err) { setMsg((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--brand-primary, #1d4ed8)' }}>{BRAND.name}</h1>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Education Management ERP</p>
          <p className="mt-2 text-sm text-muted-foreground">{mode === 'in' ? 'Sign in to your account' : 'Create an account'}</p>
        </div>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'in' ? 'Sign in' : 'Create account'}</Button>
        <button type="button" className="w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
          {mode === 'in' ? 'Need an account? Create one' : 'Have an account? Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-[11px] text-muted-foreground">{copyrightLine()}</p>
    </div>
  );
}

/* ------------------------------- sidebar -------------------------------- */
function Sidebar({ sections, onNavigate }: { sections: NavSection[]; onNavigate: () => void }) {
  const location = useLocation();
  const activeId = sections.find((s) => s.links.some((l) => location.pathname === l.to || location.pathname.startsWith(l.to + '/')))?.id;
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeId ? { [activeId]: true } : { home: true }));

  // Whenever the route changes, make sure its section is expanded.
  useEffect(() => { if (activeId) setOpen((o) => (o[activeId] ? o : { ...o, [activeId]: true })); }, [activeId]);

  return (
    <nav className="space-y-1">
      {sections.map((s) => {
        const isOpen = !!open[s.id];
        const Icon = s.icon;
        return (
          <div key={s.id}>
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-foreground/80 hover:bg-muted">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left">{s.title}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            </button>
            {isOpen && (
              <div className="mb-1 ml-3 space-y-0.5 border-l pl-3">
                {s.links.map((l) => (
                  <NavLink key={l.to} to={l.to} onClick={onNavigate} end
                    className={({ isActive }) => `block rounded-md px-2 py-1.5 text-sm transition-colors ${isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                    {l.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* -------------------------------- shell --------------------------------- */
function Shell() {
  const { user, signOut } = useAuth();
  const { institution, isSuperAdmin, hasRole } = useTenant();
  const [open, setOpen] = useState(false);

  const sections = buildNav(institution?.type).filter((s) => !s.roles || isSuperAdmin || hasRole(...s.roles));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur">
        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu"><Menu className="h-5 w-5" /></button>
        {institution?.logo_url
          ? <img src={institution.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
          : <div className="h-8 w-8 rounded-md" style={{ background: 'var(--brand-primary, #1d4ed8)' }} />}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">{institution?.name ?? BRAND.app}</div>
          {institution?.type && <div className="text-[11px] leading-tight text-muted-foreground">{prettyType(institution.type)}</div>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />
          <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={`${open ? 'flex' : 'hidden'} w-64 shrink-0 flex-col overflow-y-auto border-r bg-muted/20 p-3 md:flex`}>
          <div className="flex-1">
            <Sidebar sections={sections} onNavigate={() => setOpen(false)} />
          </div>
          <div className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
            <p className="font-medium">{BRAND.productShort}</p>
            <p>© {new Date().getFullYear()} {BRAND.company}</p>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route index element={<HomeRedirect />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/admissions" element={<Admissions />} />
              <Route path="/provisioning" element={<Provisioning />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/structure" element={<Structure />} />
              <Route path="/teaching-assignments" element={<TeachingAssignments />} />
              <Route path="/enrollment" element={<Enrollment />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/staff-attendance" element={<StaffAttendance />} />
              <Route path="/assessment-setup" element={<AssessmentSetup />} />
              <Route path="/score-sheet" element={<ScoreSheet />} />
              <Route path="/result-approval" element={<ResultApproval />} />
              <Route path="/my-results" element={<MyResults />} />
              <Route path="/transcript" element={<Transcript />} />
              <Route path="/coursework" element={<Coursework />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/question-bank" element={<QuestionBank />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/take-exams" element={<TakeExams />} />
              <Route path="/exam-results" element={<ExamResults />} />
              <Route path="/fees-setup" element={<FeeSetup />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/scholarships" element={<Scholarships />} />
              <Route path="/my-fees" element={<MyFees />} />
              <Route path="/finance/reports" element={<FinanceReport />} />
              <Route path="/library" element={<LibraryCatalog />} />
              <Route path="/library/loans" element={<LibraryLoans />} />
              <Route path="/my-library" element={<MyLibrary />} />
              <Route path="/hostels" element={<Hostels />} />
              <Route path="/my-hostel" element={<MyHostel />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/routes" element={<TransportRoutes />} />
              <Route path="/my-transport" element={<MyTransport />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/intelligence" element={<Intelligence />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<div className="p-10 text-center text-sm text-muted-foreground">Page not found.</div>} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isSuperAdmin, hasRole } = useTenant();
  const staff = isSuperAdmin || hasRole(...ADMIN);
  return <Navigate to={staff ? '/admin' : '/dashboard'} replace />;
}

function VerifyRoute() {
  const { token } = useParams();
  return <Verify token={token} />;
}

/* --------------------------------- app ---------------------------------- */
export default function App() {
  const { session, loading } = useAuth();
  if (loading) return <FullSpinner />;

  return (
    <Suspense fallback={<FullSpinner />}>
      <Routes>
        <Route path="/apply" element={<Apply />} />
        <Route path="/verify/:token" element={<VerifyRoute />} />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/*" element={session ? <Shell /> : <Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
