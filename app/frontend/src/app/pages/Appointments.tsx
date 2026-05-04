import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Calendar } from '../components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Video, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '../lib/api';
const ROOM_OPTIONS = Array.from({ length: 100 }, (_, index) => `Room ${index + 1}`);

interface Appointment {
  id: number;
  date: string;
  time: string;
  doctor: string;
  clinician_id?: string | number | null;
  clinician_email?: string | null;
  user_email?: string | null;
  specialty: string;
  type: 'in-person' | 'video' | 'phone';
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
}

interface AppointmentApiRow {
  id: number;
  date: string;
  time: string;
  doctor: string;
  clinician_id?: string | number | null;
  clinician_email?: string | null;
  user_email?: string | null;
  specialty: string;
  type: 'in-person' | 'video' | 'phone';
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string | null;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

interface Clinician {
  id: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  display_name: string;
  specialty: string;
  phone_number: string;
  is_clinician: boolean;
}

interface CliniciansResponse {
  success: boolean;
  clinicians?: Clinician[];
  error?: string;
}

interface AvailableSlotsResponse {
  success: boolean;
  all_slots?: string[];
  booked_slots?: string[];
  user_booked_slots?: string[];
  available_slots?: string[];
  error?: string;
}

function getStoredUserEmail() {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return '';
  }

  try {
    const user = JSON.parse(userStr);
    return typeof user?.email === 'string' ? user.email : '';
  } catch {
    return '';
  }
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

function toAppointment(row: AppointmentApiRow): Appointment {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    doctor: row.doctor,
    clinician_id: row.clinician_id,
    clinician_email: row.clinician_email || null,
    user_email: row.user_email || null,
    specialty: row.specialty,
    type: row.type,
    location: row.location,
    status: row.status,
    notes: row.notes || undefined,
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getRoomOptionsForAppointment(appointments: Appointment[], appointment: Appointment) {
  const occupiedRooms = new Set(
    appointments
      .filter((item) => item.id !== appointment.id)
      .filter((item) => item.status !== 'cancelled')
      .filter((item) => item.date === appointment.date && item.time === appointment.time)
      .map((item) => item.location)
      .filter((location) => ROOM_OPTIONS.some((room) => normalizeText(room) === normalizeText(location)))
      .map((location) => normalizeText(location))
  );

  return ROOM_OPTIONS.map((room) => ({
    value: room,
  })).filter((room) => !occupiedRooms.has(normalizeText(room.value)));
}

export function Appointments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useMemo(() => getStoredUser(), []);
  const currentUserEmail = useMemo(() => {
    return typeof user?.email === 'string' ? user.email.toLowerCase() : '';
  }, [user]);
  const isAdminUser = useMemo(() => user?.role === 'admin', [user]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null);
  const [locationEdits, setLocationEdits] = useState<Record<number, string>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const [newAppointment, setNewAppointment] = useState({
    date: '',
    time: '',
    doctor: '',
    clinicianEmail: '',
    type: 'in-person' as 'in-person' | 'video' | 'phone',
    notes: '',
  });

  const selectedClinician = useMemo(
    () => clinicians.find((clinician) => clinician.user_email === newAppointment.clinicianEmail),
    [clinicians, newAppointment.clinicianEmail]
  );

  const openAppointmentEditor = (appointment: Appointment) => {
    const matchedClinician = clinicians.find(
      (clinician) => clinician.display_name === appointment.doctor || clinician.user_email === appointment.doctor
    );

    setEditingAppointmentId(appointment.id);
    setNewAppointment({
      date: appointment.date,
      time: appointment.time,
      doctor: appointment.doctor,
      clinicianEmail: matchedClinician?.user_email || '',
      type: appointment.type,
      notes: appointment.notes || '',
    });
    setSelectedDate(new Date(`${appointment.date}T00:00:00`));
    setIsDialogOpen(true);
  };

  const closeAppointmentEditor = () => {
    setIsDialogOpen(false);
    setEditingAppointmentId(null);
    setAvailableSlots([]);
    setNewAppointment({ date: '', time: '', doctor: '', clinicianEmail: '', type: 'in-person', notes: '' });
  };

  const todayDateString = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const loadAppointments = async () => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams();
        if (currentUserEmail) {
          query.set('userEmail', currentUserEmail);
        }
        query.set('role', isAdminUser ? 'admin' : 'patient');

        const appointmentsUrl = buildApiUrl(`/api/appointments?${query.toString()}`);
        if (!appointmentsUrl) {
          throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
        }

        const response = await fetch(appointmentsUrl);
        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to load appointments.');
        }

