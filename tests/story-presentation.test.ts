import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { firstBatchCityStories } from "../src/exploration/firstBatchEarth";
import { cityLandmarks } from "../src/exploration/cityLandmarks";
import { planetStories } from "../src/exploration/planetAtlasCatalog";
import { immersiveSites } from "../src/exploration/immersiveCatalog";
import {
  getGalleryEvent,
  getStoryImagePresentation,
  visibleGalleryIndices,
} from "../src/exploration/storyPresentation";

register(
  `data:text/javascript,${encodeURIComponent(
    'export async function load(url,context,next){if(url.endsWith(".css"))return {format:"module",source:"",shortCircuit:true};return next(url,context);}',
  )}`,
  import.meta.url,
);
const { GlobeStoryPanel } = await import("../src/globeLab/GlobeStoryPanel");

test("every audited non-Earth science image defaults to complete, uncropped viewing", () => {
  for (const story of planetStories)
    for (const image of story.gallery)
      assert.equal(getStoryImagePresentation(image).fit, "contain", image.path);
  for (const site of immersiveSites.filter((entry) => entry.bodyId !== "earth"))
    for (const spot of site.hotspots)
      if (spot.image)
        assert.equal(getStoryImagePresentation(spot.image).fit, "contain");
});

test("ordinary city photographs fill the media column and focal configuration never changes image records", () => {
  const image = firstBatchCityStories.find(
    (entry) => entry.id === "city-kyoto",
  )!.gallery[0];
  const before = JSON.stringify(image);
  assert.equal(getStoryImagePresentation(image).fit, "cover");
  assert.deepEqual(
    getStoryImagePresentation(image, { fit: "cover", position: "35% 20%" }),
    { fit: "cover", position: "35% 20%" },
  );
  assert.equal(JSON.stringify(image), before);
});

test("gallery association retains every original event, title, date and photo relationship", () => {
  for (const story of [
    ...firstBatchCityStories,
    ...cityLandmarks,
    ...planetStories,
  ]) {
    const before = JSON.stringify(story);
    for (const event of story.events)
      for (const index of event.imageIndices)
        assert.equal(
          getGalleryEvent(story, index, event.id),
          event,
          `${story.id}/${event.id}/${index}`,
        );
    assert.equal(getGalleryEvent(story, -1), undefined);
    assert.equal(getGalleryEvent(story, story.gallery.length), undefined);
    assert.equal(JSON.stringify(story), before);
  }
});

test("Olympus same-event photos do not invent a second event", () => {
  const story = planetStories.find(
    (entry) => entry.id === "region-mars-olympus-mons",
  )!;
  assert.equal(getGalleryEvent(story, 0), getGalleryEvent(story, 1));
});

test("a large gallery exposes at most four thumbnails while keeping the active photo accessible", () => {
  for (const length of [0, 1, 2, 4, 7, 12])
    for (let selected = 0; selected < Math.max(1, length); selected++) {
      const indices = visibleGalleryIndices(length, selected);
      assert.equal(indices.length, Math.min(4, length));
      assert.equal(new Set(indices).size, indices.length);
      assert.ok(indices.every((index) => index >= 0 && index < length));
      if (length) assert.ok(indices.includes(selected));
    }
});

test("all 134 stories render the same dialog, separate glass layer and right-side attribution", () => {
  const stories = [
    ...firstBatchCityStories,
    ...cityLandmarks,
    ...planetStories,
  ];
  assert.equal(stories.length, 134);
  for (const story of stories) {
    const html = renderToStaticMarkup(
      createElement(GlobeStoryPanel, { hotspot: story, onClose() {} }),
    );
    assert.ok(html.includes(`data-story-id="${story.id}"`));
    assert.ok(html.includes('class="globe-story-glass" aria-hidden="true"'));
    assert.ok(html.includes('class="globe-story-information"'));
    assert.ok(html.includes(story.gallery[0].licenseUrl));
    const encodedSource = story.gallery[0].sourceUrl.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
        })[char]!,
    );
    assert.ok(html.includes(encodedSource), story.id);
    assert.ok(
      html.indexOf('class="globe-story-image-details"') >
        html.indexOf('class="globe-story-copy"'),
    );
    const fit = getStoryImagePresentation(story.gallery[0]).fit;
    assert.ok(html.includes(`object-fit:${fit}`));
  }
});

test("single-image and missing-image records never render fake gallery controls", () => {
  const spot = immersiveSites[0].hotspots[0];
  for (const record of [spot, { ...spot, image: undefined }]) {
    const html = renderToStaticMarkup(
      createElement(GlobeStoryPanel, { hotspot: record, onClose() {} }),
    );
    assert.ok(!html.includes("story-gallery-next"));
    assert.ok(!html.includes("story-gallery-prev"));
  }
});

test("English panel renders the real caption and retains pending review and source disclosure", () => {
  const story = planetStories[0];
  const html = renderToStaticMarkup(
    createElement(GlobeStoryPanel, {
      hotspot: story,
      language: "en",
      onClose() {},
    }),
  );
  assert.ok(html.includes(story.name.en));
  assert.ok(html.includes("Human review pending"));
  assert.ok(html.includes("Image and attribution"));
});
