import type { AgeVerificationInfo } from '@keres/shared';
import { useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { blocksNewAccounts } from '../../../utils/ageVerificationRules';
import { useTheme, type ThemeColors } from '../../../theme';

export interface AgeVerificationNoticeProps {
  /** What the server says about age; null while unknown or unreadable, and then nothing is said. */
  info: AgeVerificationInfo | null;
  testID?: string;
}

/**
 * What the server's age check means for someone creating an account there, shown beside the 18+ confirmation.
 * A server that verifies says where the documents go; a server that does not says so too, because a server with no
 * verification must never look verified. A server that verifies but cannot right now blocks the account: the
 * registration refuses it as well, this only says why before the person tries.
 */
const AgeVerificationNotice: FC<AgeVerificationNoticeProps> = ({ info, testID }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!info) return null;
  if (info.mode !== 'required') {
    return (
      <Text style={styles.text} testID={testID}>
        {t('age_verification_disabled_notice')}
      </Text>
    );
  }
  if (blocksNewAccounts(info)) {
    return (
      <Text style={styles.blocked} testID={testID}>
        {t('age_verification_unavailable')}
      </Text>
    );
  }
  return (
    <Text style={styles.text} testID={testID}>
      {t('age_verification_required_notice')}
    </Text>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    text: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
    blocked: { fontSize: 14, color: colors.error, marginBottom: 12 },
  });

export default AgeVerificationNotice;
