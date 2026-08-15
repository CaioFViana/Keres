import {
  AttributeDateParts,
  attributeDateWeekday,
  attributeDateWeekdayLabels,
  daysInMonth,
  formatAttributeDate,
  formatAttributeDateForDisplay,
  formatAttributeDateMonthLabel,
  MAX_ATTRIBUTE_DATE_YEAR,
  MIN_ATTRIBUTE_DATE_YEAR,
  parseAttributeDate,
} from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '../../../../theme';

interface DatePickerModalProps {
  /** Canonical value, or anything else - a value this picker cannot read is kept, not erased. */
  value: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
  title?: string;
}

const WEEKDAYS_IN_ROW = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calendário de data (com hora opcional) para `AttributeType.DATE`. Espelha a estrutura de
 * `ColorPickerModal`: mantém a escolha em estado local e só a devolve no "Selecionar", para
 * que sair pelo "Cancelar" não altere nada.
 *
 * Nenhuma conta de fuso horário acontece aqui - os componentes de data são manipulados como
 * números e serializados por `formatAttributeDate`. Ver `attributeDateValue.ts` para o porquê.
 */
const DatePickerModal: React.FC<DatePickerModalProps> = ({ value, onSelect, onClose, title }) => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const parsed = useMemo(() => parseAttributeDate(value), [value]);
  // Sem valor legível, abre no mês de hoje - e "hoje" é o do fuso de quem está escrevendo,
  // o único ponto em que o relógio do sistema legitimamente participa.
  const today = useMemo(() => new Date(), []);

  const [year, setYear] = useState(parsed?.year ?? today.getFullYear());
  const [month, setMonth] = useState(parsed?.month ?? today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(parsed?.day ?? null);
  const [includeTime, setIncludeTime] = useState(parsed !== null && parsed.hour !== null);
  const [hour, setHour] = useState(parsed?.hour ?? 0);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const [yearText, setYearText] = useState(String(parsed?.year ?? today.getFullYear()));

  const monthLength = daysInMonth(year, month);
  const currentParts: AttributeDateParts | null =
    selectedDay === null
      ? null
      : {
          year,
          month,
          day: Math.min(selectedDay, monthLength),
          hour: includeTime ? hour : null,
          minute: includeTime ? minute : null,
        };

  const previewText = currentParts
    ? (formatAttributeDateForDisplay(formatAttributeDate(currentParts), language) ??
      formatAttributeDate(currentParts))
    : t('attribute_date_no_date');

  const weekdayLabels = useMemo(() => attributeDateWeekdayLabels(language), [language]);
  const monthLabel = formatAttributeDateMonthLabel(year, month, language);

  // Quantas células vazias antes do dia 1, para que ele caia sob o dia da semana certo.
  const leadingBlanks = attributeDateWeekday({
    year,
    month,
    day: 1,
    hour: null,
    minute: null,
  });

  const applyYear = (nextYear: number) => {
    const safeYear = clamp(nextYear, MIN_ATTRIBUTE_DATE_YEAR, MAX_ATTRIBUTE_DATE_YEAR);
    setYear(safeYear);
    setYearText(String(safeYear));
  };

  const shiftMonth = (delta: number) => {
    const zeroBased = month - 1 + delta;
    const nextYear = year + Math.floor(zeroBased / 12);
    const nextMonth = (((zeroBased % 12) + 12) % 12) + 1;
    if (nextYear < MIN_ATTRIBUTE_DATE_YEAR || nextYear > MAX_ATTRIBUTE_DATE_YEAR) {
      return;
    }
    applyYear(nextYear);
    setMonth(nextMonth);
    // Um dia 31 selecionado não pode sobreviver a um mês de 30 - encurta em vez de sumir.
    setSelectedDay((current) =>
      current === null ? null : Math.min(current, daysInMonth(nextYear, nextMonth)),
    );
  };

  const goToToday = () => {
    applyYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(today.getDate());
  };

  const handleConfirm = () => {
    onSelect(currentParts ? formatAttributeDate(currentParts) : null);
  };

  const styles = StyleSheet.create({
    container: { backgroundColor: colors.background, flexShrink: 1 },
    content: { padding: 20 },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 12,
      color: colors.text,
      textAlign: 'center',
    },
    preview: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 16,
      textTransform: 'capitalize',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    navButton: { padding: 8 },
    monthLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      textTransform: 'capitalize',
    },
    yearRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    yearLabel: { color: colors.textSecondary, fontSize: 13, marginRight: 8 },
    yearInput: { width: 90, height: 40, marginBottom: 0 },
    weekRow: { flexDirection: 'row' },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
    },
    weekdayText: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase' },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      margin: 1,
    },
    dayCellSelected: { backgroundColor: colors.primary },
    dayText: { fontSize: 15, color: colors.text },
    dayTextSelected: { color: colors.onPrimary, fontWeight: 'bold' },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    timeLabel: { fontSize: 15, color: colors.text },
    timeInputs: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    timeInput: { width: 64, height: 44, marginBottom: 0, textAlign: 'center' },
    timeSeparator: { fontSize: 20, color: colors.text, marginHorizontal: 8 },
    secondaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    secondaryButton: { width: '47%', backgroundColor: colors.surface },
    secondaryButtonText: { color: colors.text },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    actionButton: { width: '47%' },
  });

  const dayCells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: monthLength }, (_, index) => index + 1),
  ];
  while (dayCells.length % WEEKDAYS_IN_ROW !== 0) {
    dayCells.push(null);
  }
  const dayRows = Array.from({ length: dayCells.length / WEEKDAYS_IN_ROW }, (_, rowIndex) =>
    dayCells.slice(rowIndex * WEEKDAYS_IN_ROW, (rowIndex + 1) * WEEKDAYS_IN_ROW),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {title && <Text style={styles.title}>{title}</Text>}

      <Text style={styles.preview} testID="date-picker-preview">
        {previewText}
      </Text>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => shiftMonth(-1)}
          testID="date-picker-prev-month"
          accessibilityLabel={t('attribute_date_previous_month')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel} testID="date-picker-month">
          {monthLabel}
        </Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => shiftMonth(1)}
          testID="date-picker-next-month"
          accessibilityLabel={t('attribute_date_next_month')}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.yearRow}>
        <Text style={styles.yearLabel}>{t('attribute_date_year')}</Text>
        <TextInput
          style={styles.yearInput}
          value={yearText}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9]/g, '').slice(0, 4);
            setYearText(digits);
            const parsedYear = Number(digits);
            if (digits && Number.isFinite(parsedYear) && parsedYear >= MIN_ATTRIBUTE_DATE_YEAR) {
              setYear(clamp(parsedYear, MIN_ATTRIBUTE_DATE_YEAR, MAX_ATTRIBUTE_DATE_YEAR));
            }
          }}
          onBlur={() => applyYear(Number(yearText) || year)}
          keyboardType="numeric"
          testID="date-picker-year"
        />
      </View>

      <View style={styles.weekRow}>
        {weekdayLabels.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      {dayRows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.weekRow}>
          {row.map((day, columnIndex) => {
            if (day === null) {
              return <View key={`blank-${rowIndex}-${columnIndex}`} style={styles.dayCell} />;
            }
            const isSelected = currentParts?.day === day;
            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                onPress={() => setSelectedDay(day)}
                testID={`date-picker-day-${day}`}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>{t('attribute_date_include_time')}</Text>
        <ThemedSwitch
          value={includeTime}
          onValueChange={setIncludeTime}
          testID="date-picker-include-time"
        />
      </View>

      {includeTime && (
        <View style={styles.timeInputs}>
          <TextInput
            style={styles.timeInput}
            value={String(hour).padStart(2, '0')}
            onChangeText={(text) => setHour(clamp(Number(text.replace(/[^0-9]/g, '')) || 0, 0, 23))}
            keyboardType="numeric"
            maxLength={2}
            accessibilityLabel={t('attribute_date_hour')}
            testID="date-picker-hour"
          />
          <Text style={styles.timeSeparator}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={String(minute).padStart(2, '0')}
            onChangeText={(text) =>
              setMinute(clamp(Number(text.replace(/[^0-9]/g, '')) || 0, 0, 59))
            }
            keyboardType="numeric"
            maxLength={2}
            accessibilityLabel={t('attribute_date_minute')}
            testID="date-picker-minute"
          />
        </View>
      )}

      <View style={styles.secondaryRow}>
        <Button onPress={goToToday} style={styles.secondaryButton} testID="date-picker-today">
          <Text style={styles.secondaryButtonText}>{t('attribute_date_today')}</Text>
        </Button>
        <Button
          onPress={() => onSelect(null)}
          style={styles.secondaryButton}
          testID="date-picker-clear"
        >
          <Text style={styles.secondaryButtonText}>{t('attribute_date_clear')}</Text>
        </Button>
      </View>

      <View style={styles.actionRow}>
        <Button
          onPress={onClose}
          style={[styles.actionButton, { backgroundColor: colors.textSecondary }]}
        >
          {t('cancel')}
        </Button>
        <Button
          onPress={handleConfirm}
          disabled={currentParts === null}
          style={styles.actionButton}
          testID="date-picker-confirm"
        >
          {t('select')}
        </Button>
      </View>
    </ScrollView>
  );
};

export default DatePickerModal;
