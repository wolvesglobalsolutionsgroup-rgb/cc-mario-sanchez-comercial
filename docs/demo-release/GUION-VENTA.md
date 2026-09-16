# Guion de presentación (10 minutos)

1. Abrir `login.html?demo=1` y explicar que cada rol ve solo lo que necesita: dirección, finanzas, legal, mantenimiento, heredero e inquilino.
2. Entrar como dirección y mostrar tablero, cartera, ocupación, contratos, mantenimiento, activos, reportes y auditoría.
3. Cambiar a un inquilino demo para mostrar su deuda, comprobantes y solicitudes sin acceso a la administración.
4. Registrar un pago con referencia `DEMO-001`; la factura pasa a **Verificando**.
5. Volver a finanzas y aprobar con un actor distinto; mostrar pago **Verificado**, recibo emitido y saldo actualizado.
6. Recargar la página para demostrar que el escenario sigue en IndexedDB; ejecutar `resetDemoData()` para repetir la presentación.
7. Cerrar con la propuesta: piloto acompañado para un centro comercial o administrador de inmuebles; producción añade dominio propio, usuarios reales, migración autorizada, correo y conciliación bancaria.

No decir que se envió un correo, se consultó un banco o respondió una IA: en esta versión esos conectores están rotulados como simulación.
