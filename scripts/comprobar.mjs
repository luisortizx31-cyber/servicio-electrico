// Comprobación rápida de las reglas de cálculo contra el recibo de
// papel N° 001061 (Set 2026). Correr con: node scripts/comprobar.mjs
import assert from 'node:assert/strict'
import { calcularImporte, redondear, recibosConEstado, deudaPorUsuario } from '../src/domain/calculo.js'
import { generarEjemplo } from '../src/data/ejemplo.js'

const periodo = { coeficiente: 0.77, energiaPerdida: 0.8, comision: 3, mantenimiento: 0 }
const r = calcularImporte({ lecturaAnterior: 4343.1, lecturaActual: 4567.4, periodo })
assert.equal(r.consumo, 224.3)
assert.equal(r.costoConsumo, 172.7)
assert.equal(r.total, 176.5)
assert.equal(redondear(172.75), 172.8)
assert.equal(redondear(12.34, 0.01), 12.34)

const config = { energiaPerdida: 0.8, comision: 3, mantenimiento: 0, redondeo: 0.1, diaLectura: 30, diaVencimiento: 20, diaCorte: 21 }
const ej = generarEjemplo(config)
const u = ej.usuarios.find((x) => x.medidor === '61532962')
const rec = ej.recibos.find((x) => x.usuarioId === u.id && x.periodoId === '2026-09')
assert.deepEqual([u.mz, u.lote, rec.numero, rec.lecturaAnterior, rec.lecturaActual, rec.total], ['B', '33', 1061, 4343.1, 4567.4, 176.5])
assert.ok(ej.recibos.every((x) => x.consumo > 0 && x.total > 0), 'ningún consumo negativo')
assert.equal(new Set(ej.recibos.map((x) => x.numero)).size, ej.recibos.length, 'números de recibo sin repetir')
assert.equal(new Set(ej.usuarios.map((x) => `${x.mz}-${x.lote}`)).size, ej.usuarios.length, 'lotes sin repetir')

const conEstado = recibosConEstado(ej, '2026-10-09')
const deuda = deudaPorUsuario(conEstado)
console.log('recibos:', ej.recibos.length, '| por estado:', Object.entries(Object.groupBy(conEstado, (x) => x.estado)).map(([k, v]) => `${k} ${v.length}`).join(', '))
console.log('deudores:', deuda.size, '| en corte:', [...deuda.values()].filter((d) => d.enCorte).length, '| siguiente N°:', ej.config.siguienteNumero)
console.log('OK: el cálculo coincide con el recibo de papel (S/ 176.50)')
