import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, Mail, RefreshCw, CheckCheck, Clock3, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { buildApiUrl } from '../lib/api';

interface NotificationItem {
  id: number;
  recipient_email: string;
  category: string;
  title: string;
  message: string;
  appointment_id?: number | null;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
}

function getStoredUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return null;
  }

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function formatRelativeTime(value: string) {
  const createdAt = new Date(value).getTime();
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function MailPage() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const currentUserEmail = useMemo(() => {
    return typeof user?.email === 'string' ? user.email.toLowerCase() : '';
  }, [user]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.length;

  const loadNotifications = async () => {
    if (!currentUserEmail) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      const notificationsUrl = buildApiUrl(`/api/notifications?email=${encodeURIComponent(currentUserEmail)}`);
      if (!notificationsUrl) {
        throw new Error('Mail backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(notificationsUrl);
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load notifications.');
      }

      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Could not load mail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [currentUserEmail]);

  const markNotificationAsRead = async (notificationId: number) => {
    if (!currentUserEmail) {
      return;
    }

    try {
      const readUrl = buildApiUrl(`/api/notifications/${notificationId}/read`);
      if (!readUrl) {
        throw new Error('Mail backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(readUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: currentUserEmail }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to mark message as read.');
      }

      setNotifications((current) => current.filter((item) => item.id !== notificationId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark message as read.';
      toast.error(message);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUserEmail) {
      return;
    }

    try {
      const clearUrl = buildApiUrl('/api/notifications/mark-all-read');
      if (!clearUrl) {
        throw new Error('Mail backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(clearUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: currentUserEmail }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to clear messages.');
      }

      setNotifications([]);
      toast.success('Mail cleared');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear messages.';
      toast.error(message);
    }
  };

  const openAppointment = async (notificationId: number, appointmentId?: number | null) => {
    await markNotificationAsRead(notificationId);

    if (!appointmentId) {
      navigate('/dashboard/appointments');
      return;
    }

    navigate(`/dashboard/appointments?appointmentId=${appointmentId}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
            <Mail className="h-4 w-4" />
            Mail
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Notifications Inbox</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">View appointment updates, location changes, and reminder messages here.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadNotifications}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={markAllAsRead} disabled={notifications.length === 0}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              Inbox Summary
            </CardTitle>
            <CardDescription>Unread notifications for your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-white/70 p-4 dark:bg-slate-900/40">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unread</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{unreadCount}</p>
              </div>
              <Badge variant="secondary">Live</Badge>
            </div>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                Day-before appointment reminders
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                Location updates from your doctor
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                Appointment booking updates
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>Your newest appointment notifications appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading mail...</div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                No new messages. You’ll see booking, location, and reminder notices here.
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification, index) => (
                  <div key={notification.id}>
                    <div className="flex flex-col gap-3 rounded-xl border bg-white/80 p-4 shadow-sm dark:bg-slate-900/60 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{notification.category.replace(/-/g, ' ')}</Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(notification.created_at)}</span>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">{notification.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{notification.message}</p>
                      </div>
                      <div className="flex items-center gap-2 self-start">
                        <Button size="sm" variant="outline" onClick={() => markNotificationAsRead(notification.id)}>
                          Mark read
                        </Button>
                        {notification.appointment_id ? (
                          <Button size="sm" onClick={() => openAppointment(notification.id, notification.appointment_id)}>
                            View appointment
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {index < notifications.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
