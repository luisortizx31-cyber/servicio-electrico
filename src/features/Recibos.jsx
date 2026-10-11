import { useState } from 'react'
import { useDatos } from '../data/useDatos'
import { registrarPago, anularPago, marcarWhatsapp } from '../data/store'
import { compararUbicacion, resumenPeriodo } from '../domain/calculo'
import { formatearMonto, formatearNumeroRecibo } from '../domain/dinero'
import { formatearFecha, nombrePeriodo } from '../domain/fecha'
import { linkWhatsapp, mensajeRecibo } from '../domain/whatsapp'
import { Boton, Buscador, Insignia, Modal, Tarjeta, Vacio } from '../ui/base'
import { ReciboPapel } from '../ui/ReciboPapel'
import { imprimirRecibos } from '../ui/colaImpresion'

const FILTROS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'debe', texto: 'Deben' },
  { id: 'pagado', texto: 'Pagados' },
]

// Recibos emitidos: cobrar, ver el recibo como el de papel, imprimirlo
// o mandarlo por WhatsApp. "Todo lo pendiente" junta la deuda de todos
// los meses, para cobrarle a alguien que debe varios.
export default function Recibos({ onIr }) {
  const { hoy, config, usuariosPorId, periodos, periodoActual, recibos } = useDatos()
  const [periodoId, setPeriodoId] = useState(periodoActual?.id ?? 'pendientes')
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState(null)

  const todoPendiente = periodoId === 'pendientes'
  const base = todoPendiente ? recibos.filter((r) => !r.pago) : recibos.filter((r) => r.periodoId === periodoId)
  const resumen = resumenPeriodo(base)
  const texto = busqueda.trim().toLowerCase()
  const visibles = base
    .map((r) => ({ ...r, usuario: usuariosPorId.get(r.usuarioId) }))
    .filter((r) => r.usuario)
    .filter((r) => filtro === 'todos' || (filtro === 'pagado' ? r.pago : !r.pago))
    .filter(
      (r) =>
        !texto ||
        r.usuario.nombre.toLowerCase().includes(texto) ||
        r.usuario.medidor.includes(texto) ||
        formatearNumeroRecibo(r.numero).includes(texto) ||
        `${r.usuario.mz}${r.usuario.lote}`.toLowerCase().includes(texto.replace(/\s|-/g, ''))
    )
    .sort((a, b) => b.periodoId.localeCompare(a.periodoId) || compararUbicacion(a.usuario, b.usuario))

  const abierto = abiertoId ? recibos.find((r) => r.id === abiertoId) : null

  if (recibos.length === 0) {
    return (
      <Vacio>
        Todavía no se emitió ningún recibo. Se emiten desde{' '}
        <button type="button" onClick={() => onIr('lecturas')} className="font-bold text-brand underline">
          Lecturas
        </button>
        , cuando ya están anotados los medidores.
      </Vacio>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
          aria-label="Periodo"
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-bold text-ink outline-none focus-visible:border-brand"
        >
          <option value="pendientes">Todo lo pendiente</option>
          {[...periodos].reverse().map((p) => (
            <option key={p.id} value={p.id}>{nombrePeriodo(p)}</option>
          ))}
        </select>
        <Boton
          variante="secundario"
          className="ml-auto"
          disabled={visibles.length === 0}
          onClick={() => imprimirRecibos(visibles.map((r) => ({ recibo: r, usuario: r.usuario, periodo: r.periodo })))}
        >
          🖨️ Imprimir {visibles.length}
        </Boton>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Mini etiqueta={todoPendiente ? 'Recibos' : 'Facturado'} valor={todoPendiente ? resumen.cantidad : formatearMonto(resumen.facturado)} />
        <Mini etiqueta="Cobrado" valor={formatearMonto(resumen.cobrado)} />
        <Mini etiqueta="Falta cobrar" valor={formatearMonto(resumen.pendiente)} />
      </div>

      <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, N° de recibo, medidor o Mz/Lote…" />
      {!todoPendiente && (
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${filtro === f.id ? 'bg-brand text-white' : 'border border-line bg-surface text-ink-soft'}`}
            >
              {f.texto}
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <Vacio>{todoPendiente && !texto ? 'Nadie debe nada. 🎉' : 'Ningún recibo coincide.'}</Vacio>
      ) : (
        <Tarjeta className="divide-y divide-line overflow-hidden">
          {visibles.map((r) => (
            <button key={r.id} type="button" onClick={() => setAbiertoId(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-brand-soft">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.usuario.nombre}</p>
                <p className="text-xs text-ink-soft">
                  <span className="money">N° {formatearNumeroRecibo(r.numero)}</span> · Mz {r.usuario.mz} Lt {r.usuario.lote}
                  {todoPendiente && ` · ${nombrePeriodo(r.periodo)}`}
                </p>
              </div>
              <Insignia estado={r.estado} />
              <span className="money w-24 shrink-0 text-right text-sm font-extrabold text-ink">{formatearMonto(r.total)}</span>
            </button>
          ))}
        </Tarjeta>
      )}

      {abierto && (
        <DetalleRecibo
          recibo={abierto}
          usuario={usuariosPorId.get(abierto.usuarioId)}
          config={config}
          hoy={hoy}
          onCerrar={() => setAbiertoId(null)}
        />
      )}
    </div>
  )
}

function Mini({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{etiqueta}</p>
      <p className="money text-sm font-extrabold text-ink">{valor}</p>
    </div>
  )
}

function DetalleRecibo({ recibo, usuario, config, hoy, onCerrar }) {
  const [fecha, setFecha] = useState(hoy)
  const periodo = recibo.periodo
  const whatsapp = linkWhatsapp(usuario.telefono, mensajeRecibo({ recibo, usuario, periodo, config }))

  return (
    <Modal titulo={`Recibo N° ${formatearNumeroRecibo(recibo.numero)}`} subtitulo={`${usuario.nombre} · ${nombrePeriodo(periodo)}`} onCerrar={onCerrar}>
      <ReciboPapel recibo={recibo} usuario={usuario} periodo={periodo} config={config} />

      {recibo.pago ? (
        <div className="mt-4 rounded-xl bg-success-soft p-3 text-sm text-success">
          <p className="font-bold">✓ Pagado el {formatearFecha(recibo.pago.fecha)} · {recibo.pago.metodo === 'yape' ? 'Yape' : 'Efectivo'}</p>
          <button
            type="button"
            onClick={() => confirm('¿Anular este pago? El recibo vuelve a quedar como pendiente.') && anularPago(recibo.id)}
            className="mt-1 text-xs underline decoration-dotted"
          >
            Anular pago (se registró por error)
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-line bg-surface p-3">
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
          <div className="flex gap-2">
            <Boton variante="exito" className="flex-1" onClick={() => registrarPago(recibo.id, { fecha: fecha || hoy, metodo: 'efectivo' })}>
              💵 Efectivo
            </Boton>
            <Boton className="flex-1" onClick={() => registrarPago(recibo.id, { fecha: fecha || hoy, metodo: 'yape' })}>
              📱 Yape
            </Boton>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Boton variante="secundario" className="flex-1" onClick={() => imprimirRecibos([{ recibo, usuario, periodo }])}>
          🖨️ Imprimir
        </Boton>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => marcarWhatsapp(recibo.id)} className="flex-1 rounded-xl border border-success/40 bg-success-soft px-4 py-2.5 text-center text-sm font-bold text-success">
            {recibo.whatsapp ? 'Reenviar WhatsApp' : 'WhatsApp'}
          </a>
        ) : (
          <span className="flex-1 rounded-xl border border-dashed border-line px-4 py-2.5 text-center text-xs text-ink-soft">Sin celular registrado</span>
        )}
      </div>
    </Modal>
  )
}
