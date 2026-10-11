import { useSyncExternalStore } from 'react'
import { calcularImporte, lecturaAnteriorDe, periodosOrdenados, compararUbicacion } from '../domain/calculo'
import { diaDelMes, idPeriodo, mesSiguiente, hoyISO } from '../domain/fecha'
import { generarEjemplo } from './ejemplo'

// Todo el sistema vive en este único objeto, guardado en el navegador
// (localStorage) - mismo criterio que la app de colectivo: una sola
// persona (tesorería) lo usa desde su equipo, sin servidor, y la copia
// de seguridad se baja/sube como archivo desde Ajustes. Las pantallas
// nunca tocan localStorage: leen con useEstado() y cambian con las
// acciones de abajo, así que pasar esto a una base de datos en la nube
// más adelante es cambiar SOLO este archivo.
//
// {
//   config:   datos del comité, cargos por defecto, siguiente N° de recibo
//   usuarios: [{ id, nombre, mz, lote, medidor, telefono, lecturaInicial, estado }]
//             estado: 'activo' | 'cortado' | 'retirado'
//   periodos: [{ id:'2026-09', anio, mes, del, al, fechaLectura,
//                fechaVencimiento, fechaCorte, coeficiente, energiaPerdida,
//                comision, mantenimiento, lecturas: { [usuarioId]: kWh } }]
//   recibos:  [{ id, numero, periodoId, usuarioId, lecturaAnterior,
//                lecturaActual, consumo, costoConsumo, energiaPerdida,
//                comision, mantenimiento, total, emitidoEn,
//                pago: null | { fecha, metodo },
//                whatsapp: null | { fecha, hora, veces } }]
// }

const CLAVE = 'servicio-electrico:v1'

export const CONFIG_INICIAL = {
  nombre: 'HUP. El Salvador Parcela 13',
  ubicacion: 'Nvo. Chimbote - Ancash - Santa',
  coeficiente: 0.77,
  energiaPerdida: 0.8,
  comision: 3,
  mantenimiento: 0,
  redondeo: 0.1,
  diaLectura: 30,
  diaVencimiento: 20,
  diaCorte: 21,
  siguienteNumero: 1,
}

function nuevoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function leer() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE))
    if (guardado?.config) return guardado
  } catch (err) {
    console.error('[store] leer', err)
  }
  return null
}

// null = todavía no se configuró (pantalla de bienvenida). Abrir la
// dirección con ?ejemplo entra directo a la demostración (para
// mostrársela a alguien sin pasar por la bienvenida).
let estado = leer()
if (!estado && typeof location !== 'undefined' && new URLSearchParams(location.search).has('ejemplo')) {
  estado = generarEjemplo(CONFIG_INICIAL)
}
const oyentes = new Set()

function fijar(nuevo) {
  estado = nuevo
  try {
    if (nuevo) localStorage.setItem(CLAVE, JSON.stringify(nuevo))
    else localStorage.removeItem(CLAVE)
  } catch (err) {
    console.error('[store] guardar', err)
  }
  oyentes.forEach((fn) => fn())
}

function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function useEstado() {
  return useSyncExternalStore(suscribir, () => estado)
}

// --- Arranque, copia de seguridad ---------------------------------------

export function empezarVacio() {
  fijar({ config: { ...CONFIG_INICIAL }, usuarios: [], periodos: [], recibos: [] })
}

export function empezarConEjemplo() {
  fijar(generarEjemplo(CONFIG_INICIAL))
}

export function exportarCopia() {
  return JSON.stringify({ app: 'servicio-electrico', version: 1, exportadoEn: new Date().toISOString(), datos: estado }, null, 2)
}

export function importarCopia(texto) {
  const copia = JSON.parse(texto)
  const datos = copia?.datos
  if (copia?.app !== 'servicio-electrico' || !datos?.config || !Array.isArray(datos.usuarios)) {
    throw new Error('Ese archivo no es una copia de seguridad de este sistema.')
  }
  fijar(datos)
}

export function borrarTodo() {
  fijar(null)
}

// --- Configuración -------------------------------------------------------

export function guardarConfig(cambios) {
  fijar({ ...estado, config: { ...estado.config, ...cambios } })
}

// --- Usuarios ------------------------------------------------------------

