import { useState } from 'react'
import { registrarPago, anularPago } from '../data/store'
import { formatearMonto } from '../domain/dinero'
import { formatearFecha, hoyISO } from '../domain/fecha'
import { Boton } from './base'

// Cobrar un recibo - el mismo bloque en Recibos (tesorería) y en el
// panel del lector, que también cobra en la calle (pedido del usuario,
// 2026-10-11). Elegir efectivo o Yape NO cobra todavía: primero pide
// confirmar, para que un toque de más no deje un recibo como pagado.
export function CobroRecibo({ recibo, usuario }) {
  const hoy = hoyISO()
  const [fecha, setFecha] = useState(hoy)
  const [porConfirmar, setPorConfirmar] = useState(null) // null | 'efectivo' | 'yape'

  if (recibo.pago) {
    return (
      <div className="rounded-xl bg-success-soft p-3 text-sm text-success">
        <p className="font-bold">
          ✓ Pagado el {formatearFecha(recibo.pago.fecha)} · {recibo.pago.metodo === 'yape' ? 'Yape' : 'Efectivo'}
        </p>
        <button
          type="button"
          onClick={() => confirm('¿Anular este pago? El recibo vuelve a quedar como pendiente.') && anularPago(recibo.id)}
          className="mt-1 text-xs underline decoration-dotted"
        >
          Anular pago (se registró por error)
        </button>
      </div>
    )
  }

  const nombreMetodo = porConfirmar === 'yape' ? 'Yape' : 'efectivo'
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">Cobrar {formatearMonto(recibo.total)}</p>
        <input
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => setFecha(e.target.value)}
          aria-label="Fecha de pago"
          className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus-visible:border-brand"
        />
      </div>
      {porConfirmar ? (
        <div className={`rounded-xl p-3 ${porConfirmar === 'yape' ? 'bg-brand-soft' : 'bg-success-soft'}`}>
          <p className="text-sm font-bold text-ink">
            ¿Confirmar pago por {nombreMetodo} de <span className="money">{formatearMonto(recibo.total)}</span>?
          </p>
          <p className="text-xs text-ink-soft">
            {usuario.nombre} · fecha de pago {formatearFecha(fecha || hoy)}
          </p>
          <div className="mt-3 flex gap-2">
            <Boton variante="secundario" className="flex-1" onClick={() => setPorConfirmar(null)}>
              Cancelar
            </Boton>
            <Boton
              variante={porConfirmar === 'yape' ? 'primario' : 'exito'}
              className="flex-1"
              onClick={() => registrarPago(recibo.id, { fecha: fecha || hoy, metodo: porConfirmar })}
            >
              ✓ Confirmar pago por {nombreMetodo}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Boton variante="exito" className="flex-1" onClick={() => setPorConfirmar('efectivo')}>
            💵 Efectivo
          </Boton>
          <Boton className="flex-1" onClick={() => setPorConfirmar('yape')}>
            📱 Yape
          </Boton>
        </div>
      )}
    </div>
  )
}
