import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StorageUnit, splitBytes, toBytes } from './storageUnits';

/**
 * A storage ceiling typed the way people think of it ("100" and "Megabytes"), stored as bytes.
 * It keeps its own text and unit: the stored number alone cannot say that "1." is on its way to
 * "1.5". Mount it with a key that changes when another record is loaded.
 */
export function StorageLimitInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (bytes: number | null) => void;
}) {
  const { t } = useTranslation('admin');
  const initial = splitBytes(value);
  const [amount, setAmount] = useState(initial.amount === null ? '' : String(initial.amount));
  const [unit, setUnit] = useState<StorageUnit>(initial.unit);

  const emit = (text: string, chosen: StorageUnit) => {
    const parsed = text.trim() === '' ? null : Number(text);
    onChange(parsed !== null && Number.isFinite(parsed) ? toBytes(parsed, chosen) : null);
  };

  return (
    <label>
      {label} <span className="hint">{t('common.blankUnlimited')}</span>
      <span className="storage-input">
        <input
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            emit(e.target.value, unit);
          }}
        />
        <select
          aria-label={t('tiers.storageUnit')}
          value={unit}
          onChange={(e) => {
            const chosen = e.target.value as StorageUnit;
            setUnit(chosen);
            emit(amount, chosen);
          }}
        >
          <option value="B">{t('tiers.unitBytes')}</option>
          <option value="KB">{t('tiers.unitKilobytes')}</option>
          <option value="MB">{t('tiers.unitMegabytes')}</option>
          <option value="GB">{t('tiers.unitGigabytes')}</option>
        </select>
      </span>
    </label>
  );
}
