import type {
  ContentReview,
  ExplorationContent,
  LocalizedText,
} from "./contentTypes";

export interface ContentValidationOptions {
  requireHumanReview?: boolean;
}

const planetIds = new Set([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
]);
const idPattern = /^[a-z][a-z0-9-]*$/;

export function isContentDate(value: string): boolean {
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1) return false;
  if (month === undefined) return true;
  if (month < 1 || month > 12) return false;
  if (day === undefined) return true;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

export function validateContent(
  content: ExplorationContent,
  options: ContentValidationOptions = {},
): string[] {
  const errors: string[] = [];
  const fail = (label: string, message: string) =>
    errors.push(`${label}: ${message}`);
  const text = (value: string, label: string) => {
    if (typeof value !== "string" || !value.trim())
      fail(label, "text is required");
  };
  const localized = (value: LocalizedText, label: string) => {
    text(value?.zh, `${label}.zh`);
    text(value?.en, `${label}.en`);
  };
  const url = (value: string, label: string) => {
    try {
      const parsed = new URL(value);
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      ) {
        fail(label, "a public HTTPS URL is required");
      }
    } catch {
      fail(label, "a public HTTPS URL is required");
    }
  };
  const review = (
    value: ContentReview,
    label: string,
    mustBeChecked: boolean,
  ) => {
    if (!value || !["source-checked", "pending"].includes(value.status)) {
      fail(label, "valid review status is required");
      return;
    }
    if (!["pending", "approved"].includes(value.humanReview)) {
      fail(label, "human review status is required");
    }
    if (value.status === "source-checked") {
      if (
        !value.by?.trim() ||
        !value.checkedAt ||
        !isContentDate(value.checkedAt) ||
        value.checkedAt.length !== 10
      ) {
        fail(label, "source review needs reviewer and exact check date");
      }
    } else if (mustBeChecked) {
      fail(label, "ready content requires source-checked review");
    }
    if (value.humanReview === "approved" && value.by?.startsWith("Codex")) {
      fail(label, "Codex source review cannot assert human approval");
    }
    if (
      mustBeChecked &&
      options.requireHumanReview &&
      value.humanReview !== "approved"
    ) {
      fail(label, "human review is pending");
    }
  };
  const allIds = new Set<string>();
  for (const [kind, records] of [
    ["destination", content.destinations],
    ["story", content.stories],
    ["asset", content.assets],
    ["source", content.sources],
    ["pack", content.contentPacks],
  ] as const) {
    for (const record of records) {
      if (!idPattern.test(record.id))
        fail(`${kind}.${record.id}`, "invalid stable ID");
      if (allIds.has(record.id)) fail(`${kind}.${record.id}`, "duplicate ID");
      allIds.add(record.id);
    }
  }
  text(content.version, "content.version");
  const sourceMap = new Map(
    content.sources.map((source) => [source.id, source]),
  );
  const destinationMap = new Map(
    content.destinations.map((destination) => [destination.id, destination]),
  );
  const storyMap = new Map(content.stories.map((story) => [story.id, story]));
  const assetMap = new Map(content.assets.map((asset) => [asset.id, asset]));

  const references = (
    ids: string[],
    known: Map<string, unknown>,
    label: string,
    required = false,
  ) => {
    if (required && !ids.length)
      fail(label, "at least one reference is required");
    if (new Set(ids).size !== ids.length) fail(label, "duplicate references");
    for (const id of ids) if (!known.has(id)) fail(label, `unknown ID ${id}`);
  };
  const sourcesChecked = (ids: string[], label: string) => {
    for (const id of ids) {
      const source = sourceMap.get(id);
      if (source) review(source.review, `${label}.${id}`, true);
    }
  };

  for (const source of content.sources) {
    text(source.title, `source.${source.id}.title`);
    text(source.institution, `source.${source.id}.institution`);
    url(source.url, `source.${source.id}.url`);
    review(source.review, `source.${source.id}.review`, false);
  }
  for (const asset of content.assets) {
    const label = `asset.${asset.id}`;
    if (!/^exploration\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/.test(asset.path)) {
      fail(`${label}.path`, "a safe local exploration image path is required");
    }
    url(asset.sourceUrl, `${label}.sourceUrl`);
    url(asset.originalUrl, `${label}.originalUrl`);
    url(asset.rightsUrl, `${label}.rightsUrl`);
    text(asset.license, `${label}.license`);
    text(asset.credit, `${label}.credit`);
    if (!isContentDate(asset.date))
      fail(`${label}.date`, "invalid capture/creation date");
    localized(asset.location, `${label}.location`);
    localized(asset.caption, `${label}.caption`);
    localized(asset.processing, `${label}.processing`);
    if (
      ![
        "event-record",
        "landmark-photo",
        "orbital-image",
        "scientific-visualization",
        "artistic-illustration",
      ].includes(asset.role)
    ) {
      fail(`${label}.role`, "invalid image role");
    }
    if (
      !["ordinary-photo", "orbital-map", "panorama"].includes(asset.projection)
    ) {
      fail(`${label}.projection`, "invalid projection");
    }
    if (typeof asset.aiGenerated !== "boolean")
      fail(`${label}.aiGenerated`, "explicit boolean is required");
    if (asset.aiGenerated && asset.role !== "artistic-illustration") {
      fail(
        `${label}.role`,
        "AI images cannot be labeled as photography or scientific records",
      );
    }
    review(asset.review, `${label}.review`, false);
  }
  for (const story of content.stories) {
    const label = `story.${story.id}`;
    localized(story.title, `${label}.title`);
    localized(story.summary, `${label}.summary`);
    localized(story.body, `${label}.body`);
    if (!isContentDate(story.date)) fail(`${label}.date`, "invalid event date");
    if (!story.topics.length) fail(`${label}.topics`, "topic is required");
    if (!story.links.length)
      fail(`${label}.links`, "a destination relationship is required");
    references(story.sourceIds, sourceMap, `${label}.sourceIds`, true);
    references(story.assetIds, assetMap, `${label}.assetIds`);
    if (
      new Set(story.links.map((link) => link.destinationId)).size !==
      story.links.length
    ) {
      fail(`${label}.links`, "duplicate destination relationships");
    }
    for (const link of story.links) {
      const destination = destinationMap.get(link.destinationId);
      if (!destination)
        fail(`${label}.links`, `unknown destination ${link.destinationId}`);
      else if (!destination.storyIds.includes(story.id))
        fail(
          `${label}.links`,
          "destination must reciprocate the story relationship",
        );
      if (
        !["event-at-site", "remote-observation", "topic-related"].includes(
          link.relation,
        )
      ) {
        fail(`${label}.links`, "invalid relationship type");
      }
      localized(link.description, `${label}.link.${link.destinationId}`);
    }
    review(story.review, `${label}.review`, false);
  }
  for (const destination of content.destinations) {
    const label = `destination.${destination.id}`;
    if (!planetIds.has(destination.bodyId))
      fail(`${label}.bodyId`, "unknown planet");
    if (
      !["natural-region", "landing-site", "city", "observation"].includes(
        destination.kind,
      )
    )
      fail(`${label}.kind`, "invalid destination kind");
    if (!["ready", "draft"].includes(destination.status))
      fail(`${label}.status`, "invalid readiness status");
    if (
      !["surface", "atmosphere", "observation"].includes(destination.approach)
    )
      fail(`${label}.approach`, "invalid approach");
    if (
      ["jupiter", "saturn", "uranus", "neptune"].includes(destination.bodyId) &&
      destination.approach !== "observation"
    ) {
      fail(
        `${label}.approach`,
        "gas/ice giant destinations cannot imply surface landing",
      );
    }
    if (
      destination.kind === "city" &&
      (destination.bodyId !== "earth" ||
        !destination.cityId ||
        !idPattern.test(destination.cityId))
    ) {
      fail(`${label}.cityId`, "Earth city needs a stable city ID");
    }
    localized(destination.name, `${label}.name`);
    localized(destination.summary, `${label}.summary`);
    localized(destination.locationDescription, `${label}.locationDescription`);
    references(destination.sourceIds, sourceMap, `${label}.sourceIds`, true);
    references(
      destination.storyIds,
      storyMap,
      `${label}.storyIds`,
      destination.status === "ready",
    );
    references(
      destination.assetIds,
      assetMap,
      `${label}.assetIds`,
      destination.status === "ready",
    );
    if (destination.position) {
      const position = destination.position;
      if (
        !Number.isFinite(position.latitude) ||
        Math.abs(position.latitude) > 90
      )
        fail(`${label}.position`, "latitude out of range");
      if (
        !Number.isFinite(position.longitude) ||
        Math.abs(position.longitude) > 180
      )
        fail(`${label}.position`, "longitude out of range");
      if (
        !["WGS84", "planetocentric-east", "source-unspecified-east"].includes(
          position.coordinateSystem,
        )
      )
        fail(`${label}.position`, "unknown coordinate system");
      if (
        position.coordinateSystem === "source-unspecified-east" &&
        position.exact
      )
        fail(
          `${label}.position`,
          "unspecified datum cannot assert an exact location",
        );
      if (
        destination.bodyId === "earth" &&
        position.coordinateSystem !== "WGS84"
      )
        fail(`${label}.position`, "Earth coordinates must declare WGS84");
      if (
        destination.bodyId !== "earth" &&
        position.coordinateSystem === "WGS84"
      )
        fail(`${label}.position`, "WGS84 cannot be assigned to another planet");
      if (typeof position.exact !== "boolean")
        fail(`${label}.position`, "coordinate precision must be explicit");
      localized(position.description, `${label}.position.description`);
      references(
        position.sourceIds,
        sourceMap,
        `${label}.position.sourceIds`,
        true,
      );
      if (destination.status === "ready")
        sourcesChecked(position.sourceIds, `${label}.position.sourceIds`);
    }
    for (const storyId of destination.storyIds) {
      const story = storyMap.get(storyId);
      if (
        story &&
        !story.links.some((link) => link.destinationId === destination.id)
      )
        fail(`${label}.storyIds`, "story must link back to this destination");
    }
    review(
      destination.review,
      `${label}.review`,
      destination.status === "ready",
    );
    if (destination.status !== "ready") continue;
    sourcesChecked(destination.sourceIds, `${label}.sourceIds`);
    for (const storyId of destination.storyIds) {
      const story = storyMap.get(storyId);
      if (!story) continue;
      review(story.review, `story.${storyId}.review`, true);
      sourcesChecked(story.sourceIds, `story.${storyId}.sourceIds`);
      for (const assetId of story.assetIds) {
        const asset = assetMap.get(assetId);
        if (asset) review(asset.review, `asset.${assetId}.review`, true);
        if (!destination.assetIds.includes(assetId))
          fail(
            `${label}.assetIds`,
            `story asset ${assetId} is not in the destination preload list`,
          );
      }
    }
    for (const assetId of destination.assetIds) {
      const asset = assetMap.get(assetId);
      if (asset) review(asset.review, `asset.${assetId}.review`, true);
    }
  }
  for (const pack of content.contentPacks) {
    const label = `pack.${pack.id}`;
    text(pack.version, `${label}.version`);
    if (pack.version !== content.version)
      fail(`${label}.version`, "content version mismatch");
    references(
      pack.destinationIds,
      destinationMap,
      `${label}.destinationIds`,
      true,
    );
    references(pack.assetIds, assetMap, `${label}.assetIds`, true);
    if (
      !["bundled-assets-only", "not-cached", "verified-offline"].includes(
        pack.offlineStatus,
      )
    )
      fail(`${label}.offlineStatus`, "invalid offline status");
    if (typeof pack.browserColdStartVerified !== "boolean")
      fail(`${label}.browserColdStartVerified`, "explicit boolean is required");
    if (
      (pack.offlineStatus === "verified-offline") !==
      pack.browserColdStartVerified
    )
      fail(
        `${label}.offlineStatus`,
        "bundled assets do not verify browser offline cold start",
      );
    const fileIds = pack.files.map((file) => file.assetId);
    if (new Set(fileIds).size !== fileIds.length)
      fail(`${label}.files`, "duplicate asset file");
    for (const assetId of pack.assetIds)
      if (!fileIds.includes(assetId))
        fail(`${label}.files`, `missing file for ${assetId}`);
    for (const file of pack.files) {
      const asset = assetMap.get(file.assetId);
      if (!pack.assetIds.includes(file.assetId))
        fail(`${label}.files`, `unlisted asset ${file.assetId}`);
      if (!asset || asset.path !== file.path)
        fail(`${label}.files`, `asset path mismatch for ${file.assetId}`);
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0)
        fail(`${label}.files`, "positive byte count is required");
      if (!/^[a-f0-9]{64}$/.test(file.sha256))
        fail(`${label}.files`, "SHA-256 checksum is required");
    }
    if (
      !Number.isSafeInteger(pack.totalBytes) ||
      pack.totalBytes !== pack.files.reduce((sum, file) => sum + file.bytes, 0)
    )
      fail(`${label}.totalBytes`, "byte total mismatch");
    for (const destinationId of pack.destinationIds) {
      const destination = destinationMap.get(destinationId);
      if (!destination) continue;
      if (destination.status !== "ready")
        fail(
          `${label}.destinationIds`,
          "content pack cannot advertise a draft destination",
        );
      for (const assetId of destination.assetIds)
        if (!pack.assetIds.includes(assetId))
          fail(
            `${label}.assetIds`,
            `destination asset ${assetId} is missing from pack`,
          );
    }
  }
  return errors;
}
