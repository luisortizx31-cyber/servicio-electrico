// Reglas del recibo, tal como salen del talonario del comité:
//
//   diferencia de lectura = lectura actual - lectura anterior   (kWh)
//   costo kW consumido    = diferencia × coeficiente            (S/)
//   total a pagar         = costo + energía perdida + comisión del
//                           comité + mantenimiento/reparación/otros
//
// Comprobado contra un recibo real (Set 2026): 4567.4 - 4343.1 = 224.3
// kWh × 0.77 = 172.711 -> S/ 172.70; + 0.80 + 3.00 = S/ 176.50.
// El costo se redondea a 10 céntimos, que es como se cobra en efectivo.

function aCentimos(valor) {
  return Math.round(valor * 100)
}

// Redondea a múltiplos de `paso` soles (0.1 = diez céntimos, 0.01 = sin redondeo).
export function redondear(valor, paso = 0.1) {
  const pasoCentimos = Math.max(1, aCentimos(paso))
  return (Math.round(aCentimos(valor) / pasoCentimos) * pasoCentimos) / 100
}

export function calcularImporte({ lecturaAnterior, lecturaActual, periodo, redondeo = 0.1 }) {
  const consumo = Math.round((lecturaActual - lecturaAnterior) * 100) / 100
  const costoConsumo = redondear(consumo * periodo.coeficiente, redondeo)
  const energiaPerdida = Number(periodo.energiaPerdida) || 0
  const comision = Number(periodo.comision) || 0
  const mantenimiento = Number(periodo.mantenimiento) || 0
  const total = Math.round((costoConsumo + energiaPerdida + comision + mantenimiento) * 100) / 100
  return { consumo, costoConsumo, energiaPerdida, comision, mantenimiento, total }
}

export function periodosOrdenados(estado) {
  return [...estado.periodos].sort((a, b) => a.id.localeCompare(b.id))
}

// La lectura anterior de un usuario en un periodo es la lectura actual
// del periodo más reciente ANTERIOR en el que se le tomó lectura; si es
// su primer mes, la lectura inicial con la que se le registró.
export function lecturaAnteriorDe(estado, periodoId, usuario) {
  const anteriores = periodosOrdenados(estado).filter((p) => p.id < periodoId).reverse()
  for (const p of anteriores) {
    const valor = p.lecturas?.[usuario.id]
    if (valor != null) return valor
  }
  return Number(usuario.lecturaInicial) || 0
}

// Consumo promedio de los últimos meses, para avisar si la lectura que
// se está escribiendo se sale mucho de lo normal (posible error de dedo).
export function consumoPromedioDe(estado, usuarioId, antesDePeriodoId) {
  const consumos = estado.recibos
    .filter((r) => r.usuarioId === usuarioId && r.periodoId < antesDePeriodoId)
    .sort((a, b) => b.periodoId.localeCompare(a.periodoId))
    .slice(0, 6)
    .map((r) => r.consumo)
  if (consumos.length === 0) return null
  return consumos.reduce((s, c) => s + c, 0) / consumos.length
}

// 'pagado' | 'pendiente' (todavía a tiempo) | 'vencido' (pasó el
// vencimiento) | 'corte' (llegó la fecha de corte sin pagar).
export function estadoRecibo(recibo, periodo, hoy) {
  if (recibo.pago) return 'pagado'
  if (periodo && hoy >= periodo.fechaCorte) return 'corte'
  if (periodo && hoy > periodo.fechaVencimiento) return 'vencido'
  return 'pendiente'
}

export function recibosConEstado(estado, hoy) {
  const porId = new Map(estado.periodos.map((p) => [p.id, p]))
  return estado.recibos.map((r) => {
    const periodo = porId.get(r.periodoId)
    return { ...r, periodo, estado: estadoRecibo(r, periodo, hoy) }
  })
}

// Map usuarioId -> { total, recibos, enCorte } solo con lo que debe.
export function deudaPorUsuario(recibos) {
  const deuda = new Map()
  for (const r of recibos) {
    if (r.pago) continue
    const actual = deuda.get(r.usuarioId) || { total: 0, recibos: [], enCorte: false }
    actual.total = Math.round((actual.total + r.total) * 100) / 100
    actual.recibos.push(r)
    if (r.estado === 'corte') actual.enCorte = true
    deuda.set(r.usuarioId, actual)
  }
  return deuda
}

// Ordena por manzana y lote como los leería una persona: B-2 antes que B-10.
export function compararUbicacion(a, b) {
  const opciones = { numeric: true, sensitivity: 'base' }
  return String(a.mz).localeCompare(String(b.mz), 'es', opciones) || String(a.lote).localeCompare(String(b.lote), 'es', opciones)
}

export function resumenPeriodo(recibosDelPeriodo) {
  const suma = (lista, campo) => Math.round(lista.reduce((s, r) => s + r[campo], 0) * 100) / 100
  const pagados = recibosDelPeriodo.filter((r) => r.pago)
  return {
    cantidad: recibosDelPeriodo.length,
    pagados: pagados.length,
    facturado: suma(recibosDelPeriodo, 'total'),
    cobrado: suma(pagados, 'total'),
    pendiente: suma(recibosDelPeriodo.filter((r) => !r.pago), 'total'),
    consumo: suma(recibosDelPeriodo, 'consumo'),
  }
}
