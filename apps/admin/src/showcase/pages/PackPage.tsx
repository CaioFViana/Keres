import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  STORY_SCHEMA_ENTITY_TYPES,
  type ShowcasePackDetail,
  type StorySchemaEntityType,
} from '@keres/shared';
import { fetchPack } from '../api/showcaseApi';
import { OwnerAvatar } from '../components/OwnerAvatar';

const CUSTOM_SUGGESTION_PREFIX = 'custom:';

export function PackPage() {
  const { packId = '' } = useParams();
  const { t } = useTranslation('showcase');
  const [pack, setPack] = useState<ShowcasePackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPack(packId)
      .then(setPack)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : t('pack.loadFailed')),
      );
  }, [packId, t]);

  const content = pack?.content ?? null;

  /** Fields grouped by the entity they extend, in the order the app itself presents them. */
  const fieldsByEntity = useMemo(() => {
    const groups = new Map<
      StorySchemaEntityType,
      NonNullable<typeof content>['storySchemaFields']
    >();
    for (const entityType of STORY_SCHEMA_ENTITY_TYPES) {
      const fields = (content?.storySchemaFields ?? [])
        .filter((field) => field.entityType === entityType)
        .sort((left, right) => left.order - right.order);
      if (fields.length > 0) groups.set(entityType, fields);
    }
    return groups;
  }, [content]);

  /**
   * The ladder of each stat axis.
   *
   * A tier with a null `statId` is the story default ladder, shared by every axis that does not
   * define one of its own - so it is shown once, apart, rather than repeated under each axis.
   */
  const ladders = useMemo(() => {
    const tiers = [...(content?.statStrengths ?? [])].sort((a, b) => a.minValue - b.minValue);
    return {
      shared: tiers.filter((tier) => tier.statId === null),
      byStat: new Map(
        (content?.stats ?? []).map((stat) => [
          stat.id,
          tiers.filter((tier) => tier.statId === stat.id),
        ]),
      ),
    };
  }, [content]);

  /**
   * Suggestion catalogues, counted per list.
   *
   * `custom:<fieldId>` is resolved to the name of its field, because "custom:01J2..." on a public
   * page tells a visitor nothing. A catalogue whose field is absent from this pack keeps its raw
   * key: that is a fact about the pack, not something to paper over.
   */
  const catalogues = useMemo(() => {
    const fieldNames = new Map((content?.storySchemaFields ?? []).map((f) => [f.id, f.name]));
    const counts = new Map<string, number>();
    for (const suggestion of content?.suggestions ?? []) {
      const label = suggestion.type.startsWith(CUSTOM_SUGGESTION_PREFIX)
        ? (fieldNames.get(suggestion.type.slice(CUSTOM_SUGGESTION_PREFIX.length)) ??
          suggestion.type)
        : suggestion.type;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [content]);

  if (error) {
    return (
      <section className="story-page">
        <p className="error-text">{error}</p>
        <Link to="/packs" className="back-link">
          {t('pack.back')}
        </Link>
      </section>
    );
  }

  if (!pack || !content) {
    return <p className="muted story-page">{t('pack.loading')}</p>;
  }

  return (
    <section className="story-page">
      <Link to="/packs" className="back-link">
        {t('pack.back')}
      </Link>

      <header className="story-head">
        <span className="badge badge-pack">{t('pack.version', { version: pack.version })}</span>
        <h1>{pack.name}</h1>
        <div className="owner">
          <OwnerAvatar owner={pack.owner} size={34} />
          <span className="owner-name">
            {pack.owner.username}
            <span className="owner-tag">
              #{pack.owner.tag} · {t('pack.sharedThis')}
            </span>
          </span>
        </div>
      </header>

      {pack.description && <p className="story-description">{pack.description}</p>}

      <dl className="story-facts">
        {pack.authorName && (
          <div>
            <dt>{t('pack.author')}</dt>
            <dd>{pack.authorName}</dd>
          </div>
        )}
        {pack.language && (
          <div>
            <dt>{t('pack.language')}</dt>
            <dd>{pack.language}</dd>
          </div>
        )}
        <div>
          <dt>{t('pack.statSystem')}</dt>
          <dd>
            {content.settings.statSystem
              ? t(`pack.notation.${content.settings.statNotation}`)
              : t('pack.statSystemOff')}
          </dd>
        </div>
      </dl>

      <section className="pack-contents">
        <h2>{t('pack.contentsTitle')}</h2>
        {/*
          A pack is structure, and the point of this page is that a visitor reads that structure in
          full before deciding. Nothing is withheld for a download: what is listed here is
          everything the pack carries.
        */}
        <p className="muted">{t('pack.contentsIntro')}</p>

        {fieldsByEntity.size > 0 && (
          <div className="pack-section">
            <h3>{t('pack.fields')}</h3>
            {[...fieldsByEntity].map(([entityType, fields]) => (
              <div className="pack-group" key={entityType}>
                <h4>{t(`pack.entity.${entityType}`)}</h4>
                <ul className="pack-field-list">
                  {fields.map((field) => (
                    <li key={field.id}>
                      <span className="pack-field-name">{field.name}</span>
                      <span className="pack-field-type">
                        {t(`pack.attributeType.${field.type}`)}
                        {field.isRequired && ` · ${t('pack.required')}`}
                      </span>
                      {field.description && (
                        <span className="pack-field-desc">{field.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {content.stats.length > 0 && (
          <div className="pack-section">
            <h3>{t('pack.stats')}</h3>
            <ul className="pack-stat-list">
              {[...content.stats]
                .sort((left, right) => left.order - right.order)
                .map((stat) => {
                  const own = ladders.byStat.get(stat.id) ?? [];
                  return (
                    <li key={stat.id}>
                      <span className="pack-field-name">{stat.name}</span>
                      {!stat.isPrimary && (
                        <span className="pack-field-type">{t('pack.secondaryStat')}</span>
                      )}
                      {own.length > 0 && (
                        <span className="pack-ladder">
                          {own.map((tier) => tier.label).join(' · ')}
                        </span>
                      )}
                    </li>
                  );
                })}
            </ul>
            {ladders.shared.length > 0 && (
              <p className="pack-ladder shared">
                {t('pack.defaultLadder')}: {ladders.shared.map((tier) => tier.label).join(' · ')}
              </p>
            )}
          </div>
        )}

        {content.tags.length > 0 && (
          <div className="pack-section">
            <h3>{t('pack.tags')}</h3>
            <div className="chips">
              {content.tags.map((tag) => (
                <span
                  className="chip"
                  key={tag.id}
                  style={tag.color ? { borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {catalogues.length > 0 && (
          <div className="pack-section">
            <h3>{t('pack.suggestions')}</h3>
            <ul className="pack-field-list">
              {catalogues.map(([label, count]) => (
                <li key={label}>
                  <span className="pack-field-name">{label}</span>
                  <span className="pack-field-type">
                    {t(count === 1 ? 'pack.entryCount_one' : 'pack.entryCount_other', { count })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/*
        No download button, deliberately. A pack applies to a story at creation, inside the app - a
        `.json` saved from a browser has nowhere to go, and offering one would be a button that
        leads nowhere. What the visitor needs is the address of this server.
      */}
      <section className="pack-howto">
        <h2>{t('pack.howtoTitle')}</h2>
        <p>{t('pack.howtoBody')}</p>
      </section>
    </section>
  );
}
