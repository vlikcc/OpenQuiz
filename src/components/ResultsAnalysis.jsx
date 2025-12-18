import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId, CONTENT_TYPES } from '../config/firebase';
import {
  Trophy, Users, CheckCircle2, XCircle, BarChart3,
  Download, FileSpreadsheet, FileText, TrendingUp, Clock, PieChart as PieChartIcon
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts';

const CHART_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6', '#EF4444', '#14B8A6'];

export default function ResultsAnalysis({ poll, pollId, onClose }) {
  const [votes, setVotes] = useState([]);
  const [scores, setScores] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState('bar'); // 'bar', 'pie', 'radar'

  // Oyları dinle
  useEffect(() => {
    if (!pollId) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'polls', pollId, 'votes');
    return onSnapshot(q, (snapshot) => {
      setVotes(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          questionIndex: data.qi ?? data.questionIndex,
          optionIndex: data.oi ?? data.optionIndex,
          selectedIndices: data.ois ?? (data.oi !== undefined ? [data.oi] : [])
        };
      }));
    });
  }, [pollId]);

  // Skorları dinle
  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'scores');
    return onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.score || 0) - (a.score || 0));
      setScores(data);
    });
  }, []);

  const pollType = poll?.type || 'contest';
  const typeConfig = CONTENT_TYPES[pollType] || CONTENT_TYPES.contest;

  // Analiz verileri
  const analytics = useMemo(() => {
    if (!poll || !votes.length) return null;

    const totalParticipants = new Set(votes.map(v => v.userName || v.un)).size;
    const totalVotes = votes.length;

    // Her soru için analiz
    const questionAnalysis = poll.questions.map((q, qIndex) => {
      const questionVotes = votes.filter(v => v.questionIndex === qIndex);
      const totalQ = questionVotes.length; // Toplam katılımcı sayısı (bu soruya cevap veren)

      const optionStats = q.options.map((opt, oIndex) => {
        // Çoklu seçim desteği: ois içinde varsa veya oi ise say
        const optVotes = questionVotes.filter(v => {
          if (v.selectedIndices && v.selectedIndices.includes(oIndex)) return true;
          return v.optionIndex === oIndex;
        }).length;

        return {
          text: opt.text,
          votes: optVotes,
          percentage: totalQ > 0 ? Math.round((optVotes / totalQ) * 100) : 0,
          isCorrect: oIndex === q.correctOptionIndex || (q.correctOptionIndices && q.correctOptionIndices.includes(oIndex))
        };
      });

      const correctVotes = typeConfig.hasCorrectAnswer
        ? questionVotes.filter(v => v.isCorrect).length
        : 0;

      return {
        questionText: q.text,
        totalVotes: totalQ,
        correctVotes,
        correctPercentage: totalQ > 0 ? Math.round((correctVotes / totalQ) * 100) : 0,
        optionStats
      };
    });

    // Katılımcı bazında analiz
    const participantAnalysis = [];
    const participants = new Set(votes.map(v => v.userName || v.un));

    participants.forEach(name => {
      const userVotes = votes.filter(v => v.userName === name);
      const correctAnswers = typeConfig.hasCorrectAnswer
        ? userVotes.filter(v => v.isCorrect).length
        : 0;
      const totalAnswered = userVotes.length;
      const score = scores.find(s => s.id === name)?.score || 0;
      const totalTime = scores.find(s => s.id === name)?.totalTime || 0;

      participantAnalysis.push({
        name,
        totalAnswered,
        correctAnswers,
        wrongAnswers: totalAnswered - correctAnswers,
        accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
        score,
        avgTime: totalAnswered > 0 ? Math.round(totalTime / totalAnswered / 1000) : 0
      });
    });

    participantAnalysis.sort((a, b) => b.score - a.score);

    return {
      totalParticipants,
      totalVotes,
      totalQuestions: poll.questions.length,
      questionAnalysis,
      participantAnalysis,
      overallAccuracy: typeConfig.hasCorrectAnswer && totalVotes > 0
        ? Math.round((votes.filter(v => v.isCorrect).length / totalVotes) * 100)
        : null
    };
  }, [poll, votes, scores, typeConfig]);

  // PDF Export
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Başlık
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229);
    doc.text(poll.title || 'Yarışma Sonuçları', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${typeConfig.label} - ${new Date().toLocaleDateString('tr-TR')}`, pageWidth / 2, 28, { align: 'center' });

    // Özet istatistikler
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Özet', 14, 45);

    doc.setFontSize(10);
    doc.text(`Toplam Katılımcı: ${analytics?.totalParticipants || 0}`, 14, 55);
    doc.text(`Toplam Soru: ${analytics?.totalQuestions || 0}`, 14, 62);
    doc.text(`Toplam Oy: ${analytics?.totalVotes || 0}`, 14, 69);
    if (analytics?.overallAccuracy !== null) {
      doc.text(`Genel Doğruluk: %${analytics.overallAccuracy}`, 14, 76);
    }

    // Katılımcı tablosu
    doc.setFontSize(14);
    doc.text('Katılımcı Sıralaması', 14, 95);

    const participantData = analytics?.participantAnalysis.map((p, i) => [
      i + 1,
      p.name,
      p.score,
      p.correctAnswers,
      p.wrongAnswers,
      `%${p.accuracy}`
    ]) || [];

    doc.autoTable({
      startY: 100,
      head: [['#', 'İsim', 'Puan', 'Doğru', 'Yanlış', 'Başarı']],
      body: participantData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Soru analizleri
    let currentY = doc.lastAutoTable.finalY + 20;

    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(14);
    doc.text('Soru Bazlı Analiz', 14, currentY);
    currentY += 10;

    analytics?.questionAnalysis.forEach((q, i) => {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text(`Soru ${i + 1}: ${q.questionText.substring(0, 60)}...`, 14, currentY);
      currentY += 7;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Cevap: ${q.totalVotes} | Doğru: %${q.correctPercentage}`, 14, currentY);
      currentY += 12;
    });

    doc.save(`${poll.title || 'yarisma'}-sonuclar.pdf`);
  };

  // Excel Export
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Özet Sayfası (Genel)
    const summaryHeader = [['Yarışma Başlığı', poll.title], ['Tür', typeConfig.label], ['Tarih', new Date().toLocaleDateString('tr-TR')]];
    const summaryStats = [
      ['Toplam Katılımcı', analytics?.totalParticipants],
      ['Toplam Soru', analytics?.totalQuestions],
      ['Toplam Oy', analytics?.totalVotes],
      ['Genel Doğruluk', analytics?.overallAccuracy ? `%${analytics.overallAccuracy}` : '-']
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet([...summaryHeader, [], ...summaryStats]);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Genel Özet');

    // 2. Katılımcılar Sayfası
    if (analytics?.participantAnalysis) {
      const participantHeaders = ['Sıra', 'İsim', 'Puan', 'Doğru', 'Yanlış', 'Başarı %', 'Ort. Süre (sn)'];
      const participantData = analytics.participantAnalysis.map((p, i) => [
        i + 1, p.name, p.score, p.correctAnswers, p.wrongAnswers, p.accuracy, p.avgTime
      ]);
      const participantWs = XLSX.utils.aoa_to_sheet([participantHeaders, ...participantData]);
      XLSX.utils.book_append_sheet(wb, participantWs, 'Katılımcılar');
    }

    // 3. Soru Analizi Sayfası
    const questionDataCalc = poll.questions.map((q, i) => {
      const qVotes = votes.filter(v => v.questionIndex === i);
      const row = {
        'Soru No': i + 1,
        'Soru': q.text,
        'Tip': q.questionType === 'open' ? 'Açık Uçlu' : 'Çoktan Seçmeli',
        'Katılım': qVotes.length + ' kişi'
      };

      if (q.questionType === 'open') {
        const answers = qVotes.map(v => v.answer).filter(Boolean);
        row['Cevaplar'] = answers.join(', ');
      } else {
        q.options.forEach((opt, oIndex) => {
          const count = qVotes.filter(v => v.ois ? v.ois.includes(oIndex) : v.oi === oIndex).length;
          const percentage = qVotes.length ? Math.round((count / qVotes.length) * 100) : 0;
          row[`Seçenek ${oIndex + 1} (${opt.text || opt})`] = `${count} (${percentage}%)`;
        });
      }
      return row;
    });
    const questionsWs = XLSX.utils.json_to_sheet(questionDataCalc);
    XLSX.utils.book_append_sheet(wb, questionsWs, 'Soru Detayları');

    // 4. Detaylı Cevaplar Sayfası (Raw Data)
    const activeQuestions = poll.questions;
    const detailData = votes.map(vote => {
      const question = activeQuestions[vote.questionIndex];
      let userAnswer = "";

      if (question.questionType === 'open') {
        userAnswer = vote.answer;
      } else {
        if (vote.ois && vote.ois.length > 0) {
          userAnswer = vote.ois.map(idx => {
            const opt = question.options[idx];
            return typeof opt === 'object' ? opt.text : opt;
          }).join(', ');
        } else if (vote.oi !== undefined) {
          const opt = question.options[vote.oi];
          userAnswer = typeof opt === 'object' ? opt.text : opt;
        }
      }

      const isCorrect = question.questionType === 'multiple' && typeConfig.hasCorrectAnswer
        ? (vote.ois ? vote.ois.includes(question.correctOptionIndex) && vote.ois.length === 1 : vote.oi === question.correctOptionIndex)
        : null;

      return {
        'Kullanıcı': vote.rawName || vote.userName || 'Anonim',
        'Soru No': vote.questionIndex + 1,
        'Soru Metni': question.text,
        'Verilen Cevap': userAnswer,
        'Doğru mu?': isCorrect === true ? 'Evet' : (isCorrect === false ? 'Hayır' : '-'),
        'Puan': vote.points || 0,
        'Tarih': vote.timestamp?.toDate ? vote.timestamp.toDate().toLocaleString() : new Date().toLocaleString()
      };
    }).sort((a, b) => a['Soru No'] - b['Soru No']);

    const detailWs = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailWs, 'Tüm Cevaplar (Ham Veri)');

    // İndir
    XLSX.writeFile(wb, `${poll.title || 'Anket'}_Detayli_Sonuclar.xlsx`);
  };

  if (!poll || !analytics) {
    return (
      <div className="p-8 text-center text-slate-500">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
        <p>Henüz veri yok</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{typeConfig.icon}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">{typeConfig.label}</span>
            </div>
            <h2 className="text-2xl font-bold">{poll.title}</h2>
            <p className="text-white/70 text-sm mt-1">{poll.questions.length} soru • {analytics.totalParticipants} katılımcı</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportPDF} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
              <FileText size={16} /> PDF
            </button>
            <button onClick={exportExcel} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
              <FileSpreadsheet size={16} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 px-6">
        <div className="flex gap-4">
          {['overview', 'questions', 'participants'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab === 'overview' && 'Genel Bakış'}
              {tab === 'questions' && 'Soru Analizi'}
              {tab === 'participants' && 'Katılımcılar'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 rounded-xl p-4">
                <Users size={24} className="text-indigo-600 mb-2" />
                <div className="text-2xl font-bold text-slate-900">{analytics.totalParticipants}</div>
                <div className="text-sm text-slate-500">Katılımcı</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <CheckCircle2 size={24} className="text-emerald-600 mb-2" />
                <div className="text-2xl font-bold text-slate-900">{analytics.totalVotes}</div>
                <div className="text-sm text-slate-500">Toplam Cevap</div>
              </div>
              {analytics.overallAccuracy !== null && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <TrendingUp size={24} className="text-amber-600 mb-2" />
                  <div className="text-2xl font-bold text-slate-900">%{analytics.overallAccuracy}</div>
                  <div className="text-sm text-slate-500">Doğruluk</div>
                </div>
              )}
              <div className="bg-purple-50 rounded-xl p-4">
                <BarChart3 size={24} className="text-purple-600 mb-2" />
                <div className="text-2xl font-bold text-slate-900">{analytics.totalQuestions}</div>
                <div className="text-sm text-slate-500">Soru</div>
              </div>
            </div>

            {/* Top 5 Leaderboard */}
            <div className="bg-slate-50 rounded-xl p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Trophy className="text-amber-500" size={20} />
                En İyi 5 Katılımcı
              </h3>
              <div className="space-y-3">
                {analytics.participantAnalysis.slice(0, 5).map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700' : 'bg-slate-300'
                        }`}>
                        {i + 1}
                      </div>
                      <span className="font-medium text-slate-800">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-600 text-sm">{p.correctAnswers} doğru</span>
                      <span className="font-bold text-indigo-600">{p.score} puan</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            {/* Grafik Türü Seçici */}
            <div className="flex items-center justify-end gap-2 mb-4">
              <span className="text-sm text-slate-500">Grafik:</span>
              <div className="bg-slate-100 p-1 rounded-lg flex">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${chartType === 'bar' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  Çubuk
                </button>
                <button
                  onClick={() => setChartType('pie')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${chartType === 'pie' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  Pasta
                </button>
                <button
                  onClick={() => setChartType('radar')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${chartType === 'radar' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  Radar
                </button>
              </div>
            </div>

            {analytics.questionAnalysis.map((q, i) => {
              // Grafik verisini hazırla
              const chartData = q.optionStats.map((opt, idx) => ({
                name: opt.text.length > 15 ? opt.text.substring(0, 15) + '...' : opt.text,
                fullName: opt.text,
                value: opt.votes,
                percentage: opt.percentage,
                isCorrect: opt.isCorrect,
                fill: opt.isCorrect ? '#10B981' : CHART_COLORS[idx % CHART_COLORS.length]
              }));

              return (
                <div key={i} className="bg-slate-50 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">Soru {i + 1}</span>
                      <h4 className="font-medium text-slate-800 mt-2">{q.questionText}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">{q.totalVotes}</div>
                      <div className="text-xs text-slate-500">cevap</div>
                    </div>
                  </div>

                  {/* Grafik */}
                  <div className="bg-white rounded-xl p-4 mb-4">
                    <ResponsiveContainer width="100%" height={250}>
                      {chartType === 'pie' ? (
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percentage }) => `${name} (${percentage}%)`}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name, props) => [`${value} oy (${props.payload.percentage}%)`, props.payload.fullName]} />
                          <Legend />
                        </PieChart>
                      ) : chartType === 'radar' ? (
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
                          <Radar name="Oy" dataKey="value" stroke="#6366F1" fill="#6366F1" fillOpacity={0.6} />
                          <Tooltip formatter={(value) => [`${value} oy`, 'Oy Sayısı']} />
                        </RadarChart>
                      ) : (
                        <BarChart data={chartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value, name, props) => [`${value} oy (${props.payload.percentage}%)`, 'Oy']} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Seçenek Listesi */}
                  <div className="space-y-2">
                    {q.optionStats.map((opt, j) => (
                      <div key={j} className="relative">
                        <div className={`flex items-center justify-between p-3 rounded-lg ${opt.isCorrect ? 'bg-emerald-100 border border-emerald-200' : 'bg-white border border-slate-200'
                          }`}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: opt.isCorrect ? '#10B981' : CHART_COLORS[j % CHART_COLORS.length] }}
                            />
                            {opt.isCorrect && <CheckCircle2 size={16} className="text-emerald-600" />}
                            <span className={opt.isCorrect ? 'text-emerald-800 font-medium' : 'text-slate-700'}>{opt.text}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">{opt.votes} oy</span>
                            <span className={`font-bold ${opt.isCorrect ? 'text-emerald-600' : 'text-slate-600'}`}>%{opt.percentage}</span>
                          </div>
                        </div>
                        <div
                          className={`absolute bottom-0 left-0 h-1 rounded-b-lg ${opt.isCorrect ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                          style={{ width: `${opt.percentage}%` }}
                        />
                      </div>
                    ))}
                  </div>

                  {typeConfig.hasCorrectAnswer && (
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-sm text-slate-500">Doğru cevaplayan</span>
                      <span className={`font-bold ${q.correctPercentage >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        %{q.correctPercentage}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === 'participants' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">#</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">İsim</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Puan</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Doğru</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Yanlış</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Başarı</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Ort. Süre</th>
                </tr>
              </thead>
              <tbody>
                {analytics.participantAnalysis.map((p, i) => (
                  <tr key={p.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{p.name}</td>
                    <td className="py-3 px-4 text-center font-bold text-indigo-600">{p.score}</td>
                    <td className="py-3 px-4 text-center text-emerald-600">{p.correctAnswers}</td>
                    <td className="py-3 px-4 text-center text-rose-600">{p.wrongAnswers}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.accuracy >= 70 ? 'bg-emerald-100 text-emerald-700' :
                        p.accuracy >= 40 ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                        %{p.accuracy}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500">{p.avgTime}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

