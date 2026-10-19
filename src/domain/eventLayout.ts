/** Un instante (inicio = fin) sigue ocupando 1 ms para poder solaparse con otro igual. */
const POINT_MS = 1
const GUTTER_PX = 4
const GAP_PX = 3

export type TimedSpan = {
  startsAt: Date
  endsAt: Date
}

export type TimedLayout<T> = {
  item: T
  column: number
  columns: number
}

type Span<T> = {
  item: T
  index: number
  start: number
  end: number
}

function spanOf<T extends TimedSpan>(item: T, index: number): Span<T> {
  const start = item.startsAt.getTime()
  const rawEnd = item.endsAt.getTime()
  if (!Number.isFinite(start)) {
    return { item, index, start: 0, end: POINT_MS }
  }
  const end = Number.isFinite(rawEnd) ? rawEnd : start
  return { item, index, start, end: Math.max(end, start + POINT_MS) }
}

/**
 * Reparte en columnas los bloques que comparten horario.
 * Dos recordatorios de duración cero a la misma hora quedan en columnas distintas:
 * un intervalo [t, t] no solapa a otro con la comparación estricta `start < end`.
 */
export function layoutTimedEvents<T extends TimedSpan>(items: T[]): TimedLayout<T>[] {
  const spans = items.map((item, index) => spanOf(item, index))
  const ordered = [...spans].sort(
    (left, right) => left.start - right.start || right.end - left.end || left.index - right.index,
  )

  const clusters: Span<T>[][] = []
  let current: Span<T>[] = []
  let clusterEnd = Number.NEGATIVE_INFINITY
  for (const span of ordered) {
    if (current.length > 0 && span.start >= clusterEnd) {
      clusters.push(current)
      current = []
      clusterEnd = Number.NEGATIVE_INFINITY
    }
    current.push(span)
    clusterEnd = Math.max(clusterEnd, span.end)
  }
  if (current.length > 0) clusters.push(current)

  const placed = new Map<number, { column: number; columns: number }>()
  for (const cluster of clusters) {
    const columnEnds: number[] = []
    const columnsByIndex: number[] = []
    for (const span of cluster) {
      let column = columnEnds.findIndex((end) => end <= span.start)
      if (column < 0) {
        column = columnEnds.length
        columnEnds.push(span.end)
      } else {
        columnEnds[column] = span.end
      }
      columnsByIndex.push(column)
    }
    const columns = Math.max(1, columnEnds.length)
    cluster.forEach((span, index) => {
      placed.set(span.index, { column: columnsByIndex[index] ?? 0, columns })
    })
  }

  return items.map((item, index) => ({
    item,
    column: placed.get(index)?.column ?? 0,
    columns: placed.get(index)?.columns ?? 1,
  }))
}

function mix(percent: number, pixels: number): string {
  const pct = Math.round(percent * 1000) / 1000
  const px = Math.round(Math.abs(pixels) * 1000) / 1000
  if (px === 0) return `${pct}%`
  return `calc(${pct}% ${pixels >= 0 ? '+' : '-'} ${px}px)`
}

/** Caja horizontal del bloque. Una sola columna conserva el ancho completo. */
export function eventBlockBox(
  column: number,
  columns: number,
): { left: string; width: string; right: string } {
  const count = Math.max(1, columns)
  const index = Math.max(0, Math.min(column, count - 1))
  if (count === 1) {
    return { left: `${GUTTER_PX}px`, width: 'auto', right: `${GUTTER_PX}px` }
  }
  const subtract = GUTTER_PX * 2 + (count - 1) * GAP_PX
  const sharePx = subtract / count
  return {
    left:
      index === 0
        ? `${GUTTER_PX}px`
        : mix((100 * index) / count, GUTTER_PX + index * GAP_PX - sharePx * index),
    width: mix(100 / count, -sharePx),
    right: 'auto',
  }
}
