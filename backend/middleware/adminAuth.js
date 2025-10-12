const { security } = require('../config/config');

function normalize(u) {
  return String(u || '').trim().replace(/^@/, '').toLowerCase();
}

module.exports = function adminAuth(req, res, next) {
  try {
    const hx = String(req.headers['x-test-runner'] || '');
    const allowEnv = process.env.ALLOW_TEST_RUNNER === 'true';
    const isTestHX = /testsprite/i.test(hx);
    // Bypass de QA endurecido: requiere env + header
    if (allowEnv && isTestHX) {
      req.admin = { userName: normalize(req.headers['x-admin-username'] || 'testsprite') };
      return next();
    }
    const user = normalize(req.headers['x-admin-username'] || req.body?.adminUsername);
    const code = String(req.headers['x-admin-code'] || req.body?.adminCode || '');
    const cfgUser = normalize(process.env.ADMIN_USERNAME || security.admin.username || 'wilcnct');
    const cfgCode = String(process.env.ADMIN_CODE || security.admin.code || '');
    if (!user || !code) {
      return res.status(403).json({ success: false, error: 'admin_required' });
    }
    if (user !== cfgUser || code !== cfgCode) {
      return res.status(403).json({ success: false, error: 'unauthorized' });
    }
    req.admin = { userName: user };
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: 'admin_middleware_error' });
  }
};
