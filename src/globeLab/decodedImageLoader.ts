export interface DecodableImage {
  src: string;
  decoding: string;
  complete: boolean;
  naturalWidth: number;
  onload: ((event: Event) => unknown) | null;
  onerror: ((event: Event | string) => unknown) | null;
  decode?: () => Promise<void>;
}

export type DecodedImageFactory = () => DecodableImage;

export interface DecodedImageLoaderOptions {
  createImage?: DecodedImageFactory;
  timeoutMs?: number;
}

interface ImageRequest {
  promise: Promise<void>;
  state: "loading" | "decoded" | "error";
  foreground: boolean;
  cancel: () => void;
}

function abortedImageError() {
  const error = new Error("Image request was cancelled");
  error.name = "AbortError";
  return error;
}

const defaultImageFactory: DecodedImageFactory = () => {
  if (typeof Image === "undefined")
    throw new Error("Image loading is unavailable");
  return new Image();
};

export function adjacentGalleryIndices(
  length: number,
  index: number,
): number[] {
  if (length < 2 || index < 0 || index >= length) return [];
  return Array.from(
    new Set([(index - 1 + length) % length, (index + 1) % length]),
  );
}

export function createDecodedImageLoader({
  createImage = defaultImageFactory,
  timeoutMs = 15_000,
}: DecodedImageLoaderOptions = {}) {
  const requests = new Map<string, ImageRequest>();
  let disposed = false;

  function request(path: string, foreground: boolean): Promise<void> {
    if (disposed) return Promise.reject(abortedImageError());
    const cached = requests.get(path);
    if (cached) {
      cached.foreground ||= foreground;
      return cached.promise;
    }
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((accept, fail) => {
      resolve = accept;
      reject = fail;
    });
    let image: DecodableImage | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let decoding = false;
    const entry: ImageRequest = {
      promise,
      state: "loading",
      foreground,
      cancel: () => settle(false, abortedImageError()),
    };
    requests.set(path, entry);

    function settle(success: boolean, error?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
      if (!success) {
        entry.state = "error";
        try {
          if (image) image.src = "";
        } catch {}
        reject(error);
      } else {
        entry.state = "decoded";
        resolve();
      }
    }

    function decodeLoadedImage() {
      if (settled || decoding || !image) return;
      if (!image.naturalWidth) {
        settle(false, new Error(`Image has no pixels: ${path}`));
        return;
      }
      decoding = true;
      const loaded = image;
      Promise.resolve()
        .then(() => loaded.decode?.())
        .then(
          () => settle(true),
          (error) => settle(false, error),
        );
    }

    try {
      image = createImage();
      image.decoding = "async";
      image.onload = decodeLoadedImage;
      image.onerror = () =>
        settle(false, new Error(`Image failed to load: ${path}`));
      timer = setTimeout(
        () => settle(false, new Error(`Image loading timed out: ${path}`)),
        timeoutMs,
      );
      image.src = path;
      if (image.complete) decodeLoadedImage();
    } catch (error) {
      settle(false, error);
    }
    return promise;
  }

  return {
    load: (path: string) => request(path, true),
    retry(path: string) {
      requests.get(path)?.cancel();
      requests.delete(path);
      return request(path, true);
    },
    preloadAdjacent(paths: readonly string[], index: number) {
      if (disposed) return;
      const adjacent = new Set(
        adjacentGalleryIndices(paths.length, index).map(
          (value) => paths[value],
        ),
      );
      for (const [path, entry] of requests) {
        if (
          entry.state === "loading" &&
          !entry.foreground &&
          !adjacent.has(path)
        ) {
          entry.cancel();
          requests.delete(path);
        }
      }
      for (const path of adjacent) void request(path, false).catch(() => {});
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of requests.values()) entry.cancel();
      requests.clear();
    },
  };
}

export interface DecodedGallerySnapshot {
  index: number;
  eventId: string | null;
  ready: boolean;
  status: "loading" | "loaded" | "error";
  pendingIndex: number | null;
  previousIndex: number | null;
  requestedIndex: number;
}

