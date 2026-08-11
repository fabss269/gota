import type { Plugin } from 'chart.js';

/** Dibuja el valor de cada barra horizontal al final de la barra, para no
 * depender del hover/tooltip. Para datasets `stacked: true` (barras apiladas),
 * solo etiqueta el ÚLTIMO dataset visible por índice, con el TOTAL apilado —
 * una etiqueta por fila, no una por segmento. */
export function makeBarValueLabelsPlugin(formatter: (value: number) => string): Plugin<'bar'> {
  return {
    id: 'barValueLabels',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      const datasets = data.datasets;
      const stacked = datasets.some((d) => (d as { stack?: string }).stack != null);

      ctx.save();
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const labelsColocadas = new Set<number>();

      // Recorrer datasets de atrás hacia adelante: para barras apiladas, el
      // último dataset dibujado (el visualmente "de más afuera") es el primero
      // en el orden natural — usamos el de mayor índice acumulado real.
      for (let dsIndex = datasets.length - 1; dsIndex >= 0; dsIndex--) {
        const meta = chart.getDatasetMeta(dsIndex);
        if (meta.hidden) continue;
        meta.data.forEach((bar, index) => {
          if (stacked && labelsColocadas.has(index)) return;

          const total = stacked
            ? datasets.reduce((sum, ds) => sum + (Number(ds.data[index]) || 0), 0)
            : Number(datasets[dsIndex].data[index]) || 0;
          if (total <= 0) return;

          const props = (bar as any).getProps(['x', 'y'], true) as { x: number; y: number };
          ctx.fillText(formatter(total), props.x + 6, props.y);
          if (stacked) labelsColocadas.add(index);
        });
      }

      ctx.restore();
    },
  };
}
