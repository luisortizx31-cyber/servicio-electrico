import { useRef, useState } from 'react'
import { empezarVacio, empezarConEjemplo, importarCopia } from '../data/store'
import { Boton } from '../ui/base'

// Primera vez que se abre en este equipo.
export default function Bienvenida() {
  const archivoRef = useRef(null)
  const [error, setError] = useState(null)

  async function restaurar(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    try {
      importarCopia(await archivo.text())
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Ese archivo no se puede leer.' : err.message)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-brand-dark via-brand to-[#0e1d47] p-4">
      <div className="w-full max-w-md rounded-3xl bg-surface p-7 shadow-2xl">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-spark text-3xl" aria-hidden="true">⚡</div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber">Servicio eléctrico</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-ink">El cobro de la luz, sin sacar cuentas a mano</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Anotas la lectura de cada medidor y el sistema calcula el consumo, arma los recibos numerados, lleva quién pagó, quién debe y a quién le toca corte.
        </p>

        <div className="mt-6 space-y-2">
          <Boton className="w-full py-3" onClick={empezarConEjemplo}>Ver con datos de ejemplo</Boton>
          <Boton variante="secundario" className="w-full py-3" onClick={empezarVacio}>Empezar vacío, con mis datos</Boton>
        </div>
        <p className="mt-3 text-center text-xs text-ink-soft">
          El ejemplo trae vecinos inventados y 6 meses de historia. Se puede borrar después desde Ajustes.
        </p>

        <button type="button" onClick={() => archivoRef.current?.click()} className="mt-5 w-full text-center text-xs font-semibold text-brand underline decoration-dotted">
          Ya tengo una copia de seguridad: restaurarla
        </button>
        <input ref={archivoRef} type="file" accept="application/json,.json" className="hidden" onChange={restaurar} />
        {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}