export function guardarUsuario(datos) {
  const limpio = {
    nombre: datos.nombre.trim(),
    mz: String(datos.mz).trim().toUpperCase(),
    lote: String(datos.lote).trim(),
    medidor: String(datos.medidor).trim(),
    telefono: String(datos.telefono || '').replace(/\D/g, ''),
    lecturaInicial: Number(datos.lecturaInicial) || 0,
  }
  if (!limpio.nombre) throw new Error('Falta el nombre del usuario.')
  if (!limpio.mz || !limpio.lote) throw new Error('Faltan la manzana y el lote.')
  if (!limpio.medidor) throw new Error('Falta el código del medidor.')
  const repetido = estado.usuarios.find((u) => u.id !== datos.id && u.medidor === limpio.medidor && u.estado !== 'retirado')
  if (repetido) throw new Error(`Ese medidor ya está registrado a nombre de ${repetido.nombre} (Mz ${repetido.mz} Lt ${repetido.lote}).`)

  const usuarios = datos.id
    ? estado.usuarios.map((u) => (u.id === datos.id ? { ...u, ...limpio } : u))
    : [...estado.usuarios, { id: nuevoId(), ...limpio, estado: 'activo', creadoEn: hoyISO() }]
  fijar({ ...estado, usuarios })
}

export function cambiarEstadoUsuario(id, nuevoEstado) {
  fijar({ ...estado, usuarios: estado.usuarios.map((u) => (u.id === id ? { ...u, estado: nuevoEstado } : u)) })
}

// Con recibos emitidos no se borra (se perdería el historial): pasa a
// 'retirado' y deja de aparecer en la toma de lecturas.
export function eliminarUsuario(id) {
  const tieneHistorial = estado.recibos.some((r) => r.usuarioId === id)
  if (tieneHistorial) return cambiarEstadoUsuario(id, 'retirado')
  const periodos = estado.periodos.map((p) => {
    if (p.lecturas?.[id] == null) return p
    const lecturas = { ...p.lecturas }
    delete lecturas[id]
    return { ...p, lecturas }
  })
  fijar({ ...estado, periodos, usuarios: estado.usuarios.filter((u) => u.id !== id) })
}

// --- Periodos ------------------------------------------------------------

