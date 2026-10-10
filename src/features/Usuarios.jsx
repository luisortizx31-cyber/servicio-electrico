import { useState } from 'react'
import { useDatos } from '../data/useDatos'
import { guardarUsuario, eliminarUsuario, cambiarEstadoUsuario } from '../data/store'
import { compararUbicacion } from '../domain/calculo'
import { formatearMonto, formatearNumero, formatearNumeroRecibo } from '../domain/dinero'
import { nombrePeriodo } from '../domain/fecha'
import { linkWhatsapp, mensajeDeuda } from '../domain/whatsapp'
import { Boton, Buscador, Campo, Insignia, Modal, Tarjeta, Titulo, Vacio } from '../ui/base'

// Padrón de usuarios del servicio: uno por medidor.
export default function Usuarios() {
  const { config, usuarios, recibos, deuda } = useDatos()
  const [busqueda, setBusqueda] = useState('')
  const [verRetirados, setVerRetirados] = useState(false)
  const [formulario, setFormulario] = useState(null) // null | {} (nuevo) | usuario (editar)
  const [fichaId, setFichaId] = useState(null)

  const texto = busqueda.trim().toLowerCase()
  const retirados = usuarios.filter((u) => u.estado === 'retirado').length
  const visibles = usuarios
    .filter((u) => verRetirados || u.estado !== 'retirado')
    .filter(
      (u) =>
        !texto ||
        u.nombre.toLowerCase().includes(texto) ||
        u.medidor.includes(texto) ||
        `${u.mz}${u.lote}`.toLowerCase().includes(texto.replace(/\s|-/g, ''))
    )
    .sort(compararUbicacion)
  const ficha = fichaId ? usuarios.find((u) => u.id === fichaId) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, medidor o Mz/Lote…" />
        <Boton className="shrink-0" onClick={() => setFormulario({})}>
          + Usuario
        </Boton>
      </div>

      {visibles.length === 0 ? (
        <Vacio>{texto ? 'Ningún usuario coincide.' : 'Todavía no hay usuarios. Agrega el primero con "+ Usuario".'}</Vacio>
      ) : (
        <Tarjeta className="divide-y divide-line overflow-hidden">
          {visibles.map((u) => {
            const d = deuda.get(u.id)
            return (
              <button key={u.id} type="button" onClick={() => setFichaId(u.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-brand-soft">
                <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
                  <span className="money text-sm font-extrabold text-brand">{u.mz}-{u.lote}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{u.nombre}</p>
                  <p className="text-xs text-ink-soft">
                    Medidor <span className="money">{u.medidor}</span>
                  </p>
                </div>
                {u.estado !== 'activo' && <Insignia estado={u.estado} />}
                {d ? (
                  <span className="money shrink-0 text-right text-sm font-extrabold text-danger">{formatearMonto(d.total)}</span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-success">Al día</span>
                )}
              </button>
            )
          })}
        </Tarjeta>
      )}

      {retirados > 0 && (
        <button type="button" onClick={() => setVerRetirados((v) => !v)} className="text-xs font-semibold text-ink-soft underline decoration-dotted">
          {verRetirados ? 'Ocultar' : 'Ver'} {retirados} {retirados === 1 ? 'retirado' : 'retirados'}
        </button>
      )}

      {ficha && (
        <FichaUsuario
          usuario={ficha}
          recibos={recibos.filter((r) => r.usuarioId === ficha.id).sort((a, b) => b.periodoId.localeCompare(a.periodoId))}
          deuda={deuda.get(ficha.id)}
          config={config}
          onEditar={() => {
            setFormulario(ficha)
            setFichaId(null)
          }}
          onCerrar={() => setFichaId(null)}
        />
      )}
      {formulario && <FormularioUsuario usuario={formulario} onCerrar={() => setFormulario(null)} />}
    </div>
  )
}

function FichaUsuario({ usuario, recibos, deuda, config, onEditar, onCerrar }) {
  const whatsapp = deuda && linkWhatsapp(usuario.telefono, mensajeDeuda({ usuario, deuda, config }))

  function retirar() {
    const conHistorial = recibos.length > 0
    const pregunta = conHistorial
      ? `¿Retirar a ${usuario.nombre}? Deja de aparecer en la toma de lecturas, pero su historial se conserva.`
      : `¿Eliminar a ${usuario.nombre}? No tiene recibos, se borra del todo.`
    if (!confirm(pregunta)) return
    eliminarUsuario(usuario.id)
    onCerrar()
  }

  return (
    <Modal titulo={usuario.nombre} subtitulo={`Mz ${usuario.mz} Lt ${usuario.lote} · Medidor ${usuario.medidor}`} onCerrar={onCerrar}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Debe</p>
          <p className={`money text-lg font-extrabold ${deuda ? 'text-danger' : 'text-success'}`}>{deuda ? formatearMonto(deuda.total) : 'Al día'}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Celular</p>
          <p className="money text-lg font-extrabold text-ink">{usuario.telefono || '—'}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton variante="secundario" className="flex-1" onClick={onEditar}>Editar datos</Boton>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl border border-success/40 bg-success-soft px-4 py-2.5 text-center text-sm font-bold text-success">
            Avisar deuda
          </a>
        )}
        {usuario.estado === 'retirado' ? (
          <Boton variante="suave" className="flex-1" onClick={() => cambiarEstadoUsuario(usuario.id, 'activo')}>Reincorporar</Boton>
        ) : (
          <Boton variante="peligro" className="flex-1" onClick={retirar}>{recibos.length > 0 ? 'Retirar' : 'Eliminar'}</Boton>
        )}
      </div>

      <div className="mt-5">
        <Titulo>Historial</Titulo>
        {recibos.length === 0 ? (
          <Vacio>Todavía no tiene recibos.</Vacio>
        ) : (
          <Tarjeta className="divide-y divide-line">
            {recibos.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{nombrePeriodo(r.periodo)}</p>
                  <p className="text-xs text-ink-soft">
                    <span className="money">N° {formatearNumeroRecibo(r.numero)}</span> · <span className="money">{formatearNumero(r.consumo)} kWh</span>
                  </p>
                </div>
                <Insignia estado={r.estado} />
                <span className="money w-20 shrink-0 text-right text-sm font-bold text-ink">{formatearMonto(r.total)}</span>
              </div>
            ))}
          </Tarjeta>
        )}
      </div>
    </Modal>
  )
}

