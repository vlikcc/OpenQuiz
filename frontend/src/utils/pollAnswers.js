/**
 * The poll hub broadcasts to participants as well as the presenter, so its
 * payload has the answer key stripped. Layering it over the presenter's own
 * authenticated copy keeps the correct answer highlighted through live updates.
 */
export function mergeAnswerKey(incoming, known) {
  if (!known?.questions?.length) return incoming;

  const byId = new Map(known.questions.map((q) => [q.id, q]));

  return {
    ...incoming,
    questions: (incoming.questions || []).map((q) => {
      const previous = byId.get(q.id);
      if (!previous) return q;
      return {
        ...q,
        correctOptionIndex: q.correctOptionIndex ?? previous.correctOptionIndex,
        correctAnswer: q.correctAnswer ?? previous.correctAnswer,
      };
    }),
  };
}
