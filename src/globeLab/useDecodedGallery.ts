import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  createDecodedGallerySession,
  initialDecodedGallerySnapshot,
  type DecodedGallerySnapshot,
} from "./decodedImageLoader";

export interface UseDecodedGalleryOptions {
  identity: string;
  paths: readonly string[];
  resolveEvent: (index: number, eventId?: string | null) => string | null;
  reducedMotion?: boolean;
}

export function useDecodedGallery(options: UseDecodedGalleryOptions) {
  const { identity, paths, resolveEvent, reducedMotion = false } = options;
  const latest = useRef(options);
  latest.current = options;
  const session = useRef<ReturnType<typeof createDecodedGallerySession> | null>(
    null,
  );
  const [state, setState] = useState<{
    identity: string;
    snapshot: DecodedGallerySnapshot;
  }>(() => ({
    identity,
    snapshot: initialDecodedGallerySnapshot(paths, resolveEvent),
  }));

  useLayoutEffect(() => {
    const current = createDecodedGallerySession({
      paths: latest.current.paths,
      resolveEvent: (index, eventId) =>
        latest.current.resolveEvent(index, eventId),
      reducedMotion: latest.current.reducedMotion,
      onChange(snapshot) {
        if (session.current === current && latest.current.identity === identity)
          setState({ identity, snapshot });
      },
    });
    session.current = current;
    setState({ identity, snapshot: current.getSnapshot() });
    current.start();
    return () => {
      current.dispose();
      if (session.current === current) session.current = null;
    };
  }, [identity]);

  useLayoutEffect(() => {
    session.current?.setReducedMotion(reducedMotion);
  }, [identity, reducedMotion]);

  const select = useCallback((index: number, eventId?: string | null) => {
    session.current?.select(index, eventId);
  }, []);
  const retry = useCallback(() => session.current?.retry(), []);
  const finishFade = useCallback(() => session.current?.finishFade(), []);
  const snapshot =
    state.identity === identity
      ? state.snapshot
      : initialDecodedGallerySnapshot(paths, resolveEvent);
  return { ...snapshot, select, retry, finishFade };
}
