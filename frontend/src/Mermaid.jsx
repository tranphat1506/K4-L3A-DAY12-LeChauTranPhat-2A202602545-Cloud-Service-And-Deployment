import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { curve: 'linear' } });

export default function Mermaid({ chart, id }) {
  const [svg, setSvg] = useState('');
  
  useEffect(() => {
    if (chart) {
      // Small timeout to ensure DOM is ready if needed, and avoid React 18 strict mode double render clashes
      const renderChart = async () => {
        try {
          const { svg } = await mermaid.render(id, chart);
          setSvg(svg);
        } catch (e) {
          console.error(e);
        }
      };
      renderChart();
    }
  }, [chart, id]);

  return <div className="flex justify-center items-center w-full overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />;
}
