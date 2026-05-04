const express = require('express');

const { getSupabase } = require('../config/supabase');

const router = express.Router();
const NOTIFICATIONS_TABLE = 'notifications';
const APPOINTMENTS_TABLE = 'appointments';
const USERS_TABLE = 'users';

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function formatDate(dateString) {
    return dateString;
}

function formatUserLabel(userRecord, fallbackLabel) {
    if (!userRecord) {
        return fallbackLabel;
    }

    const firstName = typeof userRecord.user_first_name === 'string' ? userRecord.user_first_name.trim() : '';
    const lastName = typeof userRecord.user_last_name === 'string' ? userRecord.user_last_name.trim() : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

    return fullName || normalizeEmail(userRecord.user_email) || fallbackLabel;
}

async function ensureDayBeforeReminders(supabase) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowDate = `${yyyy}-${mm}-${dd}`;

    let { data: appointments, error } = await supabase
        .from(APPOINTMENTS_TABLE)
        .select('*')
        .eq('appointment_date', tomorrowDate)
        .eq('status', 'upcoming');

    if (error) {
        const fallback = await supabase
            .from(APPOINTMENTS_TABLE)
            .select('*')
            .eq('date', tomorrowDate)
            .eq('status', 'upcoming');

        appointments = fallback.data;
        error = fallback.error;
    }

    if (error || !Array.isArray(appointments) || appointments.length === 0) {
        return;
    }

    for (const appointment of appointments) {
        const appointmentId = appointment.id;
        const appointmentDate = appointment.appointment_date || appointment.date;
        const appointmentTime = appointment.appointment_time || appointment.time;
        const patientEmail = normalizeEmail(appointment.user_email);
        const clinicianEmail = normalizeEmail(appointment.clinician_email);

        const [{ data: patientRecord }, { data: clinicianRecord }] = await Promise.all([
            patientEmail
                ? supabase.from(USERS_TABLE).select('user_first_name, user_last_name, user_email').eq('user_email', patientEmail).maybeSingle()
                : Promise.resolve({ data: null }),
            clinicianEmail
                ? supabase.from(USERS_TABLE).select('user_first_name, user_last_name, user_email').eq('user_email', clinicianEmail).maybeSingle()
                : Promise.resolve({ data: null }),
        ]);

        const patientLabel = formatUserLabel(patientRecord, patientEmail || 'the patient');
        const clinicianLabel = formatUserLabel(clinicianRecord, clinicianEmail || 'your clinician');

        const recipients = [
            patientEmail,
            clinicianEmail,
        ].filter(Boolean);

        for (const recipientEmail of recipients) {
            const isClinicianRecipient = recipientEmail === clinicianEmail;
            const reminderMessage = isClinicianRecipient
                ? `Reminder: Your patient ${patientLabel} has an appointment tomorrow (${formatDate(appointmentDate)}) at ${appointmentTime}.`
                : `Reminder: You have an appointment with ${clinicianLabel} tomorrow (${formatDate(appointmentDate)}) at ${appointmentTime}.`;

            await supabase
                .from(NOTIFICATIONS_TABLE)
                .upsert([
                    {
                        recipient_email: recipientEmail,
                        category: 'appointment-reminder-day-before',
                        title: 'Appointment reminder',
                        message: reminderMessage,
                        appointment_id: appointmentId,
                        is_read: false,
                        dedupe_key: `appointment-reminder-day-before:${appointmentId}:${recipientEmail}:${tomorrowDate}`,
                        metadata: {
                            reminder_for_date: tomorrowDate,
                            appointment_date: appointmentDate,
                            appointment_time: appointmentTime,
                        },
                    },
                ], { onConflict: 'dedupe_key' });
        }
    }
}

router.get('/', async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const includeRead = String(req.query.includeRead || '').toLowerCase() === 'true';

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email query parameter is required.' });
        }

        const supabase = getSupabase();
        await ensureDayBeforeReminders(supabase);

        let query = supabase
            .from(NOTIFICATIONS_TABLE)
            .select('*')
            .eq('recipient_email', email)
            .order('created_at', { ascending: false })
            .limit(100);

        if (!includeRead) {
            query = query.eq('is_read', false);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ success: false, error: error.message, notifications: [] });
        }

        return res.status(200).json({
            success: true,
            notifications: Array.isArray(data) ? data : [],
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message, notifications: [] });
    }
});

router.get('/unread-count', async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email query parameter is required.' });
        }

        const supabase = getSupabase();
        await ensureDayBeforeReminders(supabase);

        const { count, error } = await supabase
            .from(NOTIFICATIONS_TABLE)
            .select('*', { count: 'exact', head: true })
            .eq('recipient_email', email)
            .eq('is_read', false);

        if (error) {
            return res.status(500).json({ success: false, error: error.message, unreadCount: 0 });
        }

        return res.status(200).json({ success: true, unreadCount: count || 0 });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message, unreadCount: 0 });
    }
});

router.patch('/mark-all-read', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required.' });
        }

        const supabase = getSupabase();
        const { error } = await supabase
            .from(NOTIFICATIONS_TABLE)
            .update({
                is_read: true,
                read_at: new Date().toISOString(),
            })
            .eq('recipient_email', email)
            .eq('is_read', false);

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.patch('/:id/read', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const email = normalizeEmail(req.body.email);

        if (!id || !email) {
            return res.status(400).json({ success: false, error: 'Notification id and email are required.' });
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from(NOTIFICATIONS_TABLE)
            .update({
                is_read: true,
                read_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('recipient_email', email)
            .select('*')
            .maybeSingle();

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        if (!data) {
            return res.status(404).json({ success: false, error: 'Notification not found.' });
        }

        return res.status(200).json({ success: true, notification: data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
