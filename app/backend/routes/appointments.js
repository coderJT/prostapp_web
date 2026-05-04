const express = require('express');

const { getSupabase } = require('../config/supabase');

const router = express.Router();
const APPOINTMENTS_TABLE = 'appointments';
const USERS_TABLE = 'users';
const NOTIFICATIONS_TABLE = 'notifications';
const ALLOWED_TYPES = new Set(['in-person', 'video', 'phone']);
const ALLOWED_STATUSES = new Set(['upcoming', 'completed', 'cancelled']);
const ROOM_OPTIONS = Array.from({ length: 100 }, (_, index) => `Room ${index + 1}`);

async function createNotification(supabase, payload) {
    try {
        await supabase
            .from(NOTIFICATIONS_TABLE)
            .insert([payload]);
    } catch (_error) {
        // Do not block appointment flow when notification table is unavailable.
    }
}

function generateTimeSlots() {
    const slots = [];
    for (let hour = 8; hour < 17; hour++) {
        if (hour === 12) continue; // Skip lunch hour (12pm-1pm)
        slots.push(`${String(hour).padStart(2, '0')}:00`);
    }
    return slots;
}

function normalizeAppointment(row) {
    if (!row) return null;
    const fallbackClinicianLabel = row.clinician_email || row.clinician_id || '';
    return {
        id: row.id || null,
        date: row.appointment_date || row.date || null,
        time: row.appointment_time || row.time || null,
        doctor: row.doctor || fallbackClinicianLabel,
        clinician_id: row.clinician_id || null,
        clinician_email: row.clinician_email || null,
        user_email: row.user_email || null,
        specialty: row.specialty || 'Urologist',
        type: row.appointment_type || 'in-person',
        location: row.location || '',
        status: row.status || 'upcoming',
        notes: row.notes || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
    };
}

function sortAppointments(appointments) {
    return appointments.sort((left, right) => {
        const leftDate = new Date(`${left.date || ''}T${left.time || '00:00'}`).getTime();
        const rightDate = new Date(`${right.date || ''}T${right.time || '00:00'}`).getTime();
        return leftDate - rightDate;
    });
}

async function queryAppointmentsWithFallback(supabase, filters = []) {
    let query = supabase.from(APPOINTMENTS_TABLE).select('*');

    for (const filter of filters) {
        query = filter(query);
    }

    const primaryResult = await query;
    if (!primaryResult.error) {
        return primaryResult;
    }

    const errorMessage = String(primaryResult.error.message || '').toLowerCase();
    const shouldRetry = errorMessage.includes('appointment_date') || errorMessage.includes('appointment_time');

    return shouldRetry ? primaryResult : primaryResult;
}

