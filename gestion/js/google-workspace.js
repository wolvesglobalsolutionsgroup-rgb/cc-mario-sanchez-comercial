/**
 * ==============================================================================
 * INTEGRACIÓN CON GOOGLE WORKSPACE & CENTRO DE NOTIFICACIONES
 * Soporte para Google Calendar, Gmail y WhatsApp API Web
 * ==============================================================================
 */

const GoogleWorkspace = {
  ADMIN_EMAIL: 'administracion@ccmariosanchez.com',
  ADMIN_WA: '584247380002',

  /**
   * 1. Generador de Enlace para Agregar Evento a Google Calendar
   */
  createCalendarUrl(title, description, location, isoDateStr) {
    const d = new Date(isoDateStr);
    const startStr = d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    // Duración de 1 hora para el evento
    const endDate = new Date(d.getTime() + 60 * 60 * 1000);
    const endStr = endDate.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      details: description,
      location: location || 'CC Mario Sánchez, Av. Municipal, Puerto La Cruz',
      dates: `${startStr}/${endStr}`
    });

    return `https://calendar.google.com/render?${params.toString()}`;
  },

  /**
   * 2. Generador de Redacción en Gmail Web
   */
  createGmailUrl(toEmail, subject, bodyText) {
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: toEmail,
      cc: this.ADMIN_EMAIL,
      su: subject,
      body: bodyText
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  },

  /**
   * 3. Generador de Enlace Directo a WhatsApp
   */
  createWhatsAppUrl(rawPhone, messageText) {
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '58' + cleanPhone.substring(1);
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  },

  /**
   * 4. Plantillas de Mensajes Preformateadas
   */
  templates: {
    avisoCobro(tenant, invoice, rate) {
      const totalBs = (invoice.total_usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2 });
      return `Estimados *${tenant.business_name}* (${tenant.trade_name || ''}):\n\n` +
        `Le informamos que ha sido emitida la cuota de canon y condominio correspondiente al período *${invoice.period_month}/${invoice.period_year}* para la unidad *${invoice.unit_code}* en el Centro Comercial Mario Sánchez.\n\n` +
        `💵 *Monto Total USD:* $${invoice.total_usd.toFixed(2)}\n` +
        `🇻🇪 *Monto en Bs. (Tasa Oficial BCV ${rate} Bs):* Bs. ${totalBs}\n` +
        `📅 *Fecha Límite de Pago:* ${invoice.due_date}\n\n` +
        `Agradecemos registrar su comprobante de pago por el portal de autogestión o enviarlo a este canal.\n\n` +
        `Atentamente,\n*Administración CC Mario Sánchez*\nPuerto La Cruz, Venezuela`;
    },

    avisoVencimientoContrato(tenant, contract) {
      return `Estimado(a) *${tenant.legal_rep_name}* / *${tenant.business_name}*:\n\n` +
        `Le saludamos cordialmente desde la Administración del CC Mario Sánchez. Le recordamos que su Contrato de Arrendamiento N° *${contract.contract_number}* para el espacio *${contract.unit_code}* está próximo a su término el *${contract.end_date}*.\n\n` +
        `De conformidad con la Ley de Arrendamiento Inmobiliario para el Uso Comercial (Gaceta Oficial 40.418), deseamos coordinar con usted los términos de renovación o prórroga legal correspondiente.\n\n` +
        `Por favor contáctenos a la brevedad.\n\n` +
        `*Administración CC Mario Sánchez*`;
    },

    avisoMora(tenant, invoice, daysOverdue, rate) {
      const totalBs = (invoice.total_usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2 });
      return `*AVISO DE COBRANZA - CUOTA VENCIDA*\n\n` +
        `Atención: *${tenant.business_name}* (Unidad *${invoice.unit_code}*)\n\n` +
        `Nuestros registros indican un saldo pendiente por concepto de canon/mantenimiento correspondiente al mes *${invoice.period_month}/${invoice.period_year}*, con *${daysOverdue} días de vencimiento*.\n\n` +
        `• Total adeudado: *$${invoice.total_usd.toFixed(2)} USD* (Bs. ${totalBs} tasa BCV).\n\n` +
        `Le exhortamos a regularizar su solvencia en las próximas 48 horas para evitar recargos o suspensiones de servicios comunes según lo estipulado en su contrato.\n\n` +
        `*CC Mario Sánchez — Departamento de Cobranzas*`;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleWorkspace;
}
