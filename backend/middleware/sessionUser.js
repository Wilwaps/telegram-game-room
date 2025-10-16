class UserIdError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function resolveUserId(req, candidate) {
  const sessionId = req && req.sessionUserId ? String(req.sessionUserId) : '';
  const provided = candidate ? String(candidate).trim() : '';
  if (sessionId) {
    if (provided && provided !== sessionId) throw new UserIdError('user_mismatch', 403);
    return sessionId;
  }
  if (provided.startsWith('tg:')) throw new UserIdError('session_required', 401);
  if (!provided) throw new UserIdError('invalid_user', 400);
  return provided;
}

function requireSessionUser(req) {
  const sessionId = req && req.sessionUserId ? String(req.sessionUserId) : '';
  if (!sessionId) throw new UserIdError('auth_required', 401);
  return sessionId;
}

module.exports = { resolveUserId, requireSessionUser, UserIdError };
function preferSessionUserId(req, candidate){
  const sessionId = req && req.sessionUserId ? String(req.sessionUserId) : '';
  const provided = candidate ? String(candidate).trim() : '';
  const sessIsTg = !!sessionId && sessionId.startsWith('tg:');
  if (sessIsTg) return sessionId;
  if (sessionId) return provided || sessionId;
  return provided;
}

module.exports.preferSessionUserId = preferSessionUserId;
