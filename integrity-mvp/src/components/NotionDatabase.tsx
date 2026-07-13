import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState, ColumnResizeMode } from '@tanstack/react-table';
import { LayoutGrid, Table as TableIcon, Search, Plus, ArrowUpDown } from 'lucide-react';

interface NotionDatabaseProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  title: string;
  readOnly?: boolean;
}

export function NotionDatabase<T>({ data, columns, title, readOnly = false }: NotionDatabaseProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [view, setView] = useState<'table' | 'board' | 'gallery'>('table');
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Notion-style Header Area */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 8px' }}>
        
        {/* Title and Views */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setView('table')} 
              style={{ 
                background: view === 'table' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', padding: '6px 12px', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem'
              }}
            >
              <TableIcon size={14} /> Table
            </button>
            <button 
              onClick={() => setView('gallery')} 
              style={{ 
                background: view === 'gallery' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', padding: '6px 12px', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem'
              }}
            >
              <LayoutGrid size={14} /> Gallery
            </button>
          </div>
        </div>

        {/* Tools and Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Filter..." 
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              style={{
                background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '4px',
                padding: '6px 12px 6px 32px', color: 'var(--text-primary)', fontSize: '0.85rem', width: '200px',
                outline: 'none'
              }}
            />
          </div>
          
          {!readOnly && (
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} /> New
            </button>
          )}
        </div>
      </div>

      {/* Database View Container */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-main)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        
        {view === 'table' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      style={{ 
                        width: header.getSize(),
                        padding: '12px 16px',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        position: 'relative',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        userSelect: 'none',
                        borderRight: '1px solid var(--border-color)'
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ArrowUpDown size={12} color="var(--primary)" />,
                          desc: <ArrowUpDown size={12} color="var(--danger)" />,
                        }[header.column.getIsSorted() as string] ?? (header.column.getCanSort() ? <ArrowUpDown size={12} style={{ opacity: 0.3 }} /> : null)}
                      </div>
                      
                      {/* Column Resizer */}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: '100%',
                          width: '5px',
                          background: header.column.getIsResizing() ? 'var(--primary)' : 'transparent',
                          cursor: 'col-resize',
                          touchAction: 'none'
                        }}
                        className="resizer"
                      />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', background: 'transparent' }} className="table-row-hover">
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id} 
                      style={{ 
                        padding: '12px 16px', 
                        fontSize: '0.85rem', 
                        color: 'var(--text-primary)',
                        borderRight: '1px solid var(--border-color)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === 'gallery' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px', padding: '24px' }}>
            {table.getRowModel().rows.map(row => (
              <div key={row.id} className="glass-panel glass-panel-hover" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                {row.getVisibleCells().map((cell, idx) => (
                  <div key={cell.id} style={{ marginBottom: idx === 0 ? '16px' : '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {cell.column.id}
                    </div>
                    <div style={{ fontSize: idx === 0 ? '1.1rem' : '0.85rem', fontWeight: idx === 0 ? 600 : 400, color: 'var(--text-primary)' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

      </div>
      
      {/* Global styles for table hover - injecting directly for convenience */}
      <style>{`
        .table-row-hover:hover {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        .resizer:hover {
          background: var(--text-muted) !important;
        }
      `}</style>
    </div>
  );
}
