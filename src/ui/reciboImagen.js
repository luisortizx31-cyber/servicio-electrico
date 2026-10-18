import { formatearFecha, MESES_CORTOS, nombrePeriodo } from '../domain/fecha'
import { formatearNumero, formatearNumeroRecibo } from '../domain/dinero'
import { datosPago, textoCaptura } from '../domain/pago'

// El recibo amarillo como IMAGEN (PNG), para mandarlo por WhatsApp
// igual al de papel (pedido del usuario, 2026-10-11). Se dibuja a mano
// en un canvas, con los mismos casilleros que ReciboPapel.jsx - sin
// librerías, así sale idéntico en cualquier celular.
const ANCHO = 1000
const ALTO_BASE = 690
// Con los datos para yapear abajo, el recibo es más alto.
const ALTO_CON_PAGO = 800

function pagoDe({ recibo, config }) {
  return recibo.pago ? null : datosPago(config)
}
const TINTA = '#1c2f86'
const PAPEL = '#f6f3ae'
const ROJO = '#b3261e'
const VERDE = '#1f7a4d'
const SANS = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = '"Cascadia Code", "Roboto Mono", Consolas, monospace'

function dinero(valor) {
  return valor ? formatearNumero(valor, 2) : ''
}

// Achica la letra hasta que el texto entre en `ancho`.
function texto(ctx, valor, x, y, { tam = 18, peso = 700, fuente = SANS, alinear = 'left', color = TINTA, ancho } = {}) {
  let t = tam
  ctx.font = `${peso} ${t}px ${fuente}`
  while (ancho && t > 10 && ctx.measureText(valor).width > ancho) {
    t -= 1
    ctx.font = `${peso} ${t}px ${fuente}`
  }
  ctx.fillStyle = color
  ctx.textAlign = alinear
  ctx.textBaseline = 'middle'
  ctx.fillText(valor, x, y)
}

function caja(ctx, x, y, w, h, grosor = 2) {
  ctx.lineWidth = grosor
  ctx.strokeStyle = TINTA
  ctx.strokeRect(x, y, w, h)
}

