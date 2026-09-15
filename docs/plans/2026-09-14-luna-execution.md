# CCMS: ejecución secuencial con Luna

Base comprobada: fe1498a4073fbc716697b1a5e74f1118679b4cdc.
Rama: implementation/luna-ccms. El usuario confirmó que Antigravity está detenido.

## Contrato

Responsable único en esta tarea; sin subagentes. Conservar Vercel, Supabase y frontend modular.
La autorización del usuario cubre implementación y verificación. Producción se aprueba sobre una versión de staging concreta; no hay autorización para contratar servicios pagados.

La base de datos es autoridad. JWT acredita identidad, membresía activa y permisos actuales autorizan cada acción. Denegación explícita prevalece. Roles son plantillas: cualquier usuario puede recibir concesiones explícitas dentro del alcance delegable. Sin autoescalamiento, autoaprobación financiera ni eliminación de la última Dirección. Founders separados de datos privados del cliente.

Dinero decimal exacto, canon/condominio separados, pago/asignación/recibo/asiento atómicos, idempotencia organización/clave/hash, tasas históricas, reversos y cierres. Importaciones trazables sin inventar blancos o beneficiarios. Déficit visible; cuota base/liquidada/aprobada/pagada separadas.

IA con adaptadores Gemini/OpenAI/Anthropic, secretos cifrados y presupuestos inicialmente cero. Datos privados solo con modalidad aprobada. El agente consulta mediante herramientas limitadas y prepara propuestas versionadas que requieren confirmación. Operaciones sensibles se confirman en la app. IA caída no bloquea ERP.

Telegram privado vinculado desde app con código de un uso/10 minutos y confirmación web. WhatsApp oficial preparado, desactivado sin accesos/presupuesto. Webhooks verificados, eventos deduplicados y outbox persistente con reintentos; envío incierto explícito.

UX: navegación por responsabilidades, organización visible, temas claro/oscuro, diseño móvil, estados vacío/error/conflicto, accesibilidad WCAG 2.2 AA. PWA solo cachea recursos estáticos, sin registros privados offline.

## Entregas y aceptación

| Entrega | Resultado | Estado |
|---|---|---|
| E00 | Inventario local/remoto/cloud, accesos y control de concurrencia | Parcial: checkout y proyecto Supabase identificados; staging aún pendiente |
| E01 | Demo separada, sin tokens propios/fallbacks/seed productivo | Parcial: bypass y seed productivo contenidos; falta fixture/demo aislada operativa |
| E02 | Migraciones, identidad y relaciones consistentes | Parcial: cadena limpia probada en PostgreSQL embebido; upgrade cloud pendiente |
| E03 | RLS y permisos efectivos por acción/recurso | Implementado en migraciones y probado con 2 organizaciones, suspensión y conflictos |
| E04 | Repositorios remotos y comando financiero atómico | Parcial: comando financiero ACID, idempotencia y maker-checker probados; CRUD remoto restante |
| E05 | Fuentes, tasas, bancos, libros y sucesión | Parcial: parser, distribución con déficit y separación contable cubiertos; fuentes cloud pendientes |
| E06 | Sistema visual y navegación móvil | Parcial: ticker responsive y smoke visual 390/1440 sin overflow; revisión autenticada por pantalla pendiente |
| E07 | Equipo/permisos y portales conectados | Parcial: UI carga capacidades y guarda overrides versionados; portales completos pendientes |
| E08 | Trabajos, reintentos y notificaciones | Pendiente |
| E09 | Conexiones y proveedores IA | Pendiente |
| E10 | Herramientas y propuestas confirmables | Pendiente |
| E11 | Telegram y adaptador WhatsApp | Pendiente |
| E12 | Segunda organización, soporte, PWA, respaldos | Pendiente |
| E13 | Aceptación contable, E2E, restore y release | Pendiente |

## Pruebas y límites

Cada entrega registra diff, pruebas, resultados, recuperación y limitaciones. Ningún PASS basado en texto certifica ejecución SQL ni despliegue.
Probar dos organizaciones y todos los roles, suspensión, escalada, Storage/export; dinero parcial/duplicado/concurrente/reverso/cierre; importaciones ambiguas; déficit/centavos; IA sin presupuesto/cuota/proveedor; webhook falso/repetido; móvil a 360/390/768/1440 y restauración de base/archivos.

PGlite ejecuta PostgreSQL local con primitivas Auth de prueba y sustitución únicamente del proveedor UUID. No prueba Supabase Auth/REST/Storage real ni concurrencia entre conexiones: se conserva como puerta independiente, no aceptación cloud.
Docker instalado sin motor activo. No se han aplicado migraciones remotas. No se han instalado credenciales ni contratado servicios.

Objetivos para piloto: 10 organizaciones sintéticas, 20 usuarios concurrentes, p95 lecturas <1.5s y comandos simples <3s excluyendo dependencias externas. RPO 1h y RTO 4h requieren capacidad contratada y ensayo, no se consideran cumplidos sin evidencia.
