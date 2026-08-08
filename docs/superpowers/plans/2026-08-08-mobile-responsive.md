# Mobile-First Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every frontend route and shared overlay fully usable on 360–430px phones in portrait and landscape, including full Floor Plan Editor feature parity, while preserving the current desktop behavior.

**Architecture:** Establish a small responsive UI foundation for media-query state, sheets, drawers, scrollable tabs, and safe-area-aware actions. Migrate low-risk document-flow screens first, then Rendering, secondary tools, Admin, and finally the stateful Floor Plan workspace and touch gestures. Browser-level Playwright tests define the responsive contract at each stage.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Motion, Three.js, Playwright

## Global Constraints

- Minimum supported portrait viewport: `360x800`.
- Primary portrait viewport: `390x844`.
- Large portrait viewport: `430x932`.
- Required phone-landscape viewport: `844x390`.
- Tablet regression viewport: `768x1024`.
- Desktop regression viewport: `1440x900`.
- Floor Plan Editor must retain full functional parity on phones.
- Rendering tools use the approved vertical flow: configuration first, results second.
- Required actions may not be hidden solely because the viewport is small.
- Every interactive touch target must be at least 44 by 44 CSS pixels.
- Accidental document-level horizontal overflow is forbidden; intentional tab-strip and data-table scrolling is allowed.
- API contracts, authentication, credit rules, rendering behavior, and other business logic remain unchanged.
- Preserve the current desktop composition from `lg` (1024px) upward unless the responsive implementation fixes a directly related desktop defect.
- Use `100dvh` and `env(safe-area-inset-*)` for viewport workspaces and fixed or sticky mobile controls.

---

## File Structure

### New responsive foundation

- `src/components/responsive/useResponsiveLayout.ts`: exposes `isPhone`, `isLandscape`, and `isPhoneLandscape` from `matchMedia` without owning screen data.
- `src/components/responsive/ResponsiveSheet.tsx`: accessible modal/bottom-sheet/side-sheet shell with focus restoration.
- `src/components/responsive/MobileDrawer.tsx`: navigation/detail drawer built on the same overlay contract.
- `src/components/responsive/ScrollableTabs.tsx`: horizontal tab strip that scrolls its active tab into view.
- `src/components/responsive/StickyActionBar.tsx`: safe-area-aware mobile primary-action container.
- `src/components/responsive/index.ts`: public exports for the responsive primitives.

### New responsive verification

- `playwright.config.ts`: client-only Vite web server and responsive browser configuration.
- `tests/e2e/support/auth.ts`: authenticated-user and API-route helpers.
- `tests/e2e/support/layout.ts`: overflow and touch-target assertions.
- `tests/e2e/responsive-smoke.spec.ts`: route-level viewport smoke matrix.
- `tests/e2e/layout-mobile.spec.ts`: shared header, navigation, and overlay behavior.
- `tests/e2e/basic-screens-mobile.spec.ts`: Login, Setup, Home, Promo, and History behavior.
- `tests/e2e/rendering-mobile.spec.ts`: Rendering vertical-flow and sticky-action behavior.
- `tests/e2e/tools-mobile.spec.ts`: TextureLab, Human Enhancer, Visual, Video, and Virtual Staging behavior.
- `tests/e2e/admin-mobile.spec.ts`: Admin cards, filters, and desktop-table regression.
- `tests/e2e/floor-plan-mobile.spec.ts`: Floor Plan workspace, sheets, orientation, and state retention.
- `tests/e2e/floor-plan-gestures.spec.ts`: tap, drag, two-finger pan, and pinch zoom.
- `tests/e2e/visual-regression.spec.ts`: final stable screenshots at the approved viewport matrix.

### Existing files modified by domain

- Shared shell and overlays: `src/index.css`, `src/components/Layout.tsx`, `src/components/HistoryModal.tsx`.
- Basic screens: `src/components/Login.tsx`, `src/components/ApiKeySetup.tsx`, `src/components/HomeScreen.tsx`, `src/components/Promo.tsx`.
- Rendering: `src/components/Render.tsx`, `src/components/render/RenderTabContent.tsx`, `src/components/render/EnhanceRenderTabContent.tsx`, `src/components/render/UpscaleTabContent.tsx`, `src/components/render/SyncTabContent.tsx`, `src/components/render/ImageLibraryModal.tsx`.
- Secondary tools: `src/components/TextureLab.tsx`, `src/components/HumanEnhancer.tsx`, `src/components/Visual.tsx`, `src/components/Video.tsx`, `src/components/VirtualStaging.tsx`.
- Admin: `src/components/AdminPanel.tsx`.
- Floor Plan: `src/components/render/FloorPlanEditor.tsx`, `src/components/render/FloorPlan3DViewer.tsx`, `src/components/render/ChooseShapeModal.tsx`, `src/components/render/ChooseRoomsModal.tsx`.
- Tooling: `package.json`, `package-lock.json`.

---

### Task 1: Install the responsive browser-test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/support/auth.ts`
- Create: `tests/e2e/support/layout.ts`
- Create: `tests/e2e/responsive-smoke.spec.ts`

**Interfaces:**
- Produces: `installAuthenticatedUser(page, role?)`, `expectNoDocumentOverflow(page)`, and the `npm run test:responsive` command used by every later task.
- Consumes: the existing `/api/v1/auth/me` contract and Vite client entry point.

- [ ] **Step 1: Install Playwright and add deterministic scripts**

Run:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
```

Add these scripts to `package.json` without removing existing scripts:

```json
{
  "dev:client": "vite --host 127.0.0.1",
  "test:responsive": "playwright test",
  "test:responsive:update": "playwright test --update-snapshots"
}
```

Expected: `package-lock.json` records `@playwright/test`, and Chromium installs successfully.

- [ ] **Step 2: Add the Playwright configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:client',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 3: Add authenticated test support**

Create `tests/e2e/support/auth.ts`:

```ts
import type { Page } from '@playwright/test';

export type TestRole = 'user' | 'admin' | 'superadmin';

export async function installAuthenticatedUser(
  page: Page,
  role: TestRole = 'user',
): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('accessToken', 'responsive-e2e-token');
  });

  await page.route('**/api/v1/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          _id: 'responsive-user',
          email: 'responsive@example.com',
          displayName: 'Responsive User',
          role,
          credits: 1250.5,
          hasSetupApiKey: true,
        },
      }),
    });
  });

  await page.route('**/socket.io/**', route => route.abort());
}
```

Create `tests/e2e/support/layout.ts`:

```ts
import { expect, type Page } from '@playwright/test';

