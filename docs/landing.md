# Landing page

The marketing site lives in `web/` and builds independently of the API and worker. It uses semantic HTML, CSS and small browser-side JavaScript modules, without a frontend framework or wallet dependencies.

```sh
pnpm dev:web
pnpm build:web
pnpm preview:web
```

Development and preview bind to `http://127.0.0.1:4210`. The production output is `web/dist/`; host it as a static site. The API remains on its separate port. Build output is ignored by Git. The build does not delete previous output files automatically.

## Content and behavior

The main CTA opens an illustrative payment-recovery walkthrough. It does not connect a wallet, create a checkout, send funds, or claim to be the hosted payment application. The payment/refund evidence links point to recorded Whitechain Sepolia transactions. The SDK snippet uses the repository's actual server client and keeps merchant keys server-side.

The walkthrough supports pointer input, arrow keys, Home and End. Mobile navigation supports Escape. FAQs use native disclosures. The copy button uses the Clipboard API and reports when manual copying is necessary. Section entrances and the floating hero receipt respect reduced-motion preferences.

The fixed Download PDF button invokes native browser printing. Print styles remove controls and reveal all content. The walkthrough prints its current selected state; it is a static snapshot, not an interactive exported demo.

## Artwork and typography

`web/public/continuity-sculpture.png` is generated decorative artwork with transparency. The receipt over it is live HTML, not text baked into the image. Do not use the sculpture as evidence of settlement or custody. The title and receipt are marked as illustrative where relevant. The working `checkout.` wordmark is provisional.

DM Sans regular/semibold and Instrument Serif italic are bundled locally. Their upstream license files are included beside the font files. The page does not request third-party fonts.

## Validation

Formatting, lint, contract compilation, offline tests and the production web build pass together through `pnpm check`. Browser checks covered desktop and narrow phone layouts, loaded artwork/fonts, outage and recovery controls, mobile menu/Escape, reduced-motion styling and print visibility. No horizontal overflow was observed at a 320 CSS-pixel browser width. This does not constitute an automated accessibility or cross-browser audit.
