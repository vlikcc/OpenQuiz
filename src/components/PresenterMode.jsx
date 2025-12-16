import { useRef, useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { doc, collection, onSnapshot, updateDoc, query, where, limit, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { Home, QrCode, Users, Trophy, Loader2, ChevronRight, ChevronLeft, BarChart3, MessageSquare, RefreshCw, Heart, ThumbsUp, PartyPopper, Smile } from 'lucide-react';
import { db, appId, COLORS, CONTENT_TYPES } from '../config/firebase';
import QrModal from './QrModal';
import KatexRenderer from './KatexRenderer';
import { throttle } from '../utils/performanceUtils';

const ResultsAnalysis = lazy(() => import('./ResultsAnalysis'));

export default function PresenterMode({ pollId, onExit, onSwitchToVoter, showToast }) {
  const [poll, setPoll] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('chart');
  const [showQr, setShowQr] = useState(false);
  const [votes, setVotes] = useState([]);
  const [openAnswers, setOpenAnswers] = useState([]);
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // Varsayılan sayaç
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [floatingReaction, setFloatingReaction] = useState([]); // {id, emoji, x, y}

  // Listener unsubscribe ref'leri
  const votesUnsubRef = useRef(null);
  const openAnswersUnsubRef = useRef(null);
  const reactionsUnsubRef = useRef(null);

  // Poll dinleyici - ana veri kaynağı
  useEffect(() => {
    if (!pollId) return;

    const pollRef = doc(db, 'artifacts', appId, 'public', 'data', 'polls', pollId);

    return onSnapshot(pollRef, (docSnap) => {
      if (docSnap.exists()) {
        setPoll({ id: docSnap.id, ...docSnap.data() });
      } else {
        showToast("Yarışma bulunamadı", "error");
        onExit();
      }
    }, (error) => {
      console.error('Poll listener error:', error);
      showToast("Bağlantı hatası", "error");
    });
  }, [pollId, showToast, onExit]);

  // Votes dinleyici - sadece gerektiğinde ve optimize edilmiş
  useEffect(() => {
    if (!pollId || !poll) return;

    // Önceki listener'ı temizle
    if (votesUnsubRef.current) {
      votesUnsubRef.current();
    }

    const currentQIndex = poll.currentQuestionIndex || 0;
    const currentQuestion = poll.questions[currentQIndex];

    // Açık uçlu soru değilse ve aggregated data varsa, votes dinlemeye gerek yok
    if (currentQuestion?.questionType !== 'open' && poll.voteCounts) {
      return;
    }

    // Sadece mevcut soru için oyları dinle
    const votesRef = collection(db, 'artifacts', appId, 'public', 'data', 'polls', pollId, 'votes');

    // Throttled update fonksiyonu
    const throttledSetVotes = throttle((votesData) => {
      setVotes(votesData);
    }, 500);

    const unsubscribe = onSnapshot(votesRef, (snapshot) => {
      const votesData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Yeni ve eski format uyumluluğu
        return {
          questionIndex: data.qi ?? data.questionIndex,
          optionIndex: data.oi ?? data.optionIndex,
          selectedIndices: data.ois ?? (data.oi !== undefined ? [data.oi] : []), // Çoklu seçim desteği
          userId: data.uid ?? data.userId,
          userName: data.un ?? data.userName,
          isCorrect: data.c ?? data.isCorrect,
          questionType: data.qt ?? data.questionType,
          answer: data.ans ?? data.answer,
          timestamp: data.ts ?? data.timestamp
        };
      });
      throttledSetVotes(votesData);
    }, (error) => {
      console.error('Votes listener error:', error);
    });

    votesUnsubRef.current = unsubscribe;

    return () => {
      if (votesUnsubRef.current) {
        votesUnsubRef.current();
      }
    };
  }, [pollId, poll?.currentQuestionIndex]);

  // Soru değiştiğinde sayaç ve leaderboard'u sıfırla
  useEffect(() => {
    if (!poll) return;
    const currentQIndex = poll.currentQuestionIndex || 0;
    const currentQ = poll.questions[currentQIndex];
    if (currentQ) {
      setLeaderboard([]); // Yeni soruya geçince leaderboard'u geçici gizle
      setIsTimerRunning(true);
      setTimeLeft(currentQ.timeLimit || 30);
    }
  }, [poll, poll?.currentQuestionIndex]);

  // Sayaç Mantığı
  useEffect(() => {
    let interval;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
      // Süre bitince yapılacaklar (Opsiyonel: otomatik oylamayı kapat?)
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Açık uçlu cevapları ayrı dinle - sadece açık uçlu soruda
  useEffect(() => {
    if (!pollId || !poll) return;

    const currentQIndex = poll.currentQuestionIndex || 0;
    const currentQuestion = poll.questions[currentQIndex];

    if (currentQuestion?.questionType !== 'open') {
      setOpenAnswers([]);
      return;
    }

    setIsLoadingAnswers(true);

    const votesRef = collection(db, 'artifacts', appId, 'public', 'data', 'polls', pollId, 'votes');

    const unsubscribe = onSnapshot(votesRef, (snapshot) => {
      const answers = snapshot.docs
        .map(doc => {
          const data = doc.data();
          const qIndex = data.qi ?? data.questionIndex;
          const qType = data.qt ?? data.questionType;

          if (qIndex !== currentQIndex || qType !== 'open') return null;

          return {
            userName: data.un ?? data.userName,
            answer: data.ans ?? data.answer,
            timestamp: data.ts ?? data.timestamp
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

      setOpenAnswers(answers);
      setIsLoadingAnswers(false);
    });

    openAnswersUnsubRef.current = unsubscribe;

    return () => {
      if (openAnswersUnsubRef.current) {
        openAnswersUnsubRef.current();
      }
    };
  }, [pollId, poll?.currentQuestionIndex]);

  // Canlı Reaksiyonları Dinle
  useEffect(() => {
    if (!pollId) return;

    if (reactionsUnsubRef.current) {
      reactionsUnsubRef.current();
    }

    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'polls', pollId, 'reactions'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    // Sadece yeni gelenleri yakalamak zor, ama snapshot her değişimde tetiklenir.
    // Biz burada sadece UI efekti göstereceğiz.
    reactionsUnsubRef.current = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Animasyon ekle
          const id = Math.random().toString(36).substr(2, 9);
          setFloatingReaction(prev => [...prev, {
            id,
            emoji: data.emoji || '❤️',
            x: Math.random() * 80 + 10 // %10-%90 arası rastgele x
          }]);

          // 2sn sonra temizle
          setTimeout(() => {
            setFloatingReaction(prev => prev.filter(r => r.id !== id));
          }, 2000);
        }
      });
    });

    return () => {
      if (reactionsUnsubRef.current) reactionsUnsubRef.current();
    }
  }, [pollId]);

  // Leaderboard dinleyici - throttled
  useEffect(() => {
    const scoresRef = collection(db, 'artifacts', appId, 'public', 'data', 'scores');

    const throttledSetLeaderboard = throttle((scores) => {
      setLeaderboard(scores);
    }, 1000);

    return onSnapshot(scoresRef, (snapshot) => {
      let scores = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      scores.sort((a, b) => (b.score || 0) - (a.score || 0) || (a.totalTime || 0) - (b.totalTime || 0));
      throttledSetLeaderboard(scores.slice(0, 50)); // İlk 50 kişi
    });
  }, []);

  const changeQuestion = useCallback(async (direction) => {
    if (!poll) return;
    const newIndex = poll.currentQuestionIndex + direction;
    if (newIndex >= 0 && newIndex < poll.questions.length) {
      const pollRef = doc(db, 'artifacts', appId, 'public', 'data', 'polls', pollId);
      await updateDoc(pollRef, { currentQuestionIndex: newIndex });
    }
  }, [poll, pollId]);

  // Seçenekleri hesapla - önce aggregated data, yoksa votes'tan hesapla
  const currentOptions = useMemo(() => {
    if (!poll) return [];
    const currentQIndex = poll.currentQuestionIndex || 0;
    const currentQuestion = poll.questions[currentQIndex];

    if (!currentQuestion.options) return [];

    const calculatedOptions = currentQuestion.options.map((opt, idx) => ({
      ...opt,
      votes: 0
    }));

    // Önce aggregated data kontrol et
    const qKey = `q${currentQIndex}`;
    if (poll.voteCounts && poll.voteCounts[qKey]) {
      const qVotes = poll.voteCounts[qKey];
      calculatedOptions.forEach((opt, idx) => {
        opt.votes = qVotes[`o${idx}`] || 0;
      });
    } else {
      // Fallback: votes array'den hesapla
      votes.forEach(vote => {
        if (vote.questionIndex === currentQIndex) {
          if (vote.selectedIndices && vote.selectedIndices.length > 0) {
            vote.selectedIndices.forEach(idx => {
              if (calculatedOptions[idx]) calculatedOptions[idx].votes += 1;
            });
          } else if (vote.optionIndex !== undefined && calculatedOptions[vote.optionIndex]) {
            calculatedOptions[vote.optionIndex].votes += 1;
          }
        }
      });
    }

    return calculatedOptions;
  }, [poll, votes]);

  // Toplam oy sayısı
  const totalVotes = useMemo(() => {
    if (!poll) return 0;
    const currentQIndex = poll.currentQuestionIndex || 0;
    const qKey = `q${currentQIndex}`;

    // Aggregated data varsa oradan al
    if (poll.voteCounts && poll.voteCounts[qKey]) {
      return poll.voteCounts[qKey].total || 0;
    }

    // Fallback
    return currentOptions.reduce((acc, c) => acc + (c.votes || 0), 0);
  }, [poll, currentOptions]);

  if (!poll) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const currentQIndex = poll.currentQuestionIndex || 0;
  const currentQuestion = poll.questions[currentQIndex];
  const isLastQuestion = currentQIndex === poll.questions.length - 1;
  const pollType = poll.type || 'contest';
  const isSurvey = pollType === 'survey';
  const isExam = pollType === 'exam';
  const isOpenQuestion = currentQuestion?.questionType === 'open';
  const typeConfig = CONTENT_TYPES[pollType] || CONTENT_TYPES.contest;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {showQr && <QrModal pollId={pollId} title={poll.title} onClose={() => setShowQr(false)} />}

      <div className="bg-white border-b px-3 sm:px-4 lg:px-6 py-2 sm:py-3 flex flex-wrap sm:flex-nowrap justify-between items-center shadow-sm z-20 gap-2">
        <div className="flex gap-2 sm:gap-4 order-1">
          <button onClick={onExit} className="flex items-center gap-1 sm:gap-2 text-slate-500 hover:text-slate-800 text-xs sm:text-sm"><Home size={16} /> <span className="hidden sm:inline">Çıkış</span></button>
          <button onClick={() => setShowQr(true)} className="flex items-center gap-1 sm:gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm"><QrCode size={16} /> <span className="hidden sm:inline">QR Kod</span></button>
        </div>

        <div className="bg-slate-100 p-0.5 sm:p-1 rounded-lg flex shadow-inner order-3 sm:order-2 w-full sm:w-auto justify-center mt-2 sm:mt-0">
          <button onClick={() => setActiveTab('chart')} className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-bold transition ${activeTab === 'chart' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Soru {currentQIndex + 1}/{poll.questions.length}</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-bold transition ${activeTab === 'leaderboard' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Liderlik</button>
          <button onClick={() => setActiveTab('results')} className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-bold transition flex items-center gap-1 ${activeTab === 'results' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>
            <BarChart3 size={14} /> <span className="hidden sm:inline">Analiz</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 order-2 sm:order-3">
          <div className="bg-blue-50 text-blue-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-1 sm:gap-2 border border-blue-100">
            <Users size={12} /> {isOpenQuestion ? openAnswers.length : totalVotes}
          </div>
          <button onClick={onSwitchToVoter} className="hidden lg:flex bg-indigo-50 text-indigo-600 px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold hover:bg-indigo-100">Test Et</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none"></div>
        {/* Reaksiyon Animasyonları */}
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {floatingReaction.map(r => (
            <div
              key={r.id}
              className="absolute bottom-0 text-4xl animate-float-up opacity-0"
              style={{ left: `${r.x}%`, animationDuration: '2s' }}
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Stil: animate-float-up (global.css'de yoksa inline ekleyelim veya tailwind extend gerekebilir) */}
        <style>{`
        @keyframes float-up {
           0% { transform: translateY(0) scale(0.5); opacity: 0; }
           10% { opacity: 1; transform: translateY(-20px) scale(1.2); }
           100% { transform: translateY(-400px) scale(1); opacity: 0; }
        }
        .animate-float-up {
           animation-name: float-up;
           animation-timing-function: ease-out;
        }
      `}</style>

        {activeTab === 'chart' && (
          <div className="flex-1 flex flex-col items-center justify-center w-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {/* Type badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{typeConfig.icon}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-bold bg-${typeConfig.color}-100 text-${typeConfig.color}-700`}>
                {typeConfig.label}
              </span>
              {isOpenQuestion && (
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-bold">
                  Açık Uçlu
                </span>
              )}
              {isExam && currentQuestion.points && (
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold">
                  {currentQuestion.points} Puan
                </span>
              )}
            </div>

            {/* Soru İçeriği (Görsel ve Metin) */}
            <div className="flex flex-col items-center justify-center relative w-full mb-4">
              {/* Soru Görseli */}
              {currentQuestion.image && (
                <div className="mb-6 max-h-[30vh]">
                  <img src={currentQuestion.image} alt="Soru görseli" className="max-h-full rounded-xl shadow-lg object-contain mx-auto border-4 border-white" />
                </div>
              )}

              {/* Soru Metni */}
              <h2 className="text-xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-slate-900 text-center mb-4 sm:mb-6 lg:mb-8 max-w-[95%] lg:max-w-[85%] leading-tight">
                {isExam && currentQuestion.text.includes('$') ? (
                  <KatexRenderer text={currentQuestion.text} />
                ) : (
                  currentQuestion.text
                )}
              </h2>

              {/* Sayaç */}
              <div className={`absolute top-0 right-0 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full font-mono text-2xl font-bold border border-white/30 ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                ⏱ {timeLeft}s
              </div>
            </div>

            {/* Açık uçlu soru için cevaplar */}
            {isOpenQuestion && (
              <div className="w-full max-w-4xl mb-6">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                  <div className="bg-rose-50 p-4 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="text-rose-600" size={20} />
                      <h3 className="font-bold text-slate-800">Gelen Cevaplar</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLoadingAnswers && <RefreshCw size={14} className="animate-spin text-rose-400" />}
                      <span className="bg-rose-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {openAnswers.length} cevap
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[40vh] overflow-y-auto divide-y divide-slate-100">
                    {openAnswers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                        <p>Henüz cevap gelmedi</p>
                      </div>
                    ) : (
                      openAnswers.map((ans, i) => (
                        <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-sm font-bold text-slate-800 mb-1">{ans.userName}</div>
                              <div className="text-slate-600">
                                {ans.answer?.includes?.('$') ? (
                                  <KatexRenderer text={ans.answer} />
                                ) : (
                                  ans.answer
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              {ans.timestamp?.toDate?.()?.toLocaleTimeString?.('tr-TR', { hour: '2-digit', minute: '2-digit' }) || ''}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Anket için oy sayıları kartları */}
            {isSurvey && !isOpenQuestion && (
              <div className="w-full max-w-4xl mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentOptions.map((opt, index) => {
                  const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                  return (
                    <div
                      key={index}
                      className="relative bg-white rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-5 overflow-hidden"
                    >
                      {/* Progress bar background */}
                      <div
                        className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                        style={{
                          height: `${percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                          opacity: 0.15
                        }}
                      />

                      <div className="relative z-10">
                        <div className="text-4xl sm:text-5xl font-black mb-2" style={{ color: COLORS[index % COLORS.length] }}>
                          {opt.votes}
                        </div>
                        <div className="text-sm font-medium text-slate-600 mb-1 line-clamp-2">{opt.text}</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                            %{percentage}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grafik - Açık uçlu sorularda gösterme */}
            {!isOpenQuestion && (
              <div className={`w-full ${isSurvey ? 'h-[30vh] max-w-4xl' : 'h-[40vh] sm:h-[45vh] lg:h-[50vh] max-w-[95%] lg:max-w-[90%] xl:max-w-[85%]'} bg-white/80 backdrop-blur-sm p-3 sm:p-4 lg:p-6 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/50`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentOptions} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="text" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} interval={0} />
                    <Bar dataKey="votes" radius={[8, 8, 0, 0]} animationDuration={500} label={isSurvey ? { position: 'top', fill: '#475569', fontWeight: 'bold', fontSize: 14 } : false}>
                      {currentOptions.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={isSurvey ? COLORS[index % COLORS.length] : (index === currentQuestion.correctOptionIndex ? '#10B981' : COLORS[index % COLORS.length])} opacity={isSurvey ? 0.85 : (index === currentQuestion.correctOptionIndex ? 1 : 0.65)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Toplam oy/cevap bilgisi */}
            {(isSurvey || isOpenQuestion) && (
              <div className="mt-6 text-center">
                <span className={`${isOpenQuestion ? 'bg-rose-600' : 'bg-slate-900'} text-white px-6 py-3 rounded-full font-bold text-lg`}>
                  {isOpenQuestion ? `✏️ ${openAnswers.length} cevap` : `📊 Toplam ${totalVotes} oy`}
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col items-center overflow-y-auto">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-4 sm:p-6 bg-yellow-50 text-center border-b border-yellow-100">
                <Trophy size={40} className="mx-auto text-yellow-600 mb-2" />
                <h2 className="text-xl sm:text-2xl font-black text-slate-800">Genel Puan Durumu</h2>
              </div>
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Henüz skor yok
                </div>
              ) : (
                leaderboard.map((p, i) => (
                  <div key={p.id} className="flex justify-between p-3 sm:p-4 border-b border-slate-50 hover:bg-slate-50">
                    <div className="flex gap-2 sm:gap-3 font-bold text-slate-700 text-sm sm:text-base">
                      <span className={i < 3 ? 'text-yellow-600' : ''}>#{i + 1}</span>
                      <span>{p.id}</span>
                    </div>
                    <div className="font-mono text-indigo-600 font-bold text-sm sm:text-base">{p.score || 0} Puan</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>}>
              <ResultsAnalysis poll={poll} pollId={pollId} onClose={() => setActiveTab('chart')} />
            </Suspense>
          </div>
        )}
      </div>

      <div className="bg-slate-900 p-3 sm:p-4 flex justify-between items-center z-30 gap-2">
        <button onClick={() => changeQuestion(-1)} disabled={currentQIndex === 0} className="px-3 sm:px-6 py-2 sm:py-3 bg-slate-800 text-white rounded-lg sm:rounded-xl font-bold flex items-center gap-1 sm:gap-2 hover:bg-slate-700 disabled:opacity-50 text-xs sm:text-sm">
          <ChevronLeft size={16} /> <span className="hidden sm:inline">Önceki</span>
        </button>

        <div className="text-slate-400 font-mono text-xs sm:text-sm">
          {currentQIndex + 1} / {poll.questions.length}
        </div>

        <button onClick={() => changeQuestion(1)} disabled={isLastQuestion} className="px-3 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg sm:rounded-xl font-bold flex items-center gap-1 sm:gap-2 hover:bg-indigo-700 disabled:bg-slate-800 disabled:opacity-50 text-xs sm:text-sm">
          <span className="hidden sm:inline">{isLastQuestion ? "Yarışma Sonu" : "Sonraki"}</span>
          <span className="sm:hidden">{isLastQuestion ? "Son" : "İleri"}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
