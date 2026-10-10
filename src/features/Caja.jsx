import { useState } from 'react'
import { useDatos } from '../data/useDatos'
import { formatearMonto, formatearNumeroRecibo } from '../domain/dinero'
import { formatearFecha, MESES } from '../domain/fecha'
import { Boton, Tarjeta, Titulo, Vacio } from '../ui/base'

function sumar(lista) {
  return Math.round(lista.reduce((s, r) => s + r.total, 0) * 100) / 100
}

// Caja: la plata que ENTRÓ, agrupada por el día en que se cobró (no
// por el mes del recibo) y separada en efectivo y Yape, para cuadrar
// contra lo que hay en mano.
export default function Caja() {
  const { hoy, usuariosPorId, recibos } = useDatos()
  const pagados = recibos.filter((r) => r.pago)
  const meses = [...new Set([hoy.slice(0, 7), ...pagados.map((r) => r.pago.fecha.slice(0, 7))])].sort().reverse()
  const [mes, setMes] = useState(meses[0])
  const [diaAbierto, setDiaAbierto] = useState(null)

  const delMes = pagados.filter((r) => r.pago.fecha.startsWith(mes))
  const efectivo = delMes.filter((r) => r.pago.metodo !== 'yape')
  const yape = delMes.filter((r) => r.pago.metodo === 'yape')
  const dias = [...new Set(delMes.map((r) => r.pago.fecha))].sort().reverse()
  const deHoy = pagados.filter((r) => r.pago.fecha === hoy)

  function descargar() {
    const filas = [['Fecha de pago', 'Metodo', 'N recibo', 'Periodo', 'Usuario', 'Mz', 'Lote', 'Total']]
    for (const r of [...delMes].sort((a, b) => a.pago.fecha.localeCompare(b.pago.fecha) || a.numero - b.numero)) {
      const u = usuariosPorId.get(r.usuarioId)
      filas.push([r.pago.fecha, r.pago.metodo, formatearNumeroRecibo(r.numero), r.periodoId, u?.nombre ?? '', u?.mz ?? '', u?.lote ?? '', r.total.toFixed(2)])
    }
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `caja-${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <Tarjeta className="flex items-center justify-between gap-3 border-l-4 border-l-spark p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Cobrado hoy · {formatearFecha(hoy)}</p>
          <p className="money text-2xl font-extrabold text-ink">{formatearMonto(sumar(deHoy))}</p>
        </div>
        <p className="text-right text-xs text-ink-soft">
          {deHoy.length} {deHoy.length === 1 ? 'recibo' : 'recibos'}
        </p>
      </Tarjeta>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          aria-label="Mes"
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-bold text-ink outline-none focus-visible:border-brand"
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {MESES[Number(m.slice(5)) - 1]} {m.slice(0, 4)}
            </option>
          ))}
        </select>
        <Boton variante="secundario" className="ml-auto" disabled={delMes.length === 0} onClick={descargar}>
          ⬇ Descargar para Excel
        </Boton>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Total del mes', delMes],
          ['Efectivo', efectivo],
          ['Yape', yape],
        ].map(([etiqueta, lista]) => (
          <div key={etiqueta} className="rounded-xl border border-line bg-surface px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{etiqueta}</p>
            <p className="money text-sm font-extrabold text-ink">{formatearMonto(sumar(lista))}</p>
            <p className="text-[10px] text-ink-soft">{lista.length} recibos</p>
          </div>
        ))}
      </div>

      <div>
        <Titulo>Día por día</Titulo>
        {dias.length === 0 ? (
          <Vacio>No se registró ningún cobro en este mes.</Vacio>
        ) : (
          <Tarjeta className="divide-y divide-line overflow-hidden">
            {dias.map((dia) => {
              const delDia = delMes.filter((r) => r.pago.fecha === dia)
              const abierto = diaAbierto === dia
              return (
                <div key={dia}>
                  <button type="button" onClick={() => setDiaAbierto(abierto ? null : dia)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-brand-soft">
                    <span className="text-sm font-semibold text-ink">
                      {abierto ? '▼' : '▶'} {formatearFecha(dia)}
                      <span className="ml-2 text-xs font-normal text-ink-soft">{delDia.length} recibos</span>
                    </span>
                    <span className="money text-sm font-extrabold text-ink">{formatearMonto(sumar(delDia))}</span>
                  </button>
                  {abierto && (
                    <ul className="bg-paper px-4 py-2">
                      {delDia.map((r) => {
                        const u = usuariosPorId.get(r.usuarioId)
                        return (
                          <li key={r.id} className="flex items-center justify-between gap-2 py-1 text-xs text-ink-soft">
                            <span className="min-w-0 truncate">
                              <span className="money">N° {formatearNumeroRecibo(r.numero)}</span> · {u?.nombre} · {r.pago.metodo === 'yape' ? 'Yape' : 'Efectivo'}
                            </span>
                            <span className="money shrink-0 font-bold text-ink">{formatearMonto(r.total)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </Tarjeta>
        )}
      </div>
    </div>
  )
}
