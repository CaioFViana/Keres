import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import DatePickerModal from '../../src/components/common/inputs/DatePickerInput/DatePickerModal';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ddf',
      shadow: '#000',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

let mockUse24HourTime = true;
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector: (state: { use24HourTime: boolean }) => unknown) =>
    selector({ use24HourTime: mockUse24HourTime }),
}));

beforeEach(() => {
  mockUse24HourTime = true;
});

async function renderModal(value: string | null) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const screen = await render(
    <DatePickerModal value={value} onSelect={onSelect} onClose={onClose} title="Birth date" />,
  );
  return { screen, onSelect, onClose };
}

describe('DatePickerModal', () => {
  it('opens on the month of the current value and previews it with the weekday', async () => {
    const { screen } = await renderModal('2024-01-15');

    // 2024-01-15 was a Monday.
    expect(screen.getByTestId('date-picker-preview').props.children).toContain('Monday');
    expect(screen.getByTestId('date-picker-month').props.children).toContain('January');
    expect(screen.getByTestId('date-picker-year').props.value).toBe('2024');
  });

  it('emits a canonical date-only value when a day is picked', async () => {
    const { screen, onSelect } = await renderModal('2024-01-15');

    await fireEvent.press(screen.getByTestId('date-picker-day-20'));
    await fireEvent.press(screen.getByTestId('date-picker-confirm'));

    expect(onSelect).toHaveBeenCalledWith('2024-01-20');
  });

  it('appends the time only after "include time" is switched on', async () => {
    const { screen, onSelect } = await renderModal('2024-01-15');

    expect(screen.queryByTestId('date-picker-hour')).toBeNull();

    await fireEvent(screen.getByTestId('date-picker-include-time'), 'valueChange', true);
    await fireEvent.changeText(screen.getByTestId('date-picker-hour'), '10');
    await fireEvent.changeText(screen.getByTestId('date-picker-minute'), '30');
    await fireEvent.press(screen.getByTestId('date-picker-confirm'));

    expect(onSelect).toHaveBeenCalledWith('2024-01-15T10:30');
  });

  it('reopens an existing timed value with the time already on', async () => {
    const { screen, onSelect } = await renderModal('2024-01-15T22:05');

    expect(screen.getByTestId('date-picker-hour').props.value).toBe('22');
    expect(screen.getByTestId('date-picker-minute').props.value).toBe('05');

    await fireEvent.press(screen.getByTestId('date-picker-confirm'));
    expect(onSelect).toHaveBeenCalledWith('2024-01-15T22:05');
  });

  it('lets a two-digit hour be typed one digit at a time', async () => {
    const { screen, onSelect } = await renderModal('2024-01-15T00:00');

    // Regressão: o campo espelhava `String(hour).padStart(2, '0')`, então o primeiro dígito
    // virava "01" na hora e `maxLength={2}` recusava o segundo - "19" era impossível de digitar.
    await fireEvent.changeText(screen.getByTestId('date-picker-hour'), '1');
    expect(screen.getByTestId('date-picker-hour').props.value).toBe('1');

    await fireEvent.changeText(screen.getByTestId('date-picker-hour'), '19');
    expect(screen.getByTestId('date-picker-hour').props.value).toBe('19');

    await fireEvent.press(screen.getByTestId('date-picker-confirm'));
    expect(onSelect).toHaveBeenCalledWith('2024-01-15T19:00');
  });

  it('pads the time back out when the field loses focus', async () => {
    const { screen } = await renderModal('2024-01-15T00:00');

    await fireEvent.changeText(screen.getByTestId('date-picker-hour'), '7');
    expect(screen.getByTestId('date-picker-hour').props.value).toBe('7');

    await fireEvent(screen.getByTestId('date-picker-hour'), 'blur');
    expect(screen.getByTestId('date-picker-hour').props.value).toBe('07');
  });

  it('clamps hours and minutes to a real clock', async () => {
    const { screen, onSelect } = await renderModal('2024-01-15T00:00');

    await fireEvent.changeText(screen.getByTestId('date-picker-hour'), '99');
    await fireEvent.changeText(screen.getByTestId('date-picker-minute'), '77');
    await fireEvent.press(screen.getByTestId('date-picker-confirm'));

    expect(onSelect).toHaveBeenCalledWith('2024-01-15T23:59');
  });

  it('shortens a day that does not exist in the month navigated to', async () => {
    const { screen, onSelect } = await renderModal('2024-01-31');

    // January 31 -> February, which has 29 days in 2024.
    await fireEvent.press(screen.getByTestId('date-picker-next-month'));
    await fireEvent.press(screen.getByTestId('date-picker-confirm'));

    expect(onSelect).toHaveBeenCalledWith('2024-02-29');
  });

  it('crosses the year boundary when paging past december', async () => {
    const { screen, onSelect } = await renderModal('2024-12-10');

    await fireEvent.press(screen.getByTestId('date-picker-next-month'));
    await fireEvent.press(screen.getByTestId('date-picker-confirm'));

    expect(onSelect).toHaveBeenCalledWith('2025-01-10');
  });

  describe('with the AM/PM setting on', () => {
    beforeEach(() => {
      mockUse24HourTime = false;
    });

    it('shows an afternoon hour on a 12-hour clock but still stores 24-hour', async () => {
      const { screen, onSelect } = await renderModal('2024-01-15T14:30');

      expect(screen.getByTestId('date-picker-hour').props.value).toBe('02');
      expect(screen.getByText('attribute_date_pm')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('date-picker-confirm'));
      expect(onSelect).toHaveBeenCalledWith('2024-01-15T14:30');
    });

    it('converts to the afternoon when the period is switched to PM', async () => {
      const { screen, onSelect } = await renderModal('2024-01-15T09:00');

      await fireEvent.press(screen.getByTestId('date-picker-period'));
      await fireEvent.press(screen.getByTestId('date-picker-confirm'));

      expect(onSelect).toHaveBeenCalledWith('2024-01-15T21:00');
    });

    it('treats 12 AM as midnight and 12 PM as noon', async () => {
      const { screen, onSelect } = await renderModal('2024-01-15T00:00');

      // Midnight reads as 12 AM on a 12-hour clock.
      expect(screen.getByTestId('date-picker-hour').props.value).toBe('12');

      await fireEvent.press(screen.getByTestId('date-picker-period'));
      await fireEvent.press(screen.getByTestId('date-picker-confirm'));
      expect(onSelect).toHaveBeenCalledWith('2024-01-15T12:00');
    });

    it('does not show the period button in 24-hour mode', async () => {
      mockUse24HourTime = true;
      const { screen } = await renderModal('2024-01-15T14:30');

      expect(screen.queryByTestId('date-picker-period')).toBeNull();
      expect(screen.getByTestId('date-picker-hour').props.value).toBe('14');
    });
  });

  it('emits null when cleared', async () => {
    const { screen, onSelect } = await renderModal('2024-01-15');

    await fireEvent.press(screen.getByTestId('date-picker-clear'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('keeps a legacy free-text value untouched until something is confirmed', async () => {
    const { screen, onSelect, onClose } = await renderModal('sometime next spring');

    expect(screen.getByTestId('date-picker-preview').props.children).toBe('attribute_date_no_date');

    await fireEvent.press(screen.getByTestId('date-picker-confirm'));
    expect(onSelect).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
