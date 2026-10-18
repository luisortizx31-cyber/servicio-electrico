import { useState } from 'react'
import { marcarWhatsapp } from '../data/store'
import { compartirRecibo } from './reciboImagen'
import { formatearFecha } from '../domain/fecha'

// Manda el recibo amarillo como imagen. WhatsApp no deja abrir un chat
// con una foto ya adjunta (su enlace directo solo acepta texto), así
// que se usa el "Compartir" del celular: ahí se elige WhatsApp y al
// vecino. Queda anotado como enviado apenas se abre el Compartir (ver
// por qué en compartirRecibo); si al final no se mandó, se desmarca
// con el enlace "No llegó a enviarse" de la ficha.
export function BotonReciboImagen({ recibo, usuario, periodo, config, className = '' }) {
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)

  async function enviar() {
    setOcupado(true)
    setAviso(null)
    try {
      const resultado = await compartirRecibo({ recibo, usuario, periodo, config }, () => marcarWhatsapp(recibo.id))
      if (resultado === 'descargado') setAviso('Este equipo no puede compartir directo: se descargó la imagen del recibo para adjuntarla a mano.')
    } catch (err) {
      console.error('[BotonReciboImagen]', err)
      setAviso('No se pudo compartir la imagen. Prueba de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  // Ya pagado: se manda el recibo con el sello PAGADO. Si todavía no se
  // le mandó, el botón resalta para que no se olvide.
  const pagado = Boolean(recibo.pago)
  const faltaEnviarPagado = pagado && !recibo.whatsappPagado
  const etiqueta = pagado
    ? recibo.whatsappPagado
      ? '↻ Reenviar el recibo pagado'
      : '✅ Enviar recibo pagado'
    : recibo.whatsapp
      ? '↻ Reenviar el recibo amarillo'
      : '🧾 Enviar el recibo amarillo'

  return (
    <div>
      {faltaEnviarPagado && recibo.whatsapp && (
        <p className="mb-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success">
          Le mandaste este recibo sin pagar el {formatearFecha(recibo.whatsapp.fecha)}. Ahora mándale el recibo pagado.
        </p>
      )}
      <button
        type="button"
        onClick={enviar}
        disabled={ocupado}
        className={`block w-full rounded-xl text-center font-extrabold transition-transform active:scale-[0.98] disabled:opacity-50 ${faltaEnviarPagado ? 'bg-success px-4 py-4 text-base text-white' : className}`}
      >
        {ocupado ? 'Preparando…' : etiqueta}
        <span className="block text-xs font-semibold opacity-80">
          Elige WhatsApp y a {usuario.nombre.split(' ')[0]}
          {usuario.telefono ? ` (${usuario.telefono})` : ''}
        </span>
      </button>
      {aviso && <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">{aviso}</p>}
    </div>
  )
}
