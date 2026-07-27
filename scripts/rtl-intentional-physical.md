# Remaining intentional physical CSS (RTL)

After the logical conversion pass, these physical properties remain on purpose:

| Location | Why kept physical |
|---|---|
| `components/ui/sidebar.tsx` | `left-`/`right-` tied to `data-side`; AppSidebar sets `side="right"` in RTL. `order-last` is **LTR-only** (`ltr:data-[side=right]:order-last`) so RTL flex does not push the spacer to the wrong edge while the fixed panel stays on `right-0`. |
| `components/ui/sheet.tsx` | Side variants use physical inset + `slide-in-from-*` animation tokens |
| `components/ui/carousel.tsx` | Prev/next absolute left/right + ArrowLeft/ArrowRight keys |
| `components/ui/resizable.tsx` | Resize handle centering uses `left-1/2` + `translate-x` |
| `dialog.tsx` / `alert-dialog.tsx` | `left-[50%]` + `translate-x-[-50%]` (logical `start` breaks centering in RTL) |
| Radix `slide-in-from-left/right-*` | Tailwind animate tokens are physical; portals inherit `html[dir]` |

CSS `margin-left/right`, `padding-left/right`, and `float: left/right` greps: **0 hits** in `src/`.

App.css progress bar + nav underline use `inset-inline-start` (logical).
