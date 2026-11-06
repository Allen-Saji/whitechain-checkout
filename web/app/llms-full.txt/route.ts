import { pages } from '@/lib/docs';
export const dynamic = 'force-static';
export function GET() {
  const content = [
    '# Checkout developer reference',
    'Public deployment: https://checkout.allensaji.dev',
    'Network: Whitechain Sepolia (1874). Test USDT only. Query /v1/config for current availability.',
    'SDK integration skill: https://checkout.allensaji.dev/skill.md',
    'API schema: https://checkout.allensaji.dev/openapi.json',
    ...pages.map((p) =>
      [
        '## ' + p.title,
        p.description,
        ...p.sections.map((s) =>
          [
            '### ' + s.title,
            s.text ?? '',
            s.code ? '```' + (s.language ?? '') + '\n' + s.code + '\n```' : '',
            ...(s.rows ?? []).map(([k, v]) => k + ': ' + v),
            s.link ? s.link.label + ': ' + s.link.href : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
      ].join('\n\n'),
    ),
  ].join('\n\n');
  return new Response(content, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
