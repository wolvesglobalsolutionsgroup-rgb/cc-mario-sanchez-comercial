/**
 * ==============================================================================
 * PILAR 2: COMUNICACIÓN TRANSACCIONAL ROBUSTA (RESEND API + PLANTILLAS HTML)
 * Centro Comercial Mario Sánchez — ERP Inmobiliario
 * 
 * Plantillas soportadas:
 * 1. welcome: Bienvenida y confirmación de cuenta con verificación de email.
 * 2. reset_password: Token efímero de recuperación (máx. 15 minutos).
 * 3. security_alert_ip: Alerta de inicio de sesión desde nueva IP o dispositivo.
 * 4. payment_receipt: Recibo oficial de cobranza con código de control y sello SHA-256.
 * ==============================================================================
 */

function generateEmailTemplate(templateName, data = {}) {
  const brandGold = '#f59e0b';
  const brandDark = '#0b1329';
  const brandBg = '#0f172a';
  const year = new Date().getFullYear();

  const baseHeader = `
    <div style="background: ${brandDark}; padding: 24px; text-align: center; border-bottom: 2px solid ${brandGold};">
      <h2 style="color: #ffffff; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; letter-spacing: 0.5px;">
        CENTRO COMERCIAL MARIO SÁNCHEZ C.A.
      </h2>
      <div style="color: ${brandGold}; font-size: 11px; margin-top: 4px; font-weight: 600;">
        RIF: J-30211544-2 • GESTIÓN INMOBILIARIA & CONDOMINIO
      </div>
    </div>
  `;

  const baseFooter = `
    <div style="background: #090e1a; padding: 20px; text-align: center; color: #64748b; font-size: 11px; font-family: sans-serif; border-top: 1px solid rgba(255,255,255,0.08);">
      <p style="margin: 0 0 6px;">Este es un mensaje transaccional oficial emitido por el sistema ERP del Centro Comercial Mario Sánchez.</p>
      <p style="margin: 0;">Puerto La Cruz, Anzoátegui, Venezuela • © ${year} CCMS C.A. Todos los derechos reservados.</p>
    </div>
  `;

  let contentHtml = '';
  let textFallback = '';

  switch (templateName) {
    case 'welcome':
      contentHtml = `
        <h3 style="color: #ffffff; font-size: 18px; margin-top: 0;">¡Bienvenido al Portal Inmobiliario CCMS!</h3>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Estimado(a) <strong>${data.name || 'Usuario'}</strong>, su cuenta ha sido creada exitosamente con el identificador <strong>${data.email || ''}</strong> para el acceso a la administración del <strong>${data.unit || 'Local Comercial'}</strong>.
        </p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Para habilitar todas las operaciones financieras, emisión de contratos y reporte de pagos, confirme su correo haciendo clic a continuación:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${data.verifyUrl || '#'}" style="background: ${brandGold}; color: #000000; font-weight: 800; padding: 12px 28px; border-radius: 8px; text-decoration: none; display: inline-block; font-size: 14px;">
            Confirmar Correo Electrónico
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">Si usted no solicitó esta cuenta, desestime este mensaje.</p>
      `;
      textFallback = `Bienvenido al CCMS ERP. Confirme su cuenta en: ${data.verifyUrl || '#'}`;
      break;

    case 'reset_password':
      contentHtml = `
        <h3 style="color: #ffffff; font-size: 18px; margin-top: 0;">Recuperación de Contraseña Segura</h3>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Hemos recibido una solicitud para restablecer la contraseña de su cuenta asociada a <strong>${data.email || ''}</strong>.
        </p>
        <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid ${brandGold}; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <strong style="color: ${brandGold}; font-size: 13px;">Seguridad Criptográfica (Validez 15 Minutos):</strong>
          <div style="color: #cbd5e1; font-size: 12.5px; margin-top: 4px;">
            Este enlace es de uso único y expirará estrictamente a los 15 minutos de su emisión (${data.expiresAt || '15 min'}).
          </div>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${data.resetUrl || '#'}" style="background: ${brandGold}; color: #000000; font-weight: 800; padding: 12px 28px; border-radius: 8px; text-decoration: none; display: inline-block; font-size: 14px;">
            Restablecer Mi Contraseña
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">Si no realizó esta solicitud, su contraseña actual permanece segura y no se requiere acción adicional.</p>
      `;
      textFallback = `Recuperación de clave CCMS (Expira en 15 min): ${data.resetUrl || '#'}`;
      break;

    case 'security_alert_ip':
      contentHtml = `
        <h3 style="color: #f43f5e; font-size: 18px; margin-top: 0;">⚠️ Alerta de Seguridad: Nuevo Inicio de Sesión</h3>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Se ha registrado un inicio de sesión en su cuenta <strong>${data.email || ''}</strong> desde una dirección IP o dispositivo no reconocido previamente.
        </p>
        <table style="width: 100%; margin: 16px 0; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">Dirección IP:</td><td style="font-weight: bold; font-family: monospace;">${data.ip || 'Desconocida'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Dispositivo / Navegador:</td><td style="font-weight: bold;">${data.device || 'Navegador Web'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Fecha y Hora:</td><td style="font-weight: bold;">${data.timestamp || new Date().toISOString()}</td></tr>
        </table>
        <p style="color: #cbd5e1; font-size: 13px;">Si reconoce esta actividad, ignore este correo. De lo contrario, ingrese de inmediato al ERP y actualice su contraseña.</p>
      `;
      textFallback = `Alerta de seguridad CCMS: Inicio de sesión detectado desde IP ${data.ip || ''} a las ${data.timestamp || ''}.`;
      break;

    case 'payment_receipt':
      contentHtml = `
        <h3 style="color: #10b981; font-size: 18px; margin-top: 0;">Recibo Oficial de Pago Arrendaticio</h3>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Confirmamos la conciliación y recepción conforme del pago correspondiente a <strong>${data.tenantName || 'Arrendatario'}</strong> por el <strong>Local ${data.unitCode || ''}</strong>.
        </p>
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e2e8f0;">
            <tr><td style="padding: 6px 0; color: #94a3b8;">N° de Control / Recibo:</td><td style="font-weight: bold; font-family: monospace; color: #10b981;">${data.receiptNumber || 'REC-2026-0000'}</td></tr>
            <tr><td style="padding: 6px 0; color: #94a3b8;">Concepto:</td><td style="font-weight: bold;">${data.concept || 'Canon de Arrendamiento'}</td></tr>
            <tr><td style="padding: 6px 0; color: #94a3b8;">Monto Pagado:</td><td style="font-weight: bold; font-size: 16px; color: #f59e0b;">$ ${data.amountUsd || '0.00'} (${data.amountVes || 'Bs. 0,00'} @ BCV)</td></tr>
            <tr><td style="padding: 6px 0; color: #94a3b8;">Referencia Bancaria:</td><td style="font-family: monospace;">${data.reference || 'N/A'}</td></tr>
            <tr><td style="padding: 6px 0; color: #94a3b8;">Sello Criptográfico SHA-256:</td><td style="font-size: 10.5px; font-family: monospace; color: #cbd5e1; word-break: break-all;">${data.seal || 'CCMS-VERIFIED'}</td></tr>
          </table>
        </div>
      `;
      textFallback = `Recibo Oficial CCMS ${data.receiptNumber || ''}. Monto: $ ${data.amountUsd || ''}. Sello SHA-256: ${data.seal || ''}`;
      break;

    default:
      contentHtml = `<p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">${data.body || ''}</p>`;
      textFallback = data.body || '';
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Centro Comercial Mario Sánchez</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: ${brandBg}; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <tr><td>${baseHeader}</td></tr>
          <tr><td style="padding: 32px 28px;">${contentHtml}</td></tr>
          <tr><td>${baseFooter}</td></tr>
        </table>
      </body>
    </html>
  `;

  return { html, textFallback };
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' }
    });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return new Response(JSON.stringify({ 
      error: 'Servicio de correo transaccional no configurado en variables de entorno (RESEND_API_KEY requerido)' 
    }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON de solicitud inválido' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const to = typeof payload.to === 'string' ? payload.to.trim() : '';
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const template = payload.template || 'custom';
  const templateData = payload.templateData || {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject) {
    return new Response(JSON.stringify({ error: 'Destinatario o asunto inválido' }), {
      status: 422,
      headers: { 'content-type': 'application/json' }
    });
  }

  const { html, textFallback } = generateEmailTemplate(template, Object.assign({}, templateData, { body: payload.body }));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout estricto (Pilar 4)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
        text: textFallback
      })
    });

    clearTimeout(timeoutId);

    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      return new Response(JSON.stringify({ ok: true, id: result.id, template }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Proveedor Resend rechazó el envío', details: result }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fallo de conexión o timeout al enviar correo', message: err.message }), {
      status: 504,
      headers: { 'content-type': 'application/json' }
    });
  }
}
