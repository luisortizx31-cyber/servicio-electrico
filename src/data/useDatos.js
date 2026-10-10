import { useMemo } from 'react'
import { useEstado } from './store'
import { recibosConEstado, deudaPorUsuario, periodosOrdenados } from '../domain/calculo'
import { hoyISO } from '../domain/fecha'

// Lo que casi todas las pantallas necesitan, ya cruzado: los recibos
// con su estado de hoy, cuánto debe cada usuario y los periodos en orden.
export function useDatos() {
  const estado = useEstado()
  const hoy = hoyISO()
  return useMemo(() => {
    const recibos = recibosConEstado(estado, hoy)
    const periodos = periodosOrdenados(estado)
    return {
      estado,
      hoy,
      config: estado.config,
      usuarios: estado.usuarios,
      usuariosPorId: new Map(estado.usuarios.map((u) => [u.id, u])),
      periodos,
      periodoActual: periodos.at(-1) ?? null,
      recibos,
      deuda: deudaPorUsuario(recibos),
    }
  }, [estado, hoy])
}
