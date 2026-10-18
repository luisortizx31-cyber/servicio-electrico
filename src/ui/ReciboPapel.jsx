import { formatearFecha, MESES_CORTOS } from '../domain/fecha'
import { formatearNumero, formatearNumeroRecibo } from '../domain/dinero'
import { datosPago, textoCaptura } from '../domain/pago'

// El recibo tal como es el talonario de papel del comité (mismos
// casilleros, tinta azul sobre amarillo) - así lo que se imprime o se
// manda por WhatsApp es lo que el vecino ya conoce.
// `resaltar`: la diferencia de lectura y el coeficiente, que son lo que
// se multiplica (pedido del usuario, 2026-10-17).
function Casilla({ etiqueta, children, className = '', resaltar }) {
  return (
    <div className={`flex items-stretch border-b border-recibo-tinta/60 last:border-b-0 ${resaltar ? 'bg-recibo-tinta/15' : ''} ${className}`}>
      <span className="w-[46%] shrink-0 border-r border-recibo-tinta/60 px-1.5 py-1 text-[9px] font-bold uppercase leading-tight">{etiqueta}</span>
      <span className="money flex-1 px-1.5 py-1 text-right text-[12px] font-bold">{children}</span>
    </div>
  )
}

function dinero(valor) {
  return valor ? formatearNumero(valor, 2) : ''
}

export function ReciboPapel({ recibo, usuario, periodo, config }) {
  return (
    <div className="recibo-hoja relative overflow-hidden rounded-lg border border-recibo-tinta/50 bg-recibo p-3 text-recibo-tinta">
      {recibo.pago && (
        <div className="pointer-events-none absolute right-3 top-14 rotate-[-12deg] rounded border-2 border-success px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-widest text-success opacity-80">
          Pagado {formatearFecha(recibo.pago.fecha)}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold uppercase leading-tight">{config.nombre}</p>
          <p className="text-[9px] font-bold uppercase">{config.ubicacion}</p>
          <p className="mt-1 text-[11px] font-extrabold uppercase">Recibo de consumo eléctrico</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="money rounded border border-recibo-tinta/60 px-2 py-0.5 text-[15px] font-extrabold text-danger">N° {formatearNumeroRecibo(recibo.numero)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase">
            Mes <span className="money">{MESES_CORTOS[periodo.mes - 1]}</span> · Año <span className="money">{periodo.anio}</span>
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-stretch rounded border border-recibo-tinta/60 text-[10px] font-bold uppercase">
        <span className="border-r border-recibo-tinta/60 px-1.5 py-1">Usuario</span>
        <span className="flex-1 truncate px-1.5 py-1 text-[12px] normal-case">{usuario?.nombre ?? '—'}</span>
        <span className="border-l border-recibo-tinta/60 px-1.5 py-1">Mz <span className="money text-[12px]">{usuario?.mz}</span></span>
        <span className="border-l border-recibo-tinta/60 px-1.5 py-1">Lot <span className="money text-[12px]">{usuario?.lote}</span></span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded border border-recibo-tinta/60">
          <Casilla etiqueta="Código de medidor">{usuario?.medidor}</Casilla>
          <Casilla etiqueta="Lectura actual">{formatearNumero(recibo.lecturaActual)}</Casilla>
          <Casilla etiqueta="Lectura anterior">{formatearNumero(recibo.lecturaAnterior)}</Casilla>
          <Casilla etiqueta="Difer. de lectura" resaltar>{formatearNumero(recibo.consumo)} kWh</Casilla>
          <Casilla etiqueta="Fecha lectura">{formatearFecha(periodo.fechaLectura)}</Casilla>
          <Casilla etiqueta="Fecha vencimiento">{formatearFecha(periodo.fechaVencimiento)}</Casilla>
          <Casilla etiqueta="Fecha corte">{formatearFecha(periodo.fechaCorte)}</Casilla>
        </div>
        <div className="flex flex-col rounded border border-recibo-tinta/60">
          <div className="border-b border-recibo-tinta/60 px-1.5 py-1 text-[9px] font-bold uppercase leading-tight">
            Importe facturado del <span className="money">{formatearFecha(periodo.del)}</span> al <span className="money">{formatearFecha(periodo.al)}</span>
          </div>
          <Casilla etiqueta="Coeficiente" resaltar>{formatearNumero(periodo.coeficiente, 2)}</Casilla>
          <Casilla etiqueta="Costo kW consumido">{dinero(recibo.costoConsumo)}</Casilla>
          <Casilla etiqueta="Energía perdida">{dinero(recibo.energiaPerdida)}</Casilla>
          <Casilla etiqueta="Comisión comité control eléctrico">{dinero(recibo.comision)}</Casilla>
          <Casilla etiqueta="Mantenimiento, reparación, otros">{dinero(recibo.mantenimiento)}</Casilla>
          <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-recibo-tinta px-1.5 py-1.5">
            <span className="text-[10px] font-extrabold uppercase leading-tight">Total a pagar</span>
            <span className="money text-[17px] font-extrabold">S/ {formatearNumero(recibo.total, 2)}</span>
          </div>
        </div>
      </div>
      {/* La cuenta del consumo, escrita */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 rounded border-2 border-recibo-tinta/70 bg-recibo-tinta/10 px-2 py-1 text-[11px] font-bold">
        <span className="text-[9px] uppercase">Consumo:</span>
        <span className="money">{formatearNumero(recibo.consumo)} kWh</span>
        <span>×</span>
        <span className="money">{formatearNumero(periodo.coeficiente, 2)}</span>
        <span className="text-[9px] uppercase">(coef.)</span>
        <span>=</span>
        <span className="money">S/ {formatearNumero(recibo.costoConsumo, 2)}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <CuadroPago recibo={recibo} config={config} />
        <p className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-widest">Tesorería</p>
      </div>
    </div>
  )
}

// A dónde yapear (ver domain/pago.js). Solo en un recibo sin pagar.
function CuadroPago({ recibo, config }) {
  const p = datosPago(config)
  if (recibo.pago || !p) return null
  return (
    <div className="min-w-0 rounded border-2 border-recibo-tinta/70 px-2 py-1 leading-tight">
      <p className="text-[10px] font-extrabold uppercase">
        Paga por {p.medio}: <span className="money text-[13px]">{p.numero}</span>
      </p>
      {p.titular && <p className="truncate text-[10px] font-bold">A nombre de: {p.titular}</p>}
      <p className="text-[9px] font-semibold">{textoCaptura(p, 'Envía la captura a este número')}</p>
    </div>
  )
}
