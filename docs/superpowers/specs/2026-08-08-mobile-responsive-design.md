# Mobile-First Responsive Design

**Date:** 2026-08-08

**Status:** Approved in conversation; awaiting written-spec review

## Objective

Make the entire iGen Architect Assistant frontend fully usable on mobile while preserving its existing desktop behavior and business logic. Mobile is the primary target, including both portrait and landscape orientations. The Floor Plan Editor must retain its complete feature set on phones.

## Scope

This design covers the shared application shell, all routes declared in `src/App.tsx`, shared overlays, and the interactive editors embedded in those routes:

- `/login`
- `/setup-api-key`
- `/home`
- `/tools/rendering`
- `/tools/floor-plan`
- `/tools/texture-lab`
- `/tools/human-enhancer`
- `/tools/virtual-staging`
- `/tools/visual`
- `/tools/video`
- `/promo`
- `/admin`
- Shared pricing, credit, history, image-library, selection, confirmation, and full-screen media overlays

The work changes presentation, responsive UI state, and touch interaction only. API contracts, credit rules, rendering behavior, authentication, and other business logic remain unchanged.

## Target Viewports

The implementation is mobile-first and must be verified at these representative viewport sizes:

| Class | Viewport | Purpose |
| --- | --- | --- |
| Small phone | `360x800` | Minimum supported portrait width |
| Standard phone | `390x844` | Primary portrait reference |
| Large phone | `430x932` | Large portrait reference |
| Phone landscape | `844x390` | Floor Plan and media workspace reference |
| Tablet | `768x1024` | Intermediate layout verification |
| Desktop | `1440x900` | Regression reference |

Widths between these references must remain usable and free of accidental page-level horizontal overflow. Horizontal scrolling is allowed only for controls designed for it, such as tab strips and data tables.

## Responsive Foundation

### Layout rules

- Use mobile styles as the unprefixed baseline.
- Use the existing Tailwind breakpoints consistently: `sm` at 640px, `md` at 768px, `lg` at 1024px, and `xl` at 1280px.
- Preserve the current desktop composition from `lg` upward unless a desktop defect is directly caused by the responsive work.
- Use `100dvh` for viewport-height workspaces and include `env(safe-area-inset-*)` in fixed or sticky mobile controls.
- Use 16px page gutters on phones, increasing progressively for tablet and desktop.
- Use one content column on phones. Two-column form grids may remain only when both controls fit without truncating their labels or values.
- Every interactive touch target must be at least 44 by 44 CSS pixels, including icon-only controls.
- Do not hide required functionality solely because the viewport is small.

### Shared primitives

Add a small responsive UI layer under `src/components/responsive/` rather than repeating behavior in every screen:

- `ResponsiveSheet`: centered modal on desktop; bottom sheet or full-screen sheet on mobile; side sheet in landscape when configured.
- `ScrollableTabs`: horizontally scrollable tab strip with the active tab brought into view.
- `StickyActionBar`: safe-area-aware container for a screen's primary action.
- `MobileDrawer`: accessible navigation or detail drawer with focus management.
- `useResponsiveLayout`: shared `matchMedia` state for cases where CSS alone cannot choose sheet placement or canvas input behavior.

These primitives must have narrow responsibilities. Screen-specific content and business state stay in the owning screen.

## Shared Application Shell

### Header

On portrait phones, the authenticated application header is approximately 56px high and contains:

- Compact logo button
- Condensed credit balance
- Account/menu button

The architectural-assistant tagline, pricing button, and labeled top-up button are removed from the header at phone widths. Pricing, top-up, history, admin navigation when authorized, and logout are available from the account menu. The desktop header remains unchanged from `lg` upward.

Header show/hide behavior must not cause layout jumps. The main content offset must use the actual header height instead of relying on a mismatched fixed padding.

### Overlays

- Short confirmations use a bottom sheet on phones and a centered modal on larger screens.
- Forms and selection dialogs with substantial content use a near-full-screen sheet on phones.
- Overlay bodies scroll independently while their title and action footer remain visible.
- Opening an overlay moves focus into it; closing it restores focus to the trigger.
- Overlays close with their explicit close control and `Escape`. Destructive or in-progress operations cannot be dismissed accidentally.

