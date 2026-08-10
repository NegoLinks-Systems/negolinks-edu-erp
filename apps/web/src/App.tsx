import { Suspense, lazy, useEffect, useState, useCallback, type ComponentType } from 'react';
import { Routes, Route, NavLink, Navigate, useParams, useLocation } from 'react-router-dom';
import {
  Loader2, LogOut, Menu, ChevronDown, ChevronLeft,
  LayoutDashboard, GraduationCap, Users, BookOpen,
  ClipboardCheck, FileQuestion, Wallet, Boxes, ShieldCheck, Bell,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import { BRAND, browserTitle, footerText } from './lib/brand';
import { useAuth, useTenant } from './providers/app-providers';
import { isTertiary } from './features/academics/academics-api';
import type { AppRole } from './lib/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SplashScreen } from '@/components/negolinks/SplashScreen';
import { DemoModeBanner } from '@/components/negolinks/DemoModeBanner';
import { useDemoStatus } from './features/admin/demo-api';
import NotificationBell from './features/comms/NotificationBell';

/* ─────────────────────── lazy pages ─────────────────────── */
const L = (f: () => Promise<{ default: ComponentType<any> }>) => lazy(f);
const Dashboard       = L(() => import('./features/portal/StudentDashboardPage'));
const Students        = L(() => import('./features/people/StudentsPage'));
const Staff           = L(() => import('./features/people/StaffPage'));
const Sessions        = L(() => import('./features/academics/SessionsPage'));
const Structure       = L(() => import('./features/academics/StructurePage'));
const TeachAssign     = L(() => import('./features/academics/TeachingAssignmentsPage'));
const Enrollment      = L(() => import('./features/attendance/EnrollmentPage'));
const Attendance      = L(() => import('./features/attendance/AttendancePage'));
const StaffAttendance = L(() => import('./features/attendance/StaffAttendancePage'));
const AssessSetup     = L(() => import('./features/results/AssessmentSetupPage'));
const ScoreSheet      = L(() => import('./features/results/ScoreSheetPage'));
const ResultApproval  = L(() => import('./features/results/ResultApprovalPage'));
const MyResults       = L(() => import('./features/results/StudentResultsPage'));
const FeeSetup        = L(() => import('./features/finance/FeeSetupPage'));
const Billing         = L(() => import('./features/finance/BillingPage'));
const Scholarships    = L(() => import('./features/finance/ScholarshipsPage'));
const MyFees          = L(() => import('./features/finance/StudentFinancePage'));
const FinanceReport   = L(() => import('./features/finance/FinanceReportPage'));
const QuestionBank    = L(() => import('./features/cbt/QuestionBankPage'));
const Exams           = L(() => import('./features/cbt/ExamsPage'));
const TakeExams       = L(() => import('./features/cbt/StudentExamsPage'));
const ExamResults     = L(() => import('./features/cbt/ExamResultsPage'));
const LibraryCatalog  = L(() => import('./features/library/LibraryCatalogPage'));
const LibraryLoans    = L(() => import('./features/library/LibraryLoansPage'));
const MyLibrary       = L(() => import('./features/library/MyLibraryPage'));
const Hostels         = L(() => import('./features/hostel/HostelsPage'));
const MyHostel        = L(() => import('./features/hostel/MyHostelPage'));
const Vehicles        = L(() => import('./features/transport/VehiclesPage'));
const TransportRoutes = L(() => import('./features/transport/RoutesPage'));
const MyTransport     = L(() => import('./features/transport/MyTransportPage'));
const Inventory       = L(() => import('./features/inventory/InventoryPage'));
const Transcript      = L(() => import('./features/transcript/TranscriptPage'));
const Admissions      = L(() => import('./features/admissions/AdmissionsPage'));
const Coursework      = L(() => import('./features/elearning/CourseworkPage'));
const Learn           = L(() => import('./features/elearning/LearnPage'));
const Inbox           = L(() => import('./features/comms/InboxPage'));
const Announcements   = L(() => import('./features/comms/AnnouncementsPage'));
const Intelligence    = L(() => import('./features/intelligence/IntelligencePage'));
const Provisioning    = L(() => import('./features/provisioning/ProvisioningPage'));
const Settings        = L(() => import('./features/settings/SettingsPage'));
const Admin           = L(() => import('./features/admin/AdminDashboardPage'));
const DemoData        = L(() => import('./features/admin/DemoDataPage'));
const AuditTrail      = L(() => import('./features/admin/AuditTrailPage'));
const Apply           = L(() => import('./features/admissions/ApplyPage'));
const Verify          = L(() => import('./features/results/VerifyPage'));

/* ─────────────────────── role groups ────────────────────── */
const ADMIN: AppRole[]   = ['institution_admin','principal','vice_principal','rector','provost','proprietor','registrar'];
const ACADEMIC: AppRole[]= [...ADMIN,'dean','head_of_department','academic_officer','lecturer','teacher','class_teacher'];
const FINANCE: AppRole[] = [...ADMIN,'bursar','accountant'];
const OPS: AppRole[]     = [...ADMIN,'librarian','hostel_manager'];
const PEOPLE: AppRole[]  = [...ADMIN,'admissions_officer'];
const LEARNER: AppRole[] = ['student','parent','guardian'];

type NavLink2 = { to: string; label: string };
type NavSection = { id: string; title: string; icon: ComponentType<any>; roles?: AppRole[]; links: NavLink2[] };

function buildNav(type?: string): NavSection[] {
  const tertiary = isTertiary(type);
  const learners = type === 'primary_school' ? 'Pupils' : 'Students';
  return [
    { id: 'home', title: 'Overview', icon: LayoutDashboard, links: [
      { to: '/dashboard', label: 'Dashboard' }, { to: '/inbox', label: 'Inbox' },
    ]},
    { id: 'me', title: 'My Space', icon: GraduationCap, roles: LEARNER, links: [
      { to: '/my-results', label: 'My Results' }, { to: '/my-fees', label: 'My Fees' },
      { to: '/take-exams', label: 'My Exams' }, { to: '/learn', label: 'E-Learning' },
      { to: '/my-library', label: 'My Library' }, { to: '/my-hostel', label: 'My Hostel' },
      { to: '/my-transport', label: 'My Transport' },
    ]},
    { id: 'people', title: 'People', icon: Users, roles: PEOPLE, links: [
      { to: '/students', label: learners }, { to: '/staff', label: 'Staff' },
      { to: '/admissions', label: 'Admissions' }, { to: '/provisioning', label: 'Accounts' },
    ]},
    { id: 'academics', title: 'Academics', icon: BookOpen, roles: ACADEMIC, links: [
      { to: '/sessions', label: 'Sessions & Terms' },
      { to: '/structure', label: tertiary ? 'Faculties & Programmes' : 'Classes & Subjects' },
      { to: '/teaching-assignments', label: 'Teaching Assignments' },
      { to: '/enrollment', label: 'Enrolment' },
      { to: '/attendance', label: 'Student Attendance' },
      { to: '/staff-attendance', label: 'Staff Attendance' },
    ]},
    { id: 'assessment', title: 'Assessment', icon: ClipboardCheck, roles: ACADEMIC, links: [
      { to: '/assessment-setup', label: 'Assessment Setup' }, { to: '/score-sheet', label: 'Score Sheet' },
      { to: '/result-approval', label: 'Result Approval' },
      ...(tertiary ? [{ to: '/transcript', label: 'Transcripts' }] : []),
      { to: '/coursework', label: 'Coursework' },
    ]},
    { id: 'cbt', title: 'Exams (CBT)', icon: FileQuestion, roles: ACADEMIC, links: [
      { to: '/question-bank', label: 'Question Bank' }, { to: '/exams', label: 'Manage Exams' },
      { to: '/exam-results', label: 'Exam Results' },
    ]},
    { id: 'finance', title: 'Finance', icon: Wallet, roles: FINANCE, links: [
      { to: '/fees-setup', label: 'Fee Setup' }, { to: '/billing', label: 'Billing' },
      { to: '/scholarships', label: 'Scholarships' }, { to: '/finance/reports', label: 'Finance Reports' },
    ]},
    { id: 'ops', title: 'Operations', icon: Boxes, roles: OPS, links: [
      { to: '/library', label: 'Library Catalog' }, { to: '/library/loans', label: 'Loan Management' },
      { to: '/hostels', label: 'Hostels' }, { to: '/vehicles', label: 'Vehicles' },
      { to: '/routes', label: 'Transport Routes' }, { to: '/inventory', label: 'Inventory' },
    ]},
    { id: 'admin', title: 'Administration', icon: ShieldCheck, roles: ADMIN, links: [
      { to: '/admin', label: 'Admin Dashboard' }, { to: '/announcements', label: 'Announcements' },
      { to: '/intelligence', label: 'Intelligence Engine' }, { to: '/audit', label: 'Audit Trail' },
      { to: '/demo-data', label: 'Demo Data' }, { to: '/settings', label: 'Settings' },
    ]},
  ];
}

const prettyType = (t?: string) => t ? t.replace(/_/g,' ').replace(/\b\w/g,(c)=>c.toUpperCase()) : '';

/* ─────────────────────── spinners ───────────────────────── */
const FullSpinner = () => (
  <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)' }}>
    <Loader2 className="h-6 w-6 animate-spin" style={{ color:'var(--accent-light)' }} />
  </div>
);
const PageSpinner = () => (
  <div style={{ display:'flex', height:'100%', alignItems:'center', justifyContent:'center', padding:'64px', background:'var(--bg-primary)' }}>
    <Loader2 className="h-6 w-6 animate-spin" style={{ color:'var(--accent-light)' }} />
  </div>
);

