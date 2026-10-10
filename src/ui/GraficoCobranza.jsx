import { useState } from 'react'
import { formatearMonto } from '../domain/dinero'
import { nombrePeriodo, nombrePeriodoCorto } from '../domain/fecha'

// Facturado vs. cobrado de los últimos periodos, en barras agrupadas
// (dos medidas en soles, un solo eje). Colores validados para
// daltonismo; la leyenda y el detalle al pasar el dedo/mouse hacen que
// la lectura nunca dependa solo del color. La misma información está
// en tabla en la pantalla Periodos.
const ANCHO = 600
const ALTO = 210
const IZQ = 46
const ABAJO = 26
const ARRIBA = 10
const BARRA = 18

function techo(valor) {
  if (valor <= 0) return 100
  const potencia = 10 ** Math.floor(Math.log10(valor))
  return [1, 1.5, 2, 3, 4, 5, 8, 10].map((m) => m * potencia).find((v) => v >= valor)
}

// Barra con las dos esquinas de arriba redondeadas y la base recta.
function barra(x, y, alto) {
  const r = Math.min(4, alto, BARRA / 2)
  return `M${x},${y + alto} V${y + r} Q${x},${y} ${x + r},${y} H${x + BARRA - r} Q${x + BARRA},${y} ${x + BARRA},${y + r} V${y + alto} Z`
}

export function GraficoCobranza({ datos }) {
  const [activo, setActivo] = useState(null)
  const maximo = techo(Math.max(...datos.map((d) => d.facturado), 1))
  const altoUtil = ALTO - ABAJO - ARRIBA
  const banda = (ANCHO - IZQ) / datos.length
  const y = (valor) => ARRIBA + altoUtil * (1 - valor / maximo)
  const marcas = [0, 0.5, 1].map((f) => f * maximo)
  const sel = activo != null ? datos[activo] : null

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-serie-1" />Facturado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-serie-2" />Cobrado</span>
      </div>
      <div className="relative" onMouseLeave={() => setActivo(null)}>
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="block w-full" role="img" aria-label="Facturado y cobrado por periodo">
          {marcas.map((m) => (
            <g key={m}>
              <line x1={IZQ} x2={ANCHO} y1={y(m)} y2={y(m)} className="stroke-line" strokeWidth="1" />
              <text x={IZQ - 6} y={y(m) + 4} textAnchor="end" className="money fill-ink-soft text-[11px]">
                {Math.round(m).toLocaleString('es-PE')}
              </text>
            </g>
          ))}
          {datos.map((d, i) => {
            const centro = IZQ + banda * i + banda / 2
            return (
              <g key={d.periodo.id}>
                {activo === i && <rect x={IZQ + banda * i + 2} y={ARRIBA} width={banda - 4} height={altoUtil} rx="6" className="fill-brand-soft" />}
                <path d={barra(centro - BARRA - 1, y(d.facturado), y(0) - y(d.facturado))} className="fill-serie-1" />
                <path d={barra(centro + 1, y(d.cobrado), y(0) - y(d.cobrado))} className="fill-serie-2" />
                <text x={centro} y={ALTO - 8} textAnchor="middle" className="fill-ink-soft text-[11px]">
                  {nombrePeriodoCorto(d.periodo)}
                </text>
                {/* Zona de toque: toda la columna, no solo las barras finas. */}
                <rect
                  x={IZQ + banda * i}
                  y={0}
                  width={banda}
                  height={ALTO}
                  fill="transparent"
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => setActivo(activo === i ? null : i)}
                />
              </g>
            )
          })}
        </svg>
        {sel && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-xl border border-line bg-surface p-2.5 text-xs shadow-lg"
            style={{ left: `${Math.min(82, Math.max(18, ((IZQ + banda * activo + banda / 2) / ANCHO) * 100))}%` }}
          >
            <p className="mb-1 font-bold text-ink">{nombrePeriodo(sel.periodo)}</p>
            <p className="flex justify-between gap-2 text-ink-soft"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-serie-1" />Facturado</span><span className="money font-bold text-ink">{formatearMonto(sel.facturado)}</span></p>
            <p className="flex justify-between gap-2 text-ink-soft"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-serie-2" />Cobrado</span><span className="money font-bold text-ink">{formatearMonto(sel.cobrado)}</span></p>
            <p className="mt-1 border-t border-line pt-1 text-ink-soft">
              Cobranza: <span className="font-bold text-ink">{sel.facturado ? Math.round((sel.cobrado / sel.facturado) * 100) : 0}%</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
