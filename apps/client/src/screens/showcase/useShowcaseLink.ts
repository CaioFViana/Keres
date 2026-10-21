import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import { useDrizzle } from '@/src/db';
import type { ServerSelect } from '@/src/db/schemas/servers';
import type { ShowcaseStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { showcaseApiService } from '@/src/services/api/ShowcaseApiService';
import { createServerService } from '@/src/services/servers/ServerService';
import {
  type ResolvedShowcaseLink,
  type ShowcaseLinkProblem,
  resolveShowcaseLink,
} from '@/src/utils/format/showcaseLinks';
import { logger } from '@/src/utils/logging/logger';
import type { ShowcaseLinkTone } from '@/src/components/features/showcase/ShowcaseLinkField';

type Navigation = NativeStackNavigationProp<ShowcaseStackParamList, 'ShowcaseHome'>;

const PROBLEM_KEYS: Record<ShowcaseLinkProblem, string> = {
  empty: 'showcase_link_problem_empty',
  not_a_url: 'showcase_link_problem_not_a_url',
  unsupported_scheme: 'showcase_link_problem_unsupported_scheme',
  insecure_http: 'showcase_link_problem_insecure_http',
  not_showcase: 'showcase_link_problem_not_showcase',
};

/**
 * The pasted link of the showcase screen: read as the person types or pastes, said back in words (whose server,
 * what it points at, or what is wrong with it), and opened inside the app. A link of a server the person
 * registered opens as theirs; one of any other server is first asked whether it has a public site at all, and
 * opens as a guest.
 */
export function useShowcaseLink() {
  const { t } = useTranslation();
  const db = useDrizzle();
  const navigation = useNavigation<Navigation>();
  const [servers, setServers] = useState<ServerSelect[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  /** Something the server answered that the text itself did not show: it is down, or has no public site. */
  const [refusal, setRefusal] = useState<string | null>(null);

  // The servers are read again whenever the screen comes back: one may have been registered meanwhile.
  useFocusEffect(
    useCallback(() => {
      createServerService(db)
        .getAllServers()
        .then(setServers)
        .catch((error) => logger.error('useShowcaseLink: failed to load the servers.', error));
    }, [db]),
  );

  const resolved = useMemo(() => resolveShowcaseLink(text, servers), [text, servers]);

  const status = useMemo((): { text: string | null; tone: ShowcaseLinkTone } => {
    if (refusal) return { text: refusal, tone: 'bad' };
    if (!text.trim()) return { text: null, tone: 'neutral' };
    if (resolved.kind === 'invalid') {
      return { text: t(PROBLEM_KEYS[resolved.problem]), tone: 'bad' };
    }
    if (resolved.kind === 'registered') {
      return {
        text: t('showcase_link_registered', {
          server: resolved.server.name ?? resolved.server.url,
        }),
        tone: 'good',
      };
    }
    return { text: t('showcase_link_guest', { server: resolved.origin }), tone: 'neutral' };
  }, [refusal, resolved, text, t]);

  const changeText = useCallback((next: string) => {
    setText(next);
    setRefusal(null);
  }, []);

  const openResolved = useCallback(
    async (link: ResolvedShowcaseLink<ServerSelect>) => {
      if (link.kind === 'invalid') return;
      const source =
        link.kind === 'registered' ? { serverId: link.server.id } : { guestOrigin: link.origin };
      if (link.kind === 'guest') {
        setBusy(true);
        try {
          const config = await showcaseApiService.getConfig({ kind: 'guest', origin: link.origin });
          if (!config) {
            setRefusal(t('showcase_link_unreachable', { server: link.origin }));
            return;
          }
          if (!config.showcaseEnabled) {
            setRefusal(t('showcase_link_site_off', { server: link.origin }));
            return;
          }
        } finally {
          setBusy(false);
        }
      }
      const { target } = link;
      if (target.kind === 'story' || target.kind === 'read') {
        navigation.navigate('ShowcaseStory', { ...source, storyId: target.storyId });
        return;
      }
      // The rest of the site is not in the app: the page itself, in the browser.
      await Linking.openURL(link.url);
    },
    [navigation, t],
  );

  const open = useCallback(() => {
    void openResolved(resolved);
  }, [openResolved, resolved]);

  /** A text that arrives by pasting is a decision already: the link it holds is opened at once. */
  const acceptPasted = useCallback(
    (pasted: string) => {
      setText(pasted);
      setRefusal(null);
      void openResolved(resolveShowcaseLink(pasted, servers));
    },
    [openResolved, servers],
  );

  const pasteFromClipboard = useCallback(async () => {
    try {
      acceptPasted(await Clipboard.getStringAsync());
    } catch (error) {
      logger.debug('useShowcaseLink: the clipboard could not be read.', error);
    }
  }, [acceptPasted]);

  /** Ctrl+V anywhere on the screen but in the field itself (which takes the text as typed). */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
      const onPaste = (event: ClipboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        const pasted = event.clipboardData?.getData('text');
        if (pasted) acceptPasted(pasted);
      };
      document.addEventListener('paste', onPaste);
      return () => document.removeEventListener('paste', onPaste);
    }, [acceptPasted]),
  );

  const openInBrowser = useMemo(() => {
    // Only an address that is fine but is not a showcase page: plain http to the internet stays refused.
    const url =
      resolved.kind === 'invalid' && resolved.problem === 'not_showcase' ? resolved.url : null;
    return url ? () => void Linking.openURL(url) : undefined;
  }, [resolved]);

  return {
    text,
    changeText,
    busy,
    status,
    canOpen: resolved.kind !== 'invalid',
    open,
    pasteFromClipboard,
    openInBrowser,
  };
}
