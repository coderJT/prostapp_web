import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { 
  Activity, 
  FileText, 
  Calendar, 
  BookOpen, 
  User, 
  BarChart3, 
  MessageSquare,
  LogOut, 
  Menu,
  X
} from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
    } else {
      setUser(JSON.parse(userData));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

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
    {
      path: '/dashboard/groq-answers',
      icon: MessageSquare,
      label: 'Groq Answers',
      description: 'Read model-generated explanation summaries',
    },
  ];

  // If we're at /dashboard root, show the main navigation
  const isRootDashboard = location.pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <Link to="/" className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">ProstAPP</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
              <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Admin Account' : 'Patient Account'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Hidden on mobile unless toggled */}
        <aside className={`
          fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] w-64 bg-white border-r overflow-y-auto
          transition-transform duration-300 z-40
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-30 lg:hidden top-[73px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          {isRootDashboard ? (
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome back, {user?.name?.split(' ')[0] || 'User'}!
                </h1>
                <p className="text-gray-600">
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
                    <div className="bg-white border-2 rounded-lg p-6 hover:border-blue-400 hover:shadow-lg transition-all">
                      <item.icon className="h-12 w-12 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {item.label}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="mt-8 grid md:grid-cols-3 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Last Assessment</h4>
                  <p className="text-2xl font-bold text-blue-600">15 days ago</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-green-900 mb-1">Risk Level</h4>
                  <p className="text-2xl font-bold text-green-600">Low</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-purple-900 mb-1">Next Appointment</h4>
                  <p className="text-2xl font-bold text-purple-600">Apr 2</p>
                </div>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
