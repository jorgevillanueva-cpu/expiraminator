import React, { useState } from 'react';
import {
  Database,
  Upload,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { TerminalRecord } from '../types';
import {
  saveSingleTerminal,
  deleteTerminalById,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
        text: `¡Se importaron ${extracted.length} terminales exitosamente!`,
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
        text: 'Terminal guardada exitosamente en Firestore.',
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

  const handleDelete = async (id: string, serial: string) => {
    if (!confirm(`¿Eliminar la terminal ${serial} de la base de datos?`)) return;
    try {
      await deleteTerminalById(id);
      onRefresh();
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

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

  const filteredTerminals = terminals.filter(
    (t) =>
      t.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.storeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Banner & Actions (White Theme) */}
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
              Catálogo maestro persistente en la nube. Durante el cotejo, el sistema busca el{' '}
              <strong className="text-slate-900">Número de Terminal (Columna S del Archivo 2)</strong> en la{' '}
              <strong className="text-indigo-600">Columna C (Número de Serie)</strong> de esta base de datos,
              obtiene el <strong className="text-indigo-600">ID Store (Columna D)</strong> correspondiente, y
              filtra únicamente las transacciones del Archivo 1 que pertenezcan a esas terminales activas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
            >
              <Upload className="w-4 h-4" />
              <span>Cargar Base desde .xlsx</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Agregar Manual</span>
            </button>

            {terminals.length === 0 && (
              <button
                onClick={handleSeedSamples}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Cargar Datos de Ejemplo</span>
              </button>
            )}

            {terminals.length > 0 && (
              <button
                onClick={handleExportCatalog}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 shadow-2xs transition"
                title="Descargar base actual en Excel"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2.5 font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Table & Search Header */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Serie o Store ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span>
              Total: <strong className="text-slate-900 font-mono font-bold">{terminals.length}</strong> terminales
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>
              Filtradas: <strong className="text-slate-900 font-mono font-bold">{filteredTerminals.length}</strong>
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono tracking-wider border-b border-slate-200 text-[10.5px] font-bold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-indigo-700">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-bold">
                      Col C
                    </span>
                    <span>Número de Serie</span>
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-bold">
                      Col D
                    </span>
                    <span>ID Store</span>
                  </div>
                </th>
                <th className="py-3 px-4">Notas / Ubicación</th>
                <th className="py-3 px-4">Sincronizado Firestore</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Cargando base de terminales...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTerminals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-400 opacity-60" />
                    <p className="font-bold text-slate-800">No hay terminales registradas</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Sube tu archivo .xlsx de catálogo de terminales o usa el botón &quot;Cargar Datos de Ejemplo&quot;
                      para probar inmediatamente.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTerminals.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 text-slate-900 font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{item.serialNumber}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        {item.storeId}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 text-xs">
                      {item.notes || <span className="text-slate-400 italic">Sin notas</span>}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-400">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Nube'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(item.id, item.serialNumber)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition"
                        title="Eliminar terminal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Single */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Registrar Nueva Terminal</h3>
            <p className="text-xs text-slate-500 mb-4">
              Ingresa el número de serie de la terminal y su correspondiente Store ID.
            </p>

            <form onSubmit={handleCreateSingle} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  Número de Serie (Columna C):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: SN-POS-8001"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  ID Store (Columna D):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: STR-010"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  Notas / Ubicación (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Caja 1 Puerta Principal"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
