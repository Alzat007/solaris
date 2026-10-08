import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate, setTimeout } from "node:timers/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  adjacentGalleryIndices,
  createDecodedGallerySession,
  createDecodedImageLoader,
  type DecodableImage,
} from "../src/globeLab/decodedImageLoader";
import { useDecodedGallery } from "../src/globeLab/useDecodedGallery";

class FakeImage implements DecodableImage {
  src = "";
  decoding = "auto";
  complete = false;
  naturalWidth = 0;
  onload: DecodableImage["onload"] = null;
  onerror: DecodableImage["onerror"] = null;
  decodeCalls = 0;
  private acceptDecode!: () => void;
  private failDecode!: (error: unknown) => void;
  private decoded = new Promise<void>((resolve, reject) => {
    this.acceptDecode = resolve;
    this.failDecode = reject;
  });

  decode = () => {
    this.decodeCalls++;
    return this.decoded;
  };

  load() {
    this.complete = true;
    this.naturalWidth = 1200;
    this.onload?.(new Event("load"));
  }

  failLoad() {
    this.onerror?.(new Event("error"));
  }

  finishDecode() {
    this.acceptDecode();
  }

  rejectDecode(error?: Error) {
    this.failDecode(error);
  }
}

function imageFactory() {
  const images: FakeImage[] = [];
  return {
    images,
    createImage() {
      const image = new FakeImage();
      images.push(image);
      return image;
    },
    image(path: string) {
      const image = images
        .slice()
        .reverse()
        .find((entry) => entry.src === path);
      assert.ok(image, `No request for ${path}`);
      return image;
    },
  };
}

const paths = ["/a.jpg", "/b.jpg", "/c.jpg", "/d.jpg"];
const resolveEvent = (index: number, eventId?: string | null) =>
  eventId?.startsWith(`event-${index}`) ? eventId : `event-${index}`;

async function decode(image: FakeImage) {
  image.load();
  image.finishDecode();
  await setImmediate();
}

test("SSR starts at the first event without constructing an Image", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Image");
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      constructor() {
        throw new Error("SSR accessed Image");
      }
    },
  });
  try {
    function Probe() {
      const gallery = useDecodedGallery({
        identity: "earth",
        paths,
        resolveEvent,
      });
      return createElement("output", {
        "data-index": gallery.index,
        "data-event": gallery.eventId,
        "data-ready": gallery.ready,
        "data-status": gallery.status,
      });
    }
    const html = renderToStaticMarkup(createElement(Probe));
    assert.match(html, /data-index="0"/);
    assert.match(html, /data-event="event-0"/);
    assert.match(html, /data-ready="false"/);
    assert.match(html, /data-status="loading"/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "Image", descriptor);
    else Reflect.deleteProperty(globalThis, "Image");
  }
});

test("loading waits for both load and decode and reuses the decoded request", async (t) => {
  const factory = imageFactory();
  const loader = createDecodedImageLoader(factory);
  t.after(() => loader.dispose());
  let resolved = false;
  const request = loader.load(paths[0]);
  void request.then(() => (resolved = true));
  const image = factory.image(paths[0]);
  assert.equal(image.decodeCalls, 0);
  image.load();
  await setImmediate();
  assert.equal(image.decodeCalls, 1);
  assert.equal(resolved, false);
  image.finishDecode();
  await request;
  assert.equal(resolved, true);
  assert.equal(loader.load(paths[0]), request);
  assert.equal(factory.images.length, 1);
});

test("load and decode failures reject, retry creates a fresh request, and disposal cancels pending work", async () => {
  const factory = imageFactory();
  const loader = createDecodedImageLoader(factory);
  const first = loader.load(paths[0]);
  const failedLoad = assert.rejects(first, /failed to load/);
  factory.image(paths[0]).failLoad();
  await failedLoad;
  const second = loader.retry(paths[0]);
  const failedDecode = assert.rejects(second, /Decode failed/);
  factory.image(paths[0]).load();
  await setImmediate();
  factory.image(paths[0]).rejectDecode(new Error("Decode failed"));
  await failedDecode;
  assert.equal(factory.images.length, 2);
  const third = loader.retry(paths[0]);
  const cancelled = assert.rejects(third, { name: "AbortError" });
  loader.dispose();
  await cancelled;
  assert.equal(factory.images.at(-1)?.src, "");
});

test("a request cannot wait forever for load or decode", async () => {
  const factory = imageFactory();
  const loader = createDecodedImageLoader({ ...factory, timeoutMs: 10 });
  const request = loader.load(paths[0]);
  factory.image(paths[0]).load();
  await assert.rejects(request, /timed out/);
  assert.equal(factory.images[0].src, "");
  loader.dispose();
});

test("decode rejection without an error value never commits a new frame", async (t) => {
  const factory = imageFactory();
  const session = createDecodedGallerySession({
    ...factory,
    paths,
    resolveEvent,
  });
  t.after(() => session.dispose());
  session.start();
  await decode(factory.image(paths[0]));
  session.select(1);
  const image = factory.image(paths[1]);
  image.load();
  await setImmediate();
  image.rejectDecode();
  await setImmediate();
  assert.equal(session.getSnapshot().index, 0);
  assert.equal(session.getSnapshot().eventId, "event-0");
  assert.equal(session.getSnapshot().status, "error");
});

