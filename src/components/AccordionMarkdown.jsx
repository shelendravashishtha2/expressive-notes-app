import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer.jsx';
import { getSections } from '../utils/text.js';

export default function AccordionMarkdown({ content, expandAll }) {
  const sections = useMemo(() => getSections(content), [content]);
  const [open, setOpen] = useState(() => new Set(sections.slice(0, 3).map((s) => s.id)));

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const isOpen = expandAll || open.has(section.id) || index === 0;
        return (
          <section key={`${section.id}-${index}`} id={section.id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/40">
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-base font-bold text-slate-950 dark:text-white">{section.title}</span>
              <ChevronDown className={`shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} size={18} />
            </button>
            {isOpen && (
              <div className="border-t border-slate-200 px-5 pb-6 dark:border-slate-800">
                <MarkdownRenderer content={section.content} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
