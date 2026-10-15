export interface InputTarget {
  id: string;
  label: string;
  kind: "body" | "ui";
  activate(): boolean;
}
let resolver: ((x: number, y: number) => InputTarget | null) | null = null;
export const scenePointer = {
  register(next: NonNullable<typeof resolver>) {
    resolver = next;
    return () => {
      if (resolver === next) resolver = null;
    };
  },
  resolve(x: number, y: number) {
    return resolver?.(x, y) ?? null;
  },
};
