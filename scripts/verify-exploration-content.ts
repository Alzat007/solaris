import { explorationContent } from "../src/exploration/content";
import { earthDirectory } from "../src/exploration/earthDirectory";
import { validateExploration } from "../src/exploration/validateExploration";

const release = process.argv.includes("--release");
const publicPreview = process.argv.includes("--public-preview");
if (release && publicPreview) {
  console.error("Choose --release or --public-preview, not both.");
  process.exit(1);
}
const mode = release ? "Release" : publicPreview ? "Public preview" : "Preview";
const errors = validateExploration(explorationContent, earthDirectory, {
  requireHumanReview: release,
});
if (errors.length) {
  console.error(`${mode} validation failed:\n${errors.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(
    `${mode} validation passed.${release ? "" : " Human review remains pending; this is not formal-release approval."}`,
  );
}
