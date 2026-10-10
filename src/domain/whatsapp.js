import { formatearFecha, nombrePeriodo } from './fecha.js'
import { formatearMonto, formatearNumero, formatearNumeroRecibo } from './dinero.js'

// Abre WhatsApp con el mensaje ya escrito (no hay forma de mandarlo
// solo: la persona toca "Enviar" en WhatsApp). null si no hay celular.
export function linkWhatsapp(telefono, mensaje) {
  const digitos = String(telefono || '').replace(/\D/g, '')
  if (digitos.length < 9) return null
  const numero = digitos.length === 9 ? `51${digitos}` : digitos
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

export function mensajeRecibo({ recibo, usuario, periodo, config }) {
  const lineas = [
    `*${config.nombre}*`,
    `Recibo de consumo eléctrico N° ${formatearNumeroRecibo(recibo.numero)} - ${nombrePeriodo(periodo)}`,
    '',
    `Usuario: ${usuario.nombre} (Mz ${usuario.mz} Lt ${usuario.lote})`,
    `Medidor: ${usuario.medidor}`,
    `Lectura anterior: ${formatearNumero(recibo.lecturaAnterior)}`,
    `Lectura actual: ${formatearNumero(recibo.lecturaActual)}`,
    `Consumo: ${formatearNumero(recibo.consumo)} kWh x ${formatearNumero(periodo.coeficiente, 2)} = ${formatearMonto(recibo.costoConsumo)}`,
  ]
  if (recibo.energiaPerdida) lineas.push(`Energía perdida: ${formatearMonto(recibo.energiaPerdida)}`)
  if (recibo.comision) lineas.push(`Comisión comité: ${formatearMonto(recibo.comision)}`)
  if (recibo.mantenimiento) lineas.push(`Mantenimiento y otros: ${formatearMonto(recibo.mantenimiento)}`)
  lineas.push('', `*TOTAL A PAGAR: ${formatearMonto(recibo.total)}*`)
  if (recibo.pago) {
    lineas.push(`PAGADO el ${formatearFecha(recibo.pago.fecha)}. Gracias.`)
  } else {
    lineas.push(`Vence: ${formatearFecha(periodo.fechaVencimiento)}`, `Corte: ${formatearFecha(periodo.fechaCorte)}`)
  }
  return lineas.join('\n')
}

export function mensajeDeuda({ usuario, deuda, config }) {
  const detalle = deuda.recibos
    .sort((a, b) => a.periodoId.localeCompare(b.periodoId))
    .map((r) => `- ${nombrePeriodo(r.periodo)}: ${formatearMonto(r.total)}`)
  return [
    `*${config.nombre}*`,
    `Estimado(a) ${usuario.nombre} (Mz ${usuario.mz} Lt ${usuario.lote}):`,
    'Tiene pendiente de pago su consumo eléctrico:',
    ...detalle,
    '',
    `*Total adeudado: ${formatearMonto(deuda.total)}*`,
    'Le pedimos regularizar su pago para evitar el corte del servicio.',
  ].join('\n')
}
