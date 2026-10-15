import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url));
const records: {
  files: { path: string; sourceUrl: string; bytes: number; sha256: string }[];
} = JSON.parse(read("public/fonts/source-records.json").toString());

test("local fonts retain the original families and weights without requesting remote stylesheets", () => {
  const styles = read("src/ui/styles.css").toString();
  const faces = read("src/ui/localFonts.css").toString();
  assert.ok(styles.startsWith('@import "./localFonts.css";'));
  assert.doesNotMatch(styles + faces, /(?:@import\s+(?:url\()?|\burl\()\s*["']?https?:\/\//);
  assert.equal((faces.match(/@font-face/g) ?? []).length, 8);
  assert.equal((faces.match(/font-weight: 300 600;/g) ?? []).length, 8);
  for (const file of records.files.filter((record) =>
    record.path.endsWith(".woff2"),
  ))
    assert.ok(faces.includes(`/${file.path}`));
});
test("all bundled font bytes match recorded sources and valid WOFF2 signatures", () => {
  assert.equal(records.files.length, 10);
  assert.equal(new Set(records.files.map((file) => file.path)).size, 10);
  for (const file of records.files) {
    const bytes = read(`public/${file.path}`);
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
    if (file.path.endsWith(".woff2")) {
      assert.ok(file.sourceUrl.startsWith("https://fonts.gstatic.com/"));
      assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    }
  }
});
test("both redistributed fonts include their original copyright and OFL notice", () => {
  for (const path of [
    "public/fonts/DM-Sans-OFL.txt",
    "public/fonts/Manrope-OFL.txt",
  ]) {
    const license = read(path).toString();
    assert.match(license, /Copyright/);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});
