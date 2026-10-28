import React, { useState, useMemo } from 'react';
import {
  Database,
  Upload,
  Plus,
  Trash2,
  Pencil,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Sparkles,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';
import { TerminalRecord } from '../types';
import {
  saveSingleTerminal,
  updateTerminal,
  deleteTerminalById,
  deleteMultipleTerminals,
  deleteAllTerminals,
  batchSaveTerminals,
  SAMPLE_TERMINALS,
} from '../services/terminalService';
import { readExcelFile } from '../utils/excelParser';
import { parseTerminalCatalogRows } from '../utils/reconciler';
import * as XLSX from 'xlsx';

interface TerminalManagerViewProps {
  terminals: TerminalRecord[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const TerminalManagerView: React.FC<TerminalManagerViewProps> = ({
  terminals,
  onRefresh,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSerial, setNewSerial] = useState('');
  const [newStore, setNewStore] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Editing state
  const [editingTerminal, setEditingTerminal] = useState<TerminalRecord | null>(null);
  const [editSerial, setEditSerial] = useState('');
  const [editStore, setEditStore] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Deletion modals state
  const [deletingTerminal, setDeletingTerminal] = useState<TerminalRecord | null>(null);
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Selection state for batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Filtered list based on search term
  const filteredTerminals = useMemo(() => {
    if (!searchTerm.trim()) return terminals;
    const q = searchTerm.toLowerCase().trim();
    return terminals.filter(
      (t) =>
        t.serialNumber.toLowerCase().includes(q) ||
        t.storeId.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
    );
  }, [terminals, searchTerm]);

  // Reset page and selection when search changes
  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize]);

  // Paginated terminals
  const paginatedTerminals = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTerminals.slice(start, start + pageSize);
  }, [filteredTerminals, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTerminals.length / pageSize));

  // Selection helpers
  const isAllVisibleSelected = useMemo(() => {
    if (paginatedTerminals.length === 0) return false;
    return paginatedTerminals.every((t) => selectedIds.has(t.id));
  }, [paginatedTerminals, selectedIds]);

  const handleToggleSelectAllVisible = () => {
    const next = new Set(selectedIds);
    if (isAllVisibleSelected) {
      paginatedTerminals.forEach((t) => next.delete(t.id));
    } else {
      paginatedTerminals.forEach((t) => next.add(t.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Upload Excel
  const handleUploadCatalogExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const parsed = await readExcelFile(file);
      const extracted = parseTerminalCatalogRows(parsed.rows);

      if (extracted.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'No se encontraron terminales válidas en el archivo. Verifica que la Columna C contenga Número de Serie y Columna D el Store ID.',
        });
        setIsSubmitting(false);
        return;
      }

      await batchSaveTerminals(extracted);
      setStatusMessage({
        type: 'success',
        text: `¡Se importaron ${extracted.length} terminales exitosamente a la base de datos!`,
      });
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'Error al procesar el archivo o guardar: ' + (err.message || 'Error desconocido'),
      });
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Create single
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim() || !newStore.trim()) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await saveSingleTerminal({
        serialNumber: newSerial.trim(),
        storeId: newStore.trim(),
        notes: newNotes.trim() || undefined,
      });
      setNewSerial('');
      setNewStore('');
      setNewNotes('');
      setShowAddModal(false);
      setStatusMessage({
        type: 'success',
        text: `Terminal ${newSerial.trim()} guardada exitosamente.`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al guardar terminal: ' + (err.message || 'Error desconocido'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (terminal: TerminalRecord) => {
    setEditingTerminal(terminal);
    setEditSerial(terminal.serialNumber);
    setEditStore(terminal.storeId);
    setEditNotes(terminal.notes || '');
  };

  // Submit edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerminal || !editSerial.trim() || !editStore.trim()) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await updateTerminal(editingTerminal.id, {
        serialNumber: editSerial.trim(),
        storeId: editStore.trim(),
        notes: editNotes.trim() || undefined,
      });
      setEditingTerminal(null);
      setStatusMessage({
        type: 'success',
        text: `Terminal ${editSerial.trim()} actualizada exitosamente.`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al actualizar terminal: ' + (err.message || 'Error desconocido'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Single delete
  const handleConfirmSingleDelete = async () => {
    if (!deletingTerminal) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await deleteTerminalById(deletingTerminal.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingTerminal.id);
        return next;
      });
      setStatusMessage({
        type: 'success',
        text: `Terminal ${deletingTerminal.serialNumber} eliminada de la base de datos.`,
      });
      setDeletingTerminal(null);
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al eliminar terminal: ' + (err.message || 'Error desconocido'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batch delete
  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    const countToDelete = selectedIds.size;
    try {
      await deleteMultipleTerminals(Array.from(selectedIds));
      setSelectedIds(new Set());
      setShowDeleteBatchModal(false);
      setStatusMessage({
        type: 'success',
        text: `Se eliminaron ${countToDelete} terminales seleccionadas exitosamente.`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al eliminar terminales seleccionadas: ' + (err.message || 'Error desconocido'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete all
  const handleConfirmDeleteAll = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const deletedCount = await deleteAllTerminals();
      setSelectedIds(new Set());
      setShowDeleteAllModal(false);
      setStatusMessage({
        type: 'success',
        text: `Se vació la base de datos (${deletedCount} registros eliminados).`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al vaciar la base de datos: ' + (err.message || 'Error desconocido'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Seed sample
  const handleSeedSamples = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      await batchSaveTerminals(
        SAMPLE_TERMINALS.map((t) => ({
          serialNumber: t.serialNumber,
          storeId: t.storeId,
          notes: 'Terminal de prueba precargada',
        }))
      );
      setStatusMessage({
        type: 'success',
        text: `¡Se cargaron ${SAMPLE_TERMINALS.length} terminales de prueba exitosamente!`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al precargar terminales: ' + err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export catalog to Excel
  const handleExportCatalog = () => {
    const rows = [
      ['ID', 'Nombre / Modelo', 'Numero de Serie (Col C)', 'ID Store (Col D)', 'Notas', 'Actualizado'],
      ...terminals.map((t, idx) => [
        idx + 1,
        'Terminal POS',
        t.serialNumber,
        t.storeId,
        t.notes || '',
        t.updatedAt || '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 28 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Terminales_En_Operacion');
    XLSX.writeFile(wb, `Base_Terminales_${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: false });
  };

  return (
    <div className="space-y-6">
      {/* Banner & Actions */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Database className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Base de Datos de Terminales en Funcionamiento
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              Catálogo maestro persistente. Permite registrar, editar y depurar las terminales físicas (Columna C)
              y sus correspondientes Store IDs (Columna D) para que el cotejo de pagos de Archivo 1 vs Archivo 2 y Archivo 3
              sea 100% exacto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* File Upload trigger */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleUploadCatalogExcel}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
              title="Importar archivo Excel de catálogo"
            >
              <Upload className="w-4 h-4" />
              <span>Cargar Base (.xlsx)</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Agregar Terminal</span>
            </button>

            {terminals.length > 0 && (
              <button
                onClick={handleExportCatalog}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 shadow-2xs transition"
                title="Descargar base actual en Excel"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs transition"
              title="Actualizar datos desde la nube"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {terminals.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition disabled:opacity-50"
                title="Vaciar la base de datos completa"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar Todo</span>
              </button>
            )}

            {terminals.length === 0 && (
              <button
                onClick={handleSeedSamples}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Cargar Datos de Ejemplo</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center justify-between gap-2.5 font-medium animate-fadeIn ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="p-1 rounded-lg hover:bg-black/5 text-slate-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Batch Selection Banner */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            <span>{selectedIds.size} {selectedIds.size === 1 ? 'terminal seleccionada' : 'terminales seleccionadas'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-indigo-200 transition"
            >
              Deseleccionar
            </button>
            <button
              onClick={() => setShowDeleteBatchModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Selección ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Table & Search Header */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Serie, Store ID o Ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <span>Mostrar:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value={25}>25 por pág.</option>
                <option value={50}>50 por pág.</option>
                <option value={100}>100 por pág.</option>
                <option value={500}>500 por pág.</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span>
                Total: <strong className="text-slate-900 font-mono font-bold">{terminals.length}</strong>
              </span>
              {searchTerm && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>
                    Filtradas: <strong className="text-slate-900 font-mono font-bold">{filteredTerminals.length}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono tracking-wider border-b border-slate-200 text-[10.5px] font-bold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAllVisible}
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 transition"
                    title={isAllVisibleSelected ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
                  >
                    {isAllVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-indigo-700">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-bold">
                      Col C
                    </span>
                    <span>Número de Serie (Terminal)</span>
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-bold">
                      Col D
                    </span>
                    <span>Store ID</span>
                  </div>
                </th>
                <th className="py-3 px-4">Notas / Ubicación</th>
                <th className="py-3 px-4">Última Actualización</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Cargando base de datos de terminales...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTerminals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-500 font-sans">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-bold text-slate-800 text-sm">
                      {searchTerm ? 'Ninguna terminal coincide con la búsqueda' : 'No hay terminales registradas'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      {searchTerm
                        ? `No se encontraron resultados para "${searchTerm}". Puedes limpiar la búsqueda o agregar una nueva terminal.`
                        : 'Sube tu archivo .xlsx de catálogo de terminales o haz clic en "Agregar Terminal" para ingresar los registros.'}
                    </p>
                    {searchTerm ? (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                      >
                        Limpiar búsqueda
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      >
                        + Registrar Primera Terminal
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedTerminals.map((item, idx) => {
                  const isSelected = selectedIds.has(item.id);
                  const rowNumber = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleSelectRow(item.id)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans">{rowNumber}</td>
                      <td className="py-3 px-4 text-slate-900 font-bold">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="font-mono text-xs">{item.serialNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                          {item.storeId}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 text-xs max-w-[200px] truncate">
                        {item.notes || <span className="text-slate-400 italic font-mono text-[11px]">Sin notas</span>}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Nube'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Editar datos de la terminal"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingTerminal(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        {filteredTerminals.length > 0 && (
          <div className="p-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 text-xs">
            <div className="text-slate-500">
              Mostrando <strong className="text-slate-900">{(page - 1) * pageSize + 1}</strong> a{' '}
              <strong className="text-slate-900">
                {Math.min(page * pageSize, filteredTerminals.length)}
              </strong>{' '}
              de <strong className="text-slate-900">{filteredTerminals.length}</strong> terminales
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition shadow-2xs"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono font-bold text-xs shadow-2xs">
                {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition shadow-2xs"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Agregar Terminal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Registrar Nueva Terminal</h3>
                  <p className="text-xs text-slate-500">Mapeo de Serie física a Store ID</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSingle} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  Número de Serie (Columna C):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2841943566 o SN-POS-8001"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  ID Store (Columna D):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1634555 o STR-010"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  Notas / Ubicación (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Barra Poniente 2, Caja 1"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Terminal */}
      {editingTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Editar Terminal</h3>
                  <p className="text-xs text-slate-500">Actualiza los datos del registro en la base de datos</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTerminal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  Número de Serie (Columna C):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Número de serie"
                  value={editSerial}
                  onChange={(e) => setEditSerial(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  ID Store (Columna D):
                </label>
                <input
                  type="text"
                  required
                  placeholder="ID Store"
                  value={editStore}
                  onChange={(e) => setEditStore(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  Notas / Ubicación:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Barra Poniente 2"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTerminal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación Individual */}
      {deletingTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              ¿Eliminar esta Terminal?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">
              Estás a punto de eliminar la terminal con serie{' '}
              <strong className="text-slate-900 font-mono">{deletingTerminal.serialNumber}</strong> y Store ID{' '}
              <strong className="text-emerald-700 font-mono">{deletingTerminal.storeId}</strong>.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingTerminal(null)}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100 font-semibold border border-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={isSubmitting}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs transition disabled:opacity-50"
              >
                {isSubmitting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación en Lote */}
      {showDeleteBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-100">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              ¿Eliminar {selectedIds.size} Terminales?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">
              Esta acción eliminará de forma permanente los{' '}
              <strong className="text-slate-900">{selectedIds.size}</strong> registros seleccionados de la base de datos en la nube.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteBatchModal(false)}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100 font-semibold border border-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={isSubmitting}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs transition disabled:opacity-50"
              >
                {isSubmitting ? 'Eliminando...' : `Eliminar (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Vaciar Toda la Base */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              ¿Vaciar Toda la Base de Datos?
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4 leading-relaxed">
              Esta acción eliminará los <strong className="text-rose-700">{terminals.length}</strong> registros existentes en la base de datos de terminales.
              Úsalo si deseas limpiar datos de prueba o iniciar con un catálogo completamente nuevo.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs mb-4">
              <strong>Nota:</strong> Si tienes un archivo Excel de respaldo, podrás volver a importarlo en cualquier momento usando el botón &quot;Cargar Base (.xlsx)&quot;.
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100 font-semibold border border-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isSubmitting}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs transition disabled:opacity-50"
              >
                {isSubmitting ? 'Vaciando...' : 'Sí, Vaciar Base'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
