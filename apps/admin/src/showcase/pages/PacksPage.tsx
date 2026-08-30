import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShowcasePackCard } from '@keres/shared';
import { fetchPacks } from '../api/showcaseApi';
import { PackCard } from '../components/PackCard';

export function PacksPage() {
  const { t } = useTranslation('showcase');
  const [packs, setPacks] = useState<ShowcasePackCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPacks(await fetchPacks());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('packs.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
    // Coming back to the tab, and nothing else. The story listing polls because a publication can
    // land at any moment; a pack is shared deliberately and rarely, so an interval here would be
    // traffic without a reader.
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-eyebrow">{t('packs.eyebrow')}</p>
          <h1 className="hero-title">{t('packs.title')}</h1>
          <p className="hero-text">{t('packs.intro')}</p>
        </div>
      </section>

      <section className="stories" id="packs">
        <div className="section-head">
          <h2>{t('packs.sharedPacks')}</h2>
          {packs && <span className="count">{packs.length}</span>}
        </div>

        {error && <p className="error-text">{error}</p>}

        {!packs && !error && <p className="muted">{t('packs.loading')}</p>}

        {packs && packs.length === 0 && <p className="empty">{t('packs.empty')}</p>}

        {packs && packs.length > 0 && (
          <div className="pack-grid">
            {packs.map((pack) => (
              <PackCard key={pack.id} pack={pack} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
