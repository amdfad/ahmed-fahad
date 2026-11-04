# ahmed-fahad

Personal site. Posts are single, self-contained HTML pages: inline CSS, inline
generated SVG illustrations and a little vanilla JS. No dependencies.

```
src/posts/*.html      post templates
src/css, src/js       styles and behaviour, inlined at build time
illustrations/*.mjs   generators for the etched SVG illustrations
site/<post>/index.html   built output (deploy this folder)
docs/design-reference.md design system notes
```

Build with `node build.mjs` (Node 18+).