export async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

export async function expectMinimumTouchTarget(
  page: Page,
  selector: string,
): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} must be visible`).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}
```

- [ ] **Step 4: Write and run the initial smoke test**

Create `tests/e2e/responsive-smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';

test('authenticated home loads through the client-only test server', async ({ page }) => {
  await installAuthenticatedUser(page);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('main')).toBeVisible();
});

test('login remains reachable without an access token', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('form')).toBeVisible();
});
```

Run:

```powershell
npm run test:responsive -- tests/e2e/responsive-smoke.spec.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit the test harness**

```powershell
git add package.json package-lock.json playwright.config.ts tests/e2e/support/auth.ts tests/e2e/support/layout.ts tests/e2e/responsive-smoke.spec.ts
git commit -m "test: add responsive browser test harness"
```

---

### Task 2: Build the responsive primitives and mobile application shell

**Files:**
- Create: `src/components/responsive/useResponsiveLayout.ts`
- Create: `src/components/responsive/ResponsiveSheet.tsx`
- Create: `src/components/responsive/MobileDrawer.tsx`
- Create: `src/components/responsive/ScrollableTabs.tsx`
- Create: `src/components/responsive/StickyActionBar.tsx`
- Create: `src/components/responsive/index.ts`
- Modify: `src/index.css`
- Modify: `src/components/Layout.tsx`
- Create: `tests/e2e/layout-mobile.spec.ts`

**Interfaces:**
- Produces: `useResponsiveLayout(): { isPhone: boolean; isLandscape: boolean; isPhoneLandscape: boolean }` and the four shared responsive components.
- Consumes: existing `Layout` navigation, credit, modal, and header state.

- [ ] **Step 1: Write failing mobile-shell tests**

Create `tests/e2e/layout-mobile.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';
import { expectMinimumTouchTarget, expectNoDocumentOverflow } from './support/layout';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedUser(page);
});

test('mobile header condenses actions into an account menu', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByTestId('mobile-app-header')).toBeVisible();
  await expect(page.getByTestId('desktop-header-tagline')).toBeHidden();
  await expectMinimumTouchTarget(page, '[data-testid="account-menu-trigger"]');
  await page.getByTestId('account-menu-trigger').click();
  await expect(page.getByRole('button', { name: /Nạp Credit/i })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test('floor plan owns the viewport instead of rendering the shared header', async ({ page }) => {
  await page.goto('/tools/floor-plan');
  await expect(page.getByTestId('mobile-app-header')).toBeHidden();
  await expect(page.locator('main')).toBeVisible();
});
```

Run:

```powershell
npm run test:responsive -- tests/e2e/layout-mobile.spec.ts
```

Expected: FAIL because the test IDs and mobile shell do not exist.

- [ ] **Step 2: Implement viewport state without coupling it to domain state**

Create `src/components/responsive/useResponsiveLayout.ts`:

```ts
import { useEffect, useState } from 'react';

const PHONE_QUERY = '(max-width: 639px)';
const LANDSCAPE_QUERY = '(orientation: landscape)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}

export function useResponsiveLayout() {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isLandscape = useMediaQuery(LANDSCAPE_QUERY);
  return { isPhone, isLandscape, isPhoneLandscape: isPhone && isLandscape };
}
```

- [ ] **Step 3: Implement the shared presentation primitives**

Create each component with these exact public props:

```ts
export interface ResponsiveSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  mobileMode?: 'bottom' | 'fullscreen';
  landscapeMode?: 'bottom' | 'side';
  closeDisabled?: boolean;
  testId?: string;
}

export interface MobileDrawerProps {
  open: boolean;
  title: string;
  side?: 'left' | 'right';
  onClose: () => void;
  children: React.ReactNode;
  testId?: string;
}

export interface ScrollableTab {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface ScrollableTabsProps {
  tabs: ScrollableTab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  sticky?: boolean;
  testId?: string;
}

export interface StickyActionBarProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}
```

Use this shell inside `ResponsiveSheet.tsx`; keep the title and footer outside the scrolling body:

```tsx
const { isPhoneLandscape } = useResponsiveLayout();
const panelRef = useRef<HTMLElement>(null);
const titleId = useId();
const placement = isPhoneLandscape && landscapeMode === 'side' ? 'side' : 'bottom';
const panelClassName = placement === 'side'
  ? 'ml-auto flex h-full w-[min(360px,90vw)] flex-col bg-white shadow-2xl'
  : mobileMode === 'fullscreen'
    ? 'flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl'
    : 'absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl bg-white sm:static sm:w-full sm:max-w-lg sm:rounded-2xl';

