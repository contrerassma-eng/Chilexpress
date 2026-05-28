import { useMemo, useState } from 'react';
import { useStore, STATUS } from './state/store.jsx';
import { fmtTime } from './lib/format.js';
import ScannerPanel from './components/ScannerPanel.jsx';
import FilterBar from './components/FilterBar.jsx';
import PackageList from './components/PackageList.jsx';
import ImportPanel from './components/ImportPanel.jsx';
import CloseShiftDialog from './components/CloseShiftDialog.jsx';
import ReportView from './components/ReportView.jsx';
import StartShift from './components/StartShift.jsx';

const STATUS_ORDER = { [STATUS.RECIBIDO]: 0, [STATUS.ESPERADO]: 1, [STATUS.ENTREGADO]: 2 };

export default function App() {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState('recepcion');
  const [filter, setFilter] = useState('todos');
  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [report, setReport] = useState(null);

  const all = useMemo(() => Object.values(state.packages), [state.packages]);

  const counts = useMemo(() => {
    const c = { todos: all.length, [STATUS.ESPERADO]: 0, [STATUS.RECIBIDO]: 0, [STATUS.ENTREGADO]: 0 };
    for (const p of all) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [all]);

  const items = useMemo(() => {
    const q = query.trim();
    let list = all;
    if (filter !== 'todos') list = list.filter((p) => p.status === filter);
    if (q) list = list.filter((p) => p.code.includes(q));
    return list.sort((a, b) => {
      const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return so !== 0 ? so : a.code.localeCompare(b.code);
    });
  }, [all, filter, query]);

  if (report) {
    return <ReportView payload={report} onClose={() => setReport(null)} />;
  }

  if (!state.shift) {
    return <StartShift dispatch={dispatch} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__info">
          <strong>{state.shift.responsable}</strong>
          <span className="muted">turno desde {fmtTime(state.shift.startedAt)}</span>
        </div>
        <div className="topbar__actions">
          <button className="btn btn--sm" onClick={() => setShowImport(true)}>Importar</button>
          <button className="btn btn--sm btn--danger-soft" onClick={() => setShowClose(true)}>Cerrar turno</button>
          <button className="btn btn--sm btn--ghost" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>⋮</button>
          {menuOpen && (
            <div className="menu" onClick={() => setMenuOpen(false)}>
              <button onClick={() => dispatch({ type: 'CLEAR_DELIVERED' })}>Quitar entregados de la lista</button>
              <button
                className="danger"
                onClick={() => { if (confirm('Vaciar TODA la lista de codigos?')) dispatch({ type: 'CLEAR_ALL' }); }}
              >
                Vaciar lista completa
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="content">
        <ScannerPanel state={state} dispatch={dispatch} mode={mode} setMode={setMode} />
        <FilterBar filter={filter} setFilter={setFilter} counts={counts} query={query} setQuery={setQuery} />
        <PackageList items={items} dispatch={dispatch} />
      </main>

      {showImport && <ImportPanel dispatch={dispatch} onClose={() => setShowImport(false)} />}
      {showClose && (
        <CloseShiftDialog
          state={state}
          dispatch={dispatch}
          onClose={() => setShowClose(false)}
          onGenerated={(payload) => setReport(payload)}
        />
      )}
    </div>
  );
}
