/**
 * ==============================================================================
 * BESPOKE DATEPICKER COMPONENT — CC MARIO SÁNCHEZ ERP
 * Reemplazo de alta gama para calendarios nativos del navegador (<input type="date">)
 * 
 * Características:
 * - Tema oscuro con acentos dorados (#f59e0b) y esmeralda (#10b981) acorde al CCMS.
 * - Flotante inteligente posicionado con z-index elevado (10050) para modales.
 * - Navegación mensual y anual intuitiva con nombres en español.
 * - Botones de atajo rápido: "Hoy", "Primer Día", "Limpiar".
 * - Sincronización bidireccional con campos nativos en formato ISO YYYY-MM-DD.
 * ==============================================================================
 */

(function(global) {
  'use strict';

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  let activePicker = null;

  class BespokeDatePicker {
    constructor(inputElement, options = {}) {
      if (!inputElement) return;
      this.input = inputElement;
      this.options = Object.assign({
        format: 'YYYY-MM-DD',
        displayFormat: 'DD/MM/YYYY',
        defaultDate: inputElement.value || new Date().toISOString().split('T')[0],
        onSelect: null
      }, options);

      this.currentViewDate = this.parseDate(this.input.value) || new Date();
      this.selectedDate = this.parseDate(this.input.value) || null;
      this.popover = null;

      this.init();
    }

    parseDate(val) {
      if (!val) return null;
      const parts = String(val).split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d);
      }
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }

    formatIso(date) {
      if (!date) return '';
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    formatDisplay(date) {
      if (!date) return '';
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${d}/${m}/${y}`;
    }

    init() {
      // Ocultar el input nativo pero mantenerlo accesible para formularios
      this.input.style.display = 'none';

      // Crear envoltorio y campo de visualización personalizado
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'ccms-dp-wrapper';
      this.wrapper.style.position = 'relative';
      this.wrapper.style.display = 'inline-block';
      this.wrapper.style.width = '100%';

      this.displayInput = document.createElement('div');
      this.displayInput.className = 'form-control ccms-dp-trigger';
      this.displayInput.style.cursor = 'pointer';
      this.displayInput.style.display = 'flex';
      this.displayInput.style.alignItems = 'center';
      this.displayInput.style.justifyContent = 'space-between';
      this.displayInput.style.userSelect = 'none';

      const initialDate = this.parseDate(this.input.value) || (this.input.hasAttribute('required') ? new Date() : null);
      if (initialDate && !this.input.value) {
        this.input.value = this.formatIso(initialDate);
        this.selectedDate = initialDate;
      }

      this.updateDisplayText();

      this.input.parentNode.insertBefore(this.wrapper, this.input);
      this.wrapper.appendChild(this.input);
      this.wrapper.appendChild(this.displayInput);

      this.displayInput.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });

      // Escuchar cambios programáticos en el input nativo
      this.input.addEventListener('change', () => {
        this.selectedDate = this.parseDate(this.input.value);
        if (this.selectedDate) this.currentViewDate = new Date(this.selectedDate);
        this.updateDisplayText();
        if (this.popover) this.renderCalendar();
      });
    }

    updateDisplayText() {
      const text = this.selectedDate ? this.formatDisplay(this.selectedDate) : 'Seleccionar fecha...';
      const isSet = !!this.selectedDate;
      this.displayInput.innerHTML = `
        <span style="color: ${isSet ? 'var(--txt-primary)' : 'var(--txt-muted)'}; font-weight: ${isSet ? '600' : '400'}; font-size: 12.5px;">
          ${text}
        </span>
        <i class="fa-regular fa-calendar-days" style="color: var(--amber); font-size: 13px; margin-left: 8px;"></i>
      `;
    }

    toggle() {
      if (this.popover && this.popover.style.display !== 'none') {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      if (activePicker && activePicker !== this) {
        activePicker.close();
      }
      activePicker = this;

      if (!this.popover) {
        this.createPopover();
      }

      this.positionPopover();
      this.renderCalendar();
      this.popover.style.display = 'block';
    }

    close() {
      if (this.popover) {
        this.popover.style.display = 'none';
      }
      if (activePicker === this) activePicker = null;
    }

    createPopover() {
      this.popover = document.createElement('div');
      this.popover.className = 'ccms-dp-popover';
      this.popover.style.display = 'none';
      document.body.appendChild(this.popover);

      // Prevenir cierre al hacer click dentro del popover
      this.popover.addEventListener('click', (e) => e.stopPropagation());
    }

    positionPopover() {
      const rect = this.displayInput.getBoundingClientRect();
      const popoverWidth = 290;
      const popoverHeight = 330;

      let top = rect.bottom + window.scrollY + 6;
      let left = rect.left + window.scrollX;

      // Evitar salirse de la pantalla horizontalmente
      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }
      if (left < 10) left = 10;

      // Si no cabe abajo, abrir arriba
      if (rect.bottom + popoverHeight > window.innerHeight && rect.top > popoverHeight) {
        top = rect.top + window.scrollY - popoverHeight - 6;
      }

      this.popover.style.top = `${top}px`;
      this.popover.style.left = `${left}px`;
    }

    renderCalendar() {
      const year = this.currentViewDate.getFullYear();
      const month = this.currentViewDate.getMonth();

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const prevMonthLastDay = new Date(year, month, 0);

      const daysInMonth = lastDay.getDate();
      const startingDay = firstDay.getDay(); // 0 = Domingo

      let html = `
        <div class="ccms-dp-inner">
          <div class="ccms-dp-header">
            <button type="button" class="ccms-dp-nav-btn ccms-dp-prev-month" title="Mes Anterior">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div class="ccms-dp-title">
              <span class="ccms-dp-month">${MONTH_NAMES[month]}</span>
              <span class="ccms-dp-year">${year}</span>
            </div>
            <button type="button" class="ccms-dp-nav-btn ccms-dp-next-month" title="Mes Siguiente">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          <div class="ccms-dp-weekdays">
            ${DAY_NAMES.map(d => `<span class="ccms-dp-weekday">${d}</span>`).join('')}
          </div>

          <div class="ccms-dp-grid">
      `;

      // Días del mes anterior (atenuados)
      for (let i = startingDay - 1; i >= 0; i--) {
        const d = prevMonthLastDay.getDate() - i;
        html += `<span class="ccms-dp-cell ccms-dp-muted">${d}</span>`;
      }

      // Días del mes actual
      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
      const todayDate = today.getDate();

      const isSelectedMonth = this.selectedDate && 
        this.selectedDate.getFullYear() === year && 
        this.selectedDate.getMonth() === month;
      const selectedDay = isSelectedMonth ? this.selectedDate.getDate() : -1;

      for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isCurrentMonth && day === todayDate;
        const isSelected = day === selectedDay;

        let classes = 'ccms-dp-cell ccms-dp-day';
        if (isToday) classes += ' ccms-dp-today';
        if (isSelected) classes += ' ccms-dp-selected';

        html += `<span class="${classes}" data-day="${day}">${day}</span>`;
      }

      // Rellenar resto de cuadrícula (hasta 42 celdas = 6 filas)
      const totalRendered = startingDay + daysInMonth;
      const nextDays = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
      for (let i = 1; i <= nextDays; i++) {
        html += `<span class="ccms-dp-cell ccms-dp-muted">${i}</span>`;
      }

      html += `
          </div>

          <div class="ccms-dp-footer">
            <button type="button" class="ccms-dp-foot-btn ccms-dp-btn-today">
              <i class="fa-solid fa-calendar-day"></i> Hoy
            </button>
            <button type="button" class="ccms-dp-foot-btn ccms-dp-btn-first">
              <i class="fa-solid fa-angles-left"></i> 1° de Mes
            </button>
            <button type="button" class="ccms-dp-foot-btn ccms-dp-btn-clear" style="color: var(--rose);">
              Limpiar
            </button>
          </div>
        </div>
      `;

      this.popover.innerHTML = html;

      // Event Listeners dentro del Popover
      this.popover.querySelector('.ccms-dp-prev-month').addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentViewDate.setMonth(this.currentViewDate.getMonth() - 1);
        this.renderCalendar();
      });

      this.popover.querySelector('.ccms-dp-next-month').addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentViewDate.setMonth(this.currentViewDate.getMonth() + 1);
        this.renderCalendar();
      });

      this.popover.querySelectorAll('.ccms-dp-day').forEach(cell => {
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          const d = parseInt(cell.getAttribute('data-day'), 10);
          this.selectDate(new Date(year, month, d));
        });
      });

      this.popover.querySelector('.ccms-dp-btn-today').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectDate(new Date());
      });

      this.popover.querySelector('.ccms-dp-btn-first').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectDate(new Date(year, month, 1));
      });

      this.popover.querySelector('.ccms-dp-btn-clear').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedDate = null;
        this.input.value = '';
        this.updateDisplayText();
        this.dispatchChangeEvent();
        this.close();
      });
    }

    selectDate(date) {
      this.selectedDate = date;
      this.currentViewDate = new Date(date);
      this.input.value = this.formatIso(date);
      this.updateDisplayText();
      this.dispatchChangeEvent();
      if (typeof this.options.onSelect === 'function') {
        this.options.onSelect(this.input.value, date);
      }
      this.close();
    }

    dispatchChangeEvent() {
      const event = new Event('change', { bubbles: true });
      this.input.dispatchEvent(event);
      const inputEv = new Event('input', { bubbles: true });
      this.input.dispatchEvent(inputEv);
    }
  }

  // Cerrar popover al hacer click fuera o presionar Escape
  document.addEventListener('click', (e) => {
    if (activePicker) {
      activePicker.close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePicker) {
      activePicker.close();
    }
  });

  // Helper para inicializar automáticamente todos los inputs de fecha en el DOM
  function initAllDatePickers() {
    const dateInputs = document.querySelectorAll('input[type="date"], input.ccms-datepicker');
    dateInputs.forEach(input => {
      if (!input._ccmsDatePicker) {
        input._ccmsDatePicker = new BespokeDatePicker(input);
      }
    });
  }

  // Exponer a nivel global
  global.BespokeDatePicker = BespokeDatePicker;
  global.initAllDatePickers = initAllDatePickers;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllDatePickers);
  } else {
    initAllDatePickers();
  }

})(typeof window !== 'undefined' ? window : this);
