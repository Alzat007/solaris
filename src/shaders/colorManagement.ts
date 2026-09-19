/** Match direct rendering and HDR composer output, especially on the low tier. */
export function colorManaged(fragment: string): string {
  return fragment.replace(
    /}\s*$/,
    `\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`,
  );
}
