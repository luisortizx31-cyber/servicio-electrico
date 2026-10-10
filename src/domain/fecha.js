// Todas las fechas se guardan como texto 'AAAA-MM-DD' (sin hora), que
// se ordena y compara bien como texto y no se corre por zona horaria.

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']

function dos(n) {
  return String(n).padStart(2, '0')
}

export function aISO(anio, mes, dia) {
  return `${anio}-${dos(mes)}-${dos(dia)}`
}

export function hoyISO() {
  const d = new Date()
  return aISO(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate()
}

// Día `dia` del mes, o el último si ese mes no llega (ej. 30 en febrero).
export function diaDelMes(anio, mes, dia) {
  return aISO(anio, mes, Math.min(dia, diasDelMes(anio, mes)))
}

export function mesSiguiente(anio, mes) {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
}

export function mesAnterior(anio, mes) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
}

// '2026-09-30' -> '30/09/2026'
export function formatearFecha(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// '2026-09-30' -> '30 set'
export function formatearFechaCorta(iso) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MESES_CORTOS[Number(m) - 1].toLowerCase()}`
}

export function idPeriodo(anio, mes) {
  return `${anio}-${dos(mes)}`
}

export function nombrePeriodo(periodo) {
  return `${MESES[periodo.mes - 1]} ${periodo.anio}`
}

export function nombrePeriodoCorto(periodo) {
  return `${MESES_CORTOS[periodo.mes - 1]} ${String(periodo.anio).slice(2)}`
}

export function diasEntre(desdeISO, hastaISO) {
  const [a1, m1, d1] = desdeISO.split('-').map(Number)
  const [a2, m2, d2] = hastaISO.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000)
}
