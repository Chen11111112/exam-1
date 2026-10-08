import { readFile } from 'node:fs/promises';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { MarkdownDoc } from '@/components/markdown-doc';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function buildToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const toc: TocItem[] = [];
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{2,4})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const text = match[2].replace(/[`*_]/g, '');
    toc.push({ level: match[1].length, text, id: slugger.slug(text) });
  }
  return toc;
}

async function loadSwagger(): Promise<string> {
  'use cache';
  return readFile(path.join(process.cwd(), 'swagger.md'), 'utf8');
}

export default async function Home() {
  const markdown = await loadSwagger();
  const toc = buildToc(markdown);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-10 px-6 py-10">
      <aside className="hidden w-64 shrink-0 lg:block">
        <nav className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto text-sm">
          <p className="mb-3 font-semibold">API 文件目錄</p>
          <ul className="space-y-1.5">
            {toc.map((item) => (
              <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 0.75}rem` }}>
                <a
                  href={`#${item.id}`}
                  className="text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="mb-6">
          <h1 className="text-4xl font-bold">商智餐飲 API 文件</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            內容來源：<code className="font-mono">swagger.md</code>
          </p>
        </header>
        <article>
          <MarkdownDoc source={markdown} />
        </article>
      </main>
    </div>
  );
}
