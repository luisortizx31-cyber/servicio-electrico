import { useState } from 'react'
import { marcarWhatsapp } from '../data/store'
import { linkWhatsapp } from '../domain/whatsapp'
import { reciboComoImagen } from './reciboImagen'

// Otra forma de mandar el recibo amarillo, para llegar DIRECTO al chat
// del vecino (pedido del usuario, 2026-10-11): copia la imagen del
// recibo al portapapeles y abre su chat de WhatsApp; ahí solo falta
// mantener apretado donde se escribe y tocar "Pegar". Es un rodeo:
// WhatsApp no deja abrir un chat con una foto ya adjunta. Depende de
// que el celular permita copiar imágenes, por eso avisa si no pudo.
export function BotonReciboPegar({ recibo, usuario, periodo, config }) {
  const [estado, setEstado] = useState(null) // null | 'copiando' | 'copiado' | 'error'
  const chat = linkWhatsapp(usuario.telefono, '')
  if (!chat) return null

  async function copiarYAbrir() {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setEstado('error')
      return
    }
    setEstado('copiando')
    try {
      // Se le pasa la promesa (no la imagen ya lista): así el navegador
      // sigue contando el toque del botón como permiso para copiar.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': reciboComoImagen({ recibo, usuario, periodo, config }) })])
      setEstado('copiado')
      marcarWhatsapp(recibo.id)
      // Si el navegador no deja abrirlo solo, queda el enlace de abajo.
      window.open(chat, '_blank', 'noopener')
    } catch (err) {
      console.error('[BotonReciboPegar]', err)
      setEstado('error')
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={copiarYAbrir}
        disabled={estado === 'copiando'}
        className="block w-full rounded-xl border border-success/40 bg-surface px-4 py-3 text-center text-sm font-bold text-success transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {estado === 'copiando' ? 'Copiando…' : '📋 Copiar el recibo amarillo y abrir su chat'}
        <span className="money block text-xs font-semibold opacity-80">directo al {usuario.telefono} · ahí tocas "Pegar"</span>
      </button>
      {estado === 'copiado' && (
        <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success">
          ✓ Recibo copiado. En el chat, mantén apretado donde se escribe, toca <b>Pegar</b> y envía.{' '}
          <a href={chat} target="_blank" rel="noopener noreferrer" className="font-bold underline">
            Si no se abrió el chat, toca aquí
          </a>
          .
        </p>
      )}
      {estado === 'error' && (
        <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
          Este celular no dejó copiar la imagen. Usa "Enviar el recibo amarillo" de arriba.
        </p>
      )}
    </div>
  )
}