        setAppointments((payload.appointments || []).map(toAppointment));
      } catch (error) {
        console.error('Failed to load appointments:', error);
        toast.error('Could not load appointments from the database');
        setAppointments([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointments();
  }, [currentUserEmail, isAdminUser]);

  useEffect(() => {
    const appointmentId = searchParams.get('appointmentId');
    if (!appointmentId) {
      return;
    }

    const element = document.getElementById(`appointment-${appointmentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchParams, appointments]);

  useEffect(() => {
    const loadClinicians = async () => {
      try {
        const cliniciansUrl = buildApiUrl('/api/appointments/clinicians');
        if (!cliniciansUrl) {
          throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
        }

        const response = await fetch(cliniciansUrl);
        const payload: CliniciansResponse = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to load clinicians.');
        }

        setClinicians(payload.clinicians || []);
      } catch (error) {
        console.error('Failed to load clinicians:', error);
        toast.error('Could not load available doctors');
        setClinicians([]);
      }
    };

    loadClinicians();
  }, []);

  useEffect(() => {
    const loadAvailableSlots = async () => {
      if (!newAppointment.clinicianEmail || !newAppointment.date) {
        setAvailableSlots([]);
        return;
      }

      setSlotsLoading(true);
      try {
        const userEmail = getStoredUserEmail();
        const query = new URLSearchParams({ date: newAppointment.date });

        if (userEmail) {
          query.set('userEmail', userEmail);
        }

        const slotsUrl = buildApiUrl(
          `/api/appointments/available-slots/${encodeURIComponent(newAppointment.clinicianEmail)}?${query.toString()}`
        );
        if (!slotsUrl) {
          throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
        }

        const response = await fetch(slotsUrl);
        const payload: AvailableSlotsResponse = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to load available time slots.');
        }

        const nextSlots = payload.available_slots ?? payload.all_slots ?? [];
        setAvailableSlots(nextSlots);

        if (newAppointment.time && !nextSlots.includes(newAppointment.time)) {
          setNewAppointment((current) => ({ ...current, time: '' }));
        }
      } catch (error) {
        console.error('Failed to load available slots:', error);
        toast.error('Could not load available time slots');
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    loadAvailableSlots();
  }, [newAppointment.clinicianEmail, newAppointment.date]);

  useEffect(() => {
    if (selectedDate) {
      setNewAppointment((current) => ({
        ...current,
        date: formatDateInput(selectedDate),
        time: '',
      }));
    }
  }, [selectedDate]);

  const loadNotifications = async () => {
    if (!currentUserEmail) {
      setNotifications([]);
      return;
    }

    setIsLoadingNotifications(true);
    try {
      const notificationsUrl = buildApiUrl(`/api/notifications?email=${encodeURIComponent(currentUserEmail)}`);
      if (!notificationsUrl) {
        throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(notificationsUrl);
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load notifications.');
      }

      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (!currentUserEmail) {
      return;
    }

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
        throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
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
        throw new Error(payload?.error || 'Failed to mark notification as read.');
      }

      setNotifications((current) => current.filter((item) => item.id !== notificationId));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!currentUserEmail) {
      return;
    }

    try {
      const clearUrl = buildApiUrl('/api/notifications/mark-all-read');
      if (!clearUrl) {
        throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
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
        throw new Error(payload?.error || 'Failed to clear notifications.');
      }

      setNotifications([]);
      toast.success('All notifications marked as read');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear notifications.';
      toast.error(message);
    }
  };

  const handleUpdateLocation = async (appointment: Appointment) => {
    const nextLocation = (locationEdits[appointment.id] || appointment.location || '').trim();

    if (!nextLocation) {
      toast.error('Please enter a location before saving.');
      return;
    }

    if (!currentUserEmail) {
      toast.error('Could not determine current user. Please log in again.');
      return;
    }

    setIsSaving(true);
    try {
      const updateUrl = buildApiUrl(`/api/appointments/${appointment.id}`);
      if (!updateUrl) {
        throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actorEmail: currentUserEmail,
          location: nextLocation,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.appointment) {
        throw new Error(payload?.error || 'Failed to update location.');
      }

      const updated = toAppointment(payload.appointment);
      setAppointments((current) => current.map((item) => (item.id === appointment.id ? updated : item)));
      setLocationEdits((current) => ({ ...current, [appointment.id]: '' }));
      toast.success('Location updated successfully.');
      loadNotifications();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update location.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!newAppointment.date || !newAppointment.time || !newAppointment.doctor || !newAppointment.clinicianEmail) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!availableSlots.includes(newAppointment.time)) {
      toast.error('That time slot is no longer available. Please choose another one.');
      return;
    }

    const payload = {
      userEmail: getStoredUserEmail() || null,
      date: newAppointment.date,
      time: newAppointment.time,
      clinicianEmail: newAppointment.clinicianEmail,
      doctor: selectedClinician?.display_name || newAppointment.doctor,
      specialty: selectedClinician?.specialty || 'Urologist',
      type: newAppointment.type,
      status: 'upcoming',
      notes: newAppointment.notes,
    };

    setIsSaving(true);
    try {
      const isEditing = editingAppointmentId !== null;
      const saveUrl = buildApiUrl(
        isEditing ? `/api/appointments/${editingAppointmentId}` : '/api/appointments'
      );
      if (!saveUrl) {
        throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(
        saveUrl,
        {
          method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      if (!response.ok || !result?.success || !result?.appointment) {
        throw new Error(result?.error || 'Failed to save appointment.');
      }

      setAppointments((current) => {
        const nextAppointment = toAppointment(result.appointment);
        if (isEditing) {
          return current.map((appointment) => (appointment.id === editingAppointmentId ? nextAppointment : appointment));
        }
        return [...current, nextAppointment];
      });
      setEditingAppointmentId(null);
      setNewAppointment({ date: '', time: '', doctor: '', clinicianEmail: '', type: 'in-person', notes: '' });
      setAvailableSlots([]);
      setIsDialogOpen(false);
      toast.success(isEditing ? 'Appointment rescheduled successfully!' : 'Appointment scheduled successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save appointment.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: number) => {
    setIsSaving(true);
    try {
      const cancelUrl = buildApiUrl(`/api/appointments/${appointmentId}`);
      if (!cancelUrl) {
        throw new Error('Appointments backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(cancelUrl, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (!response.ok || !result?.success || !result?.appointment) {
        throw new Error(result?.error || 'Failed to cancel appointment.');
      }

      const cancelledAppointment = toAppointment(result.appointment);
      setAppointments((current) => current.map((appointment) => (appointment.id === appointmentId ? cancelledAppointment : appointment)));
      toast.success('Appointment cancelled successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel appointment.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter((apt) => apt.status === 'upcoming')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appointments]);

  const pastAppointments = useMemo(() => {
    return appointments
      .filter((apt) => apt.status === 'completed')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments]);

  const currentMonthCount = appointments.filter((apt) => {
    const appointmentDate = new Date(apt.date);
    const today = new Date();
    return appointmentDate.getMonth() === today.getMonth() && appointmentDate.getFullYear() === today.getFullYear();
  }).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isAdminUser ? 'Clinician Schedule' : 'Appointments'}
          </h1>
          <p className="text-gray-600">
            {isAdminUser
              ? 'Manage your assigned appointments and update locations for patients.'
              : 'Schedule and manage your healthcare appointments'}
          </p>
        </div>
        {!isAdminUser && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule New Appointment</DialogTitle>
              <DialogDescription>
                {editingAppointmentId ? 'Update the appointment details and time' : 'Book an appointment with your healthcare provider'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doctor">Healthcare Provider *</Label>
                <Select
                  value={newAppointment.clinicianEmail}
                  onValueChange={(value) => {
                    const clinician = clinicians.find((item) => item.user_email === value);
                    setNewAppointment({
                      ...newAppointment,
                      clinicianEmail: value,
                      doctor: clinician?.display_name || '',
                      time: '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinicians.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No doctors available
                      </SelectItem>
                    ) : (
                      clinicians.map((clinician) => (
                        <SelectItem key={clinician.id} value={clinician.user_email}>
                          {clinician.display_name} - {clinician.specialty}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apt-date">Date *</Label>
                  <Input
                    id="apt-date"
                    type="date"
                    min={todayDateString}
                    value={newAppointment.date}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setNewAppointment({ ...newAppointment, date: nextDate, time: '' });
                      if (nextDate) {
                        setSelectedDate(new Date(`${nextDate}T00:00:00`));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apt-time">Time *</Label>
                  <Select
                    value={newAppointment.time}
                    onValueChange={(value) => setNewAppointment({ ...newAppointment, time: value })}
                    disabled={!newAppointment.clinicianEmail || !newAppointment.date || slotsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={slotsLoading ? 'Loading slots...' : 'Select a time'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No available slots
                        </SelectItem>
                      ) : (
                        availableSlots.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-800">Available hours</p>
                <p>8:00 AM to 5:00 PM, 1-hour slots, excluding lunch from 12:00 PM to 1:00 PM.</p>
                <p className="mt-1">Location will be updated by your clinician after booking.</p>
                {newAppointment.clinicianEmail && newAppointment.date && (
                  <p className="mt-1">
                    {selectedClinician ? selectedClinician.display_name : 'Selected doctor'} currently has {availableSlots.length}{' '}
                    open slot{availableSlots.length === 1 ? '' : 's'} on this date.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Appointment Type</Label>
                <Select
                  value={newAppointment.type}
                  onValueChange={(value: 'in-person' | 'video' | 'phone') => setNewAppointment({ ...newAppointment, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in-person">In-Person Visit</SelectItem>
                    <SelectItem value="video">Video Call</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes or reasons for the appointment"
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSchedule} className="flex-1" disabled={isSaving || availableSlots.length === 0}>
                  {isSaving ? 'Saving...' : editingAppointmentId ? 'Save Changes' : 'Schedule'}
                </Button>
                <Button variant="outline" onClick={closeAppointmentEditor} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Mail</CardTitle>
              <CardDescription>Unread appointment notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Unread</span>
                <Badge variant="secondary">{notifications.length}</Badge>
              </div>
              {isLoadingNotifications ? (
                <p className="text-sm text-gray-500">Loading notifications...</p>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-gray-500">No new notifications.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 5).map((notification) => (
                    <div key={notification.id} className="rounded-md border p-2">
                      <p className="text-sm font-medium text-gray-800">{notification.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => markNotificationAsRead(notification.id)}>
                          Mark read
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {notifications.length > 0 && (
                <Button variant="outline" className="w-full" onClick={markAllNotificationsAsRead}>
                  Mark all as read
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calendar</CardTitle>
              <CardDescription>Select a date to view appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  if (date) {
                    setNewAppointment((current) => ({
                      ...current,
                      date: formatDateInput(date),
                      time: '',
                    }));
                  }
                }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Upcoming</span>
                <Badge variant="secondary">{upcomingAppointments.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <Badge variant="secondary">{pastAppointments.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">This Month</span>
                <Badge variant="secondary">{currentMonthCount}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Upcoming Appointments</h2>
            {isLoading ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  Loading appointments from the database...
                </CardContent>
              </Card>
            ) : upcomingAppointments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No upcoming appointments. Schedule one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((apt) => (
                  <Card key={apt.id} id={`appointment-${apt.id}`} className="border-l-4 border-l-blue-500 scroll-mt-24">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{apt.doctor}</CardTitle>
                          <CardDescription>{apt.specialty}</CardDescription>
                        </div>
                        <Badge className={getStatusColor(apt.status)} variant="secondary">
                          {apt.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          {new Date(apt.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {apt.time}
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          {getTypeIcon(apt.type)}
                          {apt.location}
                        </div>
                        {apt.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-md text-gray-600">
                            {apt.notes}
                          </div>
                        )}
                      </div>
                      {isAdminUser && currentUserEmail && apt.clinician_email?.toLowerCase() === currentUserEmail && (
                        <div className="mt-4 space-y-2 rounded-md border p-3">
                          <Label htmlFor={`location-${apt.id}`}>Set appointment location</Label>
                          <div className="flex gap-2">
                            <Select
                              value={locationEdits[apt.id] ?? apt.location ?? ''}
                              onValueChange={(value) => setLocationEdits((current) => ({
                                ...current,
                                [apt.id]: value,
                              }))}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select a room" />
                              </SelectTrigger>
                              <SelectContent>
                                {getRoomOptionsForAppointment(appointments, apt).map((room) => (
                                  <SelectItem key={room.value} value={room.value}>
                                    {room.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" onClick={() => handleUpdateLocation(apt)} disabled={isSaving}>
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline" onClick={() => openAppointmentEditor(apt)}>
                          Reschedule
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCancelAppointment(apt.id)} disabled={isSaving || apt.status === 'cancelled'}>
                          Cancel
                        </Button>
                        {apt.type === 'video' && <Button size="sm">Join Video Call</Button>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Past Appointments</h2>
            {pastAppointments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No past appointments.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastAppointments.map((apt) => (
                  <Card key={apt.id} id={`appointment-${apt.id}`} className="opacity-75 scroll-mt-24">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{apt.doctor}</CardTitle>
                          <CardDescription>{apt.specialty}</CardDescription>
                        </div>
                        <Badge className={getStatusColor(apt.status)} variant="secondary">
                          {apt.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          {new Date(apt.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {apt.time}
                        </div>
                        {apt.notes && <div className="mt-3 p-3 bg-gray-50 rounded-md text-gray-600">{apt.notes}</div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
