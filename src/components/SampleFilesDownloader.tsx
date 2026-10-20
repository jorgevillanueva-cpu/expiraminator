import React from 'react';
import { Download, FileSpreadsheet, PlayCircle } from 'lucide-react';
import { generateSampleExcelBlob } from '../utils/reconciler';

interface SampleFilesDownloaderProps {
  onLoadSamplesDirectly: () => void;
}

export const SampleFilesDownloader: React.FC<SampleFilesDownloaderProps> = ({
  onLoadSamplesDirectly,
}) => {
  const downloadBlob = (bytes: Uint8Array, fileName: string) => {
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Plantillas y Archivos de Prueba (.xlsx)
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Descarga plantillas formateadas de acuerdo a las especificaciones del sistema, o
              ejecuta una prueba completa en tiempo real en 1 solo clic.
            </p>
          </div>

          <button
            onClick={onLoadSamplesDirectly}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition shrink-0"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Cargar Datos de Prueba Directamente</span>
          </button>
        </div>
      </div>

      {/* Grid of sample files */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sample 1: Base de Terminales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                BASE FIREBASE
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">.xlsx</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Base de Terminales en Funcionamiento</h3>
            <p className="text-xs text-slate-600 mt-1">
              Catálogo con <strong className="text-slate-800">Columna C (Número de Serie)</strong> y{' '}
              <strong className="text-slate-800">Columna D (ID Store)</strong>.
            </p>
          </div>
          <button
            onClick={() =>
              downloadBlob(generateSampleExcelBlob('base'), 'Base_Terminales_En_Funcionamiento.xlsx')
            }
            className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Base_Terminales.xlsx</span>
          </button>
        </div>

        {/* Sample 2: Archivo 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                ARCHIVO 1
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">.xlsx</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Total Registro de Transacciones (SPIN)</h3>
            <p className="text-xs text-slate-600 mt-1">
              Descarta primeros 12 renglones. Columna D (Hora), Col S (Tarjeta), Col Y (Autorización),
              Col I & L (Estatus Aprobadas), Col P (Store ID).
            </p>
          </div>
          <button
            onClick={() =>
              downloadBlob(generateSampleExcelBlob('f1'), 'Archivo_1_Transacciones_SPIN.xlsx')
            }
            className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Archivo_1_Transacciones_SPIN.xlsx</span>
          </button>
        </div>

        {/* Sample 3: Archivo 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ARCHIVO 2
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">.xlsx</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Total Órdenes Generadas (Excel detallado pagos)</h3>
            <p className="text-xs text-slate-600 mt-1">
              Desde renglón 5. Col A (Fecha de venta / hora), Col M (Tarjeta últimos 4), Col R
              (Autorización), Col S (Número de terminal).
            </p>
          </div>
          <button
            onClick={() => downloadBlob(generateSampleExcelBlob('f2'), 'Archivo_2_Ordenes_Detallado_Pagos.xlsx')}
            className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Archivo_2_Ordenes.xlsx</span>
          </button>
        </div>

        {/* Sample 4: Archivo 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                ARCHIVO 3
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">.xlsx</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Total Órdenes Expiradas</h3>
            <p className="text-xs text-slate-600 mt-1">
              Desde renglón 5. Col A (Hora), Col B (Concesión), Col C (Código), Col E (Vendedor), Col G
              (Monto base para aumentos 5-20%), Col H (Total).
            </p>
          </div>
          <button
            onClick={() => downloadBlob(generateSampleExcelBlob('f3'), 'Archivo_3_Ordenes_Expiradas.xlsx')}
            className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Archivo_3_Expiradas.xlsx</span>
          </button>
        </div>
      </div>
    </div>
  );
};
