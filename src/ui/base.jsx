import { useEffect } from 'react'

// Piezas chicas que usan todas las pantallas.

const VARIANTES = {
  primario: 'bg-brand text-white active:bg-brand-dark',
  secundario: 'border border-line bg-surface text-ink',
  suave: 'bg-brand-soft text-brand',
  peligro: 'border border-danger/30 bg-danger-soft text-danger',
  exito: 'bg-success text-white',
}

export function Boton({ variante = 'primario', className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-40 ${VARIANTES[variante]} ${className}`}
    />
  )
}

export function Tarjeta({ className = '', ...props }) {
  return <div {...props} className={`rounded-2xl border border-line bg-surface shadow-sm ${className}`} />
}

export function Titulo({ children, accion }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">{children}</h2>
      {accion}
    </div>
  )
}

export function Vacio({ children }) {
  return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">{children}</p>
}

export function Campo({ etiqueta, ayuda, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-ink-soft">{etiqueta}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus-visible:border-brand disabled:bg-paper disabled:text-ink-soft"
      />
      {ayuda && <span className="mt-1 block text-[11px] text-ink-soft">{ayuda}</span>}
    </label>
  )
}

export function Buscador({ value, onChange, placeholder }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus-visible:border-brand"
    />
  )
}

const ESTADOS = {
  pagado: { texto: 'Pagado', clase: 'bg-success-soft text-success', icono: '✓' },
  pendiente: { texto: 'Pendiente', clase: 'bg-brand-soft text-brand', icono: '○' },
  vencido: { texto: 'Vencido', clase: 'bg-warning-soft text-warning', icono: '!' },
  corte: { texto: 'En corte', clase: 'bg-danger-soft text-danger', icono: '✕' },
  cortado: { texto: 'Cortado', clase: 'bg-danger-soft text-danger', icono: '✕' },
  retirado: { texto: 'Retirado', clase: 'bg-ink-soft/10 text-ink-soft', icono: '–' },
}

// Estado siempre con icono + palabra, nunca solo el color.
export function Insignia({ estado }) {
  const e = ESTADOS[estado]
  if (!e) return null
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${e.clase}`}>
      <span aria-hidden="true">{e.icono}</span>
      {e.texto}
    </span>
  )
}

export function Modal({ titulo, subtitulo, onCerrar, children, ancho = 'max-w-md' }) {
  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', tecla)
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = anterior
    }
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92svh] w-full ${ancho} overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink">{titulo}</h2>
            {subtitulo && <p className="truncate text-xs text-ink-soft">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="px-1 text-2xl leading-none text-ink-soft">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function SelectorPeriodo({ periodos, value, onChange, nombre }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Periodo"
      className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-bold text-ink outline-none focus-visible:border-brand"
    >
      {[...periodos].reverse().map((p) => (
        <option key={p.id} value={p.id}>
          {nombre(p)}
        </option>
      ))}
    </select>
  )
}
