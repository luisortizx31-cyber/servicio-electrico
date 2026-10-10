import { useDatos } from '../data/useDatos'
import { cambiarEstadoUsuario } from '../data/store'
import { compararUbicacion } from '../domain/calculo'
import { formatearMonto } from '../domain/dinero'
import { nombrePeriodoCorto } from '../domain/fecha'
import { linkWhatsapp, mensajeDeuda } from '../domain/whatsapp'
import { Boton, Tarjeta, Titulo, Vacio } from '../ui/base'

// Lista de corte: sale sola de los recibos impagos que ya pasaron la
// fecha de corte. El sistema solo lleva el registro - cortar y
// reconectar el servicio lo decide y lo hace el comité.
export default function Cortes() {
  const { config, usuarios, deuda } = useDatos()
  const ordenados = [...usuarios].sort(compararUbicacion)
  const paraCortar = ordenados.filter((u) => u.estado === 'activo' && deuda.get(u.id)?.enCorte)
  const cortados = ordenados.filter((u) => u.estado === 'cortado')

  function reconectar(u) {
    const d = deuda.get(u.id)
    if (d && !confirm(`${u.nombre} todavía debe ${formatearMonto(d.total)}. ¿Reconectar igual?`)) return
    cambiarEstadoUsuario(u.id, 'activo')
  }

  return (
    <div className="space-y-6">
      <div>
        <Titulo>Para cortar ({paraCortar.length})</Titulo>
        {paraCortar.length === 0 ? (
          <Vacio>Nadie con recibos impagos pasó la fecha de corte.</Vacio>
        ) : (
          <div className="space-y-2">
            {paraCortar.map((u) => (
              <Fila key={u.id} usuario={u} deuda={deuda.get(u.id)} config={config}>
                <Boton variante="peligro" onClick={() => confirm(`¿Registrar el corte del servicio de ${u.nombre}?`) && cambiarEstadoUsuario(u.id, 'cortado')}>
                  ✂️ Registrar corte
                </Boton>
              </Fila>
            ))}
          </div>
        )}
      </div>

      <div>
        <Titulo>Con servicio cortado ({cortados.length})</Titulo>
        {cortados.length === 0 ? (
          <Vacio>Ningún usuario tiene el servicio cortado.</Vacio>
        ) : (
          <div className="space-y-2">
            {cortados.map((u) => (
              <Fila key={u.id} usuario={u} deuda={deuda.get(u.id)} config={config}>
                <Boton variante={deuda.get(u.id) ? 'secundario' : 'exito'} onClick={() => reconectar(u)}>
                  🔌 Reconectar
                </Boton>
              </Fila>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Fila({ usuario, deuda, config, children }) {
  const whatsapp = deuda && linkWhatsapp(usuario.telefono, mensajeDeuda({ usuario, deuda, config }))
  return (
    <Tarjeta className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{usuario.nombre}</p>
          <p className="text-xs text-ink-soft">
            Mz {usuario.mz} Lt {usuario.lote} · Medidor <span className="money">{usuario.medidor}</span>
          </p>
          {deuda && (
            <p className="mt-1 text-xs text-ink-soft">
              Debe: {deuda.recibos.map((r) => nombrePeriodoCorto(r.periodo)).join(', ')}
            </p>
          )}
        </div>
        <p className={`money shrink-0 text-lg font-extrabold ${deuda ? 'text-danger' : 'text-success'}`}>{deuda ? formatearMonto(deuda.total) : 'Al día'}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {children}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-success/40 bg-success-soft px-4 py-2.5 text-sm font-bold text-success">
            Avisar por WhatsApp
          </a>
        )}
      </div>
    </Tarjeta>
  )
}
