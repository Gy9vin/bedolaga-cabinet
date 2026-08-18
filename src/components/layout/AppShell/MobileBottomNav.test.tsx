// @vitest-environment jsdom
/**
 * MobileBottomNav — находка 3 разбора макета: в простом режиме таббар
 * терял пункт «Профиль», потому что coreItems (полный режим) никогда его
 * не содержит, а filterNavForSimpleMode умеет только вычитать пункты, а не
 * добавлять. Правка собирает простой таббар явным списком из четырёх
 * разделов. Проверяем: профиль присутствует, порядок и состав верны,
 * referralEnabled по-прежнему может убрать раздел рефералов.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { MobileBottomNav } from './MobileBottomNav';

vi.mock('@/platform', () => ({
  usePlatform: () => ({ haptic: { impact: vi.fn(), notification: vi.fn() } }),
}));

let mockIsSimple = false;
vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => ({ isSimple: mockIsSimple }),
}));

afterEach(() => {
  cleanup();
  mockIsSimple = false;
});

function r(referralEnabled = true, wheelEnabled = false) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <MobileBottomNav
          isKeyboardOpen={false}
          referralEnabled={referralEnabled}
          wheelEnabled={wheelEnabled}
        />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function linkPaths() {
  return screen.getAllByRole('link').map((link) => link.getAttribute('href'));
}

describe('MobileBottomNav', () => {
  it('полный режим: профиля в таббаре нет (он в гамбургер-меню)', () => {
    mockIsSimple = false;
    r();
    expect(linkPaths()).not.toContain('/profile');
  });

  it('простой режим: таббар содержит ровно четыре раздела, включая профиль', () => {
    mockIsSimple = true;
    r(true);
    expect(linkPaths()).toEqual(['/', '/subscriptions', '/referral', '/profile']);
  });

  it('простой режим без рефералов: таббар из трёх разделов, профиль остаётся', () => {
    mockIsSimple = true;
    r(false);
    expect(linkPaths()).toEqual(['/', '/subscriptions', '/profile']);
  });
});