## Screen Designs

### Login and API-key setup

- Keep the form centered when space permits, but allow the page to scroll when the software keyboard or landscape height reduces the viewport.
- Reduce phone padding and heading sizes without dropping labels or supporting text.
- Remove fixed footers that can overlap form actions.
- Keep the submit action visible after focusing the final field.

### Home

- Display tool cards in one column on phones, two columns from `md`, and the existing desktop grid from `xl`.
- Reduce card image height and internal padding on phones.
- Make the complete active card tappable while retaining an explicit action label.
- Do not depend on hover to communicate locked or available state.

### Rendering and image tools

This group includes Render, Enhance Render, Upscale, Sync, Edit, Canvas, Utilities, and related media results.

- Use a compact page heading on phones.
- Make the primary tab strip horizontally scrollable and sticky below the shared header.
- Use a vertical document flow on phones: input and configuration first, results second.
- Remove fixed desktop panel widths at phone widths. Control and result panels become full width.
- Convert form grids to one column when labels, select values, or text inputs would otherwise be truncated.
- Keep the primary generate/render action in a safe-area-aware sticky action bar.
- Preserve result history and thumbnails below the current result; horizontal thumbnail rails remain intentionally scrollable.
- Make result actions available by tap. Hover-only controls must be visible or accessible through an action menu on touch devices.
- Do not use nested full-height containers that prevent the document from scrolling to results.

### TextureLab, Human Enhancer, Visual, Video, and Virtual Staging

- Place controls before preview/output in the phone document flow.
- Remove phone-level `overflow-hidden` and fixed heights that clip content.
- Size previews with aspect ratios and viewport-aware minimum/maximum heights.
- Allow toolbars to wrap or scroll horizontally instead of overflowing the viewport.
- Expose actions that are currently revealed only on hover.
- Keep the established side-by-side desktop layout from `lg` upward.
- In Virtual Staging, replace the 440px sidebar and 800px workspace assumptions with a full-width control section followed by a responsive editor/preview.

### Admin

- Stack summary cards in one column on small phones and two columns where space permits.
- Render user records as mobile cards with expandable details and actions instead of compressing the eight-column desktop table.
- Keep the desktop user table from `lg` upward.
- Keep wide cost-comparison tables horizontally scrollable, with a visible affordance that more columns are available.
- Stack filters and heading actions when they cannot fit on one line.

### Promo and supporting screens

- Use the shared phone gutters and responsive type scale.
- Remove fixed decorative elements or footers when they cover meaningful content.
- Keep primary forms and actions in normal document flow.

## Floor Plan Editor

The Floor Plan Editor is a separate adaptive workspace because its current desktop composition contains a 380px chat sidebar, a flexible canvas, and a 380px configuration sidebar with no responsive breakpoints.

### Workspace shell

- Hide the shared authenticated header on `/tools/floor-plan`; the editor owns the complete viewport.
- Use `100dvh` and account for all safe-area insets.
- Add an editor app bar of approximately 52px containing Back, a truncated project name, Undo, Redo, and More.
- Put dimension labels, room labels, export PNG, regenerate, and Render 3D in the More menu. Loading or disabled state remains visible for actions that take time.
- Let the 2D or 3D canvas fill all remaining space.

### Panels

- Open Chat and Project History in a near-full-height sheet on portrait phones.
- Open layout and visualization configuration in a bottom sheet with compact and expanded snap states.
- Allow only one major sheet to be open at a time.
- In phone landscape, render chat and configuration as a 320–360px side sheet so the canvas remains visible.
- Preserve chat messages, project history, active configuration tab, form values, canvas selection, floor plans, and undo/redo history when a panel closes or orientation changes.

### Touch interaction

- Tap selects an object or room.
- One-finger drag moves the selected movable object in the appropriate editing mode.
- Two-finger movement pans the canvas.
- Two-finger pinch changes canvas zoom around the gesture center.
- Existing mouse drag and wheel-to-zoom behavior remains available on desktop.
- Gesture handling must distinguish object dragging, drawing, and two-finger canvas navigation so that a pan does not create or move an object accidentally.
- Canvas controls use 44px touch targets and do not overlap the mobile action bar or sheets.

