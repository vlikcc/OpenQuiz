import { useEffect, useRef } from 'react';
import cloud from 'd3-cloud';
import { select } from 'd3-selection';
import { useTranslation } from 'react-i18next';

const PALETTE = ['#4F46E5', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6', '#EF4444', '#14B8A6'];

export default function WordCloudCanvas({ terms = [], width = 800, height = 400 }) {
  const { t } = useTranslation();
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || terms.length === 0) return;
    const counts = terms.map((t) => t.count);
    const max = Math.max(...counts, 1);
    const min = Math.min(...counts);
    const minSize = 14;
    const maxSize = Math.min(width, height) / 6;

    const fontSize = (c) => {
      if (max === min) return (minSize + maxSize) / 2;
      return minSize + ((c - min) / (max - min)) * (maxSize - minSize);
    };

    const layout = cloud()
      .size([width, height])
      .words(terms.map((t, i) => ({ text: t.term, size: fontSize(t.count), color: PALETTE[i % PALETTE.length] })))
      .padding(4)
      .rotate(() => (Math.random() < 0.5 ? 0 : 90))
      .font('Inter, sans-serif')
      .fontSize((d) => d.size)
      .on('end', draw);
    layout.start();

    function draw(words) {
      const svg = select(ref.current);
      svg.selectAll('*').remove();
      svg
        .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .selectAll('text')
        .data(words)
        .enter()
        .append('text')
        .style('font-size', (d) => `${d.size}px`)
        .style('font-family', 'Inter, sans-serif')
        .style('font-weight', '700')
        .style('fill', (d) => d.color)
        .attr('text-anchor', 'middle')
        .attr('transform', (d) => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
        .text((d) => d.text);
    }
  }, [terms, width, height]);

  if (terms.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full text-slate-300 italic text-center px-4">
        {t('presenter.noJoin')}
      </div>
    );
  }

  return <svg ref={ref} width="100%" height="100%" className="block" />;
}
