const express = require('express');
const router = express.Router();

const { getSupabase } = require('../config/supabase');

function mapRowToHistoryEntry(row) {
    return {
        id: row.client_entry_id || row.id,
        createdAt: row.created_at,
        source: row.source,
        riskLevel: row.risk_level,
        riskScore: row.risk_score,
        color: row.color,
        predictionValue: row.prediction_value,
        predictionClass: row.prediction_class,
        csvType: row.csv_type,
        csvFileName: row.csv_file_name,
        limeSummary: row.lime_summary,
        shapSummary: row.shap_summary,
        topLimeFeatures: Array.isArray(row.top_lime_features) ? row.top_lime_features : [],
        topShapFeatures: Array.isArray(row.top_shap_features) ? row.top_shap_features : [],
        featureNotes: Array.isArray(row.feature_notes) ? row.feature_notes : [],
    };
}

async function resolveUserId(supabase, userEmail, userId) {
    if (!userEmail) {
        return null;
    }

    // The frontend might send a Supabase Auth UUID as `userId`, but the `public.users`
    // table uses custom IDs like 'P0001'. We must look up the correct ID by email.
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('user_email', userEmail)
        .maybeSingle();

    if (data && data.id) {
        return data.id;
    }

    // If we couldn't find the user by email, try using the provided userId just in case
    // it IS a valid public.users ID. Otherwise return null so the FK constraint doesn't fail.
    return null;
}

router.get('/reports', async (req, res) => {
    const userEmail = typeof req.query.userEmail === 'string' ? req.query.userEmail.trim().toLowerCase() : '';
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

    if (!userEmail && !userId) {
        return res.status(400).json({ success: false, error: 'userEmail or userId is required.' });
    }

    try {
        const supabase = getSupabase();
        let query = supabase
            .from('prediction_reports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        query = userId
            ? query.eq('user_id', userId)
            : query.eq('user_email', userEmail);

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return res.json({
            success: true,
            reports: Array.isArray(data) ? data.map(mapRowToHistoryEntry) : [],
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/reports', async (req, res) => {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const userEmail = typeof payload.userEmail === 'string' ? payload.userEmail.trim().toLowerCase() : '';
    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';

    if (!userEmail) {
        return res.status(400).json({ success: false, error: 'userEmail is required.' });
    }

    try {
        const supabase = getSupabase();
        const resolvedUserId = await resolveUserId(supabase, userEmail, userId);

        const row = {
            // Removed client_entry_id as it causes cache/schema mismatch in Supabase
            user_id: resolvedUserId,
            user_email: userEmail,
            source: payload.source,
            csv_type: payload.csvType || null,
            risk_level: payload.riskLevel,
            risk_score: payload.riskScore,
            color: payload.color,
            prediction_value: payload.predictionValue ?? null,
            prediction_class:
                payload.predictionClass === null || typeof payload.predictionClass === 'undefined'
                    ? null
                    : String(payload.predictionClass),
            csv_file_name: payload.csvFileName || null,
            lime_summary: payload.limeSummary || null,
            shap_summary: payload.shapSummary || null,
            top_lime_features: Array.isArray(payload.topLimeFeatures) ? payload.topLimeFeatures : [],
            top_shap_features: Array.isArray(payload.topShapFeatures) ? payload.topShapFeatures : [],
            feature_notes: Array.isArray(payload.featureNotes) ? payload.featureNotes : [],
        };

        const { data, error } = await supabase
            .from('prediction_reports')
            .insert(row)
            .select('*')
            .single();

        if (error) {
            throw error;
        }

        return res.json({
            success: true,
            report: mapRowToHistoryEntry(data),
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/reports', async (req, res) => {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const userEmail = typeof payload.userEmail === 'string' ? payload.userEmail.trim().toLowerCase() : '';
    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';

    if (!userEmail && !userId) {
        return res.status(400).json({ success: false, error: 'userEmail or userId is required.' });
    }

    try {
        const supabase = getSupabase();
        let query = supabase.from('prediction_reports').delete();
        query = userId
            ? query.eq('user_id', userId)
            : query.eq('user_email', userEmail);

        const { error } = await query;

        if (error) {
            throw error;
        }

        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
