import { Suspense, lazy, useState } from 'react';
import { Plus, Trash2, XCircle, Upload, BookOpen, Image as ImageIcon, Timer, Lock, BookMarked } from 'lucide-react';
import { CONTENT_TYPES, POLL_TYPE_VALUE, QUESTION_TYPE_VALUE, QUESTION_TYPE_KEY } from '../config/constants';
import { EntitlementKeys } from '../config/entitlementKeys';
import { pollService } from '../services/pollService';
import { mediaService } from '../services/mediaService';
import { draftToBankRequest, questionBankService } from '../services/questionBankService';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../hooks/useEntitlements';
import KatexText, { KatexTextEditor } from './KatexText';
import { KATEX_EXAMPLES } from '../config/katexExamples';
import { DEFAULT_MODERATION, parseModeration, toWordCloudConfig } from '../utils/wordCloudSettings';
import WordCloudModeration from './wordcloud/WordCloudModeration';
import QuestionBankPanel from './QuestionBankPanel';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Carries the spreadsheet and Word parsers, and most polls are typed by hand.
const FileImport = lazy(() => import('./FileImport'));

const GATED_CONTENT_TYPES = {
  exam: EntitlementKeys.ContentExam,
  wordcloud: EntitlementKeys.ContentWordCloud,
};

const FEATURE_LOCKED_I18N = {
  [EntitlementKeys.ContentExam]: 'billing.featureLockedContentExam',
  [EntitlementKeys.ContentWordCloud]: 'billing.featureLockedContentWordcloud',
};

const blankMultiple = () => ({ text: '', options: ['', ''], correctIndex: 0, questionType: 'multiple', correctAnswer: '', image: '', timeLimit: 30 });
const blankOpen = () => ({ text: '', questionType: 'open', correctAnswer: '', points: 10, image: '', timeLimit: 30 });
const blankWordCloud = () => ({
  text: '', questionType: 'wordcloud', image: '', timeLimit: 60, maxWords: 3,
  moderation: { ...DEFAULT_MODERATION },
});

const blankFor = (contentType) => {
  const questionType = CONTENT_TYPES[contentType].questionType;
  if (questionType === 'open') return blankOpen();
  if (questionType === 'wordcloud') return blankWordCloud();
  return blankMultiple();
};

const draftFromPoll = (poll) => {
  const questions = (poll.questions || []).map((q) => {
    const qt = QUESTION_TYPE_KEY[q.questionType] || 'multiple';
    if (qt === 'open') return { text: q.text, questionType: 'open', correctAnswer: q.correctAnswer || '', points: q.points || 10, image: q.imageUrl || '', timeLimit: q.timeLimit || 30 };
    if (qt === 'wordcloud') return { text: q.text, questionType: 'wordcloud', image: q.imageUrl || '', timeLimit: q.timeLimit || 60, maxWords: q.maxWords || 3, moderation: parseModeration(q.wordCloudConfig) };
    return {
      text: q.text,
      questionType: 'multiple',
      allowMultiple: q.allowMultiple || false,
      options: (q.options || []).map((o) => o.text),
      correctIndex: q.correctOptionIndex ?? 0,
      points: q.points || 10,
      image: q.imageUrl || '',
      timeLimit: q.timeLimit || 30,
    };
  });
  return questions.length ? questions : [blankMultiple()];
};

/**
 * The draft lives here rather than in the dashboard so that closing the editor
 * unmounts it and throws the draft away. Callers give the element a key that
 * changes whenever a different poll (or a different type) is being composed.
 */
