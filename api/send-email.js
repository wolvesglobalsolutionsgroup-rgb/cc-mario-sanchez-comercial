/**
 * Vercel Function para correo transaccional.
 * La clave RESEND_API_KEY solo existe en variables de entorno del servidor.
 */
export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' }
    });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return new Response(JSON.stringify({ error: 'Correo no configurado en el servidor' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const to = typeof payload.to === 'string' ? payload.to.trim() : '';
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !body || body.length > 20000) {
    return new Response(JSON.stringify({ error: 'Destinatario, asunto o cuerpo inválido' }), {
      status: 422,
      headers: { 'content-type': 'application/json' }
    });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      text: body
    })
  });

  const result = await response.json().catch(() => ({}));
  return new Response(JSON.stringify(response.ok ? { ok: true, id: result.id } : { error: 'Proveedor rechazó el correo' }), {
    status: response.ok ? 200 : 502,
    headers: { 'content-type': 'application/json' }
  });
}
