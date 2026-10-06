import { useEffect, useRef, useState } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import {
  COUNTRY_OUTLINES_PATH,
  buildCountryOutlineSegments,
  parseCountryOutlines,
} from "./countryOutlines";

export interface CountryOutlineStatus {
  state: "loading" | "ready" | "error";
  featureCount: number;
  lineCount: number;
  message?: string;
}

export interface CountryOutlinesProps {
  visible: boolean;
  onStatus?: (status: CountryOutlineStatus) => void;
}

export function CountryOutlineLayer({
  visible,
  onStatus,
}: CountryOutlinesProps) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const statusCallback = useRef(onStatus);
  statusCallback.current = onStatus;

  useEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    let ownedGeometry: BufferGeometry | undefined;
    setGeometry(null);
    statusCallback.current?.({
      state: "loading",
      featureCount: 0,
      lineCount: 0,
    });

    async function load() {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}${COUNTRY_OUTLINES_PATH}`,
          {
            signal: abort.signal,
          },
        );
        if (!response.ok) {
          throw new Error(
            `国家轮廓本地资源加载失败（HTTP ${response.status}）`,
          );
        }
        const source: unknown = await response.json();
        if (abort.signal.aborted) return;
        const data = buildCountryOutlineSegments(parseCountryOutlines(source));
        ownedGeometry = new BufferGeometry();
        ownedGeometry.setAttribute(
          "position",
          new BufferAttribute(data.positions, 3),
        );
        ownedGeometry.computeBoundingSphere();
        setGeometry(ownedGeometry);
        statusCallback.current?.({
          state: "ready",
          featureCount: data.featureCount,
          lineCount: data.lineCount,
        });
      } catch (error) {
        if (abort.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "国家轮廓加载失败，未知错误";
        statusCallback.current?.({
          state: "error",
          featureCount: 0,
          lineCount: 0,
          message,
        });
        console.error("国家轮廓加载失败：", message);
      }
    }
    void load();
    return () => {
      // 取消异步回调，并只释放本次加载创建的几何，不能影响地球本身。
      abort.abort();
      ownedGeometry?.dispose();
    };
  }, [visible]);

  if (!visible || !geometry) return null;
  return (
    <lineSegments
      name="earth-country-outlines"
      raycast={() => undefined}
      renderOrder={2}
    >
      <primitive object={geometry} attach="geometry" dispose={null} />
      <lineBasicMaterial
        color="#e5dfcc"
        opacity={0.46}
        transparent
        depthTest
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
