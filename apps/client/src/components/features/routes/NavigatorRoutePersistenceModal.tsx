import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { Route } from '@keres/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';

export type NavigatorRoutePersistenceMode = 'new' | 'replace';

interface Props {
  visible: boolean;
  mode: NavigatorRoutePersistenceMode;
  routes: Route[];
  suggestedName: string;
  stepCount: number;
  onClose: () => void;
  onConfirm: (value: { name?: string; routeId?: string }) => void;
}

/**
 * Makes the Navigator's only persistence boundary unmistakable. The simulation itself stays
 * untouched until the author names a new Route or selects one to replace and confirms again.
 */
export default function NavigatorRoutePersistenceModal({
  visible,
  mode,
  routes,
  suggestedName,
  stepCount,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const input = getCommonInputStyles(colors);
  const [name, setName] = useState(suggestedName);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(suggestedName);
    setRouteId(routes[0]?.id ?? null);
    setError(null);
  }, [routes, suggestedName, visible]);

  const routeOptions = useMemo(
    () => routes.map((route) => ({ value: route.id, label: route.name })),
    [routes],
  );
  const submit = () => {
    if (mode === 'new' && !name.trim()) {
      setError(t('route_name_required'));
      return;
    }
    if (mode === 'replace' && !routeId) {
      setError(t('navigator_select_route_to_replace'));
      return;
    }
    onConfirm(mode === 'new' ? { name: name.trim() } : { routeId: routeId! });
  };
  const styles = StyleSheet.create({
    sheet: { backgroundColor: colors.background, borderRadius: 10, padding: 20 },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    description: { color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
    field: { marginBottom: 14, paddingHorizontal: 2, paddingVertical: 2 },
    label: { color: colors.text, fontSize: 16, marginBottom: 5 },
    error: { color: colors.error, fontSize: 13, marginTop: 5 },
  });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      contentStyle={styles.sheet}
      maxHeight="86%"
    >
      <Text style={styles.title}>
        {mode === 'new' ? t('navigator_save_as_route') : t('navigator_replace_route')}
      </Text>
      <Text style={styles.description}>
        {t('navigator_route_steps_ready', { count: stepCount })}
      </Text>
      {mode === 'new' ? (
        <View style={styles.field}>
          <Text style={styles.label}>{t('route_name')}</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError(null);
            }}
            placeholder={t('route_name_placeholder')}
            style={input.input}
          />
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>{t('navigator_route_to_replace')}</Text>
          <Select
            options={routeOptions}
            value={routeId}
            onValueChange={(value) => {
              setRouteId(value);
              setError(null);
            }}
            placeholder={t('navigator_select_route_to_replace')}
            multiple={false}
          />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FormActions>
        <Button onPress={onClose}>{t('cancel')}</Button>
        <Button onPress={submit}>{t('continue')}</Button>
      </FormActions>
    </ResponsiveModal>
  );
}