test("only adjacent images preload, wrapping and cancelling obsolete background requests", async (t) => {
  const factory = imageFactory();
  const loader = createDecodedImageLoader(factory);
  t.after(() => loader.dispose());
  assert.deepEqual(adjacentGalleryIndices(0, 0), []);
  assert.deepEqual(adjacentGalleryIndices(1, 0), []);
  assert.deepEqual(adjacentGalleryIndices(2, 0), [1]);
  loader.preloadAdjacent(paths, 0);
  assert.deepEqual(
    factory.images.map((image) => image.src),
    [paths[3], paths[1]],
  );
  const obsolete = factory.image(paths[3]);
  loader.preloadAdjacent(paths, 1);
  assert.equal(obsolete.src, "");
  assert.deepEqual(
    factory.images.slice(2).map((image) => image.src),
    [paths[0], paths[2]],
  );
  await setImmediate();
});

test("the visible frame and event change together only after the latest request decodes", async (t) => {
  const factory = imageFactory();
  const session = createDecodedGallerySession({
    ...factory,
    paths,
    resolveEvent,
  });
  t.after(() => session.dispose());
  session.start();
  await decode(factory.image(paths[0]));
  assert.equal(session.getSnapshot().ready, true);
  session.select(1, "event-1-selected");
  session.select(session.getSnapshot().requestedIndex + 1, "event-2-selected");
  assert.deepEqual(session.getSnapshot(), {
    index: 0,
    eventId: "event-0",
    ready: true,
    status: "loading",
    pendingIndex: 2,
    previousIndex: null,
    requestedIndex: 2,
  });
  await decode(factory.image(paths[1]));
  assert.equal(session.getSnapshot().index, 0);
  const latest = factory.image(paths[2]);
  latest.load();
  await setImmediate();
  assert.equal(session.getSnapshot().index, 0);
  latest.finishDecode();
  await setImmediate();
  assert.equal(session.getSnapshot().index, 2);
  assert.equal(session.getSnapshot().eventId, "event-2-selected");
  assert.equal(session.getSnapshot().previousIndex, 0);
  assert.equal(session.getSnapshot().status, "loaded");
});

test("failed selections retain the visible frame and retry the requested target", async (t) => {
  const factory = imageFactory();
  const session = createDecodedGallerySession({
    ...factory,
    paths,
    resolveEvent,
  });
  t.after(() => session.dispose());
  session.start();
  await decode(factory.image(paths[0]));
  session.select(2, "event-2-selected");
  factory.image(paths[2]).failLoad();
  await setImmediate();
  assert.equal(session.getSnapshot().status, "error");
  assert.equal(session.getSnapshot().index, 0);
  assert.equal(session.getSnapshot().eventId, "event-0");
  assert.equal(session.getSnapshot().ready, true);
  assert.equal(session.getSnapshot().pendingIndex, null);
  session.retry();
  assert.equal(session.getSnapshot().pendingIndex, 2);
  await decode(factory.image(paths[2]));
  assert.equal(session.getSnapshot().index, 2);
  assert.equal(session.getSnapshot().eventId, "event-2-selected");
});

test("decoded rapid selections queue the newest frame until the current fade finishes", async (t) => {
  const factory = imageFactory();
  const session = createDecodedGallerySession({
    ...factory,
    paths,
    resolveEvent,
  });
  t.after(() => session.dispose());
  session.start();
  await decode(factory.image(paths[0]));
  session.select(1);
  await decode(factory.image(paths[1]));
  assert.equal(session.getSnapshot().previousIndex, 0);
  session.select(2);
  await decode(factory.image(paths[2]));
  assert.equal(session.getSnapshot().index, 1);
  assert.equal(session.getSnapshot().eventId, "event-1");
  session.select(3);
  await decode(factory.image(paths[3]));
  assert.equal(session.getSnapshot().requestedIndex, 3);
  assert.equal(session.getSnapshot().index, 1);
  session.finishFade();
  assert.equal(session.getSnapshot().index, 3);
  assert.equal(session.getSnapshot().eventId, "event-3");
  assert.equal(session.getSnapshot().previousIndex, 1);
  session.finishFade();
  assert.equal(session.getSnapshot().previousIndex, null);
});

test("reduced-motion fallback completes queued fades and disposal prevents stale commits", async () => {
  const factory = imageFactory();
  const session = createDecodedGallerySession({
    ...factory,
    paths,
    resolveEvent,
    reducedMotion: true,
  });
  session.start();
  await decode(factory.image(paths[0]));
  session.select(1);
  await decode(factory.image(paths[1]));
  session.select(2);
  await decode(factory.image(paths[2]));
  await setTimeout(50);
  assert.equal(session.getSnapshot().index, 2);
  session.finishFade();
  session.select(3);
  const pending = factory.image(paths[3]);
  const beforeDisposal = session.getSnapshot();
  session.dispose();
  pending.load();
  pending.finishDecode();
  await setImmediate();
  assert.equal(session.getSnapshot(), beforeDisposal);
  const next = createDecodedGallerySession({ ...factory, paths, resolveEvent });
  next.start();
  assert.equal(next.getSnapshot().index, 0);
  assert.equal(next.getSnapshot().ready, false);
  assert.equal(factory.image(paths[0]).decodeCalls, 0);
  next.dispose();
});
