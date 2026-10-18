import { useState } from 'react'
import { useDatos } from '../data/useDatos'
import { guardarLectura, emitirRecibos, marcarWhatsapp, guardarTelefono, cambiarEstadoUsuario } from '../data/store'
import { calcularImporte, lecturaAnteriorDe, consumoPromedioDe, compararUbicacion } from '../domain/calculo'
import { formatearMonto, formatearNumero, formatearNumeroRecibo } from '../domain/dinero'
import { formatearFecha, nombrePeriodo } from '../domain/fecha'
import { linkWhatsapp, mensajeRecibo } from '../domain/whatsapp'
import { Boton, Buscador, Insignia, Modal, Titulo, Vacio } from '../ui/base'
import { ReciboPapel } from '../ui/ReciboPapel'
import { BotonReciboImagen } from '../ui/BotonReciboImagen'
import { CobroRecibo } from '../ui/CobroRecibo'
import { BotonReciboPegar } from '../ui/BotonReciboPegar'

// Panel exclusivo de quien sale a tomar lecturas (pedido del usuario,
// 2026-10-11): sin menú ni nada de tesorería, pensado para el celular
// en la calle. El recorrido de cada lote es uno solo:
//
//   buscar el lote -> anotar la lectura -> se emite su recibo ->
//   mandarlo por WhatsApp (y cobrarlo ahí mismo, si el vecino paga)
//
// y tres listas, ordenadas por lo que más importa en la calle: a quién
// falta leer, QUIÉN DEBE y quién ya pagó (pedido del usuario,
// 2026-10-12: "más importante es saber quién falta pagar y quién
// debe"). Si el recibo ya se mandó por WhatsApp o no, pasó a ser un
// dato de cada fila, no una lista aparte.
//
// "Deben" cuenta TODA la deuda del vecino, también la de meses
// anteriores: el que cobra tiene que saber cuánto pedir en total.
//
// "Corte" junta a los que ya pasaron la fecha de corte sin pagar y a
// los que ya tienen el servicio cortado: el lector también registra el
// corte y la reconexión desde la calle (pedido del usuario, 2026-10-12).
const PESTANAS = [
  { id: 'leer', texto: 'Leer' },
  { id: 'deben', texto: 'Deben' },
  { id: 'pagaron', texto: 'Pagaron' },
  { id: 'corte', texto: 'Corte' },
]

// Le toca corte: sigue con servicio y tiene algún recibo impago que ya
// pasó su fecha de corte (misma regla que la pantalla Cortes).
function paraCortar(fila) {
  return fila.usuario.estado === 'activo' && Boolean(fila.deuda?.enCorte)
}

