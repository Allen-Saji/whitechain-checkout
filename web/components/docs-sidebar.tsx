'use client';
import { useState } from 'react';
import Link from 'next/link';
export interface DocIndexEntry {
  slug: string;
  group: string;
  label: string;
  search: string;
}
export function DocsSidebar({
  entries,
  active,
}: {
  entries: DocIndexEntry[];
  active: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = entries.filter((p) =>
    p.search.includes(query.trim().toLowerCase()),
  );
  const groups = [...new Set(filtered.map((p) => p.group))];
  return (
    <aside className="docs-sidebar">
      <Link className="docs-home" href="/docs">
        Developer documentation
      </Link>
      <label className="docs-search-label" htmlFor="docs-search">
        Find a guide
      </label>
      <input
        id="docs-search"
        type="search"
        placeholder="Search guides..."
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <nav aria-label="Documentation">
        {groups.map((group) => (
          <div className="docs-group" key={group}>
            <p>{group}</p>
            {filtered
              .filter((p) => p.group === group)
              .map((p) => (
                <Link
                  key={p.slug}
                  href={'/docs/' + p.slug}
                  aria-current={p.slug === active ? 'page' : undefined}
                >
                  {p.label}
                </Link>
              ))}
          </div>
        ))}
      </nav>
      {filtered.length === 0 ? <p role="status">No matching guides.</p> : null}
      <a
        className="docs-source"
        href="https://github.com/Allen-Saji/whitechain-checkout"
        target="_blank"
        rel="noopener noreferrer"
      >
        Source on GitHub &#8599;
      </a>
    </aside>
  );
}
