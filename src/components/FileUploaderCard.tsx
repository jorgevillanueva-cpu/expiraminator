import React, { useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { readExcelFile } from '../utils/excelParser';

interface FileUploaderCardProps {
  fileNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
  discardRuleText: string;
  columnsSummary: Array<{ col: string; name: string }>;
  fileName: string | null;
  rowCount: number;
  onFileLoaded: (name: string, rows: any[][]) => void;
  onClear: () => void;
  accentBadgeColor?: string;
}

export const FileUploaderCard: React.FC<FileUploaderCardProps> = ({
  fileNumber,
  title,
  subtitle,
  discardRuleText,
  columnsSummary,
  fileName,
  rowCount,
  onFileLoaded,
  onClear,
  accentBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200',
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleProcessFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMsg('Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const parsed = await readExcelFile(file);
      onFileLoaded(parsed.fileName, parsed.rows);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al leer el archivo Excel. Verifica que no esté corrupto.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`relative rounded-2xl border p-4 bg-white transition-all shadow-xs ${
        fileName
          ? 'border-emerald-300 ring-2 ring-emerald-100 bg-emerald-50/20'
          : isDragging
          ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/30'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleProcessFile(e.target.files[0]);
          }
        }}
      />

      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
              fileName
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            A{fileNumber}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">{title}</h3>
            <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>

        {fileName && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 transition"
            title="Quitar archivo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Discard info badge */}
      <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
        <span className="font-mono text-[10.5px] leading-tight">{discardRuleText}</span>
      </div>

      {/* Main dropzone or loaded card */}
      {!fileName ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/20 transition-all group bg-slate-50/50"
        >
          {loading ? (
            <div className="py-2 text-slate-600 text-xs flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Analizando libro de Excel...</span>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 mx-auto mb-1.5 text-slate-400 group-hover:text-rose-500 group-hover:scale-110 transition" />
              <p className="text-xs font-semibold text-slate-700">
                Arrastra o haz clic para subir <span className="text-rose-600 font-mono">.xlsx</span>
              </p>
              <p className="text-[10.5px] text-slate-400 mt-0.5">Compatible con Excel 97-365 y CSV</p>
            </>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-slate-900 truncate">{fileName}</p>
              <p className="text-[11px] text-emerald-700 font-mono font-semibold">
                {rowCount.toLocaleString()} filas listas para cotejo
              </p>
            </div>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 underline shrink-0 ml-2"
          >
            Cambiar
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mt-2 text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Columns mapping info */}
      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1.5 font-bold">
          Columnas Clave:
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {columnsSummary.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 text-[11px] bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 text-slate-700"
            >
              <span className="font-mono text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-1 rounded">
                Col {item.col}
              </span>
              <span className="truncate text-slate-600 font-medium">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