/* ────────────────────────── LOGIN ────────────────────────── */
function Login() {
  const [mode, setMode] = useState<'in'|'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Check your inbox if email confirmation is on; otherwise sign in.');
        setMode('in');
      }
    } catch (err) { setMsg((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-primary)', fontFamily:'Inter, sans-serif' }}>
      {/* ── Left hero panel: Abstract knowledge graph / floating particles ── */}
      <div style={{
        flex: 1, display:'none', position:'relative', overflow:'hidden',
        background:'radial-gradient(ellipse at 40% 50%, rgba(99,102,241,0.25) 0%, rgba(67,56,202,0.15) 40%, var(--bg-primary) 70%)',
      }} className="lg:flex flex-col items-center justify-center">
        {/* Floating particle network */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.2 }} viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {/* Network lines */}
          {[[100,150,300,250],[300,250,480,180],[300,250,200,400],[480,180,520,350],[200,400,380,500],[520,350,400,520],[380,500,180,560],[180,560,80,450],[80,450,100,150],[400,520,500,600],[200,400,80,450]].map(([x1,y1,x2,y2],i)=>(
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366F1" strokeWidth="1"/>
          ))}
          {/* Network nodes */}
          {[[100,150],[300,250],[480,180],[200,400],[520,350],[380,500],[180,560],[80,450],[400,520]].map(([cx,cy],i)=>(
            <circle key={i} cx={cx} cy={cy} r={i===1?8:5} fill="#818CF8" opacity={i===1?1:0.7}/>
          ))}
        </svg>

        {/* Open book graphic */}
        <div style={{ position:'relative', zIndex:1, textAlign:'center' }}>
          <div style={{
            width:140, height:140, margin:'0 auto 32px',
            background:'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
            borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 60px rgba(99,102,241,0.3)',
          }}>
            <div style={{ fontSize:'5rem' }}>📚</div>
          </div>
          <h2 style={{ fontFamily:'Poppins, sans-serif', fontWeight:800, fontSize:'1.75rem', color:'white', marginBottom:12 }}>
            Empowering Education
          </h2>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.95rem', maxWidth:340, lineHeight:1.6 }}>
            A complete school management platform for every institution type — primary, secondary, college, polytechnic, or university.
          </p>

          {/* Feature bullets */}
          <div style={{ marginTop:32, display:'flex', flexDirection:'column', gap:12, alignItems:'flex-start', display:'inline-flex' }}>
            {['AI-Powered Intelligence Engine','Results & Transcript Management','Finance, Fees & Scholarships','E-Learning & CBT Exams'].map((f)=>(
              <div key={f} style={{ display:'flex', alignItems:'center', gap:10, color:'var(--text-secondary)', fontSize:'0.85rem' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-primary)', flexShrink:0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position:'absolute', bottom:24, color:'var(--text-muted)', fontSize:'0.72rem', letterSpacing:'0.04em' }}>
          Powered by {BRAND.suite}
        </div>
      </div>

      {/* ── Right login card ── */}
      <div style={{ width:'100%', maxWidth:480, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px' }}>
        <form onSubmit={submit} style={{ width:'100%', maxWidth:380 }}>

          {/* Logo + wordmark */}
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div style={{
              width:64, height:64, borderRadius:'50%', margin:'0 auto 16px',
              background:'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 0 30px rgba(201,168,76,0.4)', fontSize:'1.75rem',
              fontFamily:'Poppins, sans-serif', fontWeight:900, color:'#080810',
            }}>∞</div>
            <h1 style={{
              fontFamily:'Poppins, Inter, sans-serif', fontWeight:900, fontSize:'2rem',
              background:'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
              marginBottom:4,
            }}>{BRAND.name}</h1>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.8rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
              {BRAND.productShort}
            </p>
            <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>
              {mode === 'in' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>

          {/* Card */}
          <div style={{
            background:'rgba(19,19,37,0.90)', backdropFilter:'blur(24px)',
            border:'1px solid var(--accent-border)', borderRadius:20,
            boxShadow:'0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 var(--accent-border)',
            padding:'28px 28px 24px',
          }}>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required placeholder="you@example.com" style={{ marginTop:6 }} />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={6} placeholder="••••••••" style={{ marginTop:6 }} />
              </div>
              {msg && <p style={{ fontSize:'0.78rem', color:'var(--color-warning)', background:'rgba(245,158,11,0.1)', padding:'8px 12px', borderRadius:8, border:'1px solid rgba(245,158,11,0.2)' }}>{msg}</p>}
              <button type="submit" disabled={busy} style={{
                width:'100%', padding:'11px', borderRadius:10, border:'none', cursor:busy?'not-allowed':'pointer',
                background:'linear-gradient(135deg, var(--accent-primary), var(--accent-deep))',
                color:'white', fontWeight:700, fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:'0 4px 20px var(--accent-glow)', transition:'all 0.2s',
                opacity: busy ? 0.7 : 1,
              }}>
                {busy && <Loader2 size={16} className="animate-spin" />}
                {mode === 'in' ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </div>

          <button type="button" onClick={()=>{setMode(mode==='in'?'up':'in'); setMsg(null);}}
            style={{ width:'100%', textAlign:'center', marginTop:16, background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.8rem', cursor:'pointer' }}>
            {mode === 'in' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>

          <p style={{ marginTop:24, textAlign:'center', color:'var(--text-muted)', fontSize:'0.69rem', lineHeight:1.6 }}>
            Powered by {BRAND.suite}<br />{footerText()}
          </p>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────── SIDEBAR ─────────────────────── */
function Sidebar({ sections, collapsed, onNavigate }: { sections: NavSection[]; collapsed: boolean; onNavigate: () => void }) {
  const location = useLocation();
  const activeId = sections.find((s) => s.links.some((l) => location.pathname === l.to || location.pathname.startsWith(l.to+'/')))?.id;
  const [open, setOpen] = useState<Record<string,boolean>>(() => activeId ? {[activeId]:true} : {home:true});

  useEffect(() => { if (activeId) setOpen((o) => o[activeId] ? o : {...o, [activeId]:true}); }, [activeId]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-surface)', borderRight:'1px solid var(--bg-border)', padding:'8px 0', overflowY:'auto' }}>
      <nav style={{ flex:1, padding:'0 8px' }}>
        {sections.map((s) => {
          const isOpen = !collapsed && !!open[s.id];
          const Icon = s.icon;
          const hasActive = s.links.some((l) => location.pathname === l.to || location.pathname.startsWith(l.to+'/'));
          return (
            <div key={s.id} style={{ marginBottom:2 }}>
              <button type="button" onClick={() => !collapsed && setOpen((o) => ({...o, [s.id]:!o[s.id]}))}
                title={collapsed ? s.title : undefined}
                style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%', padding: collapsed ? '10px 8px' : '9px 10px',
                  borderRadius:8, border:'none', cursor:'pointer', transition:'all 0.15s', justifyContent: collapsed ? 'center' : 'flex-start',
                  background: hasActive ? 'var(--accent-glow)' : 'transparent',
                  color: hasActive ? 'var(--accent-light)' : 'var(--text-secondary)',
                  borderLeft: hasActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                }}>
                <Icon size={16} style={{ flexShrink:0, color: hasActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                {!collapsed && <>
                  <span style={{ flex:1, textAlign:'left', fontSize:'0.82rem', fontWeight:500 }}>{s.title}</span>
                  <ChevronDown size={14} style={{ color:'var(--text-muted)', transition:'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                </>}
              </button>

              {isOpen && !collapsed && (
                <div style={{ marginLeft:8, borderLeft:'1px solid var(--bg-border)', paddingLeft:12, marginBottom:4, marginTop:2 }}>
                  {s.links.map((l) => {
                    const active = location.pathname === l.to || location.pathname.startsWith(l.to+'/');
                    return (
                      <NavLink key={l.to} to={l.to} onClick={onNavigate} end
                        style={{
                          display:'block', padding:'6px 10px', borderRadius:6, fontSize:'0.8rem',
                          textDecoration:'none', transition:'all 0.15s', marginBottom:1,
                          background: active ? 'var(--accent-glow)' : 'transparent',
                          color: active ? 'var(--accent-light)' : 'var(--text-muted)',
                          fontWeight: active ? 600 : 400,
                        }}>
                        {l.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      {!collapsed && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--bg-border)', marginTop:8 }}>
          <p style={{ fontSize:'0.68rem', color:'var(--text-muted)', lineHeight:1.5 }}>
            <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>{BRAND.productShort}</span><br/>
            {footerText()}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── APP SHELL ──────────────────────── */
function Shell() {
  const { user, signOut } = useAuth();
  const { institution, isSuperAdmin, hasRole } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const demoStatus = useDemoStatus();
  const demoMode = !!demoStatus.data?.demo_mode;

  // Post-login: browser title uses org name
  useEffect(() => {
    document.title = browserTitle(institution?.name);
  }, [institution?.name]);

  const sections = buildNav(institution?.type).filter(
    (s) => !s.roles || isSuperAdmin || hasRole(...s.roles)
  );

  const sidebarWidth = collapsed ? 56 : 256;

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg-primary)' }}>
      {/* ── Top navbar ── */}
      <header style={{
        position:'sticky', top:0, zIndex:30, height:64,
        display:'flex', alignItems:'center', gap:12, padding:'0 20px',
        background:'rgba(14,14,28,0.95)', backdropFilter:'blur(10px)',
        borderBottom:'1px solid var(--bg-border)',
      }}>
        {/* Mobile menu toggle */}
        <button onClick={() => setMobileOpen((o) => !o)} className="md:hidden"
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', padding:4 }}>
          <Menu size={20} />
        </button>

        {/* Collapse toggle (desktop) */}
        <button onClick={() => setCollapsed((c) => !c)} className="hidden md:flex"
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', padding:4 }}>
          <ChevronLeft size={18} style={{ transition:'transform 0.2s', transform: collapsed ? 'rotate(180deg)' : 'none' }} />
        </button>

        {/* Org identity */}
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          {institution?.logo_url
            ? <img src={institution.logo_url} alt="" style={{ height:32, width:32, borderRadius:6, objectFit:'contain' }} />
            : <div style={{ height:32, width:32, borderRadius:6, background:'var(--accent-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:800, color:'white', flexShrink:0 }}>
                {institution?.name?.[0] ?? 'N'}
              </div>
          }
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:'0.875rem', fontWeight:600, color:'white', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {institution?.name ?? BRAND.app}
            </div>
            {institution?.type && (
              <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', lineHeight:1 }}>{prettyType(institution.type)}</div>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <NotificationBell />
          <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'none' }} className="sm:inline">{user?.email}</span>
          <button onClick={() => signOut()} title="Sign out"
            style={{ background:'none', border:'1px solid var(--bg-border)', borderRadius:8, padding:'6px 8px', cursor:'pointer', color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor='var(--accent-border)', e.currentTarget.style.color='white')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor='var(--bg-border)', e.currentTarget.style.color='var(--text-secondary)')}>
            <LogOut size={15} />
            <span style={{ fontSize:'0.78rem', display:'none' }} className="sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <DemoModeBanner show={demoMode} />

      {/* ── Body ── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Desktop sidebar */}
        <aside className="hidden md:block" style={{ width:sidebarWidth, flexShrink:0, transition:'width 0.2s', height:'calc(100vh - 64px)', position:'sticky', top:64, overflow:'hidden' }}>
          <Sidebar sections={sections} collapsed={collapsed} onNavigate={() => {}} />
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <>
            <div onClick={() => setMobileOpen(false)} style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }} />
            <aside style={{ position:'fixed', top:64, left:0, bottom:0, zIndex:50, width:256, transition:'transform 0.25s' }}>
              <Sidebar sections={sections} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </>
        )}

        {/* Main content */}
        <main style={{ flex:1, overflow:'auto', background:'var(--bg-primary)', maxWidth:1400 }}>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route index element={<HomeRedirect />} />
              <Route path="/dashboard"           element={<Dashboard />} />
              <Route path="/students"            element={<Students />} />
              <Route path="/staff"               element={<Staff />} />
              <Route path="/admissions"          element={<Admissions />} />
              <Route path="/provisioning"        element={<Provisioning />} />
              <Route path="/sessions"            element={<Sessions />} />
              <Route path="/structure"           element={<Structure />} />
              <Route path="/teaching-assignments" element={<TeachAssign />} />
              <Route path="/enrollment"          element={<Enrollment />} />
              <Route path="/attendance"          element={<Attendance />} />
              <Route path="/staff-attendance"    element={<StaffAttendance />} />
              <Route path="/assessment-setup"    element={<AssessSetup />} />
              <Route path="/score-sheet"         element={<ScoreSheet />} />
              <Route path="/result-approval"     element={<ResultApproval />} />
              <Route path="/my-results"          element={<MyResults />} />
              <Route path="/transcript"          element={<Transcript />} />
              <Route path="/coursework"          element={<Coursework />} />
              <Route path="/learn"               element={<Learn />} />
              <Route path="/question-bank"       element={<QuestionBank />} />
              <Route path="/exams"               element={<Exams />} />
              <Route path="/take-exams"          element={<TakeExams />} />
              <Route path="/exam-results"        element={<ExamResults />} />
              <Route path="/fees-setup"          element={<FeeSetup />} />
              <Route path="/billing"             element={<Billing />} />
              <Route path="/scholarships"        element={<Scholarships />} />
              <Route path="/my-fees"             element={<MyFees />} />
              <Route path="/finance/reports"     element={<FinanceReport />} />
              <Route path="/library"             element={<LibraryCatalog />} />
              <Route path="/library/loans"       element={<LibraryLoans />} />
              <Route path="/my-library"          element={<MyLibrary />} />
              <Route path="/hostels"             element={<Hostels />} />
              <Route path="/my-hostel"           element={<MyHostel />} />
              <Route path="/vehicles"            element={<Vehicles />} />
              <Route path="/routes"              element={<TransportRoutes />} />
              <Route path="/my-transport"        element={<MyTransport />} />
              <Route path="/inventory"           element={<Inventory />} />
              <Route path="/inbox"               element={<Inbox />} />
              <Route path="/announcements"       element={<Announcements />} />
              <Route path="/intelligence"        element={<Intelligence />} />
              <Route path="/settings"            element={<Settings />} />
              <Route path="/admin"               element={<Admin />} />
              <Route path="/audit"               element={<AuditTrail />} />
              <Route path="/demo-data"           element={<DemoData />} />
              <Route path="*" element={
                <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
                  Page not found.
                </div>
              } />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isSuperAdmin, hasRole } = useTenant();
  return <Navigate to={isSuperAdmin || hasRole(...ADMIN) ? '/admin' : '/dashboard'} replace />;
}

function VerifyRoute() {
  const { token } = useParams();
  return <Verify token={token} />;
}

/* ─────────────────────────── APP ─────────────────────────── */
export default function App() {
  const { session, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  // Set pre-login browser title
  useEffect(() => {
    if (!session) document.title = `NegoLinks | ${BRAND.productShort}`;
  }, [session]);

  if (loading) return <FullSpinner />;
  if (!splashDone && !session) return <SplashScreen onDone={onSplashDone} />;

  return (
    <Suspense fallback={<FullSpinner />}>
      <Routes>
        <Route path="/apply"         element={<Apply />} />
        <Route path="/verify/:token" element={<VerifyRoute />} />
        <Route path="/login"         element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/*"             element={session ? <Shell /> : <Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