// Propone el periodo que toca abrir: el mes siguiente al último, con las
// fechas armadas según los días configurados (lectura el 30, vence el 20
// y corte el 21 del mes siguiente, como en el talonario).
export function sugerirPeriodo(e = estado) {
  const ultimo = periodosOrdenados(e).at(-1)
  const hoy = new Date()
  const { anio, mes } = ultimo ? mesSiguiente(ultimo.anio, ultimo.mes) : { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
  const sig = mesSiguiente(anio, mes)
  const ant = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
  const c = e.config
  const al = diaDelMes(anio, mes, c.diaLectura)
  return {
    anio,
    mes,
    del: ultimo ? ultimo.al : diaDelMes(ant.anio, ant.mes, c.diaLectura),
    al,
    fechaLectura: al,
    fechaVencimiento: diaDelMes(sig.anio, sig.mes, c.diaVencimiento),
    fechaCorte: diaDelMes(sig.anio, sig.mes, c.diaCorte),
    coeficiente: ultimo?.coeficiente ?? c.coeficiente,
    energiaPerdida: ultimo?.energiaPerdida ?? c.energiaPerdida,
    comision: ultimo?.comision ?? c.comision,
    mantenimiento: c.mantenimiento,
  }
}

function numeros(datos) {
  return {
    coeficiente: Number(datos.coeficiente) || 0,
    energiaPerdida: Number(datos.energiaPerdida) || 0,
    comision: Number(datos.comision) || 0,
    mantenimiento: Number(datos.mantenimiento) || 0,
  }
}

export function crearPeriodo(datos) {
  const id = idPeriodo(datos.anio, datos.mes)
  if (estado.periodos.some((p) => p.id === id)) throw new Error('Ese mes ya tiene un periodo abierto.')
  if (!(Number(datos.coeficiente) > 0)) throw new Error('El coeficiente tiene que ser mayor que cero.')
  const periodo = { ...datos, ...numeros(datos), id, anio: Number(datos.anio), mes: Number(datos.mes), lecturas: {} }
  fijar({ ...estado, periodos: [...estado.periodos, periodo] })
  return id
}

// Cambiar los cargos de un periodo recalcula sus recibos todavía NO
// pagados; los pagados quedan como se cobraron.
export function actualizarPeriodo(id, datos) {
  const periodos = estado.periodos.map((p) => (p.id === id ? { ...p, ...datos, ...numeros({ ...p, ...datos }) } : p))
  const periodo = periodos.find((p) => p.id === id)
  const recibos = estado.recibos.map((r) => (r.periodoId === id && !r.pago ? { ...r, ...importeDe(r.lecturaAnterior, r.lecturaActual, periodo) } : r))
  fijar({ ...estado, periodos, recibos })
}

export function eliminarPeriodo(id) {
  if (estado.recibos.some((r) => r.periodoId === id)) throw new Error('Este periodo ya tiene recibos emitidos, no se puede eliminar.')
  fijar({ ...estado, periodos: estado.periodos.filter((p) => p.id !== id) })
}

// --- Lecturas y recibos --------------------------------------------------

function importeDe(lecturaAnterior, lecturaActual, periodo) {
  return calcularImporte({ lecturaAnterior, lecturaActual, periodo, redondeo: estado.config.redondeo })
}

// `valor` null borra la lectura. Si ese usuario ya tiene recibo en el
// periodo y todavía no lo pagó, se corrige el recibo en el acto.
export function guardarLectura(periodoId, usuarioId, valor) {
  const pagado = estado.recibos.some((r) => r.periodoId === periodoId && r.usuarioId === usuarioId && r.pago)
  if (pagado) throw new Error('Ese recibo ya está pagado; no se puede cambiar la lectura.')
  const periodos = estado.periodos.map((p) => {
    if (p.id !== periodoId) return p
    const lecturas = { ...p.lecturas }
    if (valor == null) delete lecturas[usuarioId]
    else lecturas[usuarioId] = Number(valor)
    return { ...p, lecturas }
  })
  const periodo = periodos.find((p) => p.id === periodoId)
  let recibos = estado.recibos
  if (valor == null) {
    recibos = recibos.filter((r) => !(r.periodoId === periodoId && r.usuarioId === usuarioId))
  } else {
    recibos = recibos.map((r) =>
      r.periodoId === periodoId && r.usuarioId === usuarioId
        ? // Cambió el importe: el recibo que se mandó por WhatsApp ya no vale, hay que reenviarlo.
          { ...r, lecturaActual: Number(valor), ...importeDe(r.lecturaAnterior, Number(valor), periodo), whatsapp: r.lecturaActual === Number(valor) ? r.whatsapp ?? null : null }
        : r
    )
  }
  fijar({ ...estado, periodos, recibos })
}

// Usuarios del periodo con lectura tomada y todavía sin recibo.
export function pendientesDeEmitir(e, periodoId) {
  const periodo = e.periodos.find((p) => p.id === periodoId)
  if (!periodo) return []
  const conRecibo = new Set(e.recibos.filter((r) => r.periodoId === periodoId).map((r) => r.usuarioId))
  return e.usuarios
    .filter((u) => u.estado !== 'retirado' && periodo.lecturas?.[u.id] != null && !conRecibo.has(u.id))
    .sort(compararUbicacion)
}

// Emite, numerados en orden de manzana y lote, los recibos de todos los
// que ya tienen lectura. Se puede volver a llamar cuando se completan
// las lecturas que faltaban: solo emite los nuevos. Con `soloUsuarioId`
// emite únicamente el de ese usuario (el panel del lector emite uno
// por uno, apenas toma cada lectura).
export function emitirRecibos(periodoId, soloUsuarioId) {
  const periodo = estado.periodos.find((p) => p.id === periodoId)
  const pendientes = pendientesDeEmitir(estado, periodoId).filter((u) => !soloUsuarioId || u.id === soloUsuarioId)
  let numero = estado.config.siguienteNumero
  const nuevos = pendientes.map((u) => {
    const lecturaAnterior = lecturaAnteriorDe(estado, periodoId, u)
    const lecturaActual = periodo.lecturas[u.id]
    return {
      id: nuevoId(),
      numero: numero++,
      periodoId,
      usuarioId: u.id,
      lecturaAnterior,
      lecturaActual,
      ...importeDe(lecturaAnterior, lecturaActual, periodo),
      emitidoEn: hoyISO(),
      pago: null,
    }
  })
  fijar({ ...estado, recibos: [...estado.recibos, ...nuevos], config: { ...estado.config, siguienteNumero: numero } })
  return nuevos.length
}

// Deja anotado que se abrió WhatsApp con el recibo de este usuario. No
// hay forma de saber si de verdad tocó "Enviar" dentro de WhatsApp,
// así que es un registro de a quién ya se le mandó, no una
// confirmación de entrega - por eso se puede desmarcar.
export function marcarWhatsapp(reciboId, enviado = true) {
  const ahora = new Date()
  const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
  fijar({
    ...estado,
    recibos: estado.recibos.map((r) =>
      r.id === reciboId ? { ...r, whatsapp: enviado ? { fecha: hoyISO(), hora, veces: (r.whatsapp?.veces || 0) + 1 } : null } : r
    ),
  })
}

export function guardarTelefono(usuarioId, telefono) {
  const limpio = String(telefono || '').replace(/\D/g, '')
  fijar({ ...estado, usuarios: estado.usuarios.map((u) => (u.id === usuarioId ? { ...u, telefono: limpio } : u)) })
}

export function registrarPago(reciboId, { fecha, metodo }) {
  fijar({ ...estado, recibos: estado.recibos.map((r) => (r.id === reciboId ? { ...r, pago: { fecha, metodo } } : r)) })
}

export function anularPago(reciboId) {
  fijar({ ...estado, recibos: estado.recibos.map((r) => (r.id === reciboId ? { ...r, pago: null } : r)) })
}
