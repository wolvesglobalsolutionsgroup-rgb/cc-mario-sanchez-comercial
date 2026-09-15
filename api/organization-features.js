const { handle, uuid, HttpError, body } = require('../lib/server/session.cjs');

module.exports = handle(async (req, res, ctx) => {
  if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
  const input = body(req);
  if (!input.patch || typeof input.patch !== 'object' || Array.isArray(input.patch)) throw new HttpError(422, 'INVALID_FEATURE_PATCH');
  if (!Number.isFinite(Date.parse(input.expected_updated_at || ''))) throw new HttpError(422, 'EXPECTED_VERSION_REQUIRED');
  const result = await ctx.rest('rpc/update_organization_features', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_organization_id: uuid(input.organization_id),
      p_expected_updated_at: input.expected_updated_at,
      p_patch: input.patch,
      p_change_reason: typeof input.reason === 'string' ? input.reason.slice(0, 500) : ''
    })
  });
  return res.status(200).json({ ok: true, organization: Array.isArray(result) ? result[0] : result });
}, ['POST']);
