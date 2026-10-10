// Cola de recibos a imprimir - la llena imprimirRecibos() desde
// cualquier pantalla y la dibuja <ZonaImpresion> (ver impresion.jsx).
let cola = []
const oyentes = new Set()

export function fijarCola(lista) {
  cola = lista
  oyentes.forEach((fn) => fn())
}

export function leerCola() {
  return cola
}

export function suscribirCola(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

// `items`: [{ recibo, usuario, periodo }]
export function imprimirRecibos(items) {
  fijarCola(items)
}
