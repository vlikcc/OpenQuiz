import { useState, useRef } from 'react';
import { FileSpreadsheet, FileText, Upload, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { parseQuestionRows, parseQuestionText } from '../utils/questionImport';
import { useTranslation } from 'react-i18next';

async function parseExcel(file) {
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return parseQuestionRows(XLSX.utils.sheet_to_json(worksheet, { header: 1 }));
}

async function parseWord(file) {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return parseQuestionText(result.value);
}

async function parsePdf(file) {
  // pdf.js is several hundred kB; Excel and Word imports should not pay for it.
  const { extractPdfText } = await import('../utils/pdfText');
  return parseQuestionText(await extractPdfText(await file.arrayBuffer()));
}

const PARSERS = {
  xlsx: parseExcel,
  xls: parseExcel,
  docx: parseWord,
  pdf: parsePdf,
};

export default function FileImport({ onImport, onClose }) {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [saveToBank, setSaveToBank] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setPreview(null);

    const parse = PARSERS[file.name.split('.').pop().toLowerCase()];
    if (!parse) {
      setError(t('import.unsupported'));
      return;
    }

    setImporting(true);
    try {
      const questions = await parse(file);
      if (questions.length === 0) setError(t('import.noQuestions'));
      else setPreview(questions);
    } catch (err) {
      console.error('Import failed', err);
      setError(t('import.readFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleImport = () => {
    if (preview && preview.length > 0) {
      onImport(preview, { saveToBank });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{t('import.title')}</h3>
            <p className="text-slate-500 text-sm">{t('import.subtitle')}</p>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!preview ? (
            <>
              {/* Format Info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-indigo-800 mb-3">{t('import.formats')}</h4>

                <div className="space-y-4 text-sm">
                  <div>
                    <div className="font-medium text-indigo-700 flex items-center gap-2 mb-1">
                      <FileSpreadsheet size={16} /> Excel (.xlsx)
                    </div>
                    <div className="text-indigo-600 bg-white p-2 rounded font-mono text-xs">
                      {t('import.excelLayout')}
                    </div>
                  </div>

                  <div>
                    <div className="font-medium text-indigo-700 flex items-center gap-2 mb-1">
                      <FileText size={16} /> Word (.docx) / PDF
                    </div>
                    <div className="text-indigo-600 bg-white p-2 rounded font-mono text-xs whitespace-pre-line">
                      {t('import.textLayout')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
              >
                {importing ? (
                  <Loader2 size={40} className="mx-auto mb-3 text-indigo-600 animate-spin" />
                ) : (
                  <Upload size={40} className="mx-auto mb-3 text-slate-400" />
                )}
                <p className="font-medium text-slate-700">
                  {importing ? t('import.reading') : t('import.choose')}
                </p>
                <p className="text-sm text-slate-500 mt-1">{t('import.extensions')}</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.docx,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Preview */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600" size={24} />
                <div>
                  <p className="font-bold text-emerald-800">{t('import.found', { count: preview.length })}</p>
                  <p className="text-sm text-emerald-600">{t('import.previewHint')}</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {preview.map((q, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">
                        {i + 1}
                      </span>
                      <p className="font-medium text-slate-800">{q.text}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, j) => (
                        <div
                          key={j}
                          className={`text-sm p-2 rounded ${
                            j === q.correctIndex
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {j === q.correctIndex && <CheckCircle2 size={12} className="inline mr-1" />}
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors">
            {t('common.cancel')}
          </button>
          {preview && (
            <>
              <label className="mr-auto flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} className="accent-indigo-600" />
                {t('session.importToBank')}
              </label>
              <button onClick={handleImport} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2">
                <CheckCircle2 size={18} />
                {t('import.importButton', { count: preview.length })}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
