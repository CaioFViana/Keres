import { useEffect, useState } from 'react';
import { fetchConfig } from '../api/showcaseApi';

export function AboutPage() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig()
      .then((config) => setVersion(config.serverVersion))
      .catch(() => setVersion(null));
  }, []);

  return (
    <section className="prose">
      <h1>About this page</h1>
      <p>
        Keres is a tool for planning stories: characters, chapters, scenes, locations, items,
        world rules, and how they all connect. This page is the public face of one Keres server -
        a place where the people writing on it can put a story where anyone can see it.
      </p>

      <h2>What you can download here</h2>
      <p>
        Each published version is a complete package of a story&apos;s Keres base: its structure
        and everything written around it, plus the media the author attached. It is not the story
        as a finished work - Keres is always a companion to whatever the story is actually being
        made in, whether that is a novel, a game, or a campaign.
      </p>
      <p>
        Open a package in Keres through <strong>Import / Export</strong>. Importing makes a
        separate copy on your device; it does not join the author&apos;s story or send anything
        back to them.
      </p>

      <h2>Who is responsible for what</h2>
      <p>
        The stories here belong to the people who published them, and this server is run by
        whoever chose to run it. Keres, the application, is not affiliated with either, does not
        host or moderate these stories, and takes no position on them.
      </p>

      {version && <p className="muted">Server version {version}</p>}
    </section>
  );
}
