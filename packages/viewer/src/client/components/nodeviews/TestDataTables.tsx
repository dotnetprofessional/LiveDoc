import type { DataTable } from '@swedevtools/livedoc-schema';
import { normalizeDataTable } from '../StepList';

export function TestDataTables({ tables }: { tables?: DataTable[] }) {
  return tables?.map((table, index) => {
    const normalized = normalizeDataTable(table);
    if (!normalized) return null;
    return (
      <div key={index} className="overflow-x-auto">
        <table className="text-sm border-collapse border border-border">
          <caption className="text-left font-semibold mb-2">{table.name || 'Test data'}</caption>
          <thead>
            <tr>
              {normalized.headers.map((header, column) => (
                <th key={column} scope="col" className="border border-border bg-muted/40 px-3 py-2 text-left">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalized.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, column) => (
                  <td key={column} className="border border-border px-3 py-2 whitespace-pre-wrap break-words">{cell.text}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });
}
