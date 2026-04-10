import { useState } from 'react';
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

interface Appointment {
  id: number;
  date: Date;
  time: string;
  doctor: string;
  specialty: string;
  type: 'in-person' | 'video' | 'phone';
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
}

export function Appointments() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: 1,
      date: new Date(2026, 3, 5),
      time: '10:00 AM',
      doctor: 'Dr. Sarah Smith',
      specialty: 'Urologist',
      type: 'in-person',
      location: 'Medical Center - Room 302',
      status: 'upcoming',
      notes: 'Follow-up consultation',
    },
    {
      id: 2,
      date: new Date(2026, 3, 15),
      time: '2:30 PM',
      doctor: 'Dr. Michael Johnson',
      specialty: 'Oncologist',
      type: 'video',
      location: 'Virtual Appointment',
      status: 'upcoming',
      notes: 'Risk assessment review',
    },
    {
      id: 3,
      date: new Date(2026, 2, 1),
      time: '9:00 AM',
      doctor: 'Dr. Sarah Smith',
      specialty: 'Urologist',
      type: 'in-person',
      location: 'Medical Center - Room 302',
      status: 'completed',
      notes: 'Annual PSA screening',
    },
  ]);

  const [newAppointment, setNewAppointment] = useState({
    date: '',
    time: '',
    doctor: '',
    type: 'in-person' as 'in-person' | 'video' | 'phone',
    notes: '',
  });

  const handleSchedule = () => {
    if (!newAppointment.date || !newAppointment.time || !newAppointment.doctor) {
      toast.error('Please fill in all required fields');
      return;
    }

    const appointment: Appointment = {
      id: appointments.length + 1,
      date: new Date(newAppointment.date),
      time: newAppointment.time,
      doctor: newAppointment.doctor,
      specialty: 'Urologist',
      type: newAppointment.type,
      location: newAppointment.type === 'in-person' ? 'Medical Center - Room 302' : 'Virtual Appointment',
      status: 'upcoming',
      notes: newAppointment.notes,
    };

    setAppointments([...appointments, appointment]);
    setNewAppointment({ date: '', time: '', doctor: '', type: 'in-person', notes: '' });
    setIsDialogOpen(false);
    toast.success('Appointment scheduled successfully!');
  };

  const upcomingAppointments = appointments.filter(apt => apt.status === 'upcoming').sort((a, b) => a.date.getTime() - b.date.getTime());
  const pastAppointments = appointments.filter(apt => apt.status === 'completed').sort((a, b) => b.date.getTime() - a.date.getTime());

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Appointments</h1>
          <p className="text-gray-600">Schedule and manage your healthcare appointments</p>
        </div>
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
              <DialogDescription>Book an appointment with your healthcare provider</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doctor">Healthcare Provider *</Label>
                <Select value={newAppointment.doctor} onValueChange={(value) => setNewAppointment({ ...newAppointment, doctor: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr. Sarah Smith">Dr. Sarah Smith - Urologist</SelectItem>
                    <SelectItem value="Dr. Michael Johnson">Dr. Michael Johnson - Oncologist</SelectItem>
                    <SelectItem value="Dr. Emily Brown">Dr. Emily Brown - General Practitioner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apt-date">Date *</Label>
                  <Input
                    id="apt-date"
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apt-time">Time *</Label>
                  <Input
                    id="apt-time"
                    type="time"
                    value={newAppointment.time}
                    onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Appointment Type</Label>
                <Select value={newAppointment.type} onValueChange={(value: any) => setNewAppointment({ ...newAppointment, type: value })}>
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
                <Button onClick={handleSchedule} className="flex-1">Schedule</Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calendar</CardTitle>
              <CardDescription>Select a date to view appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Quick Stats */}
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
                <Badge variant="secondary">2</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Appointments List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Appointments */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Upcoming Appointments</h2>
            {upcomingAppointments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No upcoming appointments. Schedule one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((apt) => (
                  <Card key={apt.id} className="border-l-4 border-l-blue-500">
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
                          {apt.date.toLocaleDateString('en-US', { 
                            weekday: 'long',
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
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
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline">Reschedule</Button>
                        <Button size="sm" variant="outline">Cancel</Button>
                        {apt.type === 'video' && (
                          <Button size="sm">Join Video Call</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Past Appointments */}
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
                  <Card key={apt.id} className="opacity-75">
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
                          {apt.date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {apt.time}
                        </div>
                        {apt.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-md text-gray-600">
                            {apt.notes}
                          </div>
                        )}
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