export interface DecodedGalleryOptions extends DecodedImageLoaderOptions {
  paths: readonly string[];
  resolveEvent: (index: number, eventId?: string | null) => string | null;
  reducedMotion?: boolean;
  onChange?: (snapshot: DecodedGallerySnapshot) => void;
}

export function initialDecodedGallerySnapshot(
  paths: readonly string[],
  resolveEvent: DecodedGalleryOptions["resolveEvent"],
): DecodedGallerySnapshot {
  return {
    index: 0,
    eventId: resolveEvent(0),
    ready: false,
    status: paths.length ? "loading" : "error",
    pendingIndex: paths.length ? 0 : null,
    previousIndex: null,
    requestedIndex: 0,
  };
}

export function createDecodedGallerySession(options: DecodedGalleryOptions) {
  const loader = createDecodedImageLoader(options);
  let snapshot = initialDecodedGallerySnapshot(
    options.paths,
    options.resolveEvent,
  );
  let requestedEventId = snapshot.eventId;
  let generation = 0;
  let started = false;
  let disposed = false;
  let reducedMotion = options.reducedMotion ?? false;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let queued: {
    index: number;
    eventId: string | null;
    generation: number;
  } | null = null;

  function publish(next: DecodedGallerySnapshot) {
    snapshot = next;
    options.onChange?.(snapshot);
  }

  function scheduleFadeEnd() {
    clearTimeout(fadeTimer);
    if (snapshot.previousIndex !== null)
      fadeTimer = setTimeout(finishFade, reducedMotion ? 40 : 200);
  }

  function commit(index: number, eventId: string | null) {
    publish({
      index,
      eventId,
      ready: true,
      status: "loaded",
      pendingIndex: null,
      previousIndex:
        snapshot.ready && snapshot.index !== index ? snapshot.index : null,
      requestedIndex: index,
    });
    loader.preloadAdjacent(options.paths, index);
    scheduleFadeEnd();
  }

  function request(index: number, eventId?: string | null, retry = false) {
    if (
      disposed ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= options.paths.length
    )
      return;
    const nextEventId = options.resolveEvent(
      index,
      eventId === undefined ? requestedEventId : eventId,
    );
    requestedEventId = nextEventId;
    const currentGeneration = ++generation;
    queued = null;
    if (snapshot.ready && snapshot.index === index && !retry) {
      publish({
        ...snapshot,
        eventId: nextEventId,
        status: "loaded",
        pendingIndex: null,
        requestedIndex: index,
      });
      return;
    }
    publish({
      ...snapshot,
      status: "loading",
      pendingIndex: index,
      requestedIndex: index,
    });
    const promise = retry
      ? loader.retry(options.paths[index])
      : loader.load(options.paths[index]);
    promise.then(
      () => {
        if (disposed || currentGeneration !== generation) return;
        // Finish the visible fade before replacing its opaque backing frame.
        if (snapshot.previousIndex !== null) {
          queued = {
            index,
            eventId: nextEventId,
            generation: currentGeneration,
          };
          return;
        }
        commit(index, nextEventId);
      },
      () => {
        if (disposed || currentGeneration !== generation) return;
        publish({ ...snapshot, status: "error", pendingIndex: null });
      },
    );
  }

  function finishFade() {
    if (disposed) return;
    clearTimeout(fadeTimer);
    if (snapshot.previousIndex !== null)
      publish({ ...snapshot, previousIndex: null });
    const next = queued;
    queued = null;
    if (next && next.generation === generation)
      commit(next.index, next.eventId);
  }

  return {
    getSnapshot: () => snapshot,
    start() {
      if (started || disposed) return;
      started = true;
      request(0, requestedEventId);
    },
    select: (index: number, eventId?: string | null) => request(index, eventId),
    retry() {
      if (snapshot.status === "error")
        request(snapshot.requestedIndex, requestedEventId, true);
    },
    finishFade,
    setReducedMotion(value: boolean) {
      if (reducedMotion === value) return;
      reducedMotion = value;
      scheduleFadeEnd();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      queued = null;
      clearTimeout(fadeTimer);
      loader.dispose();
    },
  };
}
