import { calcularImporte } from '../domain/calculo.js'
import { diaDelMes, idPeriodo, mesSiguiente } from '../domain/fecha.js'

// Datos de demostración para ver el sistema funcionando antes de cargar
// el padrón real: 24 usuarios inventados y 6 meses de historia (abril a
// setiembre de 2026). Los nombres NO son de vecinos reales. El usuario
// de Mz B Lt 33 reproduce los números del recibo de papel N° 001061
// (4343.1 -> 4567.4, S/ 176.50) para poder comparar contra el talonario.

const NOMBRES = [
  'Rosa Alvarado Ponce', 'Julio Benites Ramos', 'Carmen Castillo Vega', 'Pedro Díaz Lozano',
  'Elena Espinoza Ruiz', 'Marco Flores Tello', 'Gladys Gamarra Solís', 'Hugo Herrera Paz',
  'Irma Ibáñez Cruz', 'Jorge Jara Medina', 'Karina León Salas', 'Luis Mendoza Arce',
  'Norma Núñez Rojas', 'Óscar Ortega Luna', 'Patricia Paredes Gil', 'Raúl Quispe Mora',
  'Silvia Reyes Campos', 'Tomás Sánchez Vera', 'Úrsula Torres Meza', 'Víctor Uribe Lara',
  'Wendy Vargas Pinto', 'Ximena Yupanqui Ríos', 'Yolanda Zavala Cano', 'Zenón Aguilar Soto',
]

// Aleatorio con semilla fija: el ejemplo sale igual cada vez.
function crearAleatorio(semilla) {
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function generarEjemplo(configBase) {
  const azar = crearAleatorio(13)
  const config = { ...configBase }

  const usuarios = NOMBRES.map((nombre, i) => {
    const mz = 'ABCD'[Math.floor(i / 6)]
    const lote = String(Math.floor(i / 6) === 1 && i % 6 === 5 ? 33 : (i % 6) * 2 + 1 + Math.floor(azar() * 2))
    return {
      id: `ej-${i + 1}`,
      nombre,
      mz,
      lote,
      medidor: String(61532000 + Math.floor(azar() * 900) + i * 3),
      telefono: `9${String(Math.floor(azar() * 100000000)).padStart(8, '0')}`,
      lecturaInicial: Math.round((1500 + azar() * 4000) * 10) / 10,
      estado: 'activo',
      creadoEn: '2026-03-30',
      consumoBase: 60 + azar() * 190,
    }
  })
  const delRecibo = usuarios.find((u) => u.mz === 'B' && u.lote === '33')
  delRecibo.medidor = '61532962'

  const periodos = []
  const recibos = []
  let numero = 1
  let anio = 2026
  let mes = 4
  let alAnterior = diaDelMes(2026, 3, config.diaLectura)
  const lecturaActual = new Map(usuarios.map((u) => [u.id, u.lecturaInicial]))

  for (let n = 0; n < 6; n++) {
    const sig = mesSiguiente(anio, mes)
    const al = diaDelMes(anio, mes, config.diaLectura)
    const esUltimo = n === 5
    const periodo = {
      id: idPeriodo(anio, mes),
      anio,
      mes,
      del: alAnterior,
      al,
      fechaLectura: al,
      fechaVencimiento: diaDelMes(sig.anio, sig.mes, config.diaVencimiento),
      fechaCorte: diaDelMes(sig.anio, sig.mes, config.diaCorte),
      coeficiente: n < 3 ? 0.74 : 0.77,
      energiaPerdida: config.energiaPerdida,
      comision: config.comision,
      mantenimiento: 0,
      lecturas: {},
    }

    usuarios.forEach((u, i) => {
      const anterior = lecturaActual.get(u.id)
      let actual = Math.round((anterior + u.consumoBase * (0.8 + azar() * 0.4)) * 10) / 10
      if (esUltimo && u === delRecibo) actual = 4567.4
      // El mes anterior al último deja al del recibo real en 4343.1.
      if (n === 4 && u === delRecibo) actual = 4343.1
      periodo.lecturas[u.id] = actual
      lecturaActual.set(u.id, actual)

      // Meses viejos: todos pagados. Agosto: dos morosos (ya en corte).
      // Setiembre: recién emitido, pagó más o menos la mitad.
      let pago = null
      const diaPago = String(2 + Math.floor(azar() * 17)).padStart(2, '0')
      const mesPago = String(sig.mes).padStart(2, '0')
      const moroso = i === 7 || i === 16
      if (n < 4 || (n === 4 && !moroso) || (esUltimo && !moroso && Number(diaPago) <= 9)) {
        pago = { fecha: `${sig.anio}-${mesPago}-${diaPago}`, metodo: azar() < 0.35 ? 'yape' : 'efectivo' }
      }
      recibos.push({
        id: `ej-r-${numero}`,
        numero: numero++,
        periodoId: periodo.id,
        usuarioId: u.id,
        lecturaAnterior: anterior,
        lecturaActual: actual,
        ...calcularImporte({ lecturaAnterior: anterior, lecturaActual: actual, periodo, redondeo: config.redondeo }),
        emitidoEn: al,
        pago,
      })
    })

    periodos.push(periodo)
    alAnterior = al
    anio = sig.anio
    mes = sig.mes
  }

  // Deja la lectura de julio del usuario del recibo coherente con el
  // 4343.1 forzado en agosto (que no quede un consumo negativo).
  const julio = periodos[3]
  if (julio.lecturas[delRecibo.id] > 4343.1 - 150) {
    const desfase = julio.lecturas[delRecibo.id] - (4343.1 - 210)
    delRecibo.lecturaInicial = Math.round((delRecibo.lecturaInicial - desfase) * 10) / 10
    for (const p of periodos.slice(0, 4)) p.lecturas[delRecibo.id] = Math.round((p.lecturas[delRecibo.id] - desfase) * 10) / 10
    let anterior = delRecibo.lecturaInicial
    for (const p of periodos) {
      const r = recibos.find((x) => x.periodoId === p.id && x.usuarioId === delRecibo.id)
      const actual = p.lecturas[delRecibo.id]
      Object.assign(r, { lecturaAnterior: anterior, lecturaActual: actual }, calcularImporte({ lecturaAnterior: anterior, lecturaActual: actual, periodo: p, redondeo: config.redondeo }))
      anterior = actual
    }
  }

  // Corre la numeración para que el recibo de setiembre de Mz B Lt 33
  // sea el N° 001061, igual que el de papel.
  const elDelPapel = recibos.find((r) => r.periodoId === '2026-09' && r.usuarioId === delRecibo.id)
  const corrimiento = 1061 - elDelPapel.numero
  recibos.forEach((r) => (r.numero += corrimiento))
  config.siguienteNumero = Math.max(...recibos.map((r) => r.numero)) + 1

  // Uno de los morosos ya tiene el servicio cortado.
  usuarios[7].estado = 'cortado'
  usuarios.forEach((u) => delete u.consumoBase)

  return { config, usuarios, periodos, recibos }
}