function FormularioUsuario({ usuario, onCerrar }) {
  const esNuevo = !usuario.id
  const [datos, setDatos] = useState({
    nombre: usuario.nombre ?? '',
    mz: usuario.mz ?? '',
    lote: usuario.lote ?? '',
    medidor: usuario.medidor ?? '',
    telefono: usuario.telefono ?? '',
    lecturaInicial: usuario.lecturaInicial ?? '',
  })
  const [error, setError] = useState(null)
  const campo = (nombre) => ({ value: datos[nombre], onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })) })

  function guardar(e) {
    e.preventDefault()
    try {
      guardarUsuario({ ...datos, id: usuario.id })
      onCerrar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal titulo={esNuevo ? 'Nuevo usuario' : 'Editar usuario'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <Campo etiqueta="Nombre completo" required autoFocus {...campo('nombre')} />
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Manzana" required placeholder="B" {...campo('mz')} />
          <Campo etiqueta="Lote" required placeholder="33" {...campo('lote')} />
        </div>
        <Campo etiqueta="Código de medidor" required inputMode="numeric" placeholder="61532962" {...campo('medidor')} />
        <Campo etiqueta="Celular (para WhatsApp)" inputMode="tel" placeholder="9XXXXXXXX" {...campo('telefono')} />
        <Campo
          etiqueta="Lectura inicial del medidor"
          inputMode="decimal"
          placeholder="0"
          ayuda="Lo que marca el medidor al registrarlo. Es la 'lectura anterior' de su primer recibo."
          {...campo('lecturaInicial')}
        />
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Boton type="submit" className="w-full">Guardar</Boton>
      </form>
    </Modal>
  )
}
