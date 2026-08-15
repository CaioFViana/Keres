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
