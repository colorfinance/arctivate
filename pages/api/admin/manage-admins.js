import { createClient } from "@supabase/supabase-js";

// Admin-only endpoint to view users and grant/revoke admin access.
// Verifies the caller is an admin (bearer token), then uses the service-role
// key to read auth users (for emails) and flip profiles.is_admin.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured for admin actions.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // --- Verify caller is an admin -------------------------------------------
  let callerId;
  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });
    callerId = userData.user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', callerId)
      .single();
    if (!profile?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  } catch (err) {
    console.error('Admin verification error:', err);
    return res.status(500).json({ error: 'Could not verify admin access' });
  }

  const { action } = req.body || {};

  try {
    // Pull the auth users (for emails) — page through to cover larger lists.
    const usersById = new Map();
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const batch = data?.users || [];
      batch.forEach((u) => usersById.set(u.id, u.email || ''));
      if (batch.length < 200) break;
    }

    // Map of which profiles are admins.
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, is_admin');
    const adminMap = new Map((profiles || []).map((p) => [p.id, !!p.is_admin]));

    const buildList = () =>
      Array.from(usersById.entries())
        .map(([id, email]) => ({ id, email, is_admin: adminMap.get(id) || false }))
        .sort((a, b) => {
          if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
          return (a.email || '').localeCompare(b.email || '');
        });

    // --- LIST ----------------------------------------------------------------
    if (action === 'list') {
      return res.status(200).json({ users: buildList() });
    }

    // --- SET (grant / revoke admin) -----------------------------------------
    if (action === 'set') {
      const { makeAdmin } = req.body;
      let targetId = typeof req.body.userId === 'string' ? req.body.userId : null;
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : null;

      if (!targetId && email) {
        for (const [id, mail] of usersById.entries()) {
          if ((mail || '').toLowerCase() === email) { targetId = id; break; }
        }
        if (!targetId) {
          return res.status(404).json({ error: 'No user with that email. Ask them to sign up first.' });
        }
      }

      if (!targetId) return res.status(400).json({ error: 'Provide a user id or email' });

      if (targetId === callerId && makeAdmin === false) {
        return res.status(400).json({ error: "You can't remove your own admin access." });
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: targetId, is_admin: !!makeAdmin }, { onConflict: 'id' });
      if (error) throw error;

      adminMap.set(targetId, !!makeAdmin);
      return res.status(200).json({ success: true, users: buildList() });
    }

    return res.status(400).json({ error: 'Invalid action. Use "list" or "set".' });
  } catch (err) {
    console.error('manage-admins error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
