/**
 * ============================================================================
 * CCMS - MESA DE AYUDA, TICKETS & RECLAMOS DE INQUILINOS
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * Gestión de Incidencias Operativas, Mantenimiento y Solicitudes
 * ============================================================================
 */

(function(global) {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const TicketsManager = {
    storageKey: 'ccms_service_tickets',

    /**
     * Obtiene los tickets registrados con fallback a incidentes muestra
     */
    getTickets() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('[TicketsManager] Error leyendo storage:', e);
      }
      return [
        {
          id: 'tk-1',
          ticket_number: 'TK-2026-001',
          tenant_id: 'ten-1',
          tenant_name: 'Mueblería Juncal, C.A.',
          unit_code: 'LOC-1',
          category: 'electricidad',
          priority: 'alta',
          subject: 'Parpadeo en reflector exterior del pasillo PB',
          description: 'El reflector que ilumina la entrada del local LOC-1 presenta intermitencia desde el día de ayer.',
          status: 'en_atencion',
          technician: 'Ing. Carlos Mendoza (Electricidad)',
          admin_response: 'Técnico electricista asignado para revisión hoy a las 14:00 hrs.',
          created_at: '2026-03-01T10:30:00Z',
          updated_at: '2026-03-01T14:15:00Z'
        },
        {
          id: 'tk-2',
          ticket_number: 'TK-2026-002',
          tenant_id: 'ten-2',
          tenant_name: 'Distribuidora Oriente Marino, C.A.',
          unit_code: 'LOC-2',
          category: 'infraestructura',
          priority: 'normal',
          subject: 'Revisión preventiva de sello perimetral en ventanal',
          description: 'Solicitud de verificación de silicón en la junta del ventanal antes del inicio de temporada de lluvias.',
          status: 'abierto',
          technician: '',
          admin_response: '',
          created_at: '2026-03-08T09:15:00Z',
          updated_at: '2026-03-08T09:15:00Z'
        }
      ];
    },

    /**
     * Guarda los tickets en almacenamiento local y adaptador Supabase si aplica
     */
    saveTickets(tickets) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(tickets));
      } catch (e) {
        console.error('[TicketsManager] Error guardando tickets:', e);
      }
    },

    /**
     * Abre el modal de creación de ticket para el inquilino
     */
    openNewTicketModal(unitCode = null) {
      const tenant = (window.AuthGuard && typeof window.AuthGuard.currentTenant === 'function')
        ? window.AuthGuard.currentTenant()
        : null;

      const unitInput = document.getElementById('tticket-unit');
      if (unitInput) {
        unitInput.value = unitCode || (tenant ? `${tenant.unit_code} - ${tenant.business_name}` : 'Local Comercial');
      }
      const form = document.getElementById('tenant-ticket-form');
      if (form) form.reset();
      if (unitInput) {
        unitInput.value = unitCode || (tenant ? `${tenant.unit_code} - ${tenant.business_name}` : 'Local Comercial');
      }

      if (typeof window.openModal === 'function') {
        window.openModal('modal-tenant-new-ticket');
      } else {
        const modal = document.getElementById('modal-tenant-new-ticket');
        if (modal) modal.style.display = 'flex';
      }
    },

    /**
     * Cierra el modal de creación de ticket
     */
    closeNewTicketModal() {
      if (typeof window.closeModal === 'function') {
        window.closeModal('modal-tenant-new-ticket');
      } else {
        const modal = document.getElementById('modal-tenant-new-ticket');
        if (modal) modal.style.display = 'none';
      }
    },

    /**
     * Persiste ticket en Supabase con RLS o en localStorage según el modo activo
     */
    async crearTicket(ticketData) {
      const usarSupabase = window.supabaseClient && window.CCMS_DEMO_MODE !== true;

      if (usarSupabase) {
        // Resolver el tenant_id real del usuario autenticado (requerido por la RLS de service_tickets)
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        const { data: tenantRow, error: tenantError } = await window.supabaseClient
          .from('tenants')
          .select('id')
          .eq('profile_id', user.id)
          .single();
        if (tenantError || !tenantRow) throw new Error('No se pudo resolver el tenant del usuario actual.');

        const { data, error } = await window.supabaseClient
          .from('service_tickets')
          .insert([{
            tenant_id: tenantRow.id,
            unit_code: ticketData.unitCode,
            category: ticketData.category || 'infraestructura',
            priority: ticketData.priority || 'normal',
            subject: ticketData.subject,
            description: ticketData.description,
            status: 'abierto'
            // ticket_number se autogenera por DEFAULT en la BD (ver migración 20260912000400)
          }])
          .select();
        if (error) throw error;
        return data[0];
      }

      // Fallback offline/demo (solo si CCMS_DEMO_MODE === true)
      const localTickets = JSON.parse(localStorage.getItem('ccms_tickets') || '[]');
      const nuevoTicket = { ...ticketData, id: 'TCK-' + Date.now(), status: 'abierto' };
      localTickets.unshift(nuevoTicket);
      localStorage.setItem('ccms_tickets', JSON.stringify(localTickets));
      return nuevoTicket;
    },

    /**
     * Procesa el envío de una nueva solicitud de servicio desde el inquilino
     */
    async handleTicketSubmit(e) {
      e.preventDefault();
      const tenant = (window.AuthGuard && typeof window.AuthGuard.currentTenant === 'function')
        ? window.AuthGuard.currentTenant()
        : null;

      const unitCode = tenant ? tenant.unit_code : (document.getElementById('tticket-unit')?.value || 'LOCAL');
      const ticketData = {
        unitCode: unitCode,
        tenant_id: tenant ? tenant.id : 'ten-current',
        tenant_name: tenant ? tenant.business_name : 'Inquilino Comercial',
        priority: document.getElementById('tticket-priority')?.value || 'normal',
        category: document.getElementById('tticket-category')?.value || 'infraestructura',
        subject: document.getElementById('tticket-subject')?.value?.trim() || 'Solicitud de Mantenimiento',
        description: document.getElementById('tticket-description')?.value?.trim() || '',
        technician: '',
        admin_response: ''
      };

      try {
        const created = await this.crearTicket(ticketData);
        // Sincronizar en memoria y almacenamiento local
        const tickets = this.getTickets();
        const existingIdx = tickets.findIndex(t => t.id === created.id || (created.ticket_number && t.ticket_number === created.ticket_number));
        if (existingIdx === -1) {
          tickets.unshift(created);
          this.saveTickets(tickets);
        }

        if (window.CCMSTelemetry && typeof window.CCMSTelemetry.captureAction === 'function') {
          window.CCMSTelemetry.captureAction('tenant_created_ticket', { ticket_number: created.ticket_number, subject: created.subject });
        }

        this.closeNewTicketModal();
        
        if (typeof window.renderAlertsCenter === 'function') {
          window.renderAlertsCenter();
        }

        if (typeof window.showToast === 'function') {
          window.showToast(`Solicitud #${created.ticket_number || 'TCK'} registrada exitosamente. Se asignará personal para su pronta atención.`, 'success', 'Mesa de Ayuda CCMS');
        }
      } catch (err) {
        console.error('[TicketsManager] Error creando ticket:', err);
        if (typeof window.showToast === 'function') {
          window.showToast('No se pudo registrar la solicitud: ' + err.message, 'error', 'Mesa de Ayuda CCMS');
        } else {
          alert('Error creando ticket: ' + err.message);
        }
      }
    },

    /**
     * Abre el modal de atención / resolución del lado de Administración
     */
    openAdminModal(ticketId) {
      const tickets = this.getTickets();
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      const tkIdInput = document.getElementById('admin-ticket-id');
      const tkNumEl = document.getElementById('admin-tk-number');
      const tkTenantEl = document.getElementById('admin-tk-tenant');
      const tkSubjEl = document.getElementById('admin-tk-subject');
      const tkDescEl = document.getElementById('admin-tk-desc');
      const tkStatusEl = document.getElementById('admin-tk-status');
      const tkTechEl = document.getElementById('admin-tk-technician');
      const tkRespEl = document.getElementById('admin-tk-response');
      const prioBadge = document.getElementById('admin-tk-prio-badge');

      if (tkIdInput) tkIdInput.value = ticket.id;
      if (tkNumEl) tkNumEl.textContent = ticket.ticket_number || 'TK-2026';
      if (tkTenantEl) tkTenantEl.textContent = `${ticket.tenant_name || 'Inquilino'} (${ticket.unit_code || 'LOCAL'})`;
      if (tkSubjEl) tkSubjEl.textContent = ticket.subject || '';
      if (tkDescEl) tkDescEl.textContent = ticket.description || '';
      if (tkStatusEl) tkStatusEl.value = ticket.status || 'abierto';
      if (tkTechEl) tkTechEl.value = ticket.technician || '';
      if (tkRespEl) tkRespEl.value = ticket.admin_response || '';

      const prioColor = ticket.priority === 'urgente' ? 'var(--rose)' : (ticket.priority === 'alta' ? 'var(--amber)' : 'var(--emerald)');
      if (prioBadge) {
        prioBadge.innerHTML = `<span style="font-size: 10.5px; font-weight: 800; color: ${prioColor}; text-transform: uppercase;">[Prioridad ${ticket.priority || 'normal'}]</span>`;
      }

      const modal = document.getElementById('modal-admin-ticket-respond');
      if (modal) {
        if (typeof window.openModal === 'function') {
          window.openModal(modal);
        } else {
          modal.style.display = 'flex';
          modal.classList.add('active');
        }
      }
    },

    /**
     * Cierra el modal de atención del lado de Administración
     */
    closeAdminModal() {
      if (typeof window.closeModal === 'function') {
        window.closeModal('modal-admin-ticket-respond');
      } else {
        const modal = document.getElementById('modal-admin-ticket-respond');
        if (modal) modal.style.display = 'none';
      }
    },

    /**
     * Guarda la resolución del ticket desde el modal de administración
     */
    handleAdminResolutionSubmit(e) {
      e.preventDefault();
      const ticketId = document.getElementById('admin-ticket-id')?.value;
      const tickets = this.getTickets();
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      ticket.status = document.getElementById('admin-tk-status')?.value || 'abierto';
      ticket.technician = document.getElementById('admin-tk-technician')?.value?.trim() || '';
      ticket.admin_response = document.getElementById('admin-tk-response')?.value?.trim() || '';
      ticket.updated_at = new Date().toISOString();

      this.saveTickets(tickets);

      if (window.CCMSTelemetry && typeof window.CCMSTelemetry.captureAction === 'function') {
        window.CCMSTelemetry.captureAction('admin_resolved_ticket', { ticket_number: ticket.ticket_number, status: ticket.status });
      }

      this.closeAdminModal();
      
      if (typeof window.renderAlertsCenter === 'function') {
        window.renderAlertsCenter();
      }

      if (typeof window.showToast === 'function') {
        window.showToast(`Solicitud #${ticket.ticket_number} actualizada a "${ticket.status.toUpperCase()}". Registro guardado.`, 'success', 'Mesa de Ayuda CCMS');
      }
    },

    /**
     * Actualiza rápidamente el estado de un ticket y abre el modal si falta respuesta
     */
    updateTicketStatus(ticketId, newStatus) {
      this.openAdminModal(ticketId);
      if (newStatus) {
        const statusSelect = document.getElementById('admin-tk-status');
        if (statusSelect) statusSelect.value = newStatus;
      }
    }
  };

  // Exponer a nivel global para retrocompatibilidad completa
  global.TicketsManager = TicketsManager;
  global.getServiceTickets = function() {
    return TicketsManager.getTickets();
  };
  global.saveServiceTickets = function(tickets) {
    TicketsManager.saveTickets(tickets);
  };
  global.openTenantNewTicketModal = function(unitCode) {
    TicketsManager.openNewTicketModal(unitCode);
  };
  global.closeTenantNewTicketModal = function() {
    TicketsManager.closeNewTicketModal();
  };
  global.handleTenantTicketSubmit = function(e) {
    TicketsManager.handleTicketSubmit(e);
  };
  global.openAdminTicketModal = function(ticketId) {
    TicketsManager.openAdminModal(ticketId);
  };
  global.closeAdminTicketModal = function() {
    TicketsManager.closeAdminModal();
  };
  global.handleAdminTicketResolutionSubmit = function(e) {
    TicketsManager.handleAdminResolutionSubmit(e);
  };
  global.adminUpdateTicketStatus = function(ticketId, newStatus) {
    TicketsManager.updateTicketStatus(ticketId, newStatus);
  };

})(typeof window !== 'undefined' ? window : this);
