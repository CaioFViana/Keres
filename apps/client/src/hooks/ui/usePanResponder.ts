import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, type PanResponderCallbacks, type PanResponderInstance } from 'react-native';

type Handler = (...args: unknown[]) => unknown;

/**
 * A gesture responder created once whose handlers are always the latest ones.
 *
 * `PanResponder.create` reads its callbacks when it is created, so a responder built in a render
 * keeps the props and state of that render for as long as it lives; the usual cure was to mirror
 * every value into a ref and read the refs from the handlers, or to rebuild the responder when a
 * dependency changed (which drops a gesture in flight). Here the handlers are written as plain
 * closures over the current render, and each call goes to the ones of the latest committed render.
 *
 * The set of handlers is fixed by the first render (a responder asks "do you want this gesture?"
 * by whether a handler exists); a handler that is absent in a later render answers `undefined`.
 */
export function usePanResponder(handlers: PanResponderCallbacks): PanResponderInstance {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });

  const [responder] = useState(() => {
    const forwarding: Record<string, Handler> = {};
    for (const name of Object.keys(handlers)) {
      // The ref is read only when a gesture calls the handler, never while rendering.
      forwarding[name] = (...args) =>
        (latest.current as Record<string, Handler | undefined>)[name]?.(...args);
    }
    return PanResponder.create(forwarding as PanResponderCallbacks);
  });
  return responder;
}
