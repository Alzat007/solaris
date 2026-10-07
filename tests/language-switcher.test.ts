import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { firstBatchCityStories } from "../src/exploration/firstBatchEarth";
import { cityLandmarks } from "../src/exploration/cityLandmarks";
import { planetStories } from "../src/exploration/planetAtlasCatalog";

register(
  `data:text/javascript,${encodeURIComponent(
    'export async function load(url,context,next){if(url.endsWith(".css"))return {format:"module",source:"",shortCircuit:true};return next(url,context);}',
  )}`,
  import.meta.url,
);
const { LanguageSwitcher } = await import("../src/ui/LanguageSwitcher");
const { GlobeStoryPanel } = await import("../src/globeLab/GlobeStoryPanel");

test("both language controls remain named and exactly one is selected", () => {
  for (const language of ["zh", "en"] as const) {
    const html = renderToStaticMarkup(
      createElement(LanguageSwitcher, {
        language,
        context: "header",
        onChange() {},
      }),
    );
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 1);
    assert.match(html, /aria-label="切换到中文"/);
    assert.match(html, /aria-label="Switch to English"/);
    assert.match(
      html,
      new RegExp(
        `aria-pressed="true" data-gesture-id="language-header-${language}"`,
      ),
    );
  }
});

test("all 134 shared stories use their existing bilingual resources without changing IDs, photos or credits", () => {
  const stories = [
    ...firstBatchCityStories,
    ...cityLandmarks,
    ...planetStories,
  ];
  const encode = (value: string) =>
    value.replace(
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
  for (const story of stories) {
    const original = JSON.stringify(story);
    for (const language of ["zh", "en"] as const) {
      const html = renderToStaticMarkup(
        createElement(GlobeStoryPanel, {
          hotspot: story,
          language,
          onLanguageChange() {},
          onClose() {},
        }),
      );
      assert.ok(html.includes(`data-story-id="${story.id}"`));
      assert.ok(html.includes(`lang="${language === "zh" ? "zh-CN" : "en"}"`));
      assert.ok(html.includes('data-language-context="story"'));
      assert.ok(html.includes(encode(story.name[language])), story.id);
      assert.ok(html.includes(encode(story.introduction[language])), story.id);
      assert.ok(
        html.includes(encode(story.gallery[0].caption[language])),
        story.id,
      );
      assert.ok(html.includes(encode(story.gallery[0].path)), story.id);
      assert.ok(html.includes(encode(story.gallery[0].sourceUrl)), story.id);
      assert.ok(html.includes(encode(story.gallery[0].licenseUrl)), story.id);
    }
    assert.equal(JSON.stringify(story), original, story.id);
  }
});

test("a standalone legacy panel without a language callback does not show a nonfunctional toggle", () => {
  const html = renderToStaticMarkup(
    createElement(GlobeStoryPanel, {
      hotspot: planetStories[0],
      onClose() {},
    }),
  );
  assert.ok(!html.includes('data-language-context="story"'));
});
