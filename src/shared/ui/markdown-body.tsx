"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-stone-400 pl-3 text-stone-600 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-lg bg-stone-900/90 p-3 text-xs text-stone-100">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-stone-300/60 px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="mb-3 overflow-x-auto last:mb-0">{children}</pre>,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-stone-400">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-stone-300/80 align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-2 font-semibold text-stone-700 first:pl-0 last:pr-0">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-2 text-stone-800 first:pl-0 last:pr-0">{children}</td>
  ),
  h1: ({ children }) => <h1 className="mb-2 text-lg font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-base font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
  hr: () => <hr className="my-3 border-stone-300" />,
};

type MarkdownBodyProps = {
  content: string;
  className?: string;
};

/** Models sometimes emit HTML breaks; GFM tables do not treat them as line breaks. */
export function sanitizeMarkdownContent(content: string): string {
  return content.replace(/<br\s*\/?>/gi, " · ");
}

export function MarkdownBody({ content, className }: MarkdownBodyProps) {
  if (!content) {
    return null;
  }
  const sanitized = sanitizeMarkdownContent(content);
  return (
    <div className={className ?? "text-stone-800"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {sanitized}
      </ReactMarkdown>
    </div>
  );
}
