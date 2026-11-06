import './style.css';
import { pages } from './content.js';
import { escapeHtml } from '../app/api.js';

export function renderDocs(view, slug = 'overview') {
  const page = pages.find((item) => item.slug === slug);
  if (!page) {
    document.title = 'Page not found | Checkout docs';
    view.innerHTML =
      '<h1>Page not found.</h1><a class="text-link" href="/docs">Return to documentation</a>';
    return;
  }
  document.title = `${page.label} | Checkout docs`;
  const index = pages.indexOf(page);
  const groups = [...new Set(pages.map((item) => item.group))];
  view.innerHTML = `<div class="docs-layout"><aside class="docs-sidebar"><a class="docs-home" href="/docs">Developer documentation</a><label class="docs-search-label" for="docs-search">Find a guide</label><input id="docs-search" type="search" placeholder="Search guides..." autocomplete="off" /><nav aria-label="Documentation">${groups
    .map(
      (group) =>
        `<div class="docs-group"><p>${escapeHtml(group)}</p>${pages
          .filter((item) => item.group === group)
          .map(
            (item) =>
              `<a href="/docs/${item.slug}" data-doc="${item.slug}" ${item === page ? 'aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`,
          )
          .join('')}</div>`,
    )
    .join(
      '',
    )}</nav><p id="docs-no-results" role="status" hidden>No matching guides.</p><a class="docs-source" href="https://github.com/Allen-Saji/whitechain-checkout" target="_blank" rel="noopener noreferrer">Source on GitHub &#8599;</a></aside><article class="docs-article"><header><p class="app-kicker">${escapeHtml(page.group)}</p><h1>${escapeHtml(page.title)}</h1><p class="docs-lede">${escapeHtml(page.description)}</p></header>${page.sections.map((section, i) => `<section id="section-${i}"><h2>${escapeHtml(section.title)}</h2>${section.text ? `<p>${escapeHtml(section.text)}</p>` : ''}${section.code ? `<div class="docs-code"><div><span>${escapeHtml(section.language)}</span><button type="button" data-copy="${i}" aria-label="Copy code for ${escapeHtml(section.title)}">Copy</button></div><pre><code>${escapeHtml(section.code)}</code></pre></div>` : ''}${section.rows ? `<dl class="docs-reference">${section.rows.map(([term, description]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(description)}</dd></div>`).join('')}</dl>` : ''}${section.link ? `<a class="text-link docs-related" href="${escapeHtml(section.link.href)}">${escapeHtml(section.link.label)} &#8599;</a>` : ''}</section>`).join('')}<nav class="docs-pagination" aria-label="Previous and next guide">${index > 0 ? `<a href="/docs/${pages[index - 1].slug}"><small>Previous</small>${escapeHtml(pages[index - 1].label)}</a>` : '<span></span>'}${index < pages.length - 1 ? `<a href="/docs/${pages[index + 1].slug}"><small>Next</small>${escapeHtml(pages[index + 1].label)} &#8594;</a>` : ''}</nav><p id="docs-copy-status" class="fine-print" role="status"></p></article><nav class="docs-toc" aria-label="On this page"><p>On this page</p>${page.sections.map((section, i) => `<a href="#section-${i}">${escapeHtml(section.title)}</a>`).join('')}<button class="text-link" id="print-docs">Download PDF &#8595;</button></nav></div>`;
  document.querySelector('#docs-search').oninput = (event) => {
    const query = event.target.value.trim().toLowerCase();
    let matches = 0;
    for (const link of document.querySelectorAll('[data-doc]')) {
      const item = pages.find((entry) => entry.slug === link.dataset.doc);
      link.hidden = !JSON.stringify(item).toLowerCase().includes(query);
      if (!link.hidden) matches++;
    }
    document.querySelector('#docs-no-results').hidden = matches !== 0;
    for (const group of document.querySelectorAll('.docs-group'))
      group.hidden = ![...group.querySelectorAll('a')].some(
        (link) => !link.hidden,
      );
  };
  for (const button of document.querySelectorAll('[data-copy]')) {
    button.onclick = async () => {
      const status = document.querySelector('#docs-copy-status');
      try {
        await navigator.clipboard.writeText(
          page.sections[Number(button.dataset.copy)].code,
        );
        button.textContent = 'Copied';
        status.textContent = 'Code copied to clipboard.';
      } catch {
        status.textContent =
          'Copy is unavailable. Select the code and copy it manually.';
      }
    };
  }
  document.querySelector('#print-docs').onclick = () => window.print();
}
