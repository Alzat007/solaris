import { Globe2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  firstBatchCities,
  firstBatchCountries,
  firstBatchContinents,
  firstBatchCityStories,
} from "./firstBatchEarth";
import { getCityLandmarks, pendingCityLandmarks } from "./cityLandmarks";

interface Props {
  language: "zh" | "en";
  cityId: string | null;
  focusId: string | null;
  onFocus: (id: string) => void;
  onScopeChange: (cityId: string | null) => void;
}

export function EarthBatchPicker({
  language,
  cityId,
  focusId,
  onFocus,
  onScopeChange,
}: Props) {
  const initialCity = firstBatchCities.find((city) => city.id === cityId);
  const [continentId, setContinentId] = useState(
    initialCity?.continentId ?? "",
  );
  const [countryId, setCountryId] = useState(initialCity?.countryId ?? "");
  useEffect(() => {
    const city = firstBatchCities.find((entry) => entry.id === cityId);
    if (city) {
      setContinentId(city.continentId);
      setCountryId(city.countryId);
    }
  }, [cityId]);
  const zh = language === "zh";
  const countries = firstBatchCountries.filter(
    (country) => !continentId || country.continentId === continentId,
  );
  const cities = firstBatchCities.filter(
    (city) =>
      (!continentId || city.continentId === continentId) &&
      (!countryId || city.countryId === countryId),
  );
  const landmarks = cityId ? getCityLandmarks(cityId) : [];
  const pending = cityId
    ? pendingCityLandmarks.filter((landmark) => landmark.cityId === cityId)
    : [];
  const selected = cities.some((city) => city.id === cityId) ? cityId! : "";
  return (
    <div className="earth-batch-picker">
      <select
        aria-label={zh ? "选择大洲" : "Choose a continent"}
        value={continentId}
        onChange={(event) => {
          setContinentId(event.target.value);
          setCountryId("");
          onScopeChange(null);
        }}
      >
        <option value="">{zh ? "全部大洲" : "All continents"}</option>
        {firstBatchContinents.map((continent) => (
          <option key={continent.id} value={continent.id}>
            {continent.name[language]}
          </option>
        ))}
      </select>
      <select
        aria-label={zh ? "选择国家或地区" : "Choose a country or territory"}
        value={countryId}
        onChange={(event) => {
          setCountryId(event.target.value);
          onScopeChange(null);
        }}
      >
        <option value="">
          {zh ? "全部国家／地区" : "All countries / territories"}
        </option>
        {countries.map((country) => (
          <option
            key={`${country.continentId}-${country.id}`}
            value={country.id}
          >
            {country.name[language]}
          </option>
        ))}
      </select>
      <select
        aria-label={zh ? "选择城市与首都" : "Choose a city or capital"}
        value={selected}
        onChange={(event) => onFocus(event.target.value)}
      >
        <option value="" disabled>
          {zh ? "首批城市与首都" : "First-batch cities & capitals"}
        </option>
        {countries
          .filter((country) => !countryId || country.id === countryId)
          .map((country) => (
            <optgroup
              key={`${country.continentId}-${country.id}`}
              label={country.name[language]}
            >
              {cities
                .filter(
                  (city) =>
                    city.countryId === country.id &&
                    city.continentId === country.continentId,
                )
                .map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name[language]}
                    {firstBatchCityStories.some((story) => story.id === city.id)
                      ? ""
                      : zh
                        ? " · 图文待补充"
                        : " · Story pending"}
                  </option>
                ))}
            </optgroup>
          ))}
      </select>
      {(landmarks.length > 0 || pending.length > 0) && (
        <select
          aria-label={zh ? "选择城市内地点" : "Choose a city landmark"}
          value={
            landmarks.some((landmark) => landmark.id === focusId)
              ? focusId!
              : ""
          }
          onChange={(event) => onFocus(event.target.value)}
        >
          <option value="" disabled>
            {zh ? "城市内地点" : "City landmarks"}
          </option>
          {landmarks.map((landmark) => (
            <option key={landmark.id} value={landmark.id}>
              {landmark.name[language]}
            </option>
          ))}
          {pending.map((landmark) => (
            <option key={landmark.id} disabled>
              {landmark.name[language]} · {zh ? "图文待补充" : "Story pending"}
            </option>
          ))}
        </select>
      )}
      {cityId && (
        <button
          type="button"
          aria-label={zh ? "返回城市标注" : "Return to city annotations"}
          title={zh ? "返回城市标注" : "Return to city annotations"}
          data-gesture-id="atlas-city-scope-clear"
          onClick={() => {
            setContinentId("");
            setCountryId("");
            onScopeChange(null);
          }}
        >
          <Globe2 size={19} />
        </button>
      )}
    </div>
  );
}
