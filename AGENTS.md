# AGENTS.md — Directrices de Desarrollo y Configuración de Agentes

## Agent skills

### Issue tracker

GitHub issues via gh CLI. See docs/agents/issue-tracker.md.

### Triage labels

Five canonical roles: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See docs/agents/triage-labels.md.

### Domain docs

Single-context repo layout. See docs/agents/domain.md.

---

## Principios de Ingeniería (Full Stack Senior & PostgreSQL Best Practices)

1. Arquitectura Defensiva & Tipado: Mantener el desacoplamiento estricto entre el portal comercial público y el ERP administrativo (/gestion).
2. PostgreSQL & Row-Level Security (RLS):
   - Toda tabla en PostgreSQL/Supabase debe tener RLS habilitado.
   - Envolver siempre funciones en SELECT para cacheo óptimo: using ((select auth.uid()) = user_id).
   - Indexar todas las columnas referenciadas en políticas RLS (tenant_id, user_id).
3. Superpowers Discipline: Invocar y aplicar rigurosamente las skills de proceso antes de tocar código crítico.