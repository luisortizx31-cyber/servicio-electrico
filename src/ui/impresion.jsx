import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ReciboPapel } from './ReciboPapel'
import { fijarCola, leerCola, suscribirCola } from './colaImpresion'

// Dibuja los recibos de la cola en una zona que solo se ve en papel
// (ver index.css) y abre el diálogo de impresión del navegador, que
// también sirve para "Guardar como PDF".
export function ZonaImpresion({ config }) {
  const items = useSyncExternalStore(suscribirCola, leerCola)

  useEffect(() => {
    if (items.length === 0) return
    const limpiar = () => fijarCola([])
    window.addEventListener('afterprint', limpiar)
    // Un respiro para que el navegador termine de dibujar los recibos.
    const id = setTimeout(() => window.print(), 150)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', limpiar)
    }
  }, [items])

  if (items.length === 0) return null
  return createPortal(
    <div className="zona-impresion">
      {items.map(({ recibo, usuario, periodo }) => (
        <ReciboPapel key={recibo.id} recibo={recibo} usuario={usuario} periodo={periodo} config={config} />
      ))}
    </div>,
    document.body
  )
}
