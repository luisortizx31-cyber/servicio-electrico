import { useRef, useState } from 'react'
import { useDatos } from '../data/useDatos'
import { guardarConfig, exportarCopia, importarCopia, borrarTodo } from '../data/store'
import { formatearNumeroRecibo } from '../domain/dinero'
import { Boton, Campo, Tarjeta, Titulo } from '../ui/base'

export default function Ajustes() {
  const { hoy, config, usuarios, recibos } = useDatos()
  const [datos, setDatos] = useState({ ...config })
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const archivoRef = useRef(null)
  const campo = (nombre) => ({
    value: datos[nombre],
    onChange: (e) => {
      setDatos((d) => ({ ...d, [nombre]: e.target.value }))
      setAviso(null)
    },
  })

  function guardar(e) {
    e.preventDefault()
    const numero = (nombre, minimo = 0) => Math.max(minimo, Number(datos[nombre]) || 0)
    guardarConfig({
      nombre: datos.nombre.trim(),
      ubicacion: datos.ubicacion.trim(),
      coeficiente: numero('coeficiente'),
      energiaPerdida: numero('energiaPerdida'),
      comision: numero('comision'),
      mantenimiento: numero('mantenimiento'),
      redondeo: Number(datos.redondeo) || 0.1,
      diaLectura: Math.min(31, numero('diaLectura', 1)),
      diaVencimiento: Math.min(31, numero('diaVencimiento', 1)),
      diaCorte: Math.min(31, numero('diaCorte', 1)),
      siguienteNumero: Math.round(numero('siguienteNumero', 1)),
    })
    setAviso('Guardado.')
  }

  function descargarCopia() {
    const url = URL.createObjectURL(new Blob([exportarCopia()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `servicio-electrico-copia-${hoy}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function restaurar(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError(null)
    if (!confirm('Restaurar una copia REEMPLAZA todo lo que hay ahora en este equipo. ¿Continuar?')) return
    try {
      importarCopia(await archivo.text())
      setAviso('Copia restaurada.')
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Ese archivo no se puede leer.' : err.message)
    }
  }

  function borrar() {
    if (!confirm('¿Borrar TODO (usuarios, periodos, recibos y pagos) de este equipo? No se puede deshacer.')) return
    if (!confirm('¿Seguro? Si no bajaste una copia de seguridad, se pierde todo.')) return
    borrarTodo()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={guardar} className="space-y-6">
        <div>
          <Titulo>Datos del comité</Titulo>
          <Tarjeta className="space-y-3 p-4">
            <Campo etiqueta="Nombre (encabezado del recibo)" required {...campo('nombre')} />
            <Campo etiqueta="Ubicación" {...campo('ubicacion')} />
          </Tarjeta>
        </div>

        <div>
          <Titulo>Cargos por defecto</Titulo>
          <Tarjeta className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Coeficiente (S/ por kWh)" type="number" step="0.01" min="0" {...campo('coeficiente')} />
              <Campo etiqueta="Energía perdida (S/)" type="number" step="0.01" min="0" {...campo('energiaPerdida')} />
              <Campo etiqueta="Comisión comité (S/)" type="number" step="0.01" min="0" {...campo('comision')} />
              <Campo etiqueta="Mantenimiento y otros (S/)" type="number" step="0.01" min="0" {...campo('mantenimiento')} />
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">Redondeo del costo del consumo</span>
              <select {...campo('redondeo')} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus-visible:border-brand">
                <option value="0.1">A 10 céntimos (como en el talonario)</option>
                <option value="0.01">Sin redondear (al céntimo)</option>
              </select>
            </label>
            <p className="mt-2 text-[11px] text-ink-soft">Con esto se propone cada periodo nuevo; ahí mismo se puede cambiar para ese mes.</p>
          </Tarjeta>
        </div>

        <div>
          <Titulo>Calendario y numeración</Titulo>
          <Tarjeta className="p-4">
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Día de lectura" type="number" min="1" max="31" {...campo('diaLectura')} />
              <Campo etiqueta="Día que vence" type="number" min="1" max="31" {...campo('diaVencimiento')} />
              <Campo etiqueta="Día de corte" type="number" min="1" max="31" {...campo('diaCorte')} />
            </div>
            <p className="mt-2 text-[11px] text-ink-soft">El vencimiento y el corte caen en el mes siguiente al de la lectura.</p>
            <Campo
              className="mt-3"
              etiqueta="N° del próximo recibo"
              type="number"
              min="1"
              ayuda={`El próximo recibo que se emita será el N° ${formatearNumeroRecibo(Number(datos.siguienteNumero) || 1)}. Ponlo para continuar la numeración del talonario.`}
              {...campo('siguienteNumero')}
            />
          </Tarjeta>
        </div>

        <div className="flex items-center gap-3">
          <Boton type="submit">Guardar ajustes</Boton>
          {aviso && <p className="text-sm font-medium text-success">✓ {aviso}</p>}
        </div>
      </form>

      <div>
        <Titulo>Copia de seguridad</Titulo>
        <Tarjeta className="p-4">
          <p className="text-sm text-ink-soft">
            Todo se guarda en este equipo y en este navegador ({usuarios.length} usuarios, {recibos.length} recibos). Baja una copia cada cierto tiempo y guárdala en otro lado (tu correo, WhatsApp, un USB): si el equipo se malogra o se borran los datos del navegador, con la copia lo recuperas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton onClick={descargarCopia}>⬇ Bajar copia</Boton>
            <Boton variante="secundario" onClick={() => archivoRef.current?.click()}>⬆ Restaurar una copia</Boton>
            <input ref={archivoRef} type="file" accept="application/json,.json" className="hidden" onChange={restaurar} />
          </div>
          {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        </Tarjeta>
      </div>

      <div>
        <Titulo>Zona de cuidado</Titulo>
        <Tarjeta className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink-soft">Borra todo y vuelve a la pantalla de bienvenida (por ejemplo, para quitar los datos de ejemplo y cargar los reales).</p>
          <Boton variante="peligro" className="shrink-0" onClick={borrar}>Borrar todo</Boton>
        </Tarjeta>
      </div>
    </div>
  )
}