<div className="fixed inset-0 z-[100] bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4" role="presentation">
  <section
    ref={panelRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    data-testid={testId}
    data-placement={placement}
    className={panelClassName}
  >
    <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:px-6">
      <h2 id={titleId} className="min-w-0 truncate text-lg font-bold">{title}</h2>
      <button aria-label="Đóng" className="flex min-h-11 min-w-11 items-center justify-center rounded-full" disabled={closeDisabled} onClick={onClose}>×</button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
    {footer && <footer className="shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
  </section>
</div>
```

Implement focus entry, `Escape`, body-scroll locking, and trigger-focus restoration in effects inside `ResponsiveSheet`. `MobileDrawer` uses the same focus behavior with a fixed left/right panel. `ScrollableTabs` holds button refs and calls `scrollIntoView({ block: 'nearest', inline: 'center' })` when `activeId` changes. `StickyActionBar` renders:

```tsx
<div data-testid={testId} className={`sticky bottom-0 z-30 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 ${className ?? ''}`}>
  {children}
</div>
```

Export all five modules from `src/components/responsive/index.ts`.

- [ ] **Step 4: Add global viewport and safe-area rules**

Append to `src/index.css`:

```css
@layer base {
  html,
  body,
  #root {
    min-width: 320px;
    min-height: 100%;
  }

  body {
    overflow-x: clip;
  }

  button,
  [role="button"] {
    touch-action: manipulation;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Make `Layout` adaptive and let Floor Plan own its viewport**

In `src/components/Layout.tsx`:

- Define `const isFloorPlan = _currentScreen === '/tools/floor-plan';`.
- Do not render the shared header when `isFloorPlan` is true.
- Add `data-testid="mobile-app-header"` to the header and `data-testid="desktop-header-tagline"` to the tagline.
- Add `data-testid="account-menu-trigger"`, `aria-expanded={showDropdown}`, and a 44px phone target to the profile button.
- Use `h-[100dvh]` on the root.
- Use `px-3 py-2 sm:px-6 sm:py-4` on the header.
- Hide the tagline below `md` with `hidden md:inline`.
- Move pricing and top-up actions into the account dropdown below `md`; retain their existing desktop buttons with `hidden md:flex`.
- Replace the main-content top padding with `pt-14 md:pt-20` while the header is visible, and `pt-0` when it is hidden.
- For Floor Plan, use `overflow-hidden pt-0`; for every other route retain `overflow-auto`.

- [ ] **Step 6: Run shell tests and static verification**

```powershell
npm run test:responsive -- tests/e2e/layout-mobile.spec.ts
npm run typecheck
npm run lint
```

Expected: layout tests pass; TypeScript and ESLint exit 0.

- [ ] **Step 7: Commit the foundation**

```powershell
git add src/index.css src/components/Layout.tsx src/components/responsive tests/e2e/layout-mobile.spec.ts
git commit -m "feat: add mobile responsive foundation"
```

---

### Task 3: Migrate shared overlays and basic screens

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/HistoryModal.tsx`
- Modify: `src/components/Login.tsx`
- Modify: `src/components/ApiKeySetup.tsx`
- Modify: `src/components/HomeScreen.tsx`
- Modify: `src/components/Promo.tsx`
- Create: `tests/e2e/basic-screens-mobile.spec.ts`

**Interfaces:**
- Consumes: `ResponsiveSheet`, `StickyActionBar`, the existing modal callbacks, and existing route navigation.
- Produces: mobile-safe authentication, setup, home, promo, pricing, credit, and transaction-history flows.

- [ ] **Step 1: Write failing basic-screen tests**

Create `tests/e2e/basic-screens-mobile.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';
import { expectNoDocumentOverflow } from './support/layout';

for (const viewport of [
  { width: 360, height: 800 },
  { width: 844, height: 390 },
]) {
  test(`login and home fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await expect(page.locator('form')).toBeVisible();
    await expectNoDocumentOverflow(page);

    await installAuthenticatedUser(page);
    await page.goto('/home');
    await expect(page.getByTestId('tool-card').first()).toBeVisible();
    await expectNoDocumentOverflow(page);

    await page.goto('/setup-api-key');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
}

test('history uses a scrollable full-height phone sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedUser(page);
  await page.route('**/api/v1/users/me/transactions?limit=100', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [] }),
  }));
  await page.goto('/home');
  await page.getByTestId('account-menu-trigger').click();
  await page.getByRole('button', { name: /Lịch sử giao dịch/i }).click();
  await expect(page.getByTestId('history-sheet')).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test('pricing and top-up actions remain reachable from the phone account menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedUser(page);
  await page.goto('/home');
  await page.getByTestId('account-menu-trigger').click();
  await page.getByRole('button', { name: /Bảng giá/i }).click();
  await expect(page.getByTestId('pricing-sheet')).toBeVisible();
  await page.getByTestId('pricing-sheet').getByRole('button', { name: 'Đóng' }).click();
  await page.getByTestId('account-menu-trigger').click();
  await page.getByRole('button', { name: /Nạp Credit/i }).click();
  await expect(page.getByTestId('top-up-sheet')).toBeVisible();
});
```

Run:

```powershell
npm run test:responsive -- tests/e2e/basic-screens-mobile.spec.ts
```

Expected: FAIL because the tool-card and sheet contracts are not present.

- [ ] **Step 2: Convert shared overlays to `ResponsiveSheet`**

In `src/components/Layout.tsx`, replace the duplicated outer overlay/card shells for exhausted credit, QR top-up, and pricing with `ResponsiveSheet`. Preserve all existing inner content and callbacks. Use:

```tsx
<ResponsiveSheet
  open={showPricingModal}
  title="Bảng giá dịch vụ"
  onClose={() => setShowPricingModal(false)}
  mobileMode="fullscreen"
  testId="pricing-sheet"
>
  {pricingSections.map(section => (
    <section key={section.id} className="space-y-3">
      <h4 className="font-bold text-slate-800">{section.title}</h4>
      {section.items.map(item => (
        <article key={item.name} className="grid grid-cols-12 gap-2 py-3">
          <div className="col-span-7 min-w-0">
            <p className="break-words font-bold">{item.name}</p>
            <p className="text-xs text-slate-500">{item.subtitle}</p>
          </div>
          <div className="col-span-3 text-center">
            {typeof item.price === 'string' ? item.price : (
              <table className="w-full text-[10px]">
                <thead><tr>{item.price.headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>{item.price.rows.map(row => <tr key={row.label}><th>{row.label}</th>{row.values.map((value, index) => <td key={`${row.label}-${index}`}>{value}</td>)}</tr>)}</tbody>
              </table>
            )}
          </div>
          <div className="col-span-2 text-right text-xs text-slate-500">{item.unit}</div>
        </article>
      ))}
    </section>
  ))}
</ResponsiveSheet>
```

Use `mobileMode="bottom"` for exhausted-credit confirmation and `mobileMode="fullscreen"` for QR and pricing. Set `testId="top-up-sheet"` on the QR sheet. Put confirmation buttons in the `footer` prop so they remain visible.

In `src/components/HistoryModal.tsx`, retain the public `onClose` prop and wrap transaction content with:

```tsx
<ResponsiveSheet
  open
  title="Lịch sử giao dịch"
  onClose={onClose}
  mobileMode="fullscreen"
  testId="history-sheet"
>
  <div className="space-y-3">
    {loading ? (
      <div role="status" className="py-12 text-center">Đang tải...</div>
    ) : transactions.length === 0 ? (
      <p className="py-12 text-center text-slate-500">Chưa có giao dịch nào.</p>
    ) : transactions.map(tx => {
      const typeInfo = getTypeLabel(tx.type);
      return (
        <article key={tx._id} className="flex flex-col items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{typeInfo.label}</p>
            <p className="break-words text-xs text-slate-500">{formatDate(tx.timestamp)} · {tx.model || 'Unknown model'}</p>
          </div>
          <p className="shrink-0 font-bold">{tx.type === 'topup' ? tx.amount : -tx.amount} Credits</p>
        </article>
      );
    })}
  </div>
</ResponsiveSheet>
```

Change each transaction row to `flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`, and allow model/date metadata to wrap.

- [ ] **Step 3: Apply explicit mobile class changes to the basic routes**

Make these exact class-direction changes:

```text
Login nav:         px-3 py-3 sm:px-6 sm:py-4
Login main:        min-h-[100dvh] overflow-y-auto px-4 pb-8 pt-20
Login card:        p-6 sm:p-8 md:p-12
API Setup root:    min-h-[100dvh] overflow-y-auto p-4 sm:p-6
API Setup card:    p-6 sm:p-10
Home root:         p-4 sm:p-6 lg:p-8
Home grid:         grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8
Home card image:   h-[180px] sm:h-[220px] lg:h-[240px]
Home card body:    p-5 sm:p-6 lg:p-8
Promo root:        min-h-[100dvh] overflow-y-auto px-4 py-20 sm:px-6
```

Add `data-testid="tool-card"` to `ToolCard`. Keep locked-state logic and navigation unchanged. Remove `fixed` positioning from Promo decorative footer and render it in normal flow.

- [ ] **Step 4: Run focused tests and build checks**

```powershell
npm run test:responsive -- tests/e2e/basic-screens-mobile.spec.ts tests/e2e/layout-mobile.spec.ts
npm run typecheck
npm run build
```

Expected: focused browser tests pass; typecheck and build exit 0.

- [ ] **Step 5: Commit shared overlays and basic screens**

```powershell
git add src/components/Layout.tsx src/components/HistoryModal.tsx src/components/Login.tsx src/components/ApiKeySetup.tsx src/components/HomeScreen.tsx src/components/Promo.tsx tests/e2e/basic-screens-mobile.spec.ts
git commit -m "feat: adapt shared screens and overlays for mobile"
```

---

### Task 4: Convert the Rendering shell and Render flow to vertical mobile layout

**Files:**
- Modify: `src/components/Render.tsx`
- Modify: `src/components/render/RenderTabContent.tsx`
- Create: `tests/e2e/rendering-mobile.spec.ts`

**Interfaces:**
- Consumes: `ScrollableTabs`, `StickyActionBar`, current tab names, upload state, and render callbacks.
- Produces: a sticky horizontal main-tab strip and phone document flow with configuration before results.

- [ ] **Step 1: Write failing Rendering layout tests**

Create `tests/e2e/rendering-mobile.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';
import { expectNoDocumentOverflow } from './support/layout';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedUser(page);
  await page.goto('/tools/rendering');
});

test('Rendering uses tabs, configuration, results, and action in vertical order', async ({ page }) => {
  const tabs = page.getByTestId('render-main-tabs');
  const controls = page.getByTestId('render-controls');
  const results = page.getByTestId('render-results');
  const action = page.getByTestId('render-primary-action');

  await expect(tabs).toBeVisible();
  await expect(controls).toBeVisible();
  await expect(results).toBeVisible();
  await expect(action).toBeVisible();

  const controlBox = await controls.boundingBox();
  const resultBox = await results.boundingBox();
  expect(controlBox!.y).toBeLessThan(resultBox!.y);
  await expectNoDocumentOverflow(page);
});

test('Rendering desktop retains side-by-side controls and results', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const controlBox = await page.getByTestId('render-controls').boundingBox();
  const resultBox = await page.getByTestId('render-results').boundingBox();
  expect(Math.abs(controlBox!.y - resultBox!.y)).toBeLessThan(80);
});
```

Run:

```powershell
npm run test:responsive -- tests/e2e/rendering-mobile.spec.ts
```

Expected: FAIL because the stable layout landmarks do not exist.

- [ ] **Step 2: Make the Rendering page shell mobile-first**

In `src/components/Render.tsx`:

- Change the page container from `p-8` to `p-4 sm:p-6 lg:p-8`.
- Change the heading from `text-3xl` to `text-2xl sm:text-3xl`.
- Replace the main tab wrapper with `ScrollableTabs`, using each existing `TABS` string as both `id` and `label`, `activeId={activeTab}`, and `testId="render-main-tabs"`.
- Preserve locked-tab behavior by calling the existing `setPendingTab`/`setShowFeatureModal` branch from `onChange`.
- Use `sticky top-14 z-30 -mx-4 bg-surface px-4 py-2 md:top-20 lg:static lg:mx-0 lg:bg-transparent lg:p-0` for the phone tab container.
- Change the content card to `rounded-none shadow-none sm:rounded-xl sm:shadow-sm` on phones versus larger screens.
- Change the chatbot panel from fixed `w-[460px] h-[640px]` to `fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] h-[min(75dvh,640px)] sm:inset-x-auto sm:right-6 sm:w-[460px]`; keep message state and API behavior unchanged.

- [ ] **Step 3: Make `RenderTabContent` a vertical phone document**

In `src/components/render/RenderTabContent.tsx`:

- Add `data-testid="render-controls"` to the control panel and `data-testid="render-results"` to the result panel.
- Keep the outer direction `flex-col lg:flex-row` and replace `gap-8 min-h-[600px]` with `gap-4 lg:gap-8 lg:min-h-[600px]`.
- Change `w-full lg:w-[380px]` only at `lg`; do not introduce a phone width or `min-width`.
- Replace unconditional `grid-cols-2` form grids with `grid-cols-1 sm:grid-cols-2`.
- Replace fixed result heights with `min-h-[280px] sm:min-h-[420px] lg:min-h-[550px]` and image caps with `max-h-[70dvh] lg:max-h-[800px]`.
- Wrap the existing primary render button in:

```tsx
<StickyActionBar testId="render-primary-action">
  <button className="min-h-11 w-full rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50" disabled={isRendering || !prompt || isUploading || isUploadingRef} onClick={handleRender}>
    {isRendering ? 'Đang xử lý...' : 'Tạo ảnh theo chế độ hiện tại'}
  </button>
</StickyActionBar>
```

Retain the existing subtab-specific idle labels inside this button; do not duplicate `handleRender` or its API state.

- [ ] **Step 4: Verify phone order and desktop regression**

```powershell
npm run test:responsive -- tests/e2e/rendering-mobile.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected: both phone and desktop Rendering tests pass; static checks exit 0.

- [ ] **Step 5: Commit the Rendering shell**

```powershell
git add src/components/Render.tsx src/components/render/RenderTabContent.tsx tests/e2e/rendering-mobile.spec.ts
git commit -m "feat: make Rendering mobile-first"
```

---

### Task 5: Migrate Enhance, Upscale, Sync, and the image library

**Files:**
- Modify: `src/components/render/EnhanceRenderTabContent.tsx`
- Modify: `src/components/render/UpscaleTabContent.tsx`
- Modify: `src/components/render/SyncTabContent.tsx`
- Modify: `src/components/render/ImageLibraryModal.tsx`
- Modify: `tests/e2e/rendering-mobile.spec.ts`

**Interfaces:**
- Consumes: the vertical Rendering shell and responsive primitives from Tasks 2 and 4.
- Produces: consistent configuration-first flows for every active Rendering subtool and a mobile image-library sheet.

- [ ] **Step 1: Extend the Rendering test before changing the subtools**

Append to `tests/e2e/rendering-mobile.spec.ts`:

```ts
for (const tab of ['Upscale', 'Đồng bộ']) {
  test(`${tab} keeps controls before results on phones`, async ({ page }) => {
    await page.getByTestId('render-main-tabs').getByRole('button', { name: tab }).click();
    const controls = page.getByTestId('subtool-controls');
    const results = page.getByTestId('subtool-results');
    await expect(controls).toBeVisible();
    await expect(results).toBeVisible();
    const controlsBox = await controls.boundingBox();
    const resultsBox = await results.boundingBox();
    expect(controlsBox!.y).toBeLessThan(resultsBox!.y);
    await expectNoDocumentOverflow(page);
  });
}
```

Add the missing `expectNoDocumentOverflow` import if Task 4 did not retain it.

Run:

```powershell
npm run test:responsive -- tests/e2e/rendering-mobile.spec.ts
```

Expected: FAIL because `subtool-controls` and `subtool-results` are absent.

- [ ] **Step 2: Apply one explicit responsive contract to all three subtools**

In `EnhanceRenderTabContent.tsx`, `UpscaleTabContent.tsx`, and `SyncTabContent.tsx`:

- Add `data-testid="subtool-controls"` to the left/input panel and `data-testid="subtool-results"` to the result panel.
- Keep `flex-col lg:flex-row`; change gaps to `gap-4 lg:gap-6` or `gap-4 lg:gap-8` matching the existing desktop value.
- Keep fixed panel widths only behind `lg:w-[380px]`.
- Change tab buttons from `w-[220px]` to `min-w-[180px] flex-1 sm:w-[220px] sm:flex-none` inside an overflow-x-auto tab rail.
- Change every settings `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` unless it represents two square image choices; square-image pairs may remain two columns at 360px.
- Change result placeholders from fixed 400–460px heights to `min-h-[280px] sm:min-h-[400px] lg:h-[460px]`.
- Wrap each primary generate action in `StickyActionBar` with `testId="subtool-primary-action"`.
- Keep history rails horizontally scrollable with `snap-x snap-mandatory`, and add `snap-start` to each thumbnail.

- [ ] **Step 3: Convert the image library to a full-screen phone sheet**

In `src/components/render/ImageLibraryModal.tsx`:

- Keep its existing public props unchanged.
- Use `ResponsiveSheet` with `mobileMode="fullscreen"`, `testId="image-library-sheet"`, and the existing `onClose` callback.
- Use `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` for images.
- Put selection confirmation in the sheet footer.
- Render image preview as a nested full-screen overlay with a 44px close control and `max-h-[calc(100dvh-5rem)]` media.

- [ ] **Step 4: Run the complete Rendering suite**

```powershell
npm run test:responsive -- tests/e2e/rendering-mobile.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected: Rendering suite and all static checks pass.

- [ ] **Step 5: Commit the remaining Rendering tools**

```powershell
git add src/components/render/EnhanceRenderTabContent.tsx src/components/render/UpscaleTabContent.tsx src/components/render/SyncTabContent.tsx src/components/render/ImageLibraryModal.tsx tests/e2e/rendering-mobile.spec.ts
git commit -m "feat: adapt Rendering subtools for phones"
```

---

### Task 6: Migrate the secondary creative tools

**Files:**
- Modify: `src/components/TextureLab.tsx`
- Modify: `src/components/HumanEnhancer.tsx`
- Modify: `src/components/Visual.tsx`
- Modify: `src/components/Video.tsx`
- Modify: `src/components/VirtualStaging.tsx`
- Create: `tests/e2e/tools-mobile.spec.ts`

**Interfaces:**
- Consumes: existing control state and media previews; no service or API signature changes.
- Produces: phone document flow with controls before previews and touch-visible actions.

- [ ] **Step 1: Write failing route-fit and content-order tests**

Create `tests/e2e/tools-mobile.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';
import { expectNoDocumentOverflow } from './support/layout';

const routes = [
  '/tools/texture-lab',
  '/tools/human-enhancer',
  '/tools/visual',
  '/tools/video',
  '/tools/virtual-staging',
];

for (const route of routes) {
  test(`${route} fits a 390px phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installAuthenticatedUser(page);
    await page.goto(route);
    await expect(page.getByTestId('tool-controls')).toBeVisible();
    await expect(page.getByTestId('tool-preview')).toBeVisible();
    const controls = await page.getByTestId('tool-controls').boundingBox();
    const preview = await page.getByTestId('tool-preview').boundingBox();
    expect(controls!.y).toBeLessThan(preview!.y);
    await expectNoDocumentOverflow(page);
  });
}
```

Run:

```powershell
npm run test:responsive -- tests/e2e/tools-mobile.spec.ts
```

Expected: FAIL because tool landmarks and mobile ordering are absent.

- [ ] **Step 2: Convert the four smaller tools to document flow**

In `TextureLab.tsx`, `HumanEnhancer.tsx`, `Visual.tsx`, and `Video.tsx`:

- Add `data-testid="tool-controls"` to the settings/input section.
- Add `data-testid="tool-preview"` to the preview/output section.
- Use `flex-col lg:flex-row` at the main split.
- Replace `overflow-hidden` on the phone content container with `overflow-visible lg:overflow-hidden`.
- Replace page padding `p-6` or `px-8` with `p-4 sm:p-6 lg:p-8`.
- Keep desktop widths behind `lg:w-80`, never as unprefixed widths.
- Replace phone preview `min-h-[500px]` with `min-h-[320px] sm:min-h-[420px] lg:min-h-[500px]`.
- Change floating toolbars to `max-w-[calc(100%-2rem)] overflow-x-auto` and give each icon button `min-h-11 min-w-11`.

Do not alter placeholder images, state setters, or action callbacks.

- [ ] **Step 3: Restructure Virtual Staging without moving its domain state**

In `src/components/VirtualStaging.tsx`:

- Change the root from `h-full flex overflow-hidden` to `min-h-full lg:h-full flex flex-col lg:flex-row lg:overflow-hidden`.
- Mark the control section `data-testid="tool-controls"` and use `w-full lg:w-[440px] lg:h-full`.
- Mark the editor/output section `data-testid="tool-preview"` and use `min-h-[420px] p-4 sm:p-6 lg:h-full lg:p-8`.
- Replace `h-[800px]` with `min-h-[520px] h-[70dvh] lg:h-[800px]`.
- Keep drawing/result toolbar items in an `overflow-x-auto` rail with 44px buttons.
- Replace hover-only action groups with `opacity-100 lg:opacity-0 lg:group-hover:opacity-100`; on phones, all required actions remain visible.
- Use `max-h-[calc(100dvh-8rem)]` for phone media rather than desktop calculations based on a 500px sidebar.

- [ ] **Step 4: Verify all secondary tools**

```powershell
npm run test:responsive -- tests/e2e/tools-mobile.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected: 5 tool route tests pass; static checks exit 0.

- [ ] **Step 5: Commit the secondary tools**

```powershell
git add src/components/TextureLab.tsx src/components/HumanEnhancer.tsx src/components/Visual.tsx src/components/Video.tsx src/components/VirtualStaging.tsx tests/e2e/tools-mobile.spec.ts
git commit -m "feat: make creative tools mobile responsive"
```

---

### Task 7: Add a mobile Admin presentation

**Files:**
- Modify: `src/components/AdminPanel.tsx`
- Create: `tests/e2e/admin-mobile.spec.ts`

**Interfaces:**
- Consumes: existing users, image counts, transactions, role-change, credit, key-edit, and delete callbacks.
- Produces: mobile user cards below `lg` and the unchanged desktop table from `lg` upward.

- [ ] **Step 1: Write failing Admin card/table tests**

Create `tests/e2e/admin-mobile.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';
import { expectNoDocumentOverflow } from './support/layout';

async function mockAdminApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/users?limit=1000', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        users: [{
          _id: 'user-1',
          email: 'long.mobile.user@example.com',
          displayName: 'Mobile User',
          role: 'user',
          credits: 100,
        }],
      },
    }),
  }));
  await page.route('**/api/v1/render-jobs/all?limit=10000', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { jobs: [] } }),
  }));
  await page.route('**/api/v1/users/transactions?limit=10000', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { transactions: [] } }),
  }));
}

test('Admin uses user cards on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedUser(page, 'superadmin');
  await mockAdminApi(page);
  await page.goto('/admin');
  await expect(page.getByTestId('admin-user-cards')).toBeVisible();
  await expect(page.getByTestId('admin-user-table')).toBeHidden();
  await expectNoDocumentOverflow(page);
});

test('Admin keeps the user table on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installAuthenticatedUser(page, 'superadmin');
  await mockAdminApi(page);
  await page.goto('/admin');
  await expect(page.getByTestId('admin-user-table')).toBeVisible();
  await expect(page.getByTestId('admin-user-cards')).toBeHidden();
});
```

Run:

```powershell
npm run test:responsive -- tests/e2e/admin-mobile.spec.ts
```

Expected: FAIL because separate mobile and desktop presentations do not exist.

- [ ] **Step 2: Render mobile user cards from the existing user data**

In `src/components/AdminPanel.tsx`, extract no data fetching. Render the existing user array twice with CSS-controlled visibility:

```tsx
<div data-testid="admin-user-cards" className="space-y-3 lg:hidden">
  {users.map(user => (
    <article key={user._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-semibold text-slate-900">{user.email}</p>
          <p className="text-sm text-slate-500">{user.displayName || '—'}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{user.role}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500">Credits</dt><dd className="font-bold text-primary">{Number(user.credits || 0).toFixed(2)}</dd></div>
        <div><dt className="text-slate-500">Hình ảnh</dt><dd className="font-semibold">{imageCounts[user._id] || 0}</dd></div>
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="min-h-11 rounded-xl border border-slate-200" onClick={() => setEditingCreditsUser(user)}>Credits</button>
        <button className="min-h-11 rounded-xl border border-slate-200" onClick={() => handleEditKeys(user)}>Sửa Keys</button>
        <button className="col-span-2 min-h-11 rounded-xl bg-red-50 text-red-600" onClick={() => setDeletingUser(user)}>Xóa người dùng</button>
      </div>
    </article>
  ))}
</div>
```

Add `data-testid="admin-user-table"` and `hidden lg:block` to the existing table container. Reuse the existing callbacks exactly; do not create alternative mutation logic.

- [ ] **Step 3: Adapt Admin summary, filters, tables, and dialogs**

- Use `p-4 sm:p-6 lg:p-8` on the Admin page.
- Use `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` for cost cards.
- Use `flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between` for heading/filter rows.
- Retain `overflow-x-auto` for cost-comparison tables and add a phone-only hint: `Vuốt ngang để xem thêm`.
- Convert edit-key, credit, and delete dialogs to `ResponsiveSheet`; use a bottom sheet for confirmation and full-screen mode for forms on a short landscape viewport.

- [ ] **Step 4: Run Admin verification**

```powershell
npm run test:responsive -- tests/e2e/admin-mobile.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected: phone cards and desktop table tests pass; static checks exit 0.

- [ ] **Step 5: Commit Admin mobile UI**

```powershell
git add src/components/AdminPanel.tsx tests/e2e/admin-mobile.spec.ts
git commit -m "feat: add mobile Admin presentation"
```

---

### Task 8: Build the adaptive Floor Plan workspace and sheets

**Files:**
- Modify: `src/components/render/FloorPlanEditor.tsx`
- Modify: `src/components/render/ChooseShapeModal.tsx`
- Modify: `src/components/render/ChooseRoomsModal.tsx`
- Create: `tests/e2e/floor-plan-mobile.spec.ts`

**Interfaces:**
- Consumes: `useResponsiveLayout`, `ResponsiveSheet`, `MobileDrawer`, existing Floor Plan state, chat state, history, and actions.
- Produces: full-viewport editor, compact app bar, mutually exclusive phone sheets, and landscape side panels without resetting domain state.

- [ ] **Step 1: Write failing editor workspace tests**

Create `tests/e2e/floor-plan-mobile.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';
import { expectNoDocumentOverflow } from './support/layout';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedUser(page);
  await page.goto('/tools/floor-plan');
});