### Floor Plan dialogs and 3D

- Shape, room, style, and finish selectors become full-screen sheets on phones with independently scrolling content and sticky confirmation actions.
- The 3D viewer remains mounted when switching modes so the current scene is not lost.
- The renderer responds to container size through its existing resize mechanism.
- Collapse 3D control overlays into expandable groups on phones, keeping primary navigation and reset actions directly accessible.

## State and Data Flow

Responsive components receive screen content and callbacks; they do not own domain data. Existing screen components continue to own uploads, prompts, rendering results, floor plans, and API state.

`useResponsiveLayout` exposes only presentation facts needed by JavaScript, such as whether the viewport is phone-sized and whether it is landscape. Screen state must not be initialized from these facts in a way that discards user data after a media-query change.

When an orientation or breakpoint change requires moving content between a bottom sheet and a side sheet, the same mounted content and state are retained where practical. If remounting is unavoidable, the domain state remains in the parent screen.

## Error, Loading, and Empty States

- Loading indicators and error recovery actions remain inside the visible phone flow.
- A sticky action must display its disabled or loading state and cannot cover validation feedback.
- Upload and render errors preserve the user's form values and successfully uploaded assets.
- Empty result panels should not reserve desktop-sized blank heights on phones.
- Long labels, file names, model names, credit values, and user emails wrap or truncate with an accessible full-value affordance.

## Accessibility

- Use semantic buttons for every actionable icon.
- Provide accessible names for icon-only controls.
- Manage focus within sheets and restore it on close.
- Preserve visible focus styles and keyboard access on desktop.
- Use `aria-expanded`, `aria-controls`, and dialog semantics for expandable panels and overlays.
- Do not make hover the only way to discover or execute an action.
- Respect reduced-motion preferences for sheet and drawer transitions.

## Verification Strategy

Add Playwright responsive coverage because the project currently has no browser-level responsive test suite.

### Automated checks

- Run route smoke tests at every target viewport.
- Verify no accidental document-level horizontal overflow.
- Verify primary actions are visible and tappable.
- Verify representative overlays fit, scroll, close, and restore focus.
- Verify the Rendering vertical flow reaches its results and retains the sticky action.
- Verify Admin switches between mobile user cards and the desktop table.
- Verify Floor Plan panels, orientation changes, selection, drag, pan, pinch zoom, and state retention.
- Capture stable screenshots of representative states for visual regression.
- Run `npm run typecheck`, `npm run lint`, `npm run build`, and the responsive Playwright suite before completing each implementation group.

### Manual checks

- Test iOS Safari and Android Chrome behavior for dynamic browser bars, safe areas, the software keyboard, file upload, and touch gestures.
- Confirm that landscape Floor Plan sheets leave a usable canvas region.
- Confirm that fixed or sticky controls do not overlap browser chrome, content, toasts, or each other.
- Confirm the desktop reference remains functionally and visually equivalent.

## Acceptance Criteria

The responsive project is complete when:

1. Every route and shared overlay is usable at 360px portrait width without accidental document-level horizontal scrolling.
2. Every required action remains available on phones; Floor Plan has full functional parity with desktop.
3. Portrait and landscape phone layouts retain user and editor state during orientation changes.
4. Touch controls meet the 44px minimum target and hover-only actions have a touch alternative.
5. Software keyboards and safe-area insets do not cover focused inputs or primary actions.
6. Rendering tools follow the approved vertical flow: configuration first, results second.
7. The target viewport Playwright suite, typecheck, lint, and production build pass.
8. Desktop layouts at 1440x900 retain existing functionality and show no material responsive regressions.

## Delivery Decomposition

The implementation should be delivered as independently verifiable groups:

1. Responsive foundation and shared application shell
2. Authentication, setup, home, promo, and shared overlays
3. Rendering and related image-tool flows
4. Secondary tools and Virtual Staging
5. Admin mobile presentation
6. Floor Plan workspace and sheets
7. Floor Plan touch gestures and 3D controls
8. Responsive browser tests, visual baselines, and final cross-device regression

This order establishes shared behavior before migrating screens and isolates the highest-risk Floor Plan changes from the lower-risk page work.
