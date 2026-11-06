import { notFound } from 'next/navigation';
import Link from 'next/link';
import { pages } from '@/lib/docs';
import { DocsSidebar } from '@/components/docs-sidebar';
import { CopyButton } from '@/components/ui';
import '../../../../styles/docs.css';
type Props = { params: Promise<{ slug?: string[] }> };
function getPage(slug?: string[]) {
  if (slug && slug.length > 1) return undefined;
  return pages.find((p) => p.slug === (slug?.[0] ?? 'overview'));
}
export async function generateMetadata({ params }: Props) {
  const page = getPage((await params).slug);
  return {
    title: page ? page.label + ' - Docs' : 'Page not found',
    description: page?.description,
    alternates: {
      canonical: page?.slug === 'overview' ? '/docs' : '/docs/' + page?.slug,
    },
  };
}
export function generateStaticParams() {
  return [{ slug: [] }, ...pages.map((p) => ({ slug: [p.slug] }))];
}
export default async function DocsPage({ params }: Props) {
  const page = getPage((await params).slug);
  if (!page) notFound();
  const index = pages.indexOf(page);
  return (
    <div className="docs-layout">
      <DocsSidebar
        entries={pages.map((p) => ({
          slug: p.slug,
          group: p.group,
          label: p.label,
          search: JSON.stringify(p).toLowerCase(),
        }))}
        active={page.slug}
      />
      <article className="docs-article">
        <header>
          <p className="app-kicker">{page.group}</p>
          <h1>{page.title}</h1>
          <p className="docs-lede">{page.description}</p>
        </header>
        {page.sections.map((section, i) => (
          <section id={'section-' + i} key={section.title}>
            <h2>{section.title}</h2>
            {section.text ? <p>{section.text}</p> : null}
            {section.code ? (
              <div className="docs-code">
                <div>
                  <span>{section.language}</span>
                  <CopyButton text={section.code} label="Copy" />
                </div>
                <pre>
                  <code>{section.code}</code>
                </pre>
              </div>
            ) : null}
            {section.rows ? (
              <dl className="docs-reference">
                {section.rows.map(([term, description]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {section.link ? (
              <Link className="text-link docs-related" href={section.link.href}>
                {section.link.label} &#8599;
              </Link>
            ) : null}
          </section>
        ))}
        <nav className="docs-pagination" aria-label="Previous and next guide">
          {index > 0 ? (
            <Link href={'/docs/' + pages[index - 1].slug}>
              <small>Previous</small>
              {pages[index - 1].label}
            </Link>
          ) : (
            <span />
          )}
          {index < pages.length - 1 ? (
            <Link href={'/docs/' + pages[index + 1].slug}>
              <small>Next</small>
              {pages[index + 1].label} &#8594;
            </Link>
          ) : null}
        </nav>
      </article>
      <nav className="docs-toc" aria-label="On this page">
        <p>On this page</p>
        {page.sections.map((section, i) => (
          <a href={'#section-' + i} key={section.title}>
            {section.title}
          </a>
        ))}
      </nav>
    </div>
  );
}