test('editor uses a full viewport canvas and mutually exclusive sheets', async ({ page }) => {
  await expect(page.getByTestId('floor-plan-editor')).toBeVisible();
  await expect(page.getByTestId('floor-plan-canvas')).toBeVisible();
  await page.getByTestId('floor-plan-chat-trigger').click();
  await expect(page.getByTestId('floor-plan-chat-sheet')).toBeVisible();
  await page.getByTestId('floor-plan-chat-sheet').getByRole('button', { name: 'Đóng' }).click();
  await page.getByTestId('floor-plan-config-trigger').click();
  await expect(page.getByTestId('floor-plan-chat-sheet')).toBeHidden();
  await expect(page.getByTestId('floor-plan-config-sheet')).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test('orientation change preserves the project name and open panel', async ({ page }) => {
  await page.getByTestId('floor-plan-project-name').click();
  await page.getByTestId('floor-plan-project-name-input').fill('Mobile House');
  await page.getByTestId('floor-plan-project-name-input').press('Enter');
  await page.getByTestId('floor-plan-chat-trigger').click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByTestId('floor-plan-project-name')).toContainText('Mobile House');
  await expect(page.getByTestId('floor-plan-chat-sheet')).toBeVisible();
  await expect(page.getByTestId('floor-plan-chat-sheet')).toHaveAttribute('data-placement', 'side');
});
```

Run:

```powershell
npm run test:responsive -- tests/e2e/floor-plan-mobile.spec.ts
```

Expected: FAIL because the editor has fixed 380px sidebars and no mobile sheet landmarks.

- [ ] **Step 2: Introduce presentation-only editor panel state**

In `FloorPlanEditor.tsx`, add:

```ts
type MobileEditorPanel = 'chat' | 'config' | 'more' | null;

const { isPhone, isPhoneLandscape } = useResponsiveLayout();
const [mobilePanel, setMobilePanel] = useState<MobileEditorPanel>(null);

const openMobilePanel = (panel: Exclude<MobileEditorPanel, null>) => {
  setMobilePanel(panel);
};
```

Keep `messages`, `floorPlan`, `floorPlans`, `historyStack`, `redoStack`, selection IDs, and configuration state in `FloorPlanEditor`. Do not copy any of those values into a sheet component.

- [ ] **Step 3: Replace the fixed phone workspace structure**

Apply these exact structural rules in `FloorPlanEditor.tsx`:

- Root: `h-[100dvh] w-full overflow-hidden`, `data-testid="floor-plan-editor"`.
- App bar: `h-13 pt-[env(safe-area-inset-top)]`, with Back, truncated project name, Undo, Redo, and More.
- Project-name display/input: `data-testid="floor-plan-project-name"` and `data-testid="floor-plan-project-name-input"`.
- Canvas wrapper: `data-testid="floor-plan-canvas"`, `min-w-0 flex-1 overflow-hidden`.
- Desktop chat sidebar: `hidden lg:flex lg:w-[380px]`.
- Desktop configuration sidebar: `hidden lg:flex lg:w-[380px]`.
- Phone bottom action bar: visible below `lg`, safe-area-aware, with 44px Chat, Config, 2D/3D, and More buttons.
- Add `data-testid="floor-plan-chat-trigger"` and `data-testid="floor-plan-config-trigger"`.
- Put dimensions, labels, export PNG, regenerate, and Render 3D in the More sheet, invoking the current handlers.

Use one `ResponsiveSheet` for each major panel with `open={mobilePanel === 'chat'}` or `open={mobilePanel === 'config'}`. Pass `landscapeMode="side"`; `ResponsiveSheet` supplies the verified `data-placement` attribute. Opening one panel replaces `mobilePanel`, so two major panels cannot coexist.

- [ ] **Step 4: Make Floor Plan selectors phone-fullscreen**

In `ChooseShapeModal.tsx` and `ChooseRoomsModal.tsx`:

- Preserve every existing prop and selection callback.
- Replace fixed centered shells with `ResponsiveSheet mobileMode="fullscreen" landscapeMode="side"`.
- Change modal `h-[95vh]` to sheet-controlled height.
- Keep preview/list content in the scrolling body.
- Put the existing confirm button in the sticky footer.
- Keep shape thumbnails in a two-column phone grid and allow horizontal scrolling only for the existing preview option strip.

Apply the same full-screen sheet shell to the style and finish selectors defined inside `FloorPlanEditor.tsx`, retaining their current state and callbacks.

- [ ] **Step 5: Run workspace and state-retention tests**

```powershell
npm run test:responsive -- tests/e2e/floor-plan-mobile.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected: workspace, exclusivity, and orientation-state tests pass; static checks exit 0.

- [ ] **Step 6: Commit the adaptive Floor Plan shell**

```powershell
git add src/components/render/FloorPlanEditor.tsx src/components/render/ChooseShapeModal.tsx src/components/render/ChooseRoomsModal.tsx tests/e2e/floor-plan-mobile.spec.ts
git commit -m "feat: add adaptive Floor Plan mobile workspace"
```

---

### Task 9: Add Floor Plan touch gestures and responsive 3D controls

**Files:**
- Modify: `src/components/render/FloorPlanEditor.tsx`
- Modify: `src/components/render/FloorPlan3DViewer.tsx`
- Create: `tests/e2e/floor-plan-gestures.spec.ts`

**Interfaces:**
- Produces: pointer-based `tap`, `drag`, `pan`, and `pinch` behavior while retaining existing mouse/wheel behavior.
- Consumes: existing `zoom`, pan/offset, selection, drag, drawing-mode, and `ResizeObserver` state.

- [ ] **Step 1: Write failing pointer-gesture tests**

Create `tests/e2e/floor-plan-gestures.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedUser(page);
  await page.goto('/tools/floor-plan');
});

test('two-pointer pinch changes zoom without opening a panel', async ({ page }) => {
  const canvas = page.getByTestId('floor-plan-canvas');
  const box = await canvas.boundingBox();
  const before = Number(await canvas.getAttribute('data-zoom'));

  await page.evaluate(({ x, y }) => {
    const target = document.querySelector('[data-testid="floor-plan-canvas"]')!;
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: x + 130, clientY: y + 220, bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: x + 230, clientY: y + 220, bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: x + 100, clientY: y + 220, bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, pointerType: 'touch', clientX: x + 260, clientY: y + 220, bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', bubbles: true }));
  }, { x: box!.x, y: box!.y });

  const after = Number(await canvas.getAttribute('data-zoom'));
  expect(after).toBeGreaterThan(before);
  await expect(page.getByTestId('floor-plan-chat-sheet')).toBeHidden();
});
```

Run:

```powershell
npm run test:responsive -- tests/e2e/floor-plan-gestures.spec.ts
```

Expected: FAIL because the canvas has no touch-pointer gesture state or `data-zoom` contract.

- [ ] **Step 2: Implement a pointer registry and gesture discriminator**

In `FloorPlanEditor.tsx`, add refs and helpers adjacent to the existing wheel-zoom logic:

```ts
type PointerPoint = { x: number; y: number };

const activePointersRef = useRef(new Map<number, PointerPoint>());
const pinchStartRef = useRef<{ distance: number; zoom: number; center: PointerPoint } | null>(null);

const pointerDistance = (points: PointerPoint[]) =>
  Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

const pointerCenter = (points: PointerPoint[]): PointerPoint => ({
  x: (points[0].x + points[1].x) / 2,
  y: (points[0].y + points[1].y) / 2,
});
```

Attach `onPointerDown`, `onPointerMove`, `onPointerUp`, and `onPointerCancel` to the canvas interaction layer. Use `setPointerCapture` for active pointers. When two touch pointers are registered:

1. Cancel any pending one-pointer object drag that has not crossed its drag threshold.
2. Record start distance, current zoom, and center.
3. On move, set zoom to `clamp(startZoom * currentDistance / startDistance, MIN_ZOOM, MAX_ZOOM)`.
4. Adjust the existing canvas offset so the gesture center remains visually stationary.
5. Prevent drawing and object movement until the pointer count falls below two.

When one touch pointer is registered, route movement to the existing selection/object-drag behavior in edit mode. Route empty-canvas movement to pan only after the existing movement threshold. Keep the wheel listener unchanged for mouse users.

Add `touch-none` and `data-zoom={zoom}` to the canvas interaction layer.

- [ ] **Step 3: Make 3D controls phone-safe**

In `FloorPlan3DViewer.tsx`:

- Add `data-testid="floor-plan-3d-viewer"` to its container.
- Keep the existing `ResizeObserver` and renderer-resize behavior.
- Group secondary controls under a phone-only expandable `Điều khiển 3D` button with `aria-expanded`.
- Keep navigation mode, reset view, and 2D return directly accessible with 44px targets.
- Use `max-w-[calc(100vw-2rem)] overflow-x-auto` for any remaining control rail.
- Use safe-area offsets for bottom/right overlays.

- [ ] **Step 4: Run gesture, Floor Plan, and desktop checks**

```powershell
npm run test:responsive -- tests/e2e/floor-plan-gestures.spec.ts tests/e2e/floor-plan-mobile.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected: touch gesture and workspace tests pass; mouse/wheel code typechecks; build exits 0.

- [ ] **Step 5: Commit touch and 3D behavior**

```powershell
git add src/components/render/FloorPlanEditor.tsx src/components/render/FloorPlan3DViewer.tsx tests/e2e/floor-plan-gestures.spec.ts
git commit -m "feat: add Floor Plan touch gestures"
```

---

### Task 10: Complete the viewport matrix and visual regression gate

**Files:**
- Modify: `tests/e2e/responsive-smoke.spec.ts`
- Create: `tests/e2e/visual-regression.spec.ts`
- Create: `tests/e2e/visual-regression.spec.ts-snapshots/` (generated by Playwright)
- Modify: `README.md`

**Interfaces:**
- Consumes: all responsive route landmarks and test helpers from earlier tasks.
- Produces: final route matrix, visual baselines, and documented verification commands.

- [ ] **Step 1: Expand the smoke test to the complete route and viewport matrix**

Replace `tests/e2e/responsive-smoke.spec.ts` with:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';
import { expectNoDocumentOverflow } from './support/layout';

const viewports = [
  { name: 'small-phone', width: 360, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'large-phone', width: 430, height: 932 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const routes = [
  '/home',
  '/tools/rendering',
  '/tools/floor-plan',
  '/tools/texture-lab',
  '/tools/human-enhancer',
  '/tools/virtual-staging',
  '/tools/visual',
  '/tools/video',
  '/promo',
];

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route} has no document overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await installAuthenticatedUser(page);
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await expectNoDocumentOverflow(page);
    });
  }
}
```

Run:

```powershell
npm run test:responsive -- tests/e2e/responsive-smoke.spec.ts
```

Expected: every route/viewport case passes.

- [ ] **Step 2: Add stable visual baselines**

Create `tests/e2e/visual-regression.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installAuthenticatedUser } from './support/auth';

const cases = [
  { name: 'home-phone', route: '/home', width: 390, height: 844 },
  { name: 'render-phone', route: '/tools/rendering', width: 390, height: 844 },
  { name: 'floor-plan-phone', route: '/tools/floor-plan', width: 390, height: 844 },
  { name: 'floor-plan-landscape', route: '/tools/floor-plan', width: 844, height: 390 },
  { name: 'home-desktop', route: '/home', width: 1440, height: 900 },
  { name: 'render-desktop', route: '/tools/rendering', width: 1440, height: 900 },
];

for (const item of cases) {
  test(`${item.name} visual baseline`, async ({ page }) => {
    await page.setViewportSize({ width: item.width, height: item.height });
    await installAuthenticatedUser(page);
    await page.goto(item.route);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await expect(page).toHaveScreenshot(`${item.name}.png`, {
      animations: 'disabled',
      fullPage: item.route !== '/tools/floor-plan',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.02,
    });
  });
}
```

Generate baselines:

```powershell
npm run test:responsive:update -- tests/e2e/visual-regression.spec.ts
```

Expected: six baseline PNG files are created and the visual suite passes.

- [ ] **Step 3: Document responsive verification**

Append to `README.md`:

````markdown
## Responsive verification

Install the Chromium test browser once:

```bash
npx playwright install chromium
```

Run type, lint, build, and mobile/desktop browser checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:responsive
```

Update visual baselines only after reviewing intentional UI changes:

```bash
npm run test:responsive:update -- tests/e2e/visual-regression.spec.ts
```
````

- [ ] **Step 4: Run the final verification gate**

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:responsive
git diff --check
```

Expected: all commands exit 0, all route/viewport and visual tests pass, and `git diff --check` prints no errors.

- [ ] **Step 5: Commit final regression coverage**

```powershell
git add README.md tests/e2e/responsive-smoke.spec.ts tests/e2e/visual-regression.spec.ts tests/e2e/visual-regression.spec.ts-snapshots
git commit -m "test: add responsive regression matrix"
```

---

## Implementation Completion Checklist

- [ ] All ten tasks are committed independently in the listed order.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:responsive` passes at all approved viewport sizes.
- [ ] Manual iOS Safari verification covers dynamic browser bars, software keyboard, upload, and safe areas.
- [ ] Manual Android Chrome verification covers upload, sticky actions, sheets, and Floor Plan gestures.
- [ ] Desktop at `1440x900` retains the existing workflows and visual hierarchy.
- [ ] No user-owned files outside the task are included in responsive commits.
