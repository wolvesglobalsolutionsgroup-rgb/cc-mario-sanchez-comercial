const { handle, HttpError, body } = require('../lib/server/session.cjs');

module.exports = handle(async (req, res, ctx) => {
  if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
  const input = body(req);
  const result = await ctx.rest('rpc/create_organization_onboarding', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_name: input.name,
      p_slug: input.slug,
      p_property_name: input.property_name,
      p_business_type: input.business_type || 'centro_comercial',
      p_features: input.features && typeof input.features === 'object' ? input.features : {}
    })
  });
  return res.status(201).json({ ok: true, onboarding: Array.isArray(result) ? result[0] : result });
}, ['POST']);
