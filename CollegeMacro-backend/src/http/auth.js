// Verifies the Supabase access token the app sends as "Authorization: Bearer".
function requireUser(getSupabase) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing auth token.' });
      }

      const { data, error } = await getSupabase().auth.getUser(header.slice(7));
      if (error || !data?.user) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }

      req.user = data.user;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

// For operator-only endpoints. Fails closed when the secret is not configured.
function requireSecret(envName) {
  return (req, res, next) => {
    const secret = process.env[envName];
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    return next();
  };
}

module.exports = {
  requireSecret,
  requireUser,
};
