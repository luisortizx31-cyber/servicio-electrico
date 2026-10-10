import { useDatos } from '../data/useDatos'
import { pendientesDeEmitir, sugerirPeriodo } from '../data/store'
import { resumenPeriodo, compararUbicacion } from '../domain/calculo'
import { formatearMonto, formatearNumero } from '../domain/dinero'
import { diasEntre, formatearFecha, nombrePeriodo, MESES } from '../domain/fecha'
import { Tarjeta, Titulo, Insignia } from '../ui/base'
import { GraficoCobranza } from '../ui/GraficoCobranza'

// Lo primero que ve tesorería: cómo va la cobranza del mes y, sobre
// todo, QUÉ TOCA HACER AHORA - el sistema mira en qué punto del ciclo
// mensual está (lecturas -> emitir -> cobrar -> cortes -> abrir el mes
// siguiente) y propone el paso que sigue.
export default function Inicio({ onIr }) {
  const { estado, hoy, config, usuarios, usuariosPorId, periodos, periodoActual, recibos, deuda } = useDatos()
  const activos = usuarios.filter((u) => u.estado !== 'retirado')
  const delPeriodo = periodoActual ? recibos.filter((r) => r.periodoId === periodoActual.id) : []
  const resumen = resumenPeriodo(delPeriodo)
  const porcentaje = resumen.facturado ? Math.round((resumen.cobrado / resumen.facturado) * 100) : 0
  const deudaTotal = [...deuda.values()].reduce((s, d) => s + d.total, 0)
  const paraCorte = [...deuda.entries()].filter(([id, d]) => d.enCorte && usuariosPorId.get(id)?.estado === 'activo')

  const pasos = []
  if (activos.length === 0) {
    pasos.push({ icono: '👥', titulo: 'Registra a los usuarios', texto: 'Carga el padrón: nombre, manzana, lote y código de medidor.', boton: 'Ir a Usuarios', ir: 'usuarios' })
  } else if (!periodoActual) {
    pasos.push({ icono: '🗓️', titulo: 'Abre el primer periodo', texto: 'El sistema ya te propone las fechas y los cargos del mes.', boton: 'Ir a Periodos', ir: 'periodos' })
  } else {
    const sinLectura = activos.filter((u) => periodoActual.lecturas?.[u.id] == null).length
    const porEmitir = pendientesDeEmitir(estado, periodoActual.id).length
    const siguiente = sugerirPeriodo(estado)
    if (sinLectura > 0) {
      pasos.push({ icono: '📟', titulo: `Faltan ${sinLectura} lecturas de ${MESES[periodoActual.mes - 1]}`, texto: 'Anota la lectura actual de cada medidor; el consumo y el importe se calculan solos.', boton: 'Tomar lecturas', ir: 'lecturas' })
    }
    if (porEmitir > 0) {
      pasos.push({ icono: '🧾', titulo: `${porEmitir} recibos listos para emitir`, texto: 'Ya tienen lectura. Al emitirlos se numeran y quedan listos para cobrar, imprimir o enviar.', boton: 'Emitir recibos', ir: 'lecturas' })
    }
    if (paraCorte.length > 0) {
      pasos.push({ icono: '✂️', titulo: paraCorte.length === 1 ? '1 usuario pasó la fecha de corte' : `${paraCorte.length} usuarios pasaron la fecha de corte`, texto: 'Con recibos impagos después de la fecha de corte.', boton: 'Ver cortes', ir: 'cortes' })
    }
    if (sinLectura === 0 && porEmitir === 0 && diasEntre(hoy, siguiente.fechaLectura) <= 5) {
      pasos.push({ icono: '🗓️', titulo: `Toca abrir ${MESES[siguiente.mes - 1]}`, texto: `La lectura de ese mes es el ${formatearFecha(siguiente.fechaLectura)}.`, boton: 'Abrir periodo', ir: 'periodos' })
    }
  }

  const grafico = periodos.slice(-6).map((p) => ({ periodo: p, ...resumenPeriodo(recibos.filter((r) => r.periodoId === p.id)) }))
  const deudores = [...deuda.entries()]
    .map(([id, d]) => ({ usuario: usuariosPorId.get(id), ...d }))
    .filter((d) => d.usuario)
    .sort((a, b) => b.total - a.total || compararUbicacion(a.usuario, b.usuario))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-[#0e1d47] p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-spark/15" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-white/5" />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-spark">⚡ Servicio eléctrico</p>
        <h1 className="relative mt-1 text-2xl font-extrabold leading-tight">{config.nombre}</h1>
        <p className="relative text-sm text-white/70">{config.ubicacion}</p>

        {periodoActual && (
          <div className="relative mt-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-white/70">Cobrado de {nombrePeriodo(periodoActual)}</p>
                <p className="money text-3xl font-extrabold">{formatearMonto(resumen.cobrado)}</p>
              </div>
              <p className="text-right text-xs text-white/70">
                de <span className="money font-bold text-white">{formatearMonto(resumen.facturado)}</span>
                <br />
                {resumen.pagados} de {resumen.cantidad} recibos
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`Cobranza ${porcentaje}%`}>
              <div className="h-full rounded-full bg-spark" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/70">
              {porcentaje}% cobrado · vence el {formatearFecha(periodoActual.fechaVencimiento)} · corte el {formatearFecha(periodoActual.fechaCorte)}
            </p>
          </div>
        )}
      </div>

      {pasos.length > 0 && (
        <div>
          <Titulo>Qué toca hacer ahora</Titulo>
          <div className="space-y-2">
            {pasos.map((p) => (
              <Tarjeta key={p.titulo} className="flex items-center gap-3 border-l-4 border-l-spark p-4">
                <span className="text-2xl" aria-hidden="true">{p.icono}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{p.titulo}</p>
                  <p className="text-xs text-ink-soft">{p.texto}</p>
                </div>
                <button type="button" onClick={() => onIr(p.ir)} className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white">
                  {p.boton}
                </button>
              </Tarjeta>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Por cobrar (todo)" valor={formatearMonto(deudaTotal)} nota={`${deuda.size} usuarios deben`} onClick={() => onIr('recibos')} />
        <Dato etiqueta="Consumo del periodo" valor={`${formatearNumero(resumen.consumo)} kWh`} nota={periodoActual ? `a S/ ${formatearNumero(periodoActual.coeficiente, 2)} el kWh` : '—'} />
        <Dato etiqueta="Usuarios activos" valor={activos.filter((u) => u.estado === 'activo').length} nota={`${activos.filter((u) => u.estado === 'cortado').length} con servicio cortado`} onClick={() => onIr('usuarios')} />
        <Dato etiqueta="Para corte" valor={paraCorte.length} nota="pasaron la fecha de corte" onClick={() => onIr('cortes')} />
      </div>

      {grafico.length > 0 && (
        <Tarjeta className="p-4">
          <Titulo>Facturado y cobrado por periodo (S/)</Titulo>
          <GraficoCobranza datos={grafico} />
        </Tarjeta>
      )}

      {deudores.length > 0 && (
        <div>
          <Titulo accion={<button type="button" onClick={() => onIr('recibos')} className="text-xs font-semibold text-brand underline decoration-dotted">Ver todos</button>}>
            Los que más deben
          </Titulo>
          <Tarjeta className="divide-y divide-line">
            {deudores.map((d) => (
              <div key={d.usuario.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{d.usuario.nombre}</p>
                  <p className="text-xs text-ink-soft">
                    Mz {d.usuario.mz} Lt {d.usuario.lote} · {d.recibos.length} {d.recibos.length === 1 ? 'recibo' : 'recibos'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {d.enCorte && <Insignia estado="corte" />}
                  <span className="money text-sm font-extrabold text-ink">{formatearMonto(d.total)}</span>
                </div>
              </div>
            ))}
          </Tarjeta>
        </div>
      )}
    </div>
  )
}

function Dato({ etiqueta, valor, nota, onClick }) {
  const Etiqueta = onClick ? 'button' : 'div'
  return (
    <Etiqueta type={onClick ? 'button' : undefined} onClick={onClick} className="rounded-2xl border border-line bg-surface p-4 text-left shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{etiqueta}</p>
      <p className="money mt-1 text-xl font-extrabold text-ink">{valor}</p>
      <p className="mt-0.5 text-[11px] text-ink-soft">{nota}</p>
    </Etiqueta>
  )
}
