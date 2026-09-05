/**
 * ==============================================================================
 * MOTOR DE CONCILIACIÓN BANCARIA AUTOMÁTICA
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 *
 * Módulo inteligente para conciliar extractos bancarios (Banesco, Mercantil, BDV,
 * Bancamiga, BNC, Provincial, Zelle, Binance) contra facturas y pagos emitidos.
 * ==============================================================================
 */

(function (global) {
  'use strict';

  const BankReconciliation = {
    /**
     * Parsea un archivo de extracto bancario en texto plano o CSV.
     */
    parseStatement(rawText, bankType = 'auto') {
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const transactions = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Ignorar encabezados comunes
        if (/fecha|referencia|monto|balance|saldo|descripcion/i.test(line) && i < 3) continue;

        // Intentar split por coma, punto y coma o tabulación
        let parts = line.split(/[;\t]/);
        if (parts.length < 3) {
          parts = line.split(',');
        }

        if (parts.length >= 3) {
          const dateStr = parts[0].trim();
          const refStr = parts[1].replace(/[^0-9A-Za-z]/g, '').trim();
          const rawAmount = parts[2].replace(/[^0-9.,-]/g, '').trim();
          
          let amount = 0;
          if (rawAmount.includes(',') && rawAmount.includes('.')) {
            // Formato es-VE / europeo: 1.250,50
            amount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
          } else if (rawAmount.includes(',')) {
            amount = parseFloat(rawAmount.replace(',', '.'));
          } else {
            amount = parseFloat(rawAmount);
          }

          if (!isNaN(amount) && amount > 0) {
            transactions.push({
              id: `tx-${Date.now()}-${i}`,
              date: dateStr,
              reference: refStr,
              amount: amount,
              description: parts[3] ? parts[3].trim() : 'Depósito / Transferencia',
              raw_line: line
            });
          }
        }
      }

      return transactions;
    },

    /**
     * Algoritmo de Matching Tridimensional entre transacciones bancarias y facturas/cobranzas.
     * Retorna { matched: [], discrepancies: [], unmatchedBank: [], unmatchedInvoices: [] }
     */
    reconcile(bankTransactions, pendingInvoices, options = {}) {
      const bcvRate = options.bcvRate || 807.38;
      const toleranceDays = options.toleranceDays || 3;
      const toleranceAmountPct = 0.01; // 1% de tolerancia para redondeos

      const matched = [];
      const discrepancies = [];
      const usedInvoiceIds = new Set();
      const usedTxIds = new Set();

      bankTransactions.forEach(tx => {
        // 1. Búsqueda por coincidencia exacta de referencia en pagos reportados
        let candidate = pendingInvoices.find(inv => {
          if (usedInvoiceIds.has(inv.id)) return false;
          const invRef = String(inv.payment_proof_ref || inv.last_payment_ref || '').replace(/[^0-9A-Za-z]/g, '');
          if (!invRef) return false;
          return tx.reference.includes(invRef) || invRef.includes(tx.reference);
        });

        // 2. Si no hay match por referencia, buscar por monto equivalente en Bs o USD
        if (!candidate) {
          candidate = pendingInvoices.find(inv => {
            if (usedInvoiceIds.has(inv.id)) return false;
            const invTotalBs = inv.total_usd * bcvRate;
            const matchBs = Math.abs(tx.amount - invTotalBs) <= (invTotalBs * toleranceAmountPct + 2.0);
            const matchUsd = Math.abs(tx.amount - inv.total_usd) <= 0.50;
            return matchBs || matchUsd;
          });
        }

        if (candidate) {
          const invTotalBs = candidate.total_usd * bcvRate;
          const diffBs = Math.abs(tx.amount - invTotalBs);
          const isExact = diffBs < 1.0 || Math.abs(tx.amount - candidate.total_usd) < 0.05;

          if (isExact) {
            matched.push({
              status: 'CONCILIADO_EXACTO',
              confidence: 100,
              bankTx: tx,
              invoice: candidate,
              differenceBs: 0
            });
          } else {
            discrepancies.push({
              status: 'DISCREPANCIA_MONTO',
              confidence: 75,
              bankTx: tx,
              invoice: candidate,
              differenceBs: tx.amount - invTotalBs,
              differenceUsd: (tx.amount - invTotalBs) / bcvRate
            });
          }
          usedInvoiceIds.add(candidate.id);
          usedTxIds.add(tx.id);
        }
      });

      const unmatchedBank = bankTransactions.filter(tx => !usedTxIds.has(tx.id));
      const unmatchedInvoices = pendingInvoices.filter(inv => !usedInvoiceIds.has(inv.id));

      return {
        matched,
        discrepancies,
        unmatchedBank,
        unmatchedInvoices,
        summary: {
          totalBankCount: bankTransactions.length,
          totalBankAmount: bankTransactions.reduce((acc, t) => acc + t.amount, 0),
          matchedCount: matched.length,
          discrepanciesCount: discrepancies.length,
          unmatchedCount: unmatchedBank.length,
          reconciliationRatePct: bankTransactions.length > 0 
            ? Math.round((matched.length / bankTransactions.length) * 100) 
            : 0
        }
      };
    }
  };

  global.BankReconciliation = BankReconciliation;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BankReconciliation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
