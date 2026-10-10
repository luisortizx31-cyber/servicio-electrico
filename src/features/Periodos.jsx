import { useState } from 'react'
import { useDatos } from '../data/useDatos'
import { crearPeriodo, actualizarPeriodo, eliminarPeriodo, sugerirPeriodo } from '../data/store'
import { resumenPeriodo } from '../domain/calculo'
import { formatearMonto, formatearNumero } from '../domain/dinero'
import { formatearFecha, nombrePeriodo, MESES } from '../domain/fecha'
import { Boton, Campo, Modal, Tarjeta, Vacio } from '../ui/base'

// Un periodo es un mes de facturación: sus fechas (lectura,
// vencimiento, corte) y sus cargos (coeficiente por kWh y montos
// fijos). Al abrir uno nuevo el sistema ya trae todo propuesto a
// partir del mes anterior; solo hay que revisar y confirmar.
export default function Periodos({ onIr }) {
  const { estado, usuarios, periodos, recibos } = useDatos()
  const [formulario, setFormulario] = useState(null) // null | { periodo, esNuevo }
  const sugerido = sugerirPeriodo(estado)
  const activos = usuarios.filter((u) => u.estado !== 'retirado').length

  return (
    <div className="space-y-4">
      <Tarjeta className="flex items-center justify-between gap-3 border-l-4 border-l-spark p-4">
        <div>
          <p className="text-sm font-bold text-ink">Siguiente: {MESES[sugerido.mes - 1]} {sugerido.anio}</p>
          <p className="text-xs text-ink-soft">
            Lectura el {formatearFecha(sugerido.fechaLectura)} · vence el {formatearFecha(sugerido.fechaVencimiento)}
          </p>
        </div>
        <Boton className="shrink-0" onClick={() => setFormulario({ periodo: sugerido, esNuevo: true })}>
          Abrir periodo
        </Boton>
      </Tarjeta>

      {periodos.length === 0 ? (
        <Vacio>Todavía no hay periodos. Abre el primero para empezar a tomar lecturas.</Vacio>
      ) : (
        <div className="space-y-2">
          {[...periodos].reverse().map((p) => {
            const r = resumenPeriodo(recibos.filter((x) => x.periodoId === p.id))
            const lecturas = Object.keys(p.lecturas ?? {}).length
            const porcentaje = r.facturado ? Math.round((r.cobrado / r.facturado) * 100) : 0
            return (
              <Tarjeta key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold text-ink">{nombrePeriodo(p)}</p>
                    <p className="text-xs text-ink-soft">
                      Del {formatearFecha(p.del)} al {formatearFecha(p.al)} · S/ <span className="money">{formatearNumero(p.coeficiente, 2)}</span> el kWh
                    </p>
                  </div>
                  <button type="button" onClick={() => setFormulario({ periodo: p, esNuevo: false })} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft">
                    Editar
                  </button>
                </div>

                {r.cantidad === 0 ? (
                  <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
                    {lecturas} de {activos} lecturas tomadas, sin recibos emitidos.{' '}
                    <button type="button" onClick={() => onIr('lecturas')} className="font-bold underline">
                      Ir a lecturas
                    </button>
                  </p>
                ) : (
                  <>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <Par etiqueta="Recibos" valor={`${r.pagados} de ${r.cantidad} pagados`} />
                      <Par etiqueta="Consumo" valor={`${formatearNumero(r.consumo)} kWh`} />
                      <Par etiqueta="Facturado" valor={formatearMonto(r.facturado)} />
                      <Par etiqueta="Falta cobrar" valor={formatearMonto(r.pendiente)} />
                    </dl>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-soft" role="img" aria-label={`Cobrado ${porcentaje}%`}>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${porcentaje}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      Cobrado {formatearMonto(r.cobrado)} ({porcentaje}%) · vence {formatearFecha(p.fechaVencimiento)} · corte {formatearFecha(p.fechaCorte)}
                    </p>
                  </>
                )}
              </Tarjeta>
            )
          })}
        </div>
      )}

      {formulario && (
        <FormularioPeriodo
          {...formulario}
          tieneRecibos={recibos.some((r) => r.periodoId === formulario.periodo.id)}
          onCerrar={() => setFormulario(null)}
          onCreado={() => {
            setFormulario(null)
            onIr('lecturas')
          }}
        />
      )}
    </div>
  )
}

function Par({ etiqueta, valor }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{etiqueta}</dt>
      <dd className="money font-bold text-ink">{valor}</dd>
    </div>
  )
}

function FormularioPeriodo({ periodo, esNuevo, tieneRecibos, onCerrar, onCreado }) {
  const [datos, setDatos] = useState({ ...periodo })
  const [error, setError] = useState(null)
  const campo = (nombre) => ({ value: datos[nombre], onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })) })

  function guardar(e) {
    e.preventDefault()
    try {
      if (datos.al < datos.del) throw new Error('La fecha "al" no puede ser anterior a la fecha "del".')
      if (datos.fechaCorte < datos.fechaVencimiento) throw new Error('El corte no puede ser antes del vencimiento.')
      if (esNuevo) {
        crearPeriodo(datos)
        onCreado()
      } else {
        const { del, al, fechaLectura, fechaVencimiento, fechaCorte, coeficiente, energiaPerdida, comision, mantenimiento } = datos
        actualizarPeriodo(periodo.id, { del, al, fechaLectura, fechaVencimiento, fechaCorte, coeficiente, energiaPerdida, comision, mantenimiento })
        onCerrar()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  function eliminar() {
    if (!confirm(`¿Eliminar el periodo ${nombrePeriodo(periodo)}? Se borran las lecturas anotadas.`)) return
    try {
      eliminarPeriodo(periodo.id)
      onCerrar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal titulo={esNuevo ? `Abrir ${nombrePeriodo(periodo)}` : nombrePeriodo(periodo)} subtitulo={esNuevo ? 'Revisa lo propuesto y confirma' : 'Fechas y cargos del periodo'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Consumo del" type="date" required {...campo('del')} />
          <Campo etiqueta="Al" type="date" required {...campo('al')} />
        </div>
        <Campo etiqueta="Fecha de lectura" type="date" required {...campo('fechaLectura')} />
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Vencimiento" type="date" required {...campo('fechaVencimiento')} />
          <Campo etiqueta="Corte" type="date" required {...campo('fechaCorte')} />
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Cargos</p>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Coeficiente (S/ por kWh)" type="number" step="0.01" min="0" required className="col-span-2" {...campo('coeficiente')} />
            <Campo etiqueta="Energía perdida (S/)" type="number" step="0.01" min="0" {...campo('energiaPerdida')} />
            <Campo etiqueta="Comisión comité (S/)" type="number" step="0.01" min="0" {...campo('comision')} />
            <Campo etiqueta="Mantenimiento, reparación, otros (S/)" type="number" step="0.01" min="0" className="col-span-2" {...campo('mantenimiento')} />
          </div>
          <p className="mt-2 text-[11px] text-ink-soft">
            Los tres montos fijos se suman a cada recibo.
            {tieneRecibos && ' Si los cambias, se recalculan los recibos que todavía no están pagados.'}
          </p>
        </div>

        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Boton type="submit" className="w-full">{esNuevo ? 'Abrir periodo y tomar lecturas' : 'Guardar cambios'}</Boton>
        {!esNuevo && !tieneRecibos && (
          <button type="button" onClick={eliminar} className="w-full text-xs text-danger underline decoration-dotted">
            Eliminar este periodo
          </button>
        )}
      </form>
    </Modal>
  )
}
