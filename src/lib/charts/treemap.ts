// Squarified treemap (Bruls, Huizing & van Wijk): lays values out as
// rectangles whose areas are proportional to value, keeping aspect ratios
// close to square so labels fit.

export interface TreemapRect<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function squarify<T>(items: T[], valueOf: (t: T) => number, width: number, height: number): Array<TreemapRect<T>> {
  const data = items.filter((t) => valueOf(t) > 0).sort((a, b) => valueOf(b) - valueOf(a));
  const total = data.reduce((s, t) => s + valueOf(t), 0);
  if (!total || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;
  const out: Array<TreemapRect<T>> = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let row: T[] = [];

  const worst = (r: T[], side: number) => {
    const areas = r.map((t) => valueOf(t) * scale);
    const sum = areas.reduce((a, b) => a + b, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layoutRow = (r: T[]) => {
    const sum = r.reduce((s, t) => s + valueOf(t) * scale, 0);
    if (w >= h) {
      // Column on the left, items stacked top to bottom.
      const cw = sum / h;
      let cy = y;
      for (const t of r) {
        const ch = (valueOf(t) * scale) / cw;
        out.push({ item: t, x, y: cy, w: cw, h: ch });
        cy += ch;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (const t of r) {
        const cw = (valueOf(t) * scale) / rh;
        out.push({ item: t, x: cx, y, w: cw, h: rh });
        cx += cw;
      }
      y += rh;
      h -= rh;
    }
  };

  for (const t of data) {
    const side = Math.min(w, h);
    if (!row.length || worst([...row, t], side) <= worst(row, side)) {
      row.push(t);
    } else {
      layoutRow(row);
      row = [t];
    }
  }
  if (row.length) layoutRow(row);
  return out;
}
