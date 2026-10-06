import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OpenAnswerList from './OpenAnswerList';

const answer = (overrides = {}) => ({
  id: 'a1',
  questionId: 'q1',
  userName: 'Ada',
  answerText: 'Çünkü saati sunucu tutuyor',
  score: null,
  ...overrides,
});

describe('OpenAnswerList', () => {
  it('says so when nobody has written anything', () => {
    render(<OpenAnswerList answers={[]} />);

    expect(screen.getByText('Henüz cevap yok.')).toBeInTheDocument();
  });

  it('shows a grade without offering to change it when grading is off', () => {
    render(<OpenAnswerList answers={[answer({ score: 8 })]} maxPoints={10} />);

    expect(screen.getByText('8/10 puan')).toBeInTheDocument();
    expect(screen.queryByLabelText('Puanı kaydet')).not.toBeInTheDocument();
  });

  it('hands the typed grade to the caller', async () => {
    const onScore = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<OpenAnswerList answers={[answer()]} maxPoints={20} onScore={onScore} />);

    await user.type(screen.getByLabelText('Puan'), '15');
    await user.click(screen.getByLabelText('Puanı kaydet'));

    expect(onScore).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 15);
  });

  it('refuses a grade the question is not worth', async () => {
    const onScore = vi.fn();
    const user = userEvent.setup();
    render(<OpenAnswerList answers={[answer()]} maxPoints={10} onScore={onScore} />);

    await user.type(screen.getByLabelText('Puan'), '11');

    expect(screen.getByLabelText('Puanı kaydet')).toBeDisabled();
    expect(onScore).not.toHaveBeenCalled();
  });

  it('takes a grade back with null so the points come off the leaderboard', async () => {
    const onScore = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<OpenAnswerList answers={[answer({ score: 5 })]} maxPoints={10} onScore={onScore} />);

    await user.click(screen.getByLabelText('Puanı sil'));

    expect(onScore).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), null);
  });

  it('starts the input on the grade the answer already carries', () => {
    render(<OpenAnswerList answers={[answer({ score: 6 })]} maxPoints={10} onScore={vi.fn()} />);

    expect(screen.getByLabelText('Puan')).toHaveValue(6);
  });
});
