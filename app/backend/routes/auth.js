const express = require('express');
const bcrypt = require('bcryptjs');

const { getSupabase } = require('../config/supabase');

const router = express.Router();
const usersTable = 'users';
const ADMIN_EMAIL_DOMAIN = 'monashmedical.com';

router.get('/google/start', async (req, res) => {
    try {
        const supabase = getSupabase();
        const redirectTo = req.query.redirectTo || process.env.SUPABASE_GOOGLE_REDIRECT_TO;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: redirectTo
                ? {
                    redirectTo: String(redirectTo),
                }
                : undefined,
        });

        if (error || !data?.url) {
            return res.status(400).json({
                success: false,
                error: error?.message || 'Failed to create Google sign-in URL.',
            });
        }

        return res.status(200).json({
            success: true,
            url: data.url,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing bearer token.',
            });
        }

        const accessToken = authHeader.slice('Bearer '.length).trim();
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: 'Invalid bearer token.',
            });
        }

        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getUser(accessToken);

        if (error || !data?.user) {
            return res.status(401).json({
                success: false,
                error: error?.message || 'Invalid or expired token.',
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

function isValidEmail(email) {
    return typeof email === 'string' && /.+@.+\..+/.test(email);
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 8;
}

function isAllowedAdminEmail(email) {
    return email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`);
}

router.post('/signup', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, role } = req.body;

        if (!isValidEmail(email) || !isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                error: 'Valid email and password (minimum 8 characters) are required.',
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const requestedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';

        if (requestedRole === 'admin' && !isAllowedAdminEmail(normalizedEmail)) {
            return res.status(403).json({
                success: false,
                error: `Admin sign up is only allowed for @${ADMIN_EMAIL_DOMAIN} email addresses.`,
            });
        }

        const supabase = getSupabase();

        // Check if email already exists
        const { data: existingUser, error: existingUserError } = await supabase
            .from(usersTable)
            .select('id')
            .eq('user_email', normalizedEmail)
            .maybeSingle();

        if (existingUserError) {
            return res.status(500).json({
                success: false,
                error: existingUserError.message,
            });
        }

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Email is already registered.',
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const is_clinician = isAllowedAdminEmail(normalizedEmail);

        const { data: createdUser, error: insertError } = await supabase
            .from(usersTable)
            .insert([
                {
                    user_first_name: firstName || '',
                    user_last_name: lastName || '',
                    user_email: normalizedEmail,
                    user_hash_password: passwordHash,
                    user_phone_number: phone || null,
                    is_clinician,
                },
            ])
            .select('user_first_name, user_last_name, user_email, user_hash_password, user_phone_number, is_clinician')
            .single();

        if (insertError) {
            return res.status(500).json({
                success: false,
                error: insertError.message,
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Signup successful.',
            user: createdUser,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!isValidEmail(email) || typeof password !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid email and password are required.',
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const supabase = getSupabase();

        const { data: userRecord, error: userError } = await supabase
            .from(usersTable)
            .select('id, user_email, user_hash_password, user_first_name, user_last_name, user_phone_number, is_clinician')
            .eq('user_email', normalizedEmail)
            .maybeSingle();

        if (userError) {
            return res.status(500).json({
                success: false,
                error: userError.message,
            });
        }

        if (!userRecord) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.',
            });
        }

        const passwordMatches = await bcrypt.compare(password, userRecord.user_hash_password);

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            user: {
                id: userRecord.id,
                user_email: userRecord.user_email,
                user_first_name: userRecord.user_first_name,
                user_last_name: userRecord.user_last_name,
                user_phone_number: userRecord.user_phone_number,
                is_clinician: userRecord.is_clinician,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

module.exports = router;
