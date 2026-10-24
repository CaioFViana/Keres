import { useTranslation } from 'react-i18next';
import TermsModal, {
  type TermsSection,
} from '@/src/components/features/servers/TermsModal/TermsModal';

/** A server's terms or privacy policy waiting for agreement: the text to read, and which version it is. */
export interface PendingServerLegal {
  version: number;
  updatedAt: string;
  sections: TermsSection[];
  text: string;
}

interface ServerLegalModalsProps {
  terms: PendingServerLegal | null;
  privacy: PendingServerLegal | null;
  onAgreeTerms: () => void;
  onAgreePrivacy: () => void;
  onCloseTerms: () => void;
  onClosePrivacy: () => void;
}

/**
 * The two agreements an account on a server asks for, one after the other: its terms, then its privacy
 * policy. Each opens only while its text is pending, and has to be read to the end before it can be accepted.
 */
const ServerLegalModals = ({
  terms,
  privacy,
  onAgreeTerms,
  onAgreePrivacy,
  onCloseTerms,
  onClosePrivacy,
}: ServerLegalModalsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <TermsModal
        visible={terms !== null}
        title={t('server_terms_title')}
        subtitle={
          terms
            ? t('server_terms_version', { version: terms.version, date: terms.updatedAt })
            : undefined
        }
        sections={terms?.sections ?? []}
        mode="accept"
        acceptLabel={t('terms_accept')}
        onAccept={onAgreeTerms}
        onClose={onCloseTerms}
        requireScrollToEnd
        testID="server-terms-modal"
      />
      <TermsModal
        visible={privacy !== null}
        title={t('server_privacy_title')}
        subtitle={
          privacy
            ? t('server_privacy_version', { version: privacy.version, date: privacy.updatedAt })
            : undefined
        }
        sections={privacy?.sections ?? []}
        mode="accept"
        acceptLabel={t('terms_accept')}
        onAccept={onAgreePrivacy}
        onClose={onClosePrivacy}
        requireScrollToEnd
        testID="server-privacy-modal"
      />
    </>
  );
};

export default ServerLegalModals;
