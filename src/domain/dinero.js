export function formatearMonto(valor) {
  return `S/ ${Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatearNumero(valor, decimales = 1) {
  return Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

// 1061 -> '001061', como el número impreso en el talonario.
export function formatearNumeroRecibo(numero) {
  return String(numero).padStart(6, '0')
}
