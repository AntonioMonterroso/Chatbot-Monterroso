/** Textos del asistente en español de Guatemala: cortos, claros y sin tecnicismos. */
export const MSG = {
  confirmSuffix: '¿Correcto? (sí / no)',
  saved: (summary: string) => `Listo ✅\n${summary}`,
  cancelled: 'Está bien, no guardé nada. Mándeme las ventas otra vez cuando quiera.',
  duplicateWarning: (total: string) => `Ojo: ya había ${total} anotados ese día; esto se suma a lo anterior.`,
  needYesNo:
    'Tengo ventas pendientes de confirmar. Responda "sí" para guardar o "no" para cancelar, ' +
    'o mándeme las ventas completas con el dato corregido.',
  help:
    'Por ahora anoto las ventas del día. Escríbame, por ejemplo:\n' +
    '"Hoy vendimos 4,850: 3,200 efectivo y 1,650 tarjeta, propinas 300".',
  notYet: 'Eso todavía no lo sé hacer; por ahora solo anoto ventas del día. Ya vienen los gastos y los proveedores.',
  refused: 'No pude procesar ese mensaje. ¿Me lo escribe de otra forma?',
  trouble: 'Tuve un problema entendiendo el mensaje. Intente de nuevo en un momento, por favor.',
} as const
