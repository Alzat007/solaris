import { PlanetBase } from "./PlanetBase";
import { ParticleField } from "../particles/ParticleField";
export function Saturn() {
  return (
    <PlanetBase id="saturn">
      <group rotation={[0.5, 0, -0.3]}>
        <ParticleField kind="ring" count={60000} color="#d0bb91" radius={1} />
      </group>
    </PlanetBase>
  );
}