export default function Lector({ onSalir }) {
  const { estado, config, usuarios, periodoActual: periodo, recibos, deuda } = useDatos()
  // Arranca en lo que hay por hacer: si ya se leyó todo, en los que deben.
  const [pestana, setPestana] = useState(() =>
    periodo && usuarios.some((u) => u.estado !== 'retirado' && periodo.lecturas?.[u.id] == null) ? 'leer' : 'deben'
  )
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState(null) // usuarioId

  if (!periodo) {
    return (
      <Marco onSalir={onSalir} titulo="Toma de lecturas">
        <Vacio>Tesorería todavía no abrió el periodo de este mes. Cuando lo abra, aquí aparecen los medidores por leer.</Vacio>
      </Marco>
    )
  }

  const recibosDelPeriodo = new Map(recibos.filter((r) => r.periodoId === periodo.id).map((r) => [r.usuarioId, r]))
  const filas = usuarios
    .filter((u) => u.estado !== 'retirado')
    .sort(compararUbicacion)
    .map((u) => ({ usuario: u, actual: periodo.lecturas?.[u.id] ?? null, recibo: recibosDelPeriodo.get(u.id), deuda: deuda.get(u.id) ?? null }))

  const grupos = {
    leer: filas.filter((f) => f.actual == null),
    deben: filas.filter((f) => f.deuda),
    // Pagó el recibo de este mes y no arrastra nada de meses anteriores.
    pagaron: filas.filter((f) => f.recibo?.pago && !f.deuda),
    // Primero los que toca cortar, después los ya cortados.
    corte: [...filas.filter((f) => paraCortar(f)), ...filas.filter((f) => f.usuario.estado === 'cortado')],
  }
  const sumar = (lista, valor) => Math.round(lista.reduce((t, x) => t + valor(x), 0) * 100) / 100
  const totalDeuda = sumar(grupos.deben, (f) => f.deuda.total)
  const delMes = filas.filter((f) => f.recibo)
  const cobradoDelMes = sumar(delMes.filter((f) => f.recibo.pago), (f) => f.recibo.total)
  const sinEnviar = delMes.filter((f) => !f.recibo.whatsapp).length

  // Con algo escrito en el buscador se busca en TODOS, sin importar la
  // pestaña: en la calle se busca un lote, no en qué lista está.
  const texto = busqueda.trim().toLowerCase()
  const visibles = texto
    ? filas.filter(
        (f) =>
          f.usuario.nombre.toLowerCase().includes(texto) ||
          f.usuario.medidor.includes(texto) ||
          `${f.usuario.mz}${f.usuario.lote}`.toLowerCase().includes(texto.replace(/\s|-/g, ''))
      )
    : grupos[pestana]

  const abierta = abiertoId ? filas.find((f) => f.usuario.id === abiertoId) : null
  const leidos = filas.length - grupos.leer.length

  return (
    <Marco onSalir={onSalir} titulo="Toma de lecturas" subtitulo={nombrePeriodo(periodo)}>
      <div className="rounded-2xl bg-gradient-to-br from-brand-dark to-brand p-4 text-white shadow">
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm font-bold">
            {leidos} de {filas.length} medidores leídos
          </p>
          <p className="text-xs text-white/70">
            {sinEnviar > 0 ? `${sinEnviar} recibos sin enviar` : 'recibos enviados ✓'}
          </p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`${leidos} de ${filas.length}`}>
          <div className="h-full rounded-full bg-spark" style={{ width: `${filas.length ? (leidos / filas.length) * 100 : 0}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Falta cobrar</p>
            <p className="money text-lg font-extrabold">{formatearMonto(totalDeuda)}</p>
            <p className="text-[10px] text-white/70">{grupos.deben.length} deben</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Cobrado del mes</p>
            <p className="money text-lg font-extrabold">{formatearMonto(cobradoDelMes)}</p>
            <p className="text-[10px] text-white/70">{delMes.filter((f) => f.recibo.pago).length} pagaron</p>
          </div>
        </div>
      </div>

      <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar lote (B33), nombre o medidor…" />

      {!texto && (
        <div className="grid grid-cols-4 gap-1.5">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              aria-pressed={pestana === p.id}
              className={`rounded-xl px-1 py-2 text-xs font-bold ${pestana === p.id ? 'bg-brand text-white' : 'border border-line bg-surface text-ink-soft'}`}
            >
              <span className="block">{p.texto}</span>
              <span className={`money mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] ${pestana === p.id ? 'bg-white/20' : 'bg-paper'}`}>{grupos[p.id].length}</span>
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <Vacio>
          {texto
            ? 'Ningún lote coincide.'
            : pestana === 'leer'
              ? '¡Listo! Ya se leyeron todos los medidores.'
              : pestana === 'deben'
                ? 'Nadie debe nada. 🎉'
                : pestana === 'pagaron'
                  ? 'Todavía no pagó nadie de este mes.'
                  : 'Nadie pasó la fecha de corte y no hay servicios cortados.'}
        </Vacio>
      ) : (
        <ul className="space-y-2">
          {visibles.map((f) => (
            <li key={f.usuario.id}>
              <button
                type="button"
                onClick={() => setAbiertoId(f.usuario.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-sm active:bg-brand-soft"
              >
                <div className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <span className="money text-base font-extrabold leading-none">{f.usuario.mz}-{f.usuario.lote}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wide">Mz · Lt</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{f.usuario.nombre}</p>
                  {f.usuario.estado === 'cortado' ? (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-danger">✕ Servicio cortado</p>
                  ) : (
                    paraCortar(f) && <p className="text-[10px] font-bold uppercase tracking-wide text-danger">✂ Le toca corte</p>
                  )}
                  <p className="truncate text-xs text-ink-soft">
                    {f.recibo ? (
                      f.recibo.whatsapp ? (
                        <>✓ Recibo enviado el {formatearFecha(f.recibo.whatsapp.fecha)}</>
                      ) : (
                        <span className="font-semibold text-warning">⚠ Falta enviarle el recibo</span>
                      )
                    ) : (
                      <>Falta leer · medidor <span className="money">{f.usuario.medidor}</span></>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  {f.deuda ? (
                    <>
                      <span className="money block text-sm font-extrabold text-danger">{formatearMonto(f.deuda.total)}</span>
                      <span className="block text-[10px] font-bold uppercase text-danger">
                        ✕ Debe{f.deuda.recibos.length > 1 ? ` ${f.deuda.recibos.length} recibos` : ''}
                      </span>
                    </>
                  ) : f.recibo ? (
                    <>
                      <span className="money block text-sm font-extrabold text-ink">{formatearMonto(f.recibo.total)}</span>
                      <span className="block text-[10px] font-bold uppercase text-success">✓ Pagó</span>
                    </>
                  ) : (
                    <span className="rounded-full bg-amber-soft px-2.5 py-1 text-[10px] font-bold uppercase text-amber">Leer</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierta && (
        <Ficha
          key={abierta.usuario.id}
          fila={abierta}
          periodo={periodo}
          config={config}
          anterior={lecturaAnteriorDe(estado, periodo.id, abierta.usuario)}
          promedio={consumoPromedioDe(estado, abierta.usuario.id, periodo.id)}
          onCerrar={() => {
            setAbiertoId(null)
            setBusqueda('')
          }}
        />
      )}
    </Marco>
  )
}

function Marco({ titulo, subtitulo, onSalir, children }) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-spark text-lg" aria-hidden="true">📲</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-extrabold leading-tight text-ink">{titulo}</h1>
          {subtitulo && <p className="text-[11px] text-ink-soft">{subtitulo}</p>}
        </div>
        <button type="button" onClick={onSalir} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft">
          Salir
        </button>
      </header>
      <main className="mx-auto max-w-md space-y-3 p-4 pb-10">{children}</main>
    </div>
  )
}

// Un lote: primero la lectura; una vez guardada, su recibo, el cobro y
// el envío. Abajo, lo que arrastra de meses anteriores, para cobrarlo
// en la misma visita.
function Ficha({ fila, periodo, config, anterior, promedio, onCerrar }) {
  const { usuario, actual, recibo, deuda } = fila
  const [corrigiendo, setCorrigiendo] = useState(false)
  const leyendo = actual == null || !recibo || corrigiendo
  const atrasados = (deuda?.recibos ?? []).filter((r) => r.periodoId !== periodo.id).sort((a, b) => a.periodoId.localeCompare(b.periodoId))

  return (
    <Modal titulo={`Mz ${usuario.mz} · Lote ${usuario.lote}`} subtitulo={`${usuario.nombre} · Medidor ${usuario.medidor}`} onCerrar={onCerrar}>
      {atrasados.length > 0 && (
        <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-bold text-danger">
          ✕ Debe en total <span className="money">{formatearMonto(deuda.total)}</span> · {deuda.recibos.length} recibos (el detalle de los meses anteriores está abajo)
        </p>
      )}
      {leyendo ? (
        <TomarLectura
          usuario={usuario}
          periodo={periodo}
          redondeo={config.redondeo}
          anterior={anterior}
          actual={actual}
          promedio={promedio}
          onGuardada={() => setCorrigiendo(false)}
          onCancelar={corrigiendo ? () => setCorrigiendo(false) : null}
        />
      ) : (
        <EnviarRecibo recibo={recibo} usuario={usuario} periodo={periodo} config={config} onCorregir={() => setCorrigiendo(true)} onCerrar={onCerrar} />
      )}

      <CorteServicio fila={fila} />

      {atrasados.length > 0 && (
        <div className="mt-5">
          <Titulo>Debe de meses anteriores</Titulo>
          <div className="space-y-3">
            {atrasados.map((r) => (
              <div key={r.id} className="rounded-xl border border-danger/30 bg-danger-soft/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">
                    {nombrePeriodo(r.periodo)} <span className="money text-xs font-normal text-ink-soft">N° {formatearNumeroRecibo(r.numero)}</span>
                  </p>
                  <Insignia estado={r.estado} />
                </div>
                <CobroRecibo recibo={r} usuario={usuario} />
                {r.pago && (
                  <div className="mt-2">
                    <BotonReciboImagen recibo={r} usuario={usuario} periodo={r.periodo} config={config} className="border border-success/40 bg-success-soft px-4 py-3 text-sm text-success" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// El sistema solo lleva el registro: cortar y reconectar el servicio
// lo hace la persona en el poste.
function CorteServicio({ fila }) {
  const { usuario, deuda } = fila

  if (usuario.estado === 'cortado') {
    function reconectar() {
      if (deuda && !confirm(`${usuario.nombre} todavía debe ${formatearMonto(deuda.total)}. ¿Reconectar igual?`)) return
      cambiarEstadoUsuario(usuario.id, 'activo')
    }
    return (
      <div className="mt-5">
        <Titulo>Corte del servicio</Titulo>
        <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-3">
          <p className="text-sm font-bold text-danger">✕ Este lote tiene el servicio cortado</p>
          <p className="mt-0.5 text-xs text-ink-soft">{deuda ? `Todavía debe ${formatearMonto(deuda.total)}.` : 'Ya no debe nada: se puede reconectar.'}</p>
          <Boton variante={deuda ? 'secundario' : 'exito'} className="mt-3 w-full" onClick={reconectar}>
            🔌 Registrar reconexión
          </Boton>
        </div>
      </div>
    )
  }

  if (!paraCortar(fila)) return null
  return (
    <div className="mt-5">
      <Titulo>Corte del servicio</Titulo>
      <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-3">
        <p className="text-sm font-bold text-danger">✂ Pasó la fecha de corte sin pagar</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Debe {formatearMonto(deuda.total)} ({deuda.recibos.map((r) => nombrePeriodo(r.periodo)).join(', ')}).
        </p>
        <Boton
          variante="peligro"
          className="mt-3 w-full"
          onClick={() => confirm(`¿Registrar el corte del servicio de ${usuario.nombre} (Mz ${usuario.mz} Lt ${usuario.lote})?`) && cambiarEstadoUsuario(usuario.id, 'cortado')}
        >
          ✂️ Registrar corte del servicio
        </Boton>
      </div>
    </div>
  )
}

function TomarLectura({ usuario, periodo, redondeo, anterior, actual, promedio, onGuardada, onCancelar }) {
  const [texto, setTexto] = useState(actual != null ? String(actual) : '')
  const [error, setError] = useState(null)

  const valor = texto.trim() === '' ? null : Number(texto.replace(',', '.'))
  const valido = valor != null && Number.isFinite(valor)
  const menor = valido && valor < anterior
  const importe = valido && !menor ? calcularImporte({ lecturaAnterior: anterior, lecturaActual: valor, periodo, redondeo }) : null
  const raro = importe && promedio > 20 && (importe.consumo > promedio * 2 || importe.consumo < promedio / 3)

  function guardar(e) {
    e.preventDefault()
    if (!importe) return
    try {
      guardarLectura(periodo.id, usuario.id, valor)
      emitirRecibos(periodo.id, usuario.id)
      onGuardada()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">Lectura anterior</span>
        <span className="money text-xl font-extrabold text-ink">{formatearNumero(anterior)}</span>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">Lectura actual del medidor</span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setError(null)
          }}
          placeholder="0.0"
          className={`money w-full rounded-2xl border-2 bg-surface px-4 py-4 text-center text-4xl font-extrabold text-ink outline-none ${menor || (texto && !valido) ? 'border-danger' : 'border-brand/40 focus-visible:border-brand'}`}
        />
      </label>

      {menor && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">⚠ No puede ser menor que la lectura anterior.</p>}
      {texto && !valido && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">⚠ Escribe solo números.</p>}
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">⚠ {error}</p>}

      {importe && (
        <div className="rounded-xl bg-brand-soft px-4 py-3">
          <div className="flex items-center justify-between text-sm text-brand">
            <span>Consumo</span>
            <span className="money font-extrabold">{formatearNumero(importe.consumo)} kWh</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-brand">
            <span className="text-sm">Total a pagar</span>
            <span className="money text-2xl font-extrabold">{formatearMonto(importe.total)}</span>
          </div>
          {raro && (
            <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-bold text-warning">
              ⚠ Revisa el número: este lote suele consumir unos {formatearNumero(promedio, 0)} kWh.
            </p>
          )}
        </div>
      )}

      <Boton type="submit" variante="exito" className="w-full py-4 text-base" disabled={!importe}>
        Guardar y emitir recibo
      </Boton>
      {onCancelar && (
        <button type="button" onClick={onCancelar} className="w-full text-center text-xs font-semibold text-ink-soft underline decoration-dotted">
          Cancelar la corrección
        </button>
      )}
    </form>
  )
}

function EnviarRecibo({ recibo, usuario, periodo, config, onCorregir, onCerrar }) {
  const [telefono, setTelefono] = useState('')
  const whatsapp = linkWhatsapp(usuario.telefono, mensajeRecibo({ recibo, usuario, periodo, config }))
  const enviado = recibo.whatsapp

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-success-soft px-3 py-2 text-sm font-bold text-success">✓ Recibo N° {formatearNumeroRecibo(recibo.numero)} emitido</p>
      <ReciboPapel recibo={recibo} usuario={usuario} periodo={periodo} config={config} />

      <CobroRecibo recibo={recibo} usuario={usuario} />

      {enviado && (
        <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-soft">
          <p className="font-bold text-ink">
            ✓ Enviado por WhatsApp el {formatearFecha(enviado.fecha)} a las {enviado.hora}
            {enviado.veces > 1 ? ` (${enviado.veces} veces)` : ''}
          </p>
          <button type="button" onClick={() => marcarWhatsapp(recibo.id, false, { pagado: false })} className="mt-0.5 underline decoration-dotted">
            No llegó a enviarse: marcar como no enviado
          </button>
        </div>
      )}

      {/* Dos formas de mandarlo: la imagen del recibo amarillo (hay que
          elegir el contacto en WhatsApp) o el mismo detalle como texto
          (abre directo el chat del vecino, por eso necesita su celular). */}
      <BotonReciboImagen
        recibo={recibo}
        usuario={usuario}
        periodo={periodo}
        config={config}
        className={`px-4 py-4 text-base ${enviado ? 'border border-success/40 bg-success-soft text-success' : 'bg-success text-white'}`}
      />

      <BotonReciboPegar recibo={recibo} usuario={usuario} periodo={periodo} config={config} />

      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => marcarWhatsapp(recibo.id)}
          className="block w-full rounded-xl border border-success/40 bg-surface px-4 py-3 text-center text-sm font-bold text-success"
        >
          💬 Enviarlo como mensaje de texto
          <span className="money block text-xs font-semibold opacity-80">directo al {usuario.telefono}</span>
        </a>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            guardarTelefono(usuario.id, telefono)
          }}
          className="rounded-xl border border-dashed border-warning/50 bg-warning-soft p-3"
        >
          <p className="mb-2 text-xs font-bold text-warning">Sin celular registrado (hace falta para el mensaje de texto). Pídeselo y anótalo:</p>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="9XXXXXXXX"
              className="money min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-base font-bold text-ink outline-none focus-visible:border-brand"
            />
            <Boton type="submit" disabled={telefono.replace(/\D/g, '').length < 9}>
              Guardar
            </Boton>
          </div>
        </form>
      )}

      <Boton variante="secundario" className="w-full py-3" onClick={onCerrar}>
        Siguiente lote →
      </Boton>
      {!recibo.pago && (
        <button type="button" onClick={onCorregir} className="w-full text-center text-xs font-semibold text-ink-soft underline decoration-dotted">
          Me equivoqué en la lectura: corregirla
        </button>
      )}
    </div>
  )
}
