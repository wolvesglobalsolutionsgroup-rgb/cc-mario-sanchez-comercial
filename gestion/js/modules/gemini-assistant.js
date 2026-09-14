/**
 * ============================================================================
 * CCMS - MÓDULO ASISTENTE INTELIGENTE JURÍDICO & TRIBUTARIO (GEMINI FLASH)
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * Arquitectura Desacoplada (Dimensión 9: Desmonolito)
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

  let activeGeminiAttachment = null;

  const GeminiAssistant = {
    openModal() {
      const modal = document.getElementById('modal-gemini-assistant');
      if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('gemini-assistant-input');
        if (input) setTimeout(() => input.focus(), 100);
      }
    },

    closeModal() {
      const modal = document.getElementById('modal-gemini-assistant');
      if (modal) modal.style.display = 'none';
    },

    askQuick(promptText) {
      const input = document.getElementById('gemini-assistant-input');
      if (input) input.value = promptText;
      this.submit();
    },

    handleFileSelect(e) {
      const file = e && e.target && e.target.files ? e.target.files[0] : null;
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        activeGeminiAttachment = {
          name: file.name,
          type: file.type || 'image/jpeg',
          data: evt.target.result
        };
        const bar = document.getElementById('gemini-attachment-bar');
        const nameSpan = document.getElementById('gemini-attachment-name');
        if (bar) bar.style.display = 'flex';
        if (nameSpan) nameSpan.textContent = file.name;
      };
      reader.readAsDataURL(file);
    },

    clearAttachment() {
      activeGeminiAttachment = null;
      const bar = document.getElementById('gemini-attachment-bar');
      const input = document.getElementById('gemini-file-input');
      if (bar) bar.style.display = 'none';
      if (input) input.value = '';
    },

    async submit() {
      const input = document.getElementById('gemini-assistant-input');
      const sendBtn = document.getElementById('btn-gemini-assistant-send');
      const respBox = document.getElementById('gemini-assistant-response');
      if (!input || !respBox) return;

      const prompt = input.value.trim();
      if (!prompt) {
        if (global.SecuritySuite && global.SecuritySuite.toast) {
          global.SecuritySuite.toast('Por favor ingrese una pregunta o consulta.', 'warning', 'Consulta Vacía');
        }
        return;
      }

      // Estado de carga UI
      if (sendBtn) sendBtn.disabled = true;
      respBox.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 30px; color: var(--txt-secondary);">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; color: var(--cyan);"></i>
          <span>Consultando marco normativo venezolano y bases de datos con Gemini Flash...</span>
        </div>
      `;

      try {
        // Obtener token de Supabase Auth si está disponible
        let authToken = null;
        if (global.supabaseClient && global.supabaseClient.auth) {
          try {
            const { data: sessionData } = await global.supabaseClient.auth.getSession();
            authToken = sessionData?.session?.access_token || null;
          } catch (_) {}
        }

        const sess = (typeof global.AuthGuard !== 'undefined' && typeof global.AuthGuard.currentUser === 'function') 
          ? global.AuthGuard.currentUser() 
          : null;
        const isDemo = localStorage.getItem('CCMS_FORCE_DEMO') === 'true' || (sess && !sess.is_supabase_auth);

        // Si es modo demo y no hay JWT de sesión de usuario, usar token demo firmado por el servidor
        if (!authToken && isDemo) {
          authToken = global.__ccms_demo_token || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('CCMS_DEMO_TOKEN')) || null;
          if (!authToken) {
            try {
              const cfgRes = await fetch('/api/config');
              if (cfgRes.ok) {
                const cfgData = await cfgRes.json();
                if (cfgData && cfgData.demoToken) {
                  authToken = cfgData.demoToken;
                  global.__ccms_demo_token = authToken;
                  try { sessionStorage.setItem('CCMS_DEMO_TOKEN', authToken); } catch (_) {}
                }
              }
            } catch (_) {}
          }
        }

        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (isDemo) {
          headers['X-CCMS-Demo'] = 'true';
        }

        const orgContext = global.currentOrganization || null;

        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            prompt: prompt,
            image: activeGeminiAttachment ? activeGeminiAttachment.data : null,
            image_type: activeGeminiAttachment ? activeGeminiAttachment.type : null,
            demo: isDemo,
            organization: orgContext ? {
              name: orgContext.name,
              units_count: orgContext.units_count,
              features: orgContext.features
            } : undefined
          })
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          const errorMsg = data.error || 'No se pudo obtener respuesta del servidor de IA.';
          respBox.innerHTML = `
            <div style="padding: 12px 14px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171;">
              <div style="font-weight: 700; margin-bottom: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Error en la consulta</div>
              <div>${escapeHtml(errorMsg)}</div>
            </div>
          `;
          return;
        }

        // Renderizar respuesta con formato básico seguro
        const rawText = data.text || 'Sin respuesta generada.';
        const formattedText = rawText
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/^### (.*$)/gim, '<h4 style="margin: 12px 0 4px; color: var(--cyan);">$1</h4>')
          .replace(/^## (.*$)/gim, '<h3 style="margin: 14px 0 6px; color: var(--txt-primary);">$1</h3>')
          .replace(/^# (.*$)/gim, '<h2 style="margin: 16px 0 8px; color: var(--txt-primary);">$1</h2>')
          .replace(/^\s*-\s+(.*$)/gim, '<div style="display: flex; gap: 6px; margin: 3px 0;"><span>•</span><span>$1</span></div>');

        respBox.innerHTML = `
          <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--cyan);"><i class="fa-solid fa-wand-magic-sparkles"></i> Respuesta Jurídico-Tributaria</span>
            <span style="font-size: 10px; color: var(--txt-muted);">Modelo: ${escapeHtml(data.model || 'Gemini Flash')}</span>
          </div>
          <div style="color: var(--txt-primary); font-size: 12.5px; line-height: 1.65;">${formattedText}</div>
        `;
      } catch (err) {
        console.error('[GeminiAssistant] Error de conexión:', err);
        respBox.innerHTML = `
          <div style="padding: 12px 14px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171;">
            <div style="font-weight: 700; margin-bottom: 4px;"><i class="fa-solid fa-circle-exclamation"></i> Error de conexión</div>
            <div>No fue posible conectar con el endpoint de IA (/api/gemini). Verifique que el servicio esté activo y el proxy serverless configurado.</div>
          </div>
        `;
      } finally {
        if (sendBtn) sendBtn.disabled = false;
      }
    }
  };

  // Exposición en espacio de nombres y enlaces globales para UI
  global.GeminiAssistant = GeminiAssistant;
  global.openGeminiAssistantModal = () => GeminiAssistant.openModal();
  global.closeGeminiAssistantModal = () => GeminiAssistant.closeModal();
  global.askGeminiQuick = (txt) => GeminiAssistant.askQuick(txt);
  global.handleGeminiFileSelect = (e) => GeminiAssistant.handleFileSelect(e);
  global.clearGeminiAttachment = () => GeminiAssistant.clearAttachment();
  global.submitGeminiAssistant = () => GeminiAssistant.submit();

})(typeof window !== 'undefined' ? window : global);
