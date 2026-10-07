PULCHELLA FONT FILES NEEDED
============================
The @font-face rule in styles.css expects these two files
in this exact folder (project-root/fonts/):

  fonts/Pulchella.woff2   (preferred, load first)
  fonts/Pulchella.woff    (fallback for older browsers)

Where to get them:
  Export/convert your licensed Pulchella (Mevstory Studio) font file
  to .woff2 and .woff, named exactly as above, and drop them here.

If Pulchella ships as multiple static weight files instead of one
variable font, either:
  a) Rename the single weight you want to use to Pulchella.woff2/.woff, or
  b) Add extra @font-face blocks in styles.css, one per weight, e.g.:
       @font-face {
         font-family:'Pulchella';
         src:url('fonts/Pulchella-Bold.woff2') format('woff2');
         font-weight:800;
         font-style:normal;
         font-display:swap;
       }
     (keep font-family the same 'Pulchella' name so no CSS elsewhere
     needs to change — the browser will pick the right file per weight)

Until these files are added, the site falls back cleanly to the
existing system sans-serif — nothing breaks, nothing shifts.


TYPEKA REGULAR FONT FILES (optional — hero typewriter line)
=============================================================
Typeka is a PAID font from the T-26 Digital Type Foundry (~$29,
t26.com / fonts.adobe.com/fonts/typeka) — it can't be pulled from a
free CDN like Google Fonts. If you own a license:

  fonts/Typeka.woff2   (preferred, load first)
  fonts/Typeka.woff    (fallback for older browsers)

Export your licensed copy to these two formats/filenames and drop
them here; styles.css already has the matching @font-face rule
('Typeka') wired up to var(--font-typewriter), used on the hero's
typed line ("~/dev.alif $ ...").

Until those files are added, --font-typewriter falls back to
'Special Elite' (Google Fonts, already linked in index.html) — a
free distressed vintage-typewriter face that's the closest open
stand-in for Typeka's broken/typewriter character, so the hero line
still looks intentionally "typewriter" today. No CSS changes needed
later — dropping in the real files above swaps it automatically.