function linea(ctx, x1, y1, x2, y2, grosor = 2) {
  ctx.lineWidth = grosor
  ctx.strokeStyle = TINTA
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

// Tabla de filas "etiqueta | valor" con una raya vertical en `corte`.
function tabla(ctx, x, y, w, altoFila, corte, filas) {
  caja(ctx, x, y, w, altoFila * filas.length)
  linea(ctx, x + corte, y, x + corte, y + altoFila * filas.length)
  filas.forEach(([etiqueta, valor], i) => {
    const cy = y + altoFila * i + altoFila / 2
    if (i > 0) linea(ctx, x, y + altoFila * i, x + w, y + altoFila * i)
    texto(ctx, etiqueta.toUpperCase(), x + 12, cy, { tam: 15, ancho: corte - 20 })
    texto(ctx, String(valor ?? ''), x + w - 12, cy, { tam: 22, fuente: MONO, alinear: 'right', ancho: w - corte - 20 })
  })
}

function dibujar(ctx, { recibo, usuario, periodo, config }) {
  const pago = pagoDe({ recibo, config })
  const ALTO = pago ? ALTO_CON_PAGO : ALTO_BASE
  ctx.fillStyle = PAPEL
  ctx.fillRect(0, 0, ANCHO, ALTO)
  caja(ctx, 10, 10, ANCHO - 20, ALTO - 20, 3)

  // Encabezado
  texto(ctx, config.nombre.toUpperCase(), 34, 52, { tam: 34, peso: 800, ancho: 640 })
  texto(ctx, (config.ubicacion || '').toUpperCase(), 34, 86, { tam: 16, ancho: 640 })
  texto(ctx, 'RECIBO DE CONSUMO ELÉCTRICO', 34, 122, { tam: 22, peso: 800 })
  caja(ctx, 730, 28, 236, 54)
  texto(ctx, `N° ${formatearNumeroRecibo(recibo.numero)}`, 848, 56, { tam: 30, peso: 800, fuente: MONO, alinear: 'center', color: ROJO })
  texto(ctx, `MES ${MESES_CORTOS[periodo.mes - 1].toUpperCase()}  ·  AÑO ${periodo.anio}`, 966, 110, { tam: 18, alinear: 'right' })

  // Usuario, manzana y lote
  const yU = 150
  caja(ctx, 34, yU, 932, 50)
  linea(ctx, 150, yU, 150, yU + 50)
  linea(ctx, 716, yU, 716, yU + 50)
  linea(ctx, 836, yU, 836, yU + 50)
  texto(ctx, 'USUARIO', 46, yU + 25, { tam: 15 })
  texto(ctx, usuario.nombre, 164, yU + 25, { tam: 24, ancho: 540 })
  texto(ctx, 'MZ', 728, yU + 25, { tam: 15 })
  texto(ctx, String(usuario.mz), 824, yU + 25, { tam: 24, fuente: MONO, alinear: 'right', ancho: 56 })
  texto(ctx, 'LOT', 848, yU + 25, { tam: 15 })
  texto(ctx, String(usuario.lote), 954, yU + 25, { tam: 24, fuente: MONO, alinear: 'right', ancho: 60 })

  // Lecturas y fechas (izquierda)
  const yT = 222
  const fila = 56
  tabla(ctx, 34, yT, 452, fila, 230, [
    ['Código de medidor', usuario.medidor],
    ['Lectura actual', formatearNumero(recibo.lecturaActual)],
    ['Lectura anterior', formatearNumero(recibo.lecturaAnterior)],
    ['Difer. de lectura', `${formatearNumero(recibo.consumo)} kWh`],
    ['Fecha lectura', formatearFecha(periodo.fechaLectura)],
    ['Fecha vencimiento', formatearFecha(periodo.fechaVencimiento)],
    ['Fecha corte', formatearFecha(periodo.fechaCorte)],
  ])

  // Importe (derecha)
  const xD = 514
  caja(ctx, xD, yT, 452, fila)
  texto(ctx, `IMPORTE FACTURADO DEL ${formatearFecha(periodo.del)} AL ${formatearFecha(periodo.al)}`, xD + 12, yT + fila / 2, { tam: 15, ancho: 428 })
  tabla(ctx, xD, yT + fila, 452, fila, 290, [
    ['Coeficiente', formatearNumero(periodo.coeficiente, 2)],
    ['Costo kW consumido', dinero(recibo.costoConsumo)],
    ['Energía perdida', dinero(recibo.energiaPerdida)],
    ['Comisión comité control eléctrico', dinero(recibo.comision)],
    ['Mantenimiento, reparación, otros', dinero(recibo.mantenimiento)],
  ])
  const yTotal = yT + fila * 6
  caja(ctx, xD, yTotal, 452, fila, 4)
  texto(ctx, 'TOTAL A PAGAR', xD + 12, yTotal + fila / 2, { tam: 19, peso: 800 })
  texto(ctx, `S/ ${formatearNumero(recibo.total, 2)}`, xD + 440, yTotal + fila / 2, { tam: 32, peso: 800, fuente: MONO, alinear: 'right' })

  texto(ctx, 'TESORERÍA', 966, ALTO - 44, { tam: 15, alinear: 'right' })

  // A dónde yapear (ver domain/pago.js)
  if (pago) {
    const yP = 640
    caja(ctx, 34, yP, 760, 118, 3)
    texto(ctx, `PAGA POR ${pago.medio.toUpperCase()}:`, 50, yP + 28, { tam: 20, peso: 800 })
    ctx.font = `800 20px ${SANS}`
    const anchoEtiqueta = ctx.measureText(`PAGA POR ${pago.medio.toUpperCase()}:`).width
    texto(ctx, pago.numero, 50 + anchoEtiqueta + 14, yP + 28, { tam: 30, peso: 800, fuente: MONO })
    if (pago.titular) texto(ctx, `A nombre de: ${pago.titular}`, 50, yP + 64, { tam: 20, ancho: 728 })
    texto(ctx, textoCaptura(pago, 'Envía la captura a este número'), 50, yP + (pago.titular ? 96 : 68), { tam: 17, peso: 600, ancho: 728 })
  }

  if (recibo.pago) {
    ctx.save()
    ctx.translate(250, ALTO - 44)
    ctx.rotate(-0.06)
    ctx.lineWidth = 4
    ctx.strokeStyle = VERDE
    ctx.strokeRect(-210, -24, 420, 48)
    texto(ctx, `PAGADO ${formatearFecha(recibo.pago.fecha)}`, 0, 1, { tam: 26, peso: 800, alinear: 'center', color: VERDE })
    ctx.restore()
  }
}

export function reciboComoImagen(datos) {
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = pagoDe(datos) ? ALTO_CON_PAGO : ALTO_BASE
  dibujar(canvas.getContext('2d'), datos)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen del recibo.'))), 'image/png')
  )
}

// Abre el menú "Compartir" del celular con la imagen lista (ahí se
// elige WhatsApp y el contacto). Devuelve 'compartido', 'cancelado', o
// 'descargado' cuando el equipo no sabe compartir archivos (una
// computadora): en ese caso baja el PNG para adjuntarlo a mano.
//
// `alAbrir` se llama justo antes de abrir el Compartir. Hace falta
// porque NO se puede confiar en lo que el celular avisa después: al
// volver de WhatsApp, Android a veces responde "cancelado" aunque el
// recibo sí se mandó, o recarga la página y no responde nada (bug
// real, 2026-10-11: el recibo se enviaba pero no pasaba a Enviados).
export async function compartirRecibo(datos, alAbrir) {
  const { recibo, usuario, periodo } = datos
  const blob = await reciboComoImagen(datos)
  const nombre = `recibo-${formatearNumeroRecibo(recibo.numero)}-Mz${usuario.mz}-Lt${usuario.lote}.png`
  const archivo = new File([blob], nombre, { type: 'image/png' })

  if (navigator.canShare?.({ files: [archivo] })) {
    alAbrir?.()
    try {
      await navigator.share({ files: [archivo], text: `Recibo de luz de ${nombrePeriodo(periodo)} - ${usuario.nombre}` })
      return 'compartido'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelado'
      throw err
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
  return 'descargado'
}
