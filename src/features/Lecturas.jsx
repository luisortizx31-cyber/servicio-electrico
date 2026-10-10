import { useRef, useState } from 'react'
import { useDatos } from '../data/useDatos'
import { guardarLectura, emitirRecibos, pendientesDeEmitir } from '../data/store'
import { calcularImporte, lecturaAnteriorDe, consumoPromedioDe, compararUbicacion } from '../domain/calculo'
import { formatearMonto, formatearNumero } from '../domain/dinero'
import { nombrePeriodo } from '../domain/fecha'
import { Boton, Buscador, SelectorPeriodo, Tarjeta, Vacio, Insignia } from '../ui/base'

// Toma de lecturas del mes: una fila por medidor, en orden de manzana
// y lote (el orden en que se camina). Solo se escribe la lectura
// actual; la anterior, el consumo y el importe salen solos. Enter pasa
// al siguiente medidor, para cargar toda la hoja sin tocar el mouse.
export default function Lecturas({ onIr }) {
  const { estado, config, usuarios, periodos, periodoActual, recibos } = useDatos()
  const [periodoId, setPeriodoId] = useState(periodoActual?.id ?? '')
  const [busqueda, setBusqueda] = useState('')
  const [soloFaltantes, setSoloFaltantes] = useState(false)
  const [aviso, setAviso] = useState(null)
  const inputs = useRef(new Map())

  const periodo = periodos.find((p) => p.id === periodoId) ?? periodoActual
  if (!periodo) {
    return (
      <Vacio>
        Todavía no hay ningún periodo abierto.{' '}
        <button type="button" onClick={() => onIr('periodos')} className="font-bold text-brand underline">
          Abrir el primero
        </button>
      </Vacio>
    )
  }

  const recibosDelPeriodo = new Map(recibos.filter((r) => r.periodoId === periodo.id).map((r) => [r.usuarioId, r]))
  // Los retirados solo aparecen si ya tenían recibo en este periodo.
  const filas = usuarios
    .filter((u) => u.estado !== 'retirado' || recibosDelPeriodo.has(u.id))
    .sort(compararUbicacion)
    .map((u) => ({ usuario: u, anterior: lecturaAnteriorDe(estado, periodo.id, u), actual: periodo.lecturas?.[u.id] ?? null, recibo: recibosDelPeriodo.get(u.id) }))

  const tomadas = filas.filter((f) => f.actual != null).length
  const porEmitir = pendientesDeEmitir(estado, periodo.id).length
  const texto = busqueda.trim().toLowerCase()
  const visibles = filas.filter(
    (f) =>
      (!soloFaltantes || f.actual == null) &&
      (!texto || f.usuario.nombre.toLowerCase().includes(texto) || f.usuario.medidor.includes(texto) || `${f.usuario.mz}${f.usuario.lote}`.toLowerCase().includes(texto.replace(/\s|-/g, '')))
  )

  function emitir() {
    const cantidad = emitirRecibos(periodo.id)
    setAviso(`Se emitieron ${cantidad} recibos de ${nombrePeriodo(periodo)}.`)
  }

  function enfocarSiguiente(usuarioId) {
    const i = visibles.findIndex((f) => f.usuario.id === usuarioId)
    const siguiente = visibles.slice(i + 1).find((f) => !f.recibo?.pago)
    inputs.current.get(siguiente?.usuario.id)?.focus()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SelectorPeriodo periodos={periodos} value={periodo.id} onChange={setPeriodoId} nombre={nombrePeriodo} />
        <p className="text-xs text-ink-soft">
          Coeficiente <span className="money font-bold text-ink">S/ {formatearNumero(periodo.coeficiente, 2)}</span> por kWh
        </p>
      </div>

      <Tarjeta className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink">
            {tomadas} de {filas.length} lecturas tomadas
          </p>
          {porEmitir > 0 && (
            <Boton onClick={emitir} variante="exito">
              🧾 Emitir {porEmitir} {porEmitir === 1 ? 'recibo' : 'recibos'}
            </Boton>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-soft" role="img" aria-label={`${tomadas} de ${filas.length}`}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${filas.length ? (tomadas / filas.length) * 100 : 0}%` }} />
        </div>
        {aviso && (
          <p className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success">
            ✓ {aviso}
            <button type="button" onClick={() => onIr('recibos')} className="font-bold underline">
              Ver recibos
            </button>
          </p>
        )}
      </Tarjeta>

      <div className="flex items-center gap-2">
        <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, medidor o Mz/Lote…" />
        <button
          type="button"
          onClick={() => setSoloFaltantes((v) => !v)}
          aria-pressed={soloFaltantes}
          className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold ${soloFaltantes ? 'bg-brand text-white' : 'border border-line bg-surface text-ink-soft'}`}
        >
          Solo faltantes
        </button>
      </div>

      {filas.length === 0 ? (
        <Vacio>No hay usuarios registrados todavía.</Vacio>
      ) : visibles.length === 0 ? (
        <Vacio>{soloFaltantes && !texto ? '¡Listo! Ya están todas las lecturas.' : 'Ningún usuario coincide.'}</Vacio>
      ) : (
        <ul className="space-y-2">
          {visibles.map((f) => (
            <FilaLectura
              key={`${periodo.id}-${f.usuario.id}`}
              fila={f}
              periodo={periodo}
              redondeo={config.redondeo}
              promedio={consumoPromedioDe(estado, f.usuario.id, periodo.id)}
              registrarInput={(el) => (el ? inputs.current.set(f.usuario.id, el) : inputs.current.delete(f.usuario.id))}
              onEnter={() => enfocarSiguiente(f.usuario.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilaLectura({ fila, periodo, redondeo, promedio, registrarInput, onEnter }) {
  const { usuario, anterior, actual, recibo } = fila
  const [texto, setTexto] = useState(actual != null ? String(actual) : '')
  const [error, setError] = useState(null)
  const bloqueado = Boolean(recibo?.pago)

  const valor = texto.trim() === '' ? null : Number(texto.replace(',', '.'))
  const valido = valor != null && Number.isFinite(valor)
  const importe = valido ? calcularImporte({ lecturaAnterior: anterior, lecturaActual: valor, periodo, redondeo }) : null
  const menor = valido && valor < anterior
  // Más del doble (o menos de un tercio) de lo que suele consumir.
  const raro = importe && !menor && promedio > 20 && (importe.consumo > promedio * 2 || importe.consumo < promedio / 3)

  function guardar() {
    setError(null)
    if (valor === actual || (valor == null && actual == null)) return
    if (valor != null && (!valido || menor)) {
      setError(menor ? 'No puede ser menor que la lectura anterior.' : 'Escribe solo números.')
      return
    }
    try {
      guardarLectura(periodo.id, usuario.id, valor)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <li className={`rounded-2xl border bg-surface p-3 shadow-sm ${error || menor ? 'border-danger/50' : 'border-line'}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-brand">
          <span className="money text-sm font-extrabold leading-none">{usuario.mz}-{usuario.lote}</span>
          <span className="text-[8px] font-bold uppercase tracking-wide">Mz · Lt</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{usuario.nombre}</p>
          <p className="text-xs text-ink-soft">
            Medidor <span className="money">{usuario.medidor}</span> · anterior <span className="money font-bold text-ink">{formatearNumero(anterior)}</span>
          </p>
        </div>
        <input
          ref={registrarInput}
          type="text"
          inputMode="decimal"
          value={texto}
          disabled={bloqueado}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              guardar()
              onEnter()
            }
          }}
          placeholder="Lectura"
          aria-label={`Lectura actual de ${usuario.nombre}`}
          className="money w-28 shrink-0 rounded-xl border border-line bg-paper px-3 py-2.5 text-right text-base font-bold text-ink outline-none focus-visible:border-brand disabled:text-ink-soft"
        />
      </div>

      {(importe || error) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-2 text-xs">
          {error || menor ? (
            <p className="font-medium text-danger">⚠ {error || 'Es menor que la lectura anterior.'}</p>
          ) : (
            <>
              <p className="text-ink-soft">
                Consumo <span className="money font-bold text-ink">{formatearNumero(importe.consumo)} kWh</span>
                {raro && <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 font-bold text-warning">⚠ Revisar: suele consumir {formatearNumero(promedio, 0)}</span>}
              </p>
              <p className="flex items-center gap-2 text-ink-soft">
                {recibo ? <Insignia estado={recibo.estado} /> : valor === actual && <span className="font-medium text-success">✓ Guardada</span>}
                <span className="money text-sm font-extrabold text-ink">{formatearMonto(importe.total)}</span>
              </p>
            </>
          )}
        </div>
      )}
    </li>
  )
}
