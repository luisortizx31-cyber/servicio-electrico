// A dónde yapear o plinear el recibo (pedido del usuario, 2026-10-17):
// el número, el nombre completo del encargado de recibir los cobros y
// el horario en que recibe la constancia. Se carga en Ajustes y sale
// en el mensaje de WhatsApp y en el recibo amarillo de los que todavía
// no pagaron.

export const MEDIOS_PAGO = [
  { id: 'yape', texto: 'Yape' },
  { id: 'plin', texto: 'Plin' },
  { id: 'ambos', texto: 'Yape o Plin' },
]

// "20:00" -> "8:00 p. m."
function hora12(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h)) return ''
  const sufijo = h < 12 ? 'a. m.' : 'p. m.'
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${sufijo}`
}

function formatearCelular(numero) {
  const d = String(numero || '').replace(/\D/g, '')
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d
}

// null si no se cargó el número (entonces no se muestra nada).
export function datosPago(config) {
  const numero = formatearCelular(config?.pagoNumero)
  if (!numero) return null
  const medio = MEDIOS_PAGO.find((m) => m.id === config.pagoMedio)?.texto || 'Yape'
  const horario = config.pagoDesde && config.pagoHasta ? `de ${hora12(config.pagoDesde)} a ${hora12(config.pagoHasta)}` : ''
  return { medio, numero, titular: (config.pagoTitular || '').trim(), horario }
}

// "Envía la captura ..., de 8:00 a. m. a 8:00 p. m." con un solo punto final.
export function textoCaptura(p, inicio = 'Envía la captura de tu pago a este mismo número') {
  const t = p.horario ? `${inicio}, ${p.horario}` : inicio
  return t.endsWith('.') ? t : `${t}.`
}

// Líneas para el mensaje de WhatsApp.
export function lineasPago(config) {
  const p = datosPago(config)
  if (!p) return []
  const lineas = ['', `*Paga por ${p.medio}:* ${p.numero}`]
  if (p.titular) lineas.push(`A nombre de: ${p.titular}`)
  lineas.push(textoCaptura(p))
  return lineas
}