export default function PollForm({ contentType, poll = null, showToast, onCancel, onSaved }) {
  const { t } = useTranslation();
  const { can } = useEntitlements();
  const [quizTitle, setQuizTitle] = useState(poll?.title ?? '');
  const [questions, setQuestions] = useState(() => (poll ? draftFromPoll(poll) : [blankFor(contentType)]));
  const [showKatexHelp, setShowKatexHelp] = useState(false);
  const [showFileImport, setShowFileImport] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState(() => toLocalInput(poll?.scheduledStartAt));
  const [collabEmail, setCollabEmail] = useState('');
  const [collaborators, setCollaborators] = useState(poll?.collaborators || []);

  const typeConfig = CONTENT_TYPES[contentType];
  const ct = (key) => t(`contentTypes.${key}.label`);
  const featureKey = GATED_CONTENT_TYPES[contentType];

  if (!poll && featureKey && !can(featureKey)) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-indigo-50 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock size={26} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">{t('billing.featureLockedTitle')}</h2>
        <p className="text-slate-500 mb-6">{t(FEATURE_LOCKED_I18N[featureKey])}</p>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold">
          {t('common.close')}
        </button>
      </div>
    );
  }

  const handleImportQuestions = async (importedQuestions, { saveToBank } = {}) => {
    const mapped = importedQuestions.map((q) => ({
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex || 0,
      questionType: 'multiple',
      image: '',
      timeLimit: 30,
    }));
    setQuestions(mapped);
    showToast(t('dashboard.importedQuestions', { count: importedQuestions.length }));
    if (saveToBank) {
      try {
        for (const q of mapped) await questionBankService.create(draftToBankRequest(q));
        showToast(t('session.savedToBank'));
      } catch (err) {
        showToast(err.message || t('common.errorOccurred'), 'error');
      }
    }
  };

  const addFromBank = (draft) => {
    setQuestions((qs) => [...qs, draft]);
    setShowBank(false);
  };

  const saveQuestionToBank = async (q) => {
    try {
      await questionBankService.create(draftToBankRequest(q));
      showToast(t('session.savedToBank'));
    } catch (err) {
      showToast(err.message || t('common.errorOccurred'), 'error');
    }
  };

  const uploadQuestionImage = async (qIndex, file) => {
    if (!file) return;
    try {
      const saved = await mediaService.upload(file);
      updateField(qIndex, 'image', saved.url);
    } catch (err) {
      showToast(err.message || t('common.errorOccurred'), 'error');
    }
  };

  const addCollaborator = async () => {
    if (!poll?.id || !collabEmail.trim()) return;
    try {
      const row = await pollService.addCollaborator(poll.id, collabEmail.trim());
      setCollaborators((rows) => [...rows, row]);
      setCollabEmail('');
      showToast(t('session.collaboratorAdded'));
    } catch (err) {
      showToast(err.message || t('common.errorOccurred'), 'error');
    }
  };

  const removeCollaborator = async (userId) => {
    if (!poll?.id) return;
    try {
      await pollService.removeCollaborator(poll.id, userId);
      setCollaborators((rows) => rows.filter((c) => c.userId !== userId));
      showToast(t('session.collaboratorRemoved'));
    } catch (err) {
      showToast(err.message || t('common.errorOccurred'), 'error');
    }
  };

  const addQuestion = (qType = 'multiple') => {
    if (qType === 'open') setQuestions((qs) => [...qs, blankOpen()]);
    else if (qType === 'wordcloud') setQuestions((qs) => [...qs, blankWordCloud()]);
    else setQuestions((qs) => [...qs, blankMultiple()]);
  };

  const updateQuestionType = (index, qType) => {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== index) return q;
      if (qType === 'open') return { ...blankOpen(), text: q.text, image: q.image, timeLimit: q.timeLimit };
      if (qType === 'wordcloud') return { ...blankWordCloud(), text: q.text, image: q.image, timeLimit: q.timeLimit };
      return { ...blankMultiple(), text: q.text, image: q.image, timeLimit: q.timeLimit };
    }));
  };

  const updateField = (index, field, val) =>
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, [field]: val } : q)));

  const updateOption = (qIndex, oIndex, val) =>
    setQuestions((qs) => qs.map((q, i) => i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? val : o)) } : q));

  const addOption = (qIndex) =>
    setQuestions((qs) => qs.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)));

  const setCorrectOption = (qIndex, oIndex) =>
    setQuestions((qs) => qs.map((q, i) => (i === qIndex ? { ...q, correctIndex: oIndex } : q)));

  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    setQuestions((qs) => qs.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!quizTitle.trim()) return showToast(t('dashboard.titleRequired'), 'error');

    for (const q of questions) {
      if (!q.text.trim()) return showToast(t('dashboard.allQuestionsRequired'), 'error');
      if (q.questionType === 'multiple' && (q.options || []).some((o) => !o.trim()))
        return showToast(t('dashboard.allOptionsRequired'), 'error');
    }

    const payload = {
      title: quizTitle,
      type: POLL_TYPE_VALUE[contentType],
      scheduledStartAt: scheduledLocal ? new Date(scheduledLocal).toISOString() : null,
      questions: questions.map((q, idx) => ({
        orderIndex: idx,
        text: q.text,
        imageUrl: q.image || '',
        timeLimit: q.timeLimit || 30,
        questionType: QUESTION_TYPE_VALUE[q.questionType] || QUESTION_TYPE_VALUE.multiple,
        allowMultiple: !!q.allowMultiple,
        correctOptionIndex: typeConfig.hasCorrectAnswer && q.questionType === 'multiple' ? parseInt(q.correctIndex || 0, 10) : null,
        correctAnswer: q.correctAnswer || null,
        points: q.points || 10,
        maxWords: q.questionType === 'wordcloud' ? (q.maxWords || 3) : null,
        wordCloudConfig: q.questionType === 'wordcloud' ? toWordCloudConfig(q.moderation) : null,
        options: q.questionType === 'multiple'
          ? (q.options || []).map((optText, optIdx) => ({ orderIndex: optIdx, text: optText }))
          : [],
      })),
    };

    setIsSaving(true);
    try {
      if (poll) {
        await pollService.update(poll.id, payload);
        showToast(t('dashboard.createUpdated', { type: ct(contentType) }));
      } else {
        await pollService.create(payload);
        showToast(t('dashboard.createSaved', { type: ct(contentType) }));
      }
      await onSaved();
    } catch (err) {
      showToast(err.message || t('common.errorOccurred'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl border border-indigo-50 dark:border-slate-700 max-w-6xl mx-auto">
      {showFileImport && (
        <Suspense fallback={null}>
          <FileImport onImport={handleImportQuestions} onClose={() => setShowFileImport(false)} />
        </Suspense>
      )}

      <div className="flex justify-between items-center mb-4 sm:mb-6 border-b pb-4">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800">
          {typeConfig.icon} {ct(contentType)} {poll ? t('dashboard.editMode') : t('dashboard.createMode')}
        </h2>
        <button aria-label={t('common.close')} onClick={onCancel} className="text-slate-400 hover:text-slate-600"><XCircle size={22} /></button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold text-slate-700 mb-2">{t('dashboard.title')}</label>
        <input
          type="text"
          value={quizTitle}
          onChange={(e) => setQuizTitle(e.target.value)}
          className="w-full p-3 sm:p-4 text-base sm:text-lg border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-xl focus:border-indigo-500 outline-none"
          placeholder={contentType === 'wordcloud' ? t('dashboard.titlePlaceholderWordcloud') : t('dashboard.titlePlaceholderDefault')}
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{t('session.schedule')}</label>
        <input
          type="datetime-local"
          value={scheduledLocal}
          onChange={(e) => setScheduledLocal(e.target.value)}
          className="w-full sm:w-auto p-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-xl outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-slate-400 mt-1">{t('session.scheduleHint')}</p>
      </div>

      {poll?.id && !poll.isCollaborator && (
        <div className="mb-6 bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{t('session.collaborators')}</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={collabEmail}
              onChange={(e) => setCollabEmail(e.target.value)}
              placeholder={t('session.addCollaborator')}
              className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg outline-none"
            />
            <button type="button" onClick={addCollaborator} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
              {t('common.save')}
            </button>
          </div>
          <ul className="space-y-1">
            {collaborators.map((c) => (
              <li key={c.userId} className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>{c.email}</span>
                <button type="button" onClick={() => removeCollaborator(c.userId)} className="text-red-500 text-xs font-bold">{t('common.delete')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {contentType === 'exam' && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowKatexHelp(!showKatexHelp)}
            className="flex items-center gap-2 text-rose-600 hover:text-rose-700 font-medium text-sm"
          >
            <BookOpen size={16} /> {showKatexHelp ? t('dashboard.formatHelpHide') : t('dashboard.formatHelp')}
          </button>
          {showKatexHelp && (
            <div className="mt-3 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <h4 className="font-bold text-rose-800 mb-3">📐 KaTeX</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {KATEX_EXAMPLES.map((ex, i) => (
                    <div key={i} className="bg-white p-2 rounded-lg border border-rose-100 text-center">
                      <div className="text-lg mb-1"><KatexText text={`$${ex.code}$`} /></div>
                      <code className="text-[10px] text-slate-500 block truncate">${ex.code}$</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-8">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-slate-50 p-6 rounded-xl border border-slate-200 relative">
            <div className="absolute top-4 right-4 flex gap-2">
              {contentType === 'exam' && q.questionType !== 'open' && (
                <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-slate-200">
                  <span className="text-xs text-slate-500">{t('dashboard.points')}</span>
                  <input type="number" value={q.points || 10} onChange={(e) => updateField(qIndex, 'points', parseInt(e.target.value, 10) || 10)} className="w-12 text-center text-sm font-bold text-rose-600 outline-none" min="1" />
                </div>
              )}
              <button aria-label={t('session.saveToBank')} onClick={() => saveQuestionToBank(q)} className="text-indigo-400 hover:text-indigo-600 p-2"><BookMarked size={20} /></button>
              <button aria-label={t('dashboard.removeQuestion')} onClick={() => removeQuestion(qIndex)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20} /></button>
            </div>

            {contentType === 'exam' && (
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => updateQuestionType(qIndex, 'multiple')} className={`px-4 py-2 rounded-lg text-sm font-medium ${q.questionType !== 'open' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{t('dashboard.addMultipleChoice')}</button>
                <button type="button" onClick={() => updateQuestionType(qIndex, 'open')} className={`px-4 py-2 rounded-lg text-sm font-medium ${q.questionType === 'open' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{t('dashboard.addOpenEnded')}</button>
              </div>
            )}

            <div className="mb-4">
              <div className="flex gap-4 mb-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><ImageIcon size={14} /> {t('dashboard.imageUrl')}</label>
                  <div className="flex gap-2">
                    <input type="text" value={q.image || ''} onChange={(e) => updateField(qIndex, 'image', e.target.value)} className="flex-1 p-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-indigo-500" placeholder="https://..." />
                    <label className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap">
                      {t('session.uploadImage')}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          uploadQuestionImage(qIndex, file);
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Timer size={14} /> {t('dashboard.timeLimit')}</label>
                  <input type="number" value={q.timeLimit || 30} onChange={(e) => updateField(qIndex, 'timeLimit', parseInt(e.target.value, 10) || 30)} className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-center font-bold" min="5" max="600" />
                </div>
                {q.questionType === 'wordcloud' && (
                  <div className="w-24">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('dashboard.maxWords')}</label>
                    <input type="number" value={q.maxWords || 3} onChange={(e) => updateField(qIndex, 'maxWords', parseInt(e.target.value, 10) || 3)} className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-sky-500 text-center font-bold" min="1" max="20" />
                  </div>
                )}
              </div>

              <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">{t('dashboard.questionLabel', { n: qIndex + 1 })}</label>
              {contentType === 'exam' ? (
                <KatexTextEditor value={q.text} onChange={(val) => updateField(qIndex, 'text', val)} placeholder={t('dashboard.questionPlaceholderExam')} rows={3} />
              ) : (
                <input type="text" value={q.text} onChange={(e) => updateField(qIndex, 'text', e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none font-medium" placeholder={t('dashboard.questionPlaceholder')} />
              )}
            </div>

            {q.questionType === 'open' ? (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('dashboard.expectedAnswer')}</label>
                <KatexTextEditor value={q.correctAnswer || ''} onChange={(val) => updateField(qIndex, 'correctAnswer', val)} placeholder={t('dashboard.expectedAnswerPlaceholder')} rows={2} />
              </div>
            ) : q.questionType === 'wordcloud' ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-500 italic bg-sky-50 border border-sky-200 rounded-lg p-3">
                  {t('dashboard.wordcloudHint', { max: q.maxWords || 3 })}
                </div>
                <WordCloudModeration
                  index={qIndex}
                  moderation={q.moderation || DEFAULT_MODERATION}
                  onChange={(next) => updateField(qIndex, 'moderation', next)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {contentType === 'survey' && (
                  <div className="flex items-center gap-2 mb-2 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <input type="checkbox" id={`multi-${qIndex}`} checked={q.allowMultiple || false} onChange={(e) => updateField(qIndex, 'allowMultiple', e.target.checked)} className="w-5 h-5 accent-emerald-600 cursor-pointer" />
                    <label htmlFor={`multi-${qIndex}`} className="text-sm font-medium text-emerald-800 cursor-pointer">{t('dashboard.allowMultiple')}</label>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options && q.options.map((opt, oIndex) => (
                    <div key={oIndex} className={`flex items-center gap-2 p-2 rounded-lg border-2 bg-white ${typeConfig.hasCorrectAnswer && q.correctIndex === oIndex ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-transparent'}`}>
                      {typeConfig.hasCorrectAnswer ? (
                        <input type="radio" name={`correct-${qIndex}`} checked={q.correctIndex === oIndex} onChange={() => setCorrectOption(qIndex, oIndex)} className="w-5 h-5 accent-emerald-600 cursor-pointer" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">{oIndex + 1}</div>
                      )}
                      <input type="text" value={opt} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} className="w-full p-2 outline-none text-sm" placeholder={t('dashboard.optionPlaceholder', { n: oIndex + 1 })} />
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(qIndex)} className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 text-sm font-medium">
                    <Plus size={16} /> {t('dashboard.addOption')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showBank && (
        <div className="mt-6">
          <QuestionBankPanel showToast={showToast} onPick={addFromBank} compact />
        </div>
      )}

      <div className="mt-8 flex flex-col md:flex-row gap-4 justify-between items-center border-t pt-6">
        <div className="flex flex-wrap gap-3">
          {contentType === 'exam' ? (
            <>
              <button type="button" onClick={() => addQuestion('multiple')} className="py-3 px-6 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> {t('dashboard.addMultipleChoice')}</button>
              <button type="button" onClick={() => addQuestion('open')} className="py-3 px-6 bg-rose-100 text-rose-700 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> {t('dashboard.addOpenEnded')}</button>
            </>
          ) : (
            <button type="button" onClick={() => addQuestion(typeConfig.questionType === 'wordcloud' ? 'wordcloud' : 'multiple')} className="py-3 px-6 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2">
              <Plus size={20} /> {t('dashboard.addQuestion')}
            </button>
          )}
          {contentType !== 'wordcloud' && (
            <button type="button" onClick={() => setShowFileImport(true)} className="py-3 px-6 bg-emerald-100 text-emerald-700 rounded-xl font-bold flex items-center gap-2"><Upload size={20} /> {t('dashboard.importFromFile')}</button>
          )}
          <button type="button" onClick={() => setShowBank((open) => !open)} className="py-3 px-6 bg-indigo-100 text-indigo-700 rounded-xl font-bold flex items-center gap-2">
            <BookMarked size={20} /> {t('session.addFromBank')}
          </button>
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={onCancel} className="py-3 px-6 text-slate-500 hover:bg-slate-50 rounded-xl font-medium">{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={isSaving} className={`py-3 px-8 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 ${typeConfig.classes.solid}`}>
            {typeConfig.icon} {poll ? t('common.update') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
