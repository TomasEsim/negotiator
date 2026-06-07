"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Compact, Tailwind-styled Markdown renderer for assistant draft replies
// (supports GitHub-flavoured Markdown incl. tables). `node` is destructured out
// of each component so it isn't spread onto the DOM element.
const components: Components = {
  p: ({ node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-slate-900" {...props} />
  ),
  h1: ({ node, ...props }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-slate-900" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-slate-900" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h4 className="mb-1 mt-3 text-sm font-semibold text-slate-900" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="my-2 list-disc space-y-0.5 pl-5" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="my-2 list-decimal space-y-0.5 pl-5" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a className="text-teal-700 underline" target="_blank" rel="noreferrer" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-2 border-slate-200 pl-3 italic text-slate-600" {...props} />
  ),
  code: ({ node, ...props }) => (
    <code className="rounded bg-slate-100 px-1 py-0.5 text-xs" {...props} />
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
  table: ({ node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-700"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td className="border border-slate-200 px-2 py-1 text-slate-700" {...props} />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-slate-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
