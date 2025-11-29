import { useState, useEffect, lazy, Suspense } from 'react';
import { 
  collection, addDoc, doc, deleteDoc, onSnapshot, 
  serverTimestamp, query, orderBy, where 
} from 'firebase/firestore';
import { db, appId, CONTENT_TYPES } from '../config/firebase';
import { Plus, Trash2, Smartphone, XCircle, Users, AlertTriangle, Copy, QrCode, Upload, Loader2, BookOpen } from 'lucide-react';
import QrModal from './QrModal';
import KatexRenderer, { KatexEditor, KATEX_EXAMPLES, MARKDOWN_EXAMPLES } from './KatexRenderer';

const FileImport = lazy(() => import('./FileImport'));

export default function Dashboard({ onNavigate, user, showToast, isAdmin, isAuthorized }) {
  const [polls, setPolls] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [qrPoll, setQrPoll] = useState(null); 
  const [showFileImport, setShowFileImport] = useState(false);
  
  const canCreateQuiz = isAdmin || isAuthorized;
  
  const [contentType, setContentType] = useState('contest');
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState([
    { text: "", options: ["", ""], correctIndex: 0, questionType: 'multiple', correctAnswer: '' }
  ]);
  const [showKatexHelp, setShowKatexHelp] = useState(false);

  const handleImportQuestions = (importedQuestions) => {
    const formattedQuestions = importedQuestions.map(q => ({
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex || 0
    }));
    setQuestions(formattedQuestions);
    showToast(`${importedQuestions.length} soru içe aktarıldı!`);
  };

  useEffect(() => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'artifacts', appId, 'public', 'data', 'polls'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'polls'),
        where('creatorEmail', '==', user.email),
        orderBy('createdAt', 'desc')
      );
    }
    
    return onSnapshot(q, (snapshot) => {
      setPolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [isAdmin, user.email]);

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try { document.execCommand('copy'); showToast("ID Kopyalandı"); } catch (e) { showToast("Kopyalanamadı", "error"); }
    document.body.removeChild(textArea);
  };

  const addQuestion = (qType = 'multiple') => {
    if (qType === 'open') {
      setQuestions([...questions, { text: "", questionType: 'open', correctAnswer: '', points: 10 }]);
    } else {
      setQuestions([...questions, { text: "", options: ["", ""], correctIndex: 0, questionType: 'multiple' }]);
    }
  };

  const updateQuestionType = (index, qType) => {
    const newQ = [...questions];
    if (qType === 'open') {
      newQ[index] = { text: newQ[index].text, questionType: 'open', correctAnswer: '', points: 10 };
    } else {
      newQ[index] = { text: newQ[index].text, questionType: 'multiple', options: ["", ""], correctIndex: 0 };
    }
    setQuestions(newQ);
  };

  const updateCorrectAnswer = (index, val) => {
    const newQ = [...questions];
    newQ[index].correctAnswer = val;
    setQuestions(newQ);
  };

  const updatePoints = (index, val) => {
    const newQ = [...questions];
    newQ[index].points = parseInt(val) || 10;
    setQuestions(newQ);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    const newQ = [...questions];
    newQ.splice(index, 1);
    setQuestions(newQ);
  };

  const updateQuestionText = (index, val) => {
    const newQ = [...questions];
    newQ[index].text = val;
    setQuestions(newQ);
  };

  const updateOption = (qIndex, oIndex, val) => {
    const newQ = [...questions];
    newQ[qIndex].options[oIndex] = val;
    setQuestions(newQ);
  };

  const addOption = (qIndex) => {
    const newQ = [...questions];
    newQ[qIndex].options.push("");
    setQuestions(newQ);
  };

  const setCorrectOption = (qIndex, oIndex) => {
    const newQ = [...questions];
    newQ[qIndex].correctIndex = oIndex;
    setQuestions(newQ);
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    const typeConfig = CONTENT_TYPES[contentType];
    
    if (!quizTitle.trim()) return showToast("Başlık giriniz", "error");
    
    // Sınav modu için validasyon
    if (contentType === 'exam') {
      for (const q of questions) {
        if (!q.text.trim()) return showToast("Tüm soru metinlerini doldurunuz", "error");
        if (q.questionType === 'multiple' && q.options.some(o => !o.trim())) {
          return showToast("Çoktan seçmeli sorularda tüm seçenekleri doldurunuz", "error");
        }
      }
    } else {
      if (questions.some(q => !q.text.trim() || q.options.some(o => !o.trim()))) {
        return showToast("Tüm alanları doldurunuz", "error");
      }
    }

    try {
      const formattedQuestions = questions.map((q, idx) => {
        // Sınav modu - açık uçlu soru
        if (contentType === 'exam' && q.questionType === 'open') {
          return {
            id: idx,
            text: q.text,
            questionType: 'open',
            correctAnswer: q.correctAnswer || '',
            points: q.points || 10
          };
        }
        
        // Çoktan seçmeli soru
        return {
          id: idx,
          text: q.text,
          questionType: 'multiple',
          options: q.options.map((optText, optIdx) => ({ id: optIdx, text: optText })),
          ...(typeConfig.hasCorrectAnswer && { correctOptionIndex: parseInt(q.correctIndex) }),
          ...(contentType === 'exam' && { points: q.points || 10 })
        };
      });

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'polls'), {
        title: quizTitle,
        type: contentType,
        questions: formattedQuestions,
        currentQuestionIndex: 0, 
        isActive: false, 
        createdAt: serverTimestamp(),
        creatorId: user.uid,
        creatorEmail: user.email,
      });

      setIsCreating(false);
      setContentType('contest');
      setQuizTitle("");
      setQuestions([{ text: "", options: ["", ""], correctIndex: 0, questionType: 'multiple', correctAnswer: '' }]);
      showToast(`${typeConfig.label} oluşturuldu!`);
    } catch (error) {
      console.error(error);
      showToast("Hata oluştu", "error");
    }
  };

  const handleDeletePoll = async (poll) => {
    const canDelete = isAdmin || poll.creatorEmail === user.email;
    
    if (!canDelete) {
      showToast("Bu yarışmayı silme yetkiniz yok", "error");
      return;
    }

    if (!confirm(`"${poll.title || 'Bu yarışma'}" silinecek. Emin misiniz?`)) return;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'polls', poll.id));
      showToast("Yarışma silindi");
    } catch (error) {
      console.error(error);
      showToast("Silme hatası", "error");
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
      {qrPoll && (
        <QrModal pollId={qrPoll.id} title={qrPoll.title} onClose={() => setQrPoll(null)} />
      )}
      
      {showFileImport && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><Loader2 className="animate-spin text-white" size={40} /></div>}>
          <FileImport onImport={handleImportQuestions} onClose={() => setShowFileImport(false)} />
        </Suspense>
      )}

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isAdmin ? 'Tüm Yarışmalar' : 'Yarışmalarım'}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            {isAdmin 
              ? 'Tüm yarışmaları görüntüleyebilir ve yönetebilirsiniz.'
              : canCreateQuiz 
                ? 'Kendi yarışmalarınızı oluşturun ve yönetin.' 
                : 'Yarışmalara katılabilir ve sonuçları görüntüleyebilirsiniz.'
            }
          </p>
        </div>
        {!isCreating && canCreateQuiz && (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button onClick={() => { setContentType('contest'); setIsCreating(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 shadow-lg transition-transform hover:-translate-y-1 text-xs sm:text-sm">
              <span>🏆</span> Yarışma
            </button>
            <button onClick={() => { setContentType('survey'); setIsCreating(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 shadow-lg transition-transform hover:-translate-y-1 text-xs sm:text-sm">
              <span>📊</span> Anket
            </button>
            <button onClick={() => { setContentType('quiz'); setIsCreating(true); setQuestions([{ text: "", options: ["", ""], correctIndex: 0 }]); }} className="bg-amber-500 hover:bg-amber-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 shadow-lg transition-transform hover:-translate-y-1 text-xs sm:text-sm">
              <span>❓</span> Quiz
            </button>
            <button onClick={() => { setContentType('exam'); setIsCreating(true); setQuestions([{ text: "", options: ["", ""], correctIndex: 0, questionType: 'multiple', correctAnswer: '', points: 10 }]); }} className="bg-rose-600 hover:bg-rose-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 shadow-lg transition-transform hover:-translate-y-1 text-xs sm:text-sm">
              <span>📝</span> Sınav
            </button>
          </div>
        )}
        {!canCreateQuiz && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            İçerik oluşturma yetkiniz yok
          </div>
        )}
      </header>

      {isCreating ? (
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl border border-indigo-50 animate-in fade-in slide-in-from-top-4 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4 sm:mb-6 border-b pb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {CONTENT_TYPES[contentType].icon} {CONTENT_TYPES[contentType].label} Oluştur
            </h2>
            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={22} /></button>
          </div>

          <div className={`mb-6 p-4 rounded-xl bg-${CONTENT_TYPES[contentType].color}-50 border border-${CONTENT_TYPES[contentType].color}-200`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{CONTENT_TYPES[contentType].icon}</span>
              <div>
                <div className="font-bold text-slate-800">{CONTENT_TYPES[contentType].label}</div>
                <div className="text-sm text-slate-500">{CONTENT_TYPES[contentType].description}</div>
              </div>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <label className="block text-sm font-bold text-slate-700 mb-2">Başlık</label>
            <input 
              type="text" 
              value={quizTitle} 
              onChange={(e) => setQuizTitle(e.target.value)} 
              className="w-full p-3 sm:p-4 text-base sm:text-lg border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" 
              placeholder={`Örn: ${contentType === 'survey' ? 'Memnuniyet Anketi' : contentType === 'quiz' ? 'Günün Sorusu' : 'Genel Kültür Yarışması'}`} 
            />
          </div>

          {/* Sınav modu için Format Yardımı */}
          {contentType === 'exam' && (
            <div className="mb-6">
              <button 
                type="button"
                onClick={() => setShowKatexHelp(!showKatexHelp)}
                className="flex items-center gap-2 text-rose-600 hover:text-rose-700 font-medium text-sm"
              >
                <BookOpen size={16} />
                {showKatexHelp ? 'Format Yardımını Gizle' : 'Format Yardımı (KaTeX + Markdown)'}
              </button>
              
              {showKatexHelp && (
                <div className="mt-3 space-y-4">
                  {/* KaTeX Örnekleri */}
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                    <h4 className="font-bold text-rose-800 mb-3">📐 Matematiksel Formüller (KaTeX)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {KATEX_EXAMPLES.map((ex, i) => (
                        <div key={i} className="bg-white p-2 rounded-lg border border-rose-100 text-center">
                          <div className="text-lg mb-1"><KatexRenderer text={`$${ex.code}$`} /></div>
                          <code className="text-[10px] text-slate-500 block truncate">${ex.code}$</code>
                          <span className="text-[9px] text-slate-400">{ex.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-rose-600 mt-3">
                      💡 Satır içi: <code className="bg-white px-1 rounded">$formül$</code> | Blok: <code className="bg-white px-1 rounded">$$formül$$</code>
                    </p>
                  </div>

                  {/* Markdown Örnekleri */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <h4 className="font-bold text-indigo-800 mb-3">📝 Metin Formatlama (Markdown)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                      {MARKDOWN_EXAMPLES.map((ex, i) => (
                        <div key={i} className="bg-white p-2 rounded-lg border border-indigo-100 text-center">
                          <code className="text-[11px] text-indigo-600 block">{ex.code}</code>
                          <span className="text-[9px] text-slate-400">{ex.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-indigo-600 font-mono">**kalın metin**</span> → <strong>kalın metin</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-indigo-600 font-mono">*italik metin*</span> → <em>italik metin</em>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-indigo-600 font-mono">`kod bloğu`</span> → <code className="bg-slate-100 px-1 rounded text-rose-600">kod bloğu</code>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-indigo-600 font-mono">&gt; alıntı</span> → <span className="border-l-2 border-indigo-400 pl-1 italic">alıntı</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-8">
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="bg-slate-50 p-6 rounded-xl border border-slate-200 relative group">
                <div className="absolute top-4 right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-2">
                  {contentType === 'exam' && (
                    <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-slate-200">
                      <span className="text-xs text-slate-500">Puan:</span>
                      <input 
                        type="number" 
                        value={q.points || 10}
                        onChange={(e) => updatePoints(qIndex, e.target.value)}
                        className="w-12 text-center text-sm font-bold text-rose-600 outline-none"
                        min="1"
                      />
                    </div>
                  )}
                  <button onClick={() => removeQuestion(qIndex)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20}/></button>
                </div>
                
                {/* Sınav modu - soru tipi seçimi */}
                {contentType === 'exam' && (
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => updateQuestionType(qIndex, 'multiple')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        q.questionType !== 'open' 
                          ? 'bg-rose-600 text-white' 
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
                      }`}
                    >
                      📋 Çoktan Seçmeli
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuestionType(qIndex, 'open')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        q.questionType === 'open' 
                          ? 'bg-rose-600 text-white' 
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
                      }`}
                    >
                      ✏️ Açık Uçlu
                    </button>
                  </div>
                )}
                
                <div className="mb-4">
                  <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">
                    Soru {qIndex + 1}
                    {contentType === 'exam' && q.questionType === 'open' && (
                      <span className="ml-2 text-rose-500">(Açık Uçlu)</span>
                    )}
                  </label>
                  
                  {/* Sınav modu için KaTeX destekli editör */}
                  {contentType === 'exam' ? (
                    <KatexEditor
                      value={q.text}
                      onChange={(val) => updateQuestionText(qIndex, val)}
                      placeholder="Soru metnini giriniz... (Matematik için $formül$ kullanın)"
                      rows={3}
                    />
                  ) : (
                    <input 
                      type="text" 
                      value={q.text} 
                      onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                      className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none font-medium"
                      placeholder="Soru metnini giriniz..." 
                    />
                  )}
                </div>
                
                {/* Açık uçlu soru için cevap alanı */}
                {contentType === 'exam' && q.questionType === 'open' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Beklenen Cevap (Opsiyonel)</label>
                      <KatexEditor
                        value={q.correctAnswer || ''}
                        onChange={(val) => updateCorrectAnswer(qIndex, val)}
                        placeholder="Örnek cevap veya anahtar kelimeler (opsiyonel)..."
                        rows={2}
                      />
                      <p className="text-xs text-slate-400 mt-1">Bu alan sınav değerlendirmesinde referans olarak kullanılır</p>
                    </div>
                  </div>
                ) : (
                  /* Çoktan seçmeli seçenekler */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options && q.options.map((opt, oIndex) => (
                      <div key={oIndex} className={`flex items-center gap-2 p-2 rounded-lg border-2 bg-white ${CONTENT_TYPES[contentType].hasCorrectAnswer && q.correctIndex === oIndex ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-transparent'}`}>
                        {CONTENT_TYPES[contentType].hasCorrectAnswer ? (
                          <input 
                            type="radio" 
                            name={`correct-${qIndex}`} 
                            checked={q.correctIndex === oIndex} 
                            onChange={() => setCorrectOption(qIndex, oIndex)}
                            className="w-5 h-5 accent-emerald-600 cursor-pointer"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">{oIndex + 1}</div>
                        )}
                        {contentType === 'exam' ? (
                          <div className="flex-1">
                            <input 
                              type="text" 
                              value={opt} 
                              onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                              className="w-full p-2 outline-none text-sm font-mono"
                              placeholder={`Seçenek ${oIndex + 1} (KaTeX: $x^2$)`}
                            />
                            {opt && opt.includes('$') && (
                              <div className="text-xs text-slate-500 mt-1 pl-2 border-l-2 border-rose-200">
                                <KatexRenderer text={opt} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <input 
                            type="text" 
                            value={opt} 
                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                            className="w-full p-2 outline-none text-sm"
                            placeholder={`Seçenek ${oIndex + 1}`}
                          />
                        )}
                      </div>
                    ))}
                    {q.options && (
                      <button type="button" onClick={() => addOption(qIndex)} className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-medium">
                        <Plus size={16} /> Seçenek Ekle
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col md:flex-row gap-4 justify-between items-center border-t pt-6">
            {CONTENT_TYPES[contentType].multipleQuestions ? (
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                {contentType === 'exam' ? (
                  <>
                    <button type="button" onClick={() => addQuestion('multiple')} className="py-3 px-6 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                      <Plus size={20} /> 📋 Çoktan Seçmeli
                    </button>
                    <button type="button" onClick={() => addQuestion('open')} className="py-3 px-6 bg-rose-100 text-rose-700 rounded-xl font-bold hover:bg-rose-200 transition-colors flex items-center justify-center gap-2">
                      <Plus size={20} /> ✏️ Açık Uçlu
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => addQuestion()} className="py-3 px-6 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                    <Plus size={20} /> Soru Ekle
                  </button>
                )}
                <button type="button" onClick={() => setShowFileImport(true)} className="py-3 px-6 bg-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-200 transition-colors flex items-center justify-center gap-2">
                  <Upload size={20} /> Dosyadan Yükle
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic">Quiz tek soru içerir</div>
            )}
            <div className="flex gap-4 w-full md:w-auto">
              <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-3 px-6 text-slate-500 hover:bg-slate-50 rounded-xl font-medium">İptal</button>
              <button onClick={handleCreateQuiz} className={`flex-1 py-3 px-8 text-white rounded-xl font-bold shadow-lg transition-all ${contentType === 'exam' ? 'bg-rose-600 hover:bg-rose-700 hover:shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200'}`}>
                {CONTENT_TYPES[contentType].icon} {CONTENT_TYPES[contentType].label} Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6" style={{gridAutoRows: 'minmax(auto, 1fr)'}}>
          {polls.map(poll => {
            const canDeleteThisPoll = isAdmin || poll.creatorEmail === user.email;
            const pollType = poll.type || 'contest';
            const typeConfig = CONTENT_TYPES[pollType] || CONTENT_TYPES.contest;
            
            return (
              <div key={poll.id} className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-slate-300 transition-all flex flex-col h-full group min-h-[220px]">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className={`bg-${typeConfig.color}-50 text-${typeConfig.color}-700 p-2 rounded-lg flex items-center gap-1`}>
                    <span className="text-lg">{typeConfig.icon}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setQrPoll(poll)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="QR Kod"><QrCode size={16} /></button>
                    {canDeleteThisPoll && (
                      <button onClick={() => handleDeletePoll(poll)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Sil">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-${typeConfig.color}-100 text-${typeConfig.color}-700`}>
                    {typeConfig.label}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2 line-clamp-2 text-slate-800">{poll.title || poll.questions?.[0]?.text || "Başlıksız"}</h3>
                <p className="text-sm text-slate-500 mb-4 sm:mb-6 flex items-center gap-2">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold">{poll.questions?.length || 0} Soru</span>
                  {poll.creatorEmail && isAdmin && (
                    <span className="text-xs text-slate-400 truncate max-w-[150px]">• {poll.creatorEmail.split('@')[0]}</span>
                  )}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-2 sm:gap-3">
                  <button onClick={() => onNavigate('presenter', poll.id)} className="col-span-2 py-2 sm:py-2.5 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-slate-800 text-sm"><Users size={16} /> Yönet ve Sun</button>
                  <button onClick={() => copyToClipboard(poll.id)} className="py-2 sm:py-2.5 border border-slate-200 text-slate-600 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 text-xs sm:text-sm"><Copy size={14} /> ID</button>
                  <button onClick={() => onNavigate('voter', poll.id)} className="py-2 sm:py-2.5 border border-slate-200 text-slate-600 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 text-xs sm:text-sm"><Smartphone size={14} /> Test</button>
                </div>
              </div>
            );
          })}
          {polls.length === 0 && <div className="col-span-full py-10 text-center text-slate-400">Henüz yarışma yok.</div>}
        </div>
      )}
    </div>
  );
}

