import { isValidElement, type ReactElement, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

const METHOD_STYLE: Record<string, string> = {
  GET: 'bg-emerald-600',
  POST: 'bg-blue-600',
  PUT: 'bg-orange-600',
  PATCH: 'bg-amber-600',
  DELETE: 'bg-red-600',
};

const HTTP_LINE = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)$/;

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

const components: Components = {
  h2: ({ children, ...p }) => (
    <h2 {...p} className="mt-10 scroll-mt-6 border-b border-zinc-200 pb-2 text-3xl font-bold dark:border-zinc-800">
      {children}
    </h2>
  ),
  h3: ({ children, ...p }) => (
    <h3 {...p} className="mt-10 scroll-mt-6 text-2xl font-semibold">
      {children}
    </h3>
  ),
  h4: ({ children, ...p }) => (
    <h4 {...p} className="mt-8 scroll-mt-6 text-lg font-semibold">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  hr: () => <hr className="my-8 border-zinc-200 dark:border-zinc-800" />,
  a: ({ children, href }) => (
    <a href={href} className="text-blue-600 underline dark:text-blue-400">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r border-l-4 border-amber-500 bg-amber-50 px-4 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-800">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-300 px-3 py-2 dark:border-zinc-700">{children}</td>
  ),
  code: ({ children, className }) => (
    <code
      className={`${className ?? ''} rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800`}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => {
    const code = children as ReactElement<{ className?: string; children?: ReactNode }>;
    const className = isValidElement(code) ? (code.props.className ?? '') : '';
    const text = textOf(children).trim();

    if (className.includes('language-http')) {
      const match = text.match(HTTP_LINE);
      if (match) {
        return (
          <div className="my-3 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span
              className={`rounded px-2.5 py-1 text-xs font-bold text-white ${METHOD_STYLE[match[1]]}`}
            >
              {match[1]}
            </span>
            <span className="break-all">{match[2]}</span>
          </div>
        );
      }
    }

    return (
      <pre className="my-3 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-6 text-zinc-100 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
        {children}
      </pre>
    );
  },
};

export function MarkdownDoc({ source }: { source: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components}>
      {source}
    </Markdown>
  );
}
