const express = require('express');

const { getSupabase } = require('../config/supabase');

const router = express.Router();

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

        const user = data.user;

        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || null,
                phone: user.phone || user.user_metadata?.phone || null,
                role: user.user_metadata?.role || 'patient',
                clinical_role: user.user_metadata?.clinical_role || null,
                created_at: user.created_at,
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

function isRateLimitError(error) {
    const message = (error?.message || '').toLowerCase();
    const code = (error?.code || '').toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);

    return (
        status === 429 ||
        code.includes('rate') ||
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('over email rate limit')
    );
}

router.post('/signup', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, role, clinicalRole } = req.body;

        if (!isValidEmail(email) || !isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                error: 'Valid email and password (minimum 8 characters) are required.',
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

        const supabase = getSupabase();
        const { data, error } = await supabase.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName || null,
                phone: phone || null,
                role: role || 'patient',
                clinical_role: clinicalRole || null,
            },
        });

        if (error) {
            if (isRateLimitError(error)) {
                return res.status(429).json({
                    success: false,
                    error: 'Signup rate limit exceeded. Please wait a few minutes before trying again.',
                });
            }

            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }

        const user = data?.user;
        if (!user) {
            return res.status(500).json({
                success: false,
                error: 'Signup succeeded but no user object was returned.',
            });
        }

        // Sync into public.users so profile features (avatar, etc.) work
        await supabase.from('users').upsert({
            user_email: normalizedEmail,
            user_first_name: firstName || 'Unknown',
            user_last_name: lastName || 'Unknown',
            user_hashed_password: 'managed_by_supabase_auth',
            user_phone_number: phone || '0000000000',
            is_clinician: (role === 'admin' || clinicalRole),
        }, { onConflict: 'user_email' }).then(({ error: syncError }) => {
            if (syncError) console.error('Failed to sync user to public.users:', syncError.message);
        });

        return res.status(201).json({
            success: true,
            message: 'Signup successful.',
            user: {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || null,
                phone: user.phone || user.user_metadata?.phone || null,
                role: user.user_metadata?.role || 'patient',
                clinical_role: user.user_metadata?.clinical_role || null,
                created_at: user.created_at,
            },
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
        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
        });

        if (error || !data?.user) {
            return res.status(401).json({
                success: false,
                error: error?.message || 'Invalid email or password.',
            });
        }

        const user = data.user;

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            user: {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || null,
                phone: user.phone || user.user_metadata?.phone || null,
                role: user.user_metadata?.role || 'patient',
                clinical_role: user.user_metadata?.clinical_role || null,
                created_at: user.created_at,
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
