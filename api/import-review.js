const { handle, uuid, HttpError, body } = require('../lib/server/session.cjs');

module.exports = handle(async (req, res, ctx) => {
  if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
  const command = body(req);
  const stagingId = uuid(command.staging_id);
  const decision = command.decision;
  if (command.operation === 'materialize') {
    const result = await ctx.rest('rpc/materialize_authorized_import', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ p_staging_id: stagingId })
    });
    return res.status(200).json({ ok: true, row: Array.isArray(result) ? result[0] : result });
  }
  if (command.operation === 'update') {
    if (!command.patch || typeof command.patch !== 'object' || Array.isArray(command.patch)) throw new HttpError(422, 'INVALID_IMPORT_PATCH');
    const result = await ctx.rest('rpc/update_authorized_import_payload', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ p_staging_id: stagingId, p_patch: command.patch })
    });
    return res.status(200).json({ ok: true, row: Array.isArray(result) ? result[0] : result });
  }
  if (!['approved', 'rejected'].includes(decision)) throw new HttpError(422, 'INVALID_REVIEW_DECISION');
  const result = await ctx.rest('rpc/review_authorized_import', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_staging_id: stagingId,
      p_decision: decision,
      p_note: typeof command.note === 'string' ? command.note.slice(0, 2000) : null
    })
  });
  return res.status(200).json({ ok: true, row: Array.isArray(result) ? result[0] : result });
}, ['POST']);
