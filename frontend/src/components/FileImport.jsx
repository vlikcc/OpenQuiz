import { useState, useRef } from 'react';
import { FileSpreadsheet, FileText, Upload, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { parseQuestionRows } from '../utils/questionImport';
import { useTranslation } from 'react-i18next';

export default function FileImport({ onImport, onClose }) {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [saveToBank, setSaveToBank] = useState(false);
  const fileInputRef = useRef(null);

  const parseExcel = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Format: Soru | Seçenek1 | Seçenek2 | Seçenek3 | Seçenek4 | Doğru Cevap (1-4)
          resolve(parseQuestionRows(json));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const parseWord = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          const text = result.value;
          
          // Word formatı: Her soru aralarında boş satır
          // Format:
          // 1. Soru metni
          // A) Seçenek 1
          // B) Seçenek 2
          // C) Seçenek 3
          // D) Seçenek 4
          // Cevap: A
          
          const questions = [];
          const blocks = text.split(/\n\s*\n/); // Boş satırlarla ayır
          
          for (const block of blocks) {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length < 3) continue;
            
            let questionText = '';
            const options = [];
            let correctIndex = 0;
            
            for (const line of lines) {
              // Seçenek kontrolü (A), B), C), D) veya a), b), c), d)
              const optionMatch = line.match(/^([A-Da-d])[).]?\s*(.+)/);
              // Cevap kontrolü
              const answerMatch = line.match(/^(?:Cevap|Doğru|Answer)[:\s]*([A-Da-d1-4])/i);
              
              if (answerMatch) {
                const answer = answerMatch[1].toUpperCase();
                if (/[A-D]/.test(answer)) {
                  correctIndex = answer.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                } else {
                  correctIndex = parseInt(answer) - 1;
                }
              } else if (optionMatch) {
                options.push(optionMatch[2]);
              } else if (!questionText && !line.match(/^\d+[.)]/)) {
                questionText = line;
              } else if (line.match(/^\d+[.)]\s*/)) {
                questionText = line.replace(/^\d+[.)]\s*/, '');
              }
            }
            
            if (questionText && options.length >= 2) {
              questions.push({
                text: questionText,
                options,
                correctIndex: Math.max(0, Math.min(correctIndex, options.length - 1))
              });
            }
          }
          
          resolve(questions);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const parsePDF = async () => {
    // PDF desteği şu anda mevcut değil - Excel veya Word kullanılması önerilir
    throw new Error('PDF desteği şu anda mevcut değil. Lütfen Excel (.xlsx) veya Word (.docx) formatını kullanın.');
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setPreview(null);

    try {
      let questions = [];
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        questions = await parseExcel(file);
      } else if (ext === 'docx' || ext === 'doc') {
        questions = await parseWord(file);
      } else if (ext === 'pdf') {
        questions = await parsePDF(file);
      } else {
        throw new Error('Desteklenmeyen dosya formatı. Excel (.xlsx), Word (.docx) veya PDF (.pdf) kullanın.');
      }

      if (questions.length === 0) {
        throw new Error('Dosyada geçerli soru bulunamadı. Format rehberini kontrol edin.');
      }

      setPreview(questions);
    } catch (err) {
      setError(err.message);
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
            <h3 className="text-xl font-bold text-slate-800">Dosyadan Soru Yükle</h3>
            <p className="text-slate-500 text-sm">Excel, Word veya PDF dosyasından soru içe aktarın</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!preview ? (
            <>
              {/* Format Info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-indigo-800 mb-3">📋 Desteklenen Formatlar</h4>
                
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="font-medium text-indigo-700 flex items-center gap-2 mb-1">
                      <FileSpreadsheet size={16} /> Excel (.xlsx)
                    </div>
                    <div className="text-indigo-600 bg-white p-2 rounded font-mono text-xs">
                      Soru | Seçenek1 | Seçenek2 | Seçenek3 | Seçenek4 | Doğru (1-4)
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-indigo-700 flex items-center gap-2 mb-1">
                      <FileText size={16} /> Word (.docx) / PDF
                    </div>
                    <div className="text-indigo-600 bg-white p-2 rounded font-mono text-xs whitespace-pre-line">
{`1. Soru metni burada
A) Seçenek 1
B) Seçenek 2
C) Seçenek 3
D) Seçenek 4
Cevap: A`}
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
                  {importing ? 'Dosya okunuyor...' : 'Dosya seçmek için tıklayın'}
                </p>
                <p className="text-sm text-slate-500 mt-1">.xlsx, .docx veya .pdf</p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.docx,.doc,.pdf"
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
                  <p className="font-bold text-emerald-800">{preview.length} soru bulundu</p>
                  <p className="text-sm text-emerald-600">Aşağıda önizleme yapabilirsiniz</p>
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
            İptal
          </button>
          {preview && (
            <>
              <label className="mr-auto flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} className="accent-indigo-600" />
                {t('session.importToBank')}
              </label>
              <button onClick={handleImport} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2">
                <CheckCircle2 size={18} />
                {preview.length} Soruyu İçe Aktar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

