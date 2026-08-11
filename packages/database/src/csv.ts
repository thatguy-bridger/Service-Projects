// Minimal RFC-4180-ish CSV parser (quoted fields, escaped "" quotes, \r\n
// or \n line endings) — hand-written rather than a dependency, consistent
// with the rest of this app's low-dependency approach. Not a general-
// purpose CSV library, but good enough for the fixed-ish column sets this
// app's imports (households, address points) actually deal with. Shared
// here rather than duplicated per importer.
export function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

export function parseCsvRows(text: string): Record<string, string>[] {
  const table = parseCsvTable(text);
  if (table.length === 0) return [];
  const header = table[0];
  return table.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((name, idx) => {
      obj[name] = cells[idx] ?? "";
    });
    return obj;
  });
}
