import { useEffect, useState } from 'react'
import { useEstado } from './data/store'
import { ZonaImpresion } from './ui/impresion'
import Bienvenida from './features/Bienvenida'
import Inicio from './features/Inicio'
import Lecturas from './features/Lecturas'
import Recibos from './features/Recibos'
import Usuarios from './features/Usuarios'
import Cortes from './features/Cortes'
import Caja from './features/Caja'
import Periodos from './features/Periodos'
import Ajustes from './features/Ajustes'
import Lector from './features/Lector'

// Las secciones siguen el orden del trabajo de cada mes: tomar
// lecturas -> emitir y cobrar recibos -> cortes -> caja.
const SECCIONES = [
  { id: 'inicio', nombre: 'Inicio', icono: '🏠', Componente: Inicio },
  { id: 'lecturas', nombre: 'Lecturas', icono: '📟', Componente: Lecturas },
  { id: 'recibos', nombre: 'Recibos', icono: '🧾', Componente: Recibos },
  { id: 'usuarios', nombre: 'Usuarios', icono: '👥', Componente: Usuarios },
  { id: 'cortes', nombre: 'Cortes', icono: '✂️', Componente: Cortes },
  { id: 'caja', nombre: 'Caja', icono: '💰', Componente: Caja },
  { id: 'periodos', nombre: 'Periodos', icono: '🗓️', Componente: Periodos },
  { id: 'ajustes', nombre: 'Ajustes', icono: '⚙️', Componente: Ajustes },
]
// En el celular entran cuatro abajo; el resto va en "Más".
const EN_BARRA = 4

// Panel aparte, a pantalla completa y sin el menú de tesorería, para
// quien sale a tomar lecturas (ver features/Lector.jsx).
const LECTOR = 'lector'

function seccionDeLaDireccion() {
  const id = window.location.hash.slice(1)
  return id === LECTOR || SECCIONES.some((s) => s.id === id) ? id : 'inicio'
}

export default function App() {
  const estado = useEstado()
  // La sección va en la dirección (#recibos): al refrescar se queda
  // donde estaba y el botón "atrás" del celular vuelve a la anterior.
  const [seccionId, setSeccionId] = useState(seccionDeLaDireccion)
  const [masAbierto, setMasAbierto] = useState(false)

  useEffect(() => {
    const alCambiar = () => setSeccionId(seccionDeLaDireccion())
    window.addEventListener('popstate', alCambiar)
    return () => window.removeEventListener('popstate', alCambiar)
  }, [])

  if (!estado) return <Bienvenida />

  function ir(id) {
    setMasAbierto(false)
    window.history.pushState(null, '', '#' + id)
    setSeccionId(id)
    window.scrollTo(0, 0)
  }

  if (seccionId === LECTOR) {
    return (
      <>
        <Lector onSalir={() => ir('inicio')} />
        <ZonaImpresion config={estado.config} />
      </>
    )
  }

  const seccion = SECCIONES.find((s) => s.id === seccionId)
  const Componente = seccion.Componente
  const enMas = SECCIONES.slice(EN_BARRA).some((s) => s.id === seccionId)

  return (
    <div className="min-h-svh lg:pl-60">
      {/* Menú lateral (pantallas grandes) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-brand-dark p-4 text-white lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-spark text-xl" aria-hidden="true">⚡</span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold leading-tight">Servicio Eléctrico</p>
            <p className="truncate text-[11px] text-white/60">{estado.config.nombre}</p>
          </div>
        </div>
        <nav className="space-y-1">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => ir(s.id)}
              aria-current={s.id === seccionId ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${s.id === seccionId ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'}`}
            >
              <span aria-hidden="true">{s.icono}</span>
              {s.nombre}
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => ir(LECTOR)} className="mt-auto flex items-center gap-3 rounded-xl bg-spark px-3 py-2.5 text-left text-sm font-extrabold text-brand-dark">
          <span aria-hidden="true">📲</span>
          Panel del lector
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:px-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-spark text-lg lg:hidden" aria-hidden="true">⚡</span>
        <h1 className="text-base font-extrabold text-ink">{seccion.nombre}</h1>
      </header>

      <main className="mx-auto max-w-3xl p-4 pb-28 lg:p-8">
        <Componente onIr={ir} />
      </main>

      {/* Barra de abajo (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {SECCIONES.slice(0, EN_BARRA).map((s) => (
          <BotonBarra key={s.id} icono={s.icono} nombre={s.nombre} activo={s.id === seccionId} onClick={() => ir(s.id)} />
        ))}
        <BotonBarra icono="☰" nombre="Más" activo={enMas || masAbierto} onClick={() => setMasAbierto((v) => !v)} />
      </nav>
      {masAbierto && (
        <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setMasAbierto(false)}>
          <div className="absolute inset-x-3 bottom-20 grid grid-cols-2 gap-2 rounded-2xl bg-surface p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {SECCIONES.slice(EN_BARRA).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => ir(s.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-bold ${s.id === seccionId ? 'bg-brand text-white' : 'bg-paper text-ink'}`}
              >
                <span aria-hidden="true">{s.icono}</span>
                {s.nombre}
              </button>
            ))}
            <button type="button" onClick={() => ir(LECTOR)} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-spark px-3 py-3 text-sm font-extrabold text-brand-dark">
              <span aria-hidden="true">📲</span>
              Panel del lector
            </button>
          </div>
        </div>
      )}

      <ZonaImpresion config={estado.config} />
    </div>
  )
}

function BotonBarra({ icono, nombre, activo, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-current={activo ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${activo ? 'text-brand' : 'text-ink-soft'}`}>
      <span className={`flex h-7 w-12 items-center justify-center rounded-full text-base ${activo ? 'bg-brand-soft' : ''}`} aria-hidden="true">{icono}</span>
      {nombre}
    </button>
  )
}
