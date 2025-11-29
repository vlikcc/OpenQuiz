import { useState, useEffect } from 'react';
import { doc, collection, addDoc, setDoc, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { CheckCircle2, XCircle, Loader2, UserCircle, Send } from 'lucide-react';
import { db, appId, CONTENT_TYPES } from '../config/firebase';
import KatexRenderer from './KatexRenderer';

export default function VoterMode({ pollId, onExit, user, showToast }) {
  const [step, setStep] = useState('name'); 
  const [userName, setUserName] = useState('');
  const [poll, setPoll] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(-1);
  
  const [hasVotedForCurrent, setHasVotedForCurrent] = useState(false);
  const [startTime, setStartTime] = useState(Date.now()); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [openAnswer, setOpenAnswer] = useState('');

  useEffect(() => {
    const savedName = localStorage.getItem('voterName');
    if (savedName) setUserName(savedName);
    if (!pollId) return;

    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'polls', pollId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPoll({ id: docSnap.id, ...data });

        if (data.currentQuestionIndex !== currentQIndex) {
          setCurrentQIndex(data.currentQuestionIndex);
          setHasVotedForCurrent(false);
          setLastResult(null);
          setStartTime(Date.now());
        }
      }
    });
  }, [pollId, currentQIndex]);

  const handleStart = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      localStorage.setItem('voterName', userName);
      setStep('vote');
    }
  };

  const handleVote = async (optionIndex) => {
    if (isSubmitting || hasVotedForCurrent) return;
    setIsSubmitting(true);
    
    const currentQuestion = poll.questions[currentQIndex];
    const pollType = poll.type || 'contest';
    const typeConfig = CONTENT_TYPES[pollType] || CONTENT_TYPES.contest;
    
    const isCorrect = typeConfig.hasCorrectAnswer 
      ? optionIndex === currentQuestion.correctOptionIndex 
      : null;
    const responseTime = Date.now() - startTime;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'polls', pollId, 'votes'), {
        questionIndex: currentQIndex,
        optionIndex: optionIndex,
        userId: user.uid,
        userName: userName,
        isCorrect: isCorrect,
        timestamp: serverTimestamp()
      });

      if (typeConfig.hasCorrectAnswer) {
        const scoreRef = doc(db, 'artifacts', appId, 'public', 'data', 'scores', userName);
        await setDoc(scoreRef, {
          score: increment(isCorrect ? 100 : 0),
          totalTime: increment(responseTime)
        }, { merge: true });
      }

      setLastResult(typeConfig.hasCorrectAnswer ? (isCorrect ? 'correct' : 'wrong') : 'voted');
      setHasVotedForCurrent(true);
      setIsSubmitting(false);

    } catch (error) {
      console.error(error);
      if(showToast) showToast("Oy gönderilirken hata oluştu.", "error");
      setIsSubmitting(false);
    }
  };

  // Açık uçlu soru için cevap gönderme
  const handleOpenAnswer = async () => {
    if (isSubmitting || hasVotedForCurrent || !openAnswer.trim()) return;
    setIsSubmitting(true);
    
    const currentQuestion = poll.questions[currentQIndex];
    const responseTime = Date.now() - startTime;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'polls', pollId, 'votes'), {
        questionIndex: currentQIndex,
        questionType: 'open',
        answer: openAnswer.trim(),
        userId: user.uid,
        userName: userName,
        timestamp: serverTimestamp(),
        points: currentQuestion.points || 10 // Değerlendirilecek puan
      });

      setLastResult('submitted');
      setHasVotedForCurrent(true);
      setOpenAnswer('');
      setIsSubmitting(false);

    } catch (error) {
      console.error(error);
      if(showToast) showToast("Cevap gönderilirken hata oluştu.", "error");
      setIsSubmitting(false);
    }
  };

  if (!poll) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

  // İsim Giriş Ekranı
  if (step === 'name') {
    const pollType = poll.type || 'contest';
    const typeConfig = CONTENT_TYPES[pollType] || CONTENT_TYPES.contest;
    
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white max-w-sm w-full p-8 rounded-3xl shadow-xl text-center">
          <div className="text-5xl mb-4">{typeConfig.icon}</div>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 bg-${typeConfig.color}-100 text-${typeConfig.color}-700`}>
            {typeConfig.label}
          </span>
          <h2 className="text-2xl font-bold mb-2">{poll.title}</h2>
          <p className="text-slate-500 text-sm mb-6">{poll.questions?.length || 0} soru</p>
          <form onSubmit={handleStart}>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full p-4 border-2 border-slate-200 rounded-xl mb-4 text-center font-bold text-lg focus:border-indigo-500 outline-none" placeholder="Adınız" required />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg">Katıl</button>
          </form>
        </div>
      </div>
    );
  }

  // Bekleme / Sonuç Ekranı
  if (hasVotedForCurrent) {
    // Anket veya açık uçlu soru
    if (lastResult === 'voted' || lastResult === 'submitted') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white text-center bg-indigo-500">
          <div className="bg-white/20 backdrop-blur-md p-10 rounded-3xl shadow-2xl animate-bounce-in">
            <CheckCircle2 size={64} className="mx-auto mb-4"/>
            <h2 className="text-4xl font-black mb-2">
              {lastResult === 'submitted' ? 'CEVAP GÖNDERİLDİ!' : 'TEŞEKKÜRLER!'}
            </h2>
            <p className="text-xl opacity-90 mb-8">
              {lastResult === 'submitted' ? 'Cevabınız değerlendirilecek' : 'Oyunuz kaydedildi'}
            </p>
            <div className="flex items-center justify-center gap-2 bg-black/20 px-4 py-2 rounded-full text-sm font-medium animate-pulse">
              <Loader2 size={16} className="animate-spin"/> Sonraki soru için bekle...
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-white text-center transition-colors ${lastResult === 'correct' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        <div className="bg-white/20 backdrop-blur-md p-10 rounded-3xl shadow-2xl animate-bounce-in">
          {lastResult === 'correct' ? <CheckCircle2 size={64} className="mx-auto mb-4"/> : <XCircle size={64} className="mx-auto mb-4"/>}
          <h2 className="text-4xl font-black mb-2">{lastResult === 'correct' ? 'DOĞRU!' : 'YANLIŞ'}</h2>
          <p className="text-xl opacity-90 mb-8">{lastResult === 'correct' ? '+100 Puan' : 'Puan alamadın'}</p>
          <div className="flex items-center justify-center gap-2 bg-black/20 px-4 py-2 rounded-full text-sm font-medium animate-pulse">
            <Loader2 size={16} className="animate-spin"/> Sunucu bir sonraki soruya geçene kadar bekle...
          </div>
        </div>
      </div>
    );
  }

  // Oy Verme Ekranı
  const activeQuestion = poll.questions[currentQIndex];
  if (!activeQuestion) return <div className="h-screen flex items-center justify-center">Yarışma sona erdi veya soru yüklenemedi.</div>;

  const pollType = poll.type || 'contest';
  const isExam = pollType === 'exam';
  const isOpenQuestion = activeQuestion.questionType === 'open';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full max-w-2xl mx-auto">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${isExam ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
              SORU {currentQIndex + 1}
            </span>
            {isOpenQuestion && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">
                AÇIK UÇLU
              </span>
            )}
            {isExam && activeQuestion.points && (
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                {activeQuestion.points} Puan
              </span>
            )}
          </div>
          <span className="text-red-500 text-xs font-bold animate-pulse">CANLI</span>
        </div>
        
        {/* Soru metni - KaTeX destekli */}
        <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">
          {isExam && activeQuestion.text.includes('$') ? (
            <KatexRenderer text={activeQuestion.text} />
          ) : (
            activeQuestion.text
          )}
        </div>
      </div>
      
      <div className="flex-1 p-4 sm:p-6 space-y-2 sm:space-y-3">
        {/* Açık uçlu soru */}
        {isOpenQuestion ? (
          <div className="space-y-4">
            <textarea
              value={openAnswer}
              onChange={(e) => setOpenAnswer(e.target.value)}
              placeholder="Cevabınızı buraya yazın..."
              rows={6}
              className="w-full p-4 rounded-xl border-2 border-slate-200 bg-white text-base text-slate-700 focus:border-rose-400 outline-none resize-none"
            />
            
            {/* KaTeX önizleme */}
            {openAnswer && openAnswer.includes('$') && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <div className="text-[10px] uppercase text-rose-400 font-bold mb-2">Formül Önizleme</div>
                <KatexRenderer text={openAnswer} className="text-slate-800" />
              </div>
            )}
            
            <p className="text-xs text-slate-400">
              💡 Matematik formülleri için: $formül$ kullanın (örn: $x^2 + y^2 = z^2$)
            </p>
            
            <button
              onClick={handleOpenAnswer}
              disabled={isSubmitting || !openAnswer.trim()}
              className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
              Cevabı Gönder
            </button>
          </div>
        ) : (
          /* Çoktan seçmeli soru */
          activeQuestion.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={isSubmitting}
              className="w-full p-3 sm:p-4 lg:p-5 rounded-xl border-2 border-slate-200 bg-white text-left font-bold text-base sm:text-lg text-slate-700 hover:border-indigo-500 hover:shadow-lg transition-all active:scale-[0.98]"
            >
              {/* Seçenek metni - KaTeX destekli */}
              {isExam && opt.text.includes('$') ? (
                <KatexRenderer text={opt.text} />
              ) : (
                opt.text
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