function normalizeText(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isRoomLocation(location) {
    const normalizedLocation = normalizeText(location);
    return ROOM_OPTIONS.some((room) => normalizeText(room) === normalizedLocation);
}

function normalizeClinician(row) {
    const firstName = typeof row.user_first_name === 'string' ? row.user_first_name.trim() : '';
    const lastName = typeof row.user_last_name === 'string' ? row.user_last_name.trim() : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const roleValue = typeof row.role === 'string' ? row.role.trim().toLowerCase() : '';
    const userRoleValue = typeof row.user_role === 'string' ? row.user_role.trim().toLowerCase() : '';
    const clinicalRoleValue = typeof row.clinicalRole === 'string'
        ? row.clinicalRole.trim().toLowerCase()
        : (typeof row.clinical_role === 'string' ? row.clinical_role.trim().toLowerCase() : '');
    const isClinician = row.is_clinician === true
        || roleValue === 'admin'
        || userRoleValue === 'admin'
        || clinicalRoleValue === 'doctor'
        || clinicalRoleValue === 'nurse'
        || clinicalRoleValue === 'clinician';

    return {
        id: row.id,
        user_email: row.user_email,
        user_first_name: firstName,
        user_last_name: lastName,
        display_name: fullName || row.user_email,
        specialty: typeof row.specialty === 'string' ? row.specialty.trim() : 'Clinician',
        phone_number: typeof row.user_phone_number === 'string' ? row.user_phone_number.trim() : '',
        is_clinician: isClinician,
    };
}

router.get('/clinicians', async (_req, res) => {
    try {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select('*');

        if (error) {
            return res.status(500).json({ success: false, error: error.message, clinicians: [] });
        }

        const clinicians = (Array.isArray(data) ? data : [])
            .filter(Boolean)
            .map(normalizeClinician)
            .filter((clinician) => clinician.is_clinician)
            .sort((left, right) => {
                const leftName = `${left.user_first_name} ${left.user_last_name}`.trim().toLowerCase();
                const rightName = `${right.user_first_name} ${right.user_last_name}`.trim().toLowerCase();
                return leftName.localeCompare(rightName);
            });
        return res.status(200).json({
            success: true,
            clinicians: clinicians,
        });}
    catch (error) {
        return res.status(500).json({ success: false, error: error.message, clinicians: [] });
    }
});

router.get('/available-slots/:clinicianEmail', async (req, res) => {
    try {
        const { clinicianEmail: rawClinicianEmail } = req.params;
        const { date } = req.query;
        const clinicianEmail = decodeURIComponent(rawClinicianEmail || '').trim();

        if (!date || !clinicianEmail) {
            return res.status(400).json({ success: false, error: 'Date query parameter and clinician email are required.' });
        }

        const supabase = getSupabase();

        const { data: clinicianRecord, error: clinicianError } = await supabase
            .from(USERS_TABLE)
            .select('*')
            .eq('user_email', clinicianEmail)
            .maybeSingle();

        if (clinicianError) {
            return res.status(500).json({ success: false, error: clinicianError.message, available_slots: [], booked_slots: [], user_booked_slots: [], all_slots: [] });
        }

        if (!clinicianRecord) {
            const fallbackSlots = generateTimeSlots();
            const selectedDate = new Date(`${date}T00:00:00`);
            const today = new Date();
            today.setSeconds(0, 0);

            const futureFallbackSlots = fallbackSlots.filter((slot) => {
                if (selectedDate.toDateString() !== today.toDateString()) {
                    return true;
                }

                const [hour, minute] = slot.split(':').map(Number);
                const slotDateTime = new Date(selectedDate);
                slotDateTime.setHours(hour, minute, 0, 0);
                return slotDateTime > today;
            });

            return res.status(200).json({
                success: true,
                date: date,
                clinician_email: clinicianEmail,
                all_slots: futureFallbackSlots,
                booked_slots: [],
                available_slots: futureFallbackSlots,
            });
        }

        const clinicianDisplayName = [clinicianRecord.user_first_name, clinicianRecord.user_last_name]
            .filter(Boolean)
            .join(' ')
            .trim();

        const fallbackSlots = generateTimeSlots();
        const selectedDate = new Date(`${date}T00:00:00`);
        const today = new Date();
        today.setSeconds(0, 0);

        const futureSlots = fallbackSlots.filter((slot) => {
            if (selectedDate.toDateString() !== today.toDateString()) {
                return true;
            }

            const [hour, minute] = slot.split(':').map(Number);
            const slotDateTime = new Date(selectedDate);
            slotDateTime.setHours(hour, minute, 0, 0);
            return slotDateTime > today;
        });

        // Read all appointments for the selected day, then narrow them to the selected clinician.
        const { data: appointments, error: appointmentError } = await queryAppointmentsWithFallback(supabase, [
            (query) => query.eq('appointment_date', date),
        ]);

        if (appointmentError) {
            return res.status(200).json({
                success: true,
                date: date,
                clinician_email: clinicianEmail,
                all_slots: futureSlots,
                booked_slots: [],
                available_slots: futureSlots,
            });
        }

        if (!Array.isArray(appointments) || appointments.length === 0) {
            return res.status(200).json({
                success: true,
                date: date,
                clinician_email: clinicianEmail,
                all_slots: futureSlots,
                booked_slots: [],
                available_slots: futureSlots,
            });
        }

        const normalizedClinicianEmail = normalizeText(clinicianRecord.user_email);
        const clinicianName = normalizeText(clinicianDisplayName);
        const selectedClinicianEmail = normalizedClinicianEmail;

        const clinicianAppointments = (Array.isArray(appointments) ? appointments : [])
            .filter((row) => {
                const rowDoctor = normalizeText(row.doctor);
                const rowClinicianEmail = normalizeText(row.clinician_email);
                return rowClinicianEmail === selectedClinicianEmail || rowDoctor === clinicianName;
            })
            .filter((row) => normalizeText(row.status) !== 'cancelled');

        if (clinicianAppointments.length === 0) {
            return res.status(200).json({
                success: true,
                date: date,
                clinician_email: clinicianEmail,
                all_slots: futureSlots,
                booked_slots: [],
                available_slots: futureSlots,
            });
        }

        // Get booked times from database
        const bookedTimes = new Set(
            clinicianAppointments
                .map(apt => apt.appointment_time || apt.time)
                .filter(Boolean)
        );

        // Filter available slots (remove all booked slots and past times on the selected day)
        const availableSlots = futureSlots.filter(slot => !bookedTimes.has(slot));

        return res.status(200).json({
            success: true,
            date: date,
            clinician_email: clinicianEmail,
            all_slots: futureSlots,
            booked_slots: Array.from(bookedTimes),
            available_slots: availableSlots,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const requesterEmail = normalizeText(req.query.userEmail);
        const requesterRole = normalizeText(req.query.role);
        const isAdminRequester = requesterRole === 'admin';

        const supabase = getSupabase();

        let query = supabase
            .from(APPOINTMENTS_TABLE)
            .select('*');

        if (requesterEmail) {
            query = query.eq(isAdminRequester ? 'clinician_email' : 'user_email', requesterEmail);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ success: false, error: error.message, appointments: [] });
        }

        const appointments = (Array.isArray(data) ? data : []).filter(Boolean).map(normalizeAppointment);
        return res.status(200).json({
            success: true,
            appointments: sortAppointments(appointments),
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message, appointments: [] });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            userEmail,
            date,
            time,
            clinicianEmail,
            type,
            location,
            status,
            notes,
        } = req.body;

        if (!date || !time || !clinicianEmail) {
            return res.status(400).json({ success: false, error: 'Date, time, and clinician_email are required.' });
        }

        const appointmentType = typeof type === 'string' ? type.trim().toLowerCase() : 'in-person';
        const appointmentStatus = typeof status === 'string' ? status.trim().toLowerCase() : 'upcoming';

        if (!ALLOWED_TYPES.has(appointmentType)) {
            return res.status(400).json({ success: false, error: 'Invalid appointment type.' });
        }

        if (!ALLOWED_STATUSES.has(appointmentStatus)) {
            return res.status(400).json({ success: false, error: 'Invalid appointment status.' });
        }

        const supabase = getSupabase();
        const normalizedClinicianEmail = typeof clinicianEmail === 'string' ? clinicianEmail.trim() : '';

        const { data: clinicianRecord, error: clinicianError } = await supabase
            .from(USERS_TABLE)
            .select('id, user_first_name, user_last_name, user_email, user_phone_number')
            .eq('is_clinician', true)
            .eq('user_email', normalizedClinicianEmail)
            .maybeSingle();

        if (clinicianError) {
            return res.status(500).json({ success: false, error: clinicianError.message });
        }

        if (!clinicianRecord) {
            return res.status(400).json({ success: false, error: 'Selected healthcare provider must be a clinician or admin.' });
        }

        const normalizedUserEmail = typeof userEmail === 'string' && userEmail.trim() ? userEmail.trim().toLowerCase() : null;

        const primaryPayload = {
            user_email: normalizedUserEmail,
            appointment_date: date,
            appointment_time: time,
            clinician_email: clinicianRecord.user_email,
            appointment_type: appointmentType,
            location: typeof location === 'string' && location.trim()
                ? location.trim()
                : 'Pending clinician update',
            status: appointmentStatus,
            notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
            updated_at: new Date().toISOString(),
        };

        const fallbackPayload = {
            user_email: normalizedUserEmail,
            date,
            time,
            clinician_email: clinicianRecord.user_email,
            appointment_type: appointmentType,
            location: typeof location === 'string' && location.trim()
                ? location.trim()
                : 'Pending clinician update',
            status: appointmentStatus,
            notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
            updated_at: new Date().toISOString(),
        };

        const attemptInsert = async (basePayload) => {
            const payload = { ...basePayload };

            for (let attempt = 0; attempt < 8; attempt += 1) {
                const result = await supabase
                    .from(APPOINTMENTS_TABLE)
                    .insert([payload])
                    .select('*')
                    .single();

                if (!result.error) {
                    return result;
                }

                const errorMessage = String(result.error.message || '');
                const missingColumns = [...errorMessage.matchAll(/Could not find the '([^']+)' column/gi)]
                    .map((match) => match[1])
                    .filter(Boolean);

                let strippedColumn = false;
                for (const column of missingColumns) {
                    if (Object.prototype.hasOwnProperty.call(payload, column)) {
                        delete payload[column];
                        strippedColumn = true;
                    }
                }

                if (!strippedColumn) {
                    return result;
                }
            }

            return await supabase
                .from(APPOINTMENTS_TABLE)
                .insert([payload])
                .select('*')
                .single();
        };

        let insertResult = await attemptInsert(primaryPayload);

        if (insertResult.error) {
            const firstErrorMessage = String(insertResult.error.message || '').toLowerCase();
            const shouldRetryInsert = firstErrorMessage.includes('appointment_date') || firstErrorMessage.includes('appointment_time') || firstErrorMessage.includes('date') || firstErrorMessage.includes('time');

            if (shouldRetryInsert) {
                insertResult = await attemptInsert(fallbackPayload);
            }
        }

        const { data, error } = insertResult;

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        await createNotification(supabase, {
            recipient_email: clinicianRecord.user_email,
            category: 'appointment-booked',
            title: 'New appointment booked',
            message: `${normalizedUserEmail || 'A user'} booked an appointment on ${date} at ${time}.`,
            appointment_id: data.id,
            is_read: false,
            dedupe_key: `appointment-booked:${data.id}:${clinicianRecord.user_email}`,
            metadata: {
                appointment_date: date,
                appointment_time: time,
                user_email: normalizedUserEmail,
            },
        });

        return res.status(201).json({
            success: true,
            appointment: normalizeAppointment(data),
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            userEmail,
            actorEmail,
            date,
            time,
            clinicianEmail,
            type,
            location,
            status,
            notes,
        } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Appointment id is required.' });
        }

        const supabase = getSupabase();

        const { data: existingAppointment, error: existingError } = await supabase
            .from(APPOINTMENTS_TABLE)
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (existingError) {
            return res.status(500).json({ success: false, error: existingError.message });
        }

        if (!existingAppointment) {
            return res.status(404).json({ success: false, error: 'Appointment not found.' });
        }

        const appointmentType = typeof type === 'string' ? type.trim().toLowerCase() : normalizeText(existingAppointment.appointment_type || existingAppointment.type) || 'in-person';
        const appointmentStatus = typeof status === 'string' ? status.trim().toLowerCase() : normalizeText(existingAppointment.status) || 'upcoming';

        if (!ALLOWED_TYPES.has(appointmentType)) {
            return res.status(400).json({ success: false, error: 'Invalid appointment type.' });
        }

        if (!ALLOWED_STATUSES.has(appointmentStatus)) {
            return res.status(400).json({ success: false, error: 'Invalid appointment status.' });
        }

        const normalizedClinicianEmail = typeof clinicianEmail === 'string' ? clinicianEmail.trim() : '';
        const normalizedActorEmail = typeof actorEmail === 'string' ? actorEmail.trim().toLowerCase() : '';
        const normalizedRequestedLocation = typeof location === 'string' ? location.trim() : '';
        const existingLocation = typeof existingAppointment.location === 'string' ? existingAppointment.location : '';

        let canUpdateLocation = false;
        if (normalizedRequestedLocation && normalizedRequestedLocation !== existingLocation) {
            const appointmentClinicianEmail = normalizeText(existingAppointment.clinician_email);
            const actorMatchesClinician = normalizeText(normalizedActorEmail) && normalizeText(normalizedActorEmail) === appointmentClinicianEmail;

            if (!actorMatchesClinician) {
                return res.status(403).json({ success: false, error: 'Only the assigned clinician can update location.' });
            }

            const { data: actorRecord, error: actorError } = await supabase
                .from(USERS_TABLE)
                .select('user_email, is_clinician')
                .eq('user_email', normalizedActorEmail)
                .eq('is_clinician', true)
                .maybeSingle();

            if (actorError) {
                return res.status(500).json({ success: false, error: actorError.message });
            }

            if (!actorRecord) {
                return res.status(403).json({ success: false, error: 'Only clinicians can update location.' });
            }

            canUpdateLocation = true;

            if (isRoomLocation(normalizedRequestedLocation)) {
                const appointmentDate = existingAppointment.appointment_date || existingAppointment.date;
                const appointmentTime = existingAppointment.appointment_time || existingAppointment.time;

                const { data: conflictingAppointment, error: conflictError } = await supabase
                    .from(APPOINTMENTS_TABLE)
                    .select('id, location, appointment_date, appointment_time, status')
                    .eq('status', 'upcoming')
                    .eq('appointment_date', appointmentDate)
                    .eq('appointment_time', appointmentTime)
                    .ilike('location', normalizedRequestedLocation)
                    .neq('id', id)
                    .maybeSingle();

                if (conflictError) {
                    return res.status(500).json({ success: false, error: conflictError.message });
                }

                if (conflictingAppointment) {
                    return res.status(409).json({ success: false, error: 'That room is already booked for the selected date and time.' });
                }
            }
        }

        let clinicianQuery = supabase
            .from(USERS_TABLE)
            .select('id, user_first_name, user_last_name, user_email')
            .eq('is_clinician', true);

        if (normalizedClinicianEmail) {
            clinicianQuery = clinicianQuery.eq('user_email', normalizedClinicianEmail);
        } else if (typeof existingAppointment.clinician_email === 'string' && existingAppointment.clinician_email.trim()) {
            clinicianQuery = clinicianQuery.eq('user_email', existingAppointment.clinician_email.trim());
        }

        const { data: clinicianRecord, error: clinicianError } = await clinicianQuery.maybeSingle();

        if (clinicianError) {
            return res.status(500).json({ success: false, error: clinicianError.message });
        }

        const normalizedUserEmail = typeof userEmail === 'string' && userEmail.trim() ? userEmail.trim().toLowerCase() : (existingAppointment.user_email || null);

        const updatePayloads = [
            {
                user_email: normalizedUserEmail,
                appointment_date: typeof date === 'string' && date.trim() ? date.trim() : existingAppointment.appointment_date || existingAppointment.date,
                appointment_time: typeof time === 'string' && time.trim() ? time.trim() : existingAppointment.appointment_time || existingAppointment.time,
                clinician_email: clinicianRecord ? clinicianRecord.user_email : existingAppointment.clinician_email || null,
                appointment_type: appointmentType,
                location: canUpdateLocation ? normalizedRequestedLocation : (existingAppointment.location || ''),
                status: appointmentStatus,
                notes: typeof notes === 'string' ? notes.trim() || null : existingAppointment.notes || null,
                updated_at: new Date().toISOString(),
            },
            {
                user_email: normalizedUserEmail,
                date: typeof date === 'string' && date.trim() ? date.trim() : existingAppointment.date || existingAppointment.appointment_date,
                time: typeof time === 'string' && time.trim() ? time.trim() : existingAppointment.time || existingAppointment.appointment_time,
                clinician_email: clinicianRecord ? clinicianRecord.user_email : existingAppointment.clinician_email || null,
                appointment_type: appointmentType,
                location: canUpdateLocation ? normalizedRequestedLocation : (existingAppointment.location || ''),
                status: appointmentStatus,
                notes: typeof notes === 'string' ? notes.trim() || null : existingAppointment.notes || null,
                updated_at: new Date().toISOString(),
            },
        ];

        let updateResult = null;
        for (const payload of updatePayloads) {
            let nextPayload = { ...payload };

            for (let attempt = 0; attempt < 8; attempt += 1) {
                const result = await supabase
                    .from(APPOINTMENTS_TABLE)
                    .update(nextPayload)
                    .eq('id', id)
                    .select('*')
                    .maybeSingle();

                if (!result.error) {
                    updateResult = result;
                    break;
                }

                const errorMessage = String(result.error.message || '');
                const missingColumns = [...errorMessage.matchAll(/Could not find the '([^']+)' column/gi)]
                    .map((match) => match[1])
                    .filter(Boolean);

                let strippedColumn = false;
                for (const column of missingColumns) {
                    if (Object.prototype.hasOwnProperty.call(nextPayload, column)) {
                        delete nextPayload[column];
                        strippedColumn = true;
                    }
                }

                if (!strippedColumn) {
                    updateResult = result;
                    break;
                }
            }

            if (updateResult && !updateResult.error) {
                break;
            }
        }

        if (!updateResult) {
            return res.status(500).json({ success: false, error: 'Failed to update appointment.' });
        }

        const { data, error } = updateResult;

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        if (canUpdateLocation && data && normalizeText(existingAppointment.user_email)) {
            await createNotification(supabase, {
                recipient_email: normalizeText(existingAppointment.user_email),
                category: 'appointment-location-updated',
                title: 'Appointment location updated',
                message: `Your clinician set the location for your appointment on ${(data.appointment_date || data.date)} at ${(data.appointment_time || data.time)}: ${normalizedRequestedLocation}`,
                appointment_id: data.id,
                is_read: false,
                metadata: {
                    location: normalizedRequestedLocation,
                    appointment_date: data.appointment_date || data.date,
                    appointment_time: data.appointment_time || data.time,
                },
            });
        }

        return res.status(200).json({
            success: true,
            appointment: normalizeAppointment(data),
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Appointment id is required.' });
        }

        const supabase = getSupabase();

        const { data, error } = await supabase
            .from(APPOINTMENTS_TABLE)
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('*')
            .maybeSingle();

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        if (!data) {
            return res.status(404).json({ success: false, error: 'Appointment not found.' });
        }

        return res.status(200).json({
            success: true,
            appointment: normalizeAppointment(data),
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;