import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { clearUserSession, getStoredUser, type AppUser } from '../auth/session';
import { getNextAppointment } from '../appointmentsStore';
import { 
  Activity, 
  FileText, 
  Calendar, 
  BookOpen, 
  User, 
  BarChart3, 
  History,
  LogOut, 
  Menu,
  X,
  Clock,
  Video,
  Phone,
  MapPin,
  ChevronRight,
  Mail,
} from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AppUser | null>(() => getStoredUser());
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [nextAppointment, setNextAppointment] = useState<any>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      navigate('/login');
    } else {
      setUser(storedUser);
    }

    // Load next appointment
    const appointment = getNextAppointment();
    setNextAppointment(appointment);
  }, [navigate]);

  const handleLogout = () => {
    clearUserSession();
    navigate('/');
  };

  const firstName = user?.name?.split(' ')[0] || 'User';

  const navItems = [
    {
      path: '/dashboard/risk-assessment',
      icon: BarChart3,
      label: 'Risk Assessment',
      description: 'Evaluate your prostate cancer risk',
    },
    {
      path: '/dashboard/medical-history',
      icon: FileText,
      label: 'Medical History',
      description: 'View and manage your health records',
    },
    {
      path: '/dashboard/results',
      icon: Activity,
      label: 'Results',
      description: 'View your assessment results',
    },
    {
      path: '/dashboard/history-report',
      icon: History,
      label: 'History Report',
      description: 'Review saved reports with full clinical explanations',
    },
    {
      path: '/dashboard/education',
      icon: BookOpen,
      label: 'Education',
      description: 'Learn about prostate health',
    },
    {
      path: '/dashboard/appointments',
      icon: Calendar,
      label: 'Appointments',
      description: 'Schedule and manage appointments',
    },
    {
      path: '/dashboard/profile',
      icon: User,
      label: 'Profile',
      description: 'Manage your account settings',
    },
  ];

  // If we're at /dashboard root, show the main navigation
  const isRootDashboard = location.pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-50">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
            >
              {sidebarOpen ? <X className="h-6 w-6 lg:hidden" /> : null}
              {sidebarOpen ? <Menu className="h-6 w-6 hidden lg:block" /> : <Menu className="h-6 w-6" />}
            </button>
            <Link to="/dashboard/risk-assessment" className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">ProstAPP</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {/* Desktop-only header items */}
            <div className="hidden lg:flex items-center gap-4">
              <Link
                to="/dashboard/mail"
                className={`
                  inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors
                  ${location.pathname === '/dashboard/mail'
                    ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }
                `}
              >
                <Mail className="h-4 w-4" />
                <span>Mail</span>
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`
                    inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors
                    ${location.pathname === '/admin'
                      ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }
                  `}
                >
                  <User className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              )}
              <ThemeToggle />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role === 'admin' ? 'Admin Account' : 'Patient Account'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
              <LanguageSwitcher />
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800 lg:hidden">
          <LanguageSwitcher className="justify-end" size="md" />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-[113px] lg:top-[73px] left-0 h-[calc(100vh-113px)] lg:h-[calc(100vh-73px)] border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 overflow-y-auto overflow-x-hidden
          transition-all duration-300 z-40
          ${sidebarOpen ? 'w-[292px] border-r translate-x-0' : 'w-0 border-r-0 -translate-x-full'}
        `}>
          <div className="w-[292px] flex h-full flex-col p-4">
            <div className="rounded-xl border border-slate-200 bg-transparent p-4 shadow-none dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm dark:bg-sky-500">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{firstName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                  <Badge variant="outline" className="mt-3 rounded-full border-slate-200 bg-transparent px-2.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-transparent dark:text-slate-300">
                    {user?.role === 'admin' ? 'Admin account' : 'Patient dashboard'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-5 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Workspace
              </p>
            </div>

            <nav className="mt-3 flex-1 space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    }}
                    className={`
                      group flex items-center gap-3 rounded-[1.35rem] border px-3 py-3 transition-all
                      ${isActive
                        ? 'border-sky-200 bg-sky-50 shadow-sm dark:border-sky-800 dark:bg-sky-950/30'
                        : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-900'
                      }
                    `}
                  >
                    <div
                      className={`
                        flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl transition-colors
                        ${isActive
                          ? 'bg-sky-600 text-white dark:bg-sky-500'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-white dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-800'
                        }
                      `}
                    >
                      <item.icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${isActive ? 'text-sky-900 dark:text-sky-100' : 'text-slate-900 dark:text-slate-100'}`}>
                        {item.label}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={`
                        h-4 w-4 flex-shrink-0 transition-all
                        ${isActive
                          ? 'text-sky-500 dark:text-sky-300'
                          : 'text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-500'
                        }
                      `}
                    />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Session
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                Keep assessments and reports in one place.
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Your recent predictions, explanations, and appointments stay connected across the dashboard.
              </p>
            </div>

            {/* Mobile-only sidebar actions */}
            <div className="mt-4 space-y-2 lg:hidden">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Actions</p>
              <Link
                to="/dashboard/mail"
                onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                className={`
                  flex items-center gap-3 rounded-[1.35rem] border px-3 py-3 transition-all
                  ${location.pathname === '/dashboard/mail'
                    ? 'border-sky-200 bg-sky-50 shadow-sm dark:border-sky-800 dark:bg-sky-950/30'
                    : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-900'
                  }
                `}
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${location.pathname === '/dashboard/mail' ? 'bg-sky-600 text-white dark:bg-sky-500' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mail</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">View messages</p>
                </div>
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  className="flex items-center gap-3 rounded-[1.35rem] border border-transparent px-3 py-3 text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-900 transition-all"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300">
                    <User className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Admin Panel</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Manage users &amp; reports</p>
                  </div>
                </Link>
              )}
              <div className="flex items-center gap-3 rounded-[1.35rem] border border-transparent px-3 py-2">
                <ThemeToggle />
                <span className="text-sm text-slate-600 dark:text-slate-400">Toggle theme</span>
              </div>
              <div className="hidden rounded-[1.35rem] border border-transparent px-3 py-2 lg:block">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Language</p>
                <LanguageSwitcher className="w-fit" />
              </div>
              <button
                onClick={() => { setSidebarOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-3 rounded-[1.35rem] border border-transparent px-3 py-3 text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:hover:border-rose-900 dark:hover:bg-rose-950/30 transition-all"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                  <LogOut className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold">Logout</p>
                  <p className="mt-0.5 text-xs leading-5 text-rose-500/70 dark:text-rose-400/60">End your session</p>
                </div>
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-30 lg:hidden top-[73px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          {isRootDashboard ? (
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome back, {user?.name?.split(' ')[0] || 'User'}!
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Select an option below to access different features of your health dashboard.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="group"
                  >
                    <div className="bg-white dark:bg-gray-900 border-2 dark:border-gray-800 rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg dark:hover:shadow-blue-900/50 transition-all">
                      <item.icon className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {item.label}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="mt-8 grid md:grid-cols-3 gap-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">Last Assessment</h4>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">15 days ago</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-green-900 dark:text-green-300 mb-1">Risk Level</h4>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">Low</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-900 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-1">Next Appointment</h4>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">Apr 2</p>
                </div>
              </div>

              {/* Next Activity Box */}
              {nextAppointment && (
                <div className="mt-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                      <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Upcoming Activity
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 font-medium">
                        {nextAppointment.doctor}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(nextAppointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {nextAppointment.time}
                        </span>
                        <span className="flex items-center gap-1">
                          {nextAppointment.type === 'video' ? <Video className="h-4 w-4" /> : nextAppointment.type === 'phone' ? <Phone className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                          {nextAppointment.type === 'video' ? 'Video Call' : nextAppointment.type === 'phone' ? 'Phone Call' : 'In-Person'}
                        </span>
                      </div>
                      {nextAppointment.notes && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          {nextAppointment.notes}
                        </p>
                      )}
                    </div>
                    <Link to="/dashboard/appointments">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
