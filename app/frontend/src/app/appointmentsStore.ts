import { getStoredUser } from './auth/session';

export interface Appointment {
  id: number;
  date: string;
  time: string;
  doctor: string;
  specialty: string;
  type: 'in-person' | 'video' | 'phone';
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
}

const STORAGE_KEY = 'userAppointments';

function getCurrentUserKey() {
  const user = getStoredUser();
  if (user?.id) return `id:${String(user.id)}`;
  if (user?.email) return `email:${String(user.email).toLowerCase()}`;
  return 'guest';
}

function readAppointmentsStore(): Record<string, Appointment[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAppointmentsStore(value: Record<string, Appointment[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getAppointmentsForCurrentUser(): Appointment[] {
  const store = readAppointmentsStore();
  const key = getCurrentUserKey();
  return Array.isArray(store[key]) ? store[key] : [];
}

export function saveAppointment(appointment: Omit<Appointment, 'id'>): Appointment {
  const store = readAppointmentsStore();
  const key = getCurrentUserKey();
  const existing = Array.isArray(store[key]) ? store[key] : [];
  
  const newAppointment: Appointment = {
    ...appointment,
    id: Date.now(),
  };
  
  store[key] = [newAppointment, ...existing];
  writeAppointmentsStore(store);
  
  return newAppointment;
}

export function getNextAppointment(): Appointment | null {
  const appointments = getAppointmentsForCurrentUser();
  const now = new Date();
  
  const upcoming = appointments
    .filter(apt => apt.status === 'upcoming' && new Date(apt.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return upcoming[0] || null;
}

export function clearAppointmentsForCurrentUser() {
  const store = readAppointmentsStore();
  const key = getCurrentUserKey();
  store[key] = [];
  writeAppointmentsStore(store);
}