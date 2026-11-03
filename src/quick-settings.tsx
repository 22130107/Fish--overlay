import * as THREE from "three";
import { RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsColorInput, SettingsSlider } from "./settings-controls";
import { useSetting } from "./settings/react";
import { settings } from "./settings/store";
import type { SectionId } from "./settings/definition";
import { WEATHER_PRESETS, type WeatherPresetId } from "./weather";

interface QuickSettingsProps {
  weather: WeatherPresetId;
  rainEnabled: boolean;
  soundEnabled: boolean;
  onWeatherChange: (id: WeatherPresetId) => void;
  onRainChange: (enabled: boolean) => void;
  onSoundChange: (enabled: boolean) => void;
  onResetSection: (sectionIds: readonly SectionId[]) => void;
  onResetAtmosphere: () => void;
  selectedFamily: number;
  previewFamily: number | null;
  onFamilyChange: (index: number) => void;
  onPreviewFamilyChange: (index: number | null) => void;
}

function SettingSlider({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="quick-setting" data-base-ui-swipe-ignore>
      <div className="quick-setting__copy">
        <span className="quick-setting__label">{label}</span>
        <small>{description}</small>
      </div>
      <SettingsSlider
        label={label}
        aria-label={label}
        showLabel={false}
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onChange}
        className="drawer-elastic-slider"
      />
    </div>
  );
}

function hexFromRgb(value: readonly [number, number, number]): string {
  return `#${new THREE.Color().setRGB(...value).getHexString(THREE.SRGBColorSpace)}`;
}

function hexFromInt(value: number): string {
  return `#${value.toString(16).padStart(6, "0").slice(-6)}`;
}

function QuickColor({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="quick-color" data-base-ui-swipe-ignore>
      <Label htmlFor={id}>{label}</Label>
      <SettingsColorInput id={id} value={value} onChange={onChange} />
    </div>
  );
}

export function QuickSettings({
  weather,
  rainEnabled,
  soundEnabled,
  onWeatherChange,
  onRainChange,
  onSoundChange,
  onResetSection,
  onResetAtmosphere,
  selectedFamily,
  previewFamily,
  onFamilyChange,
  onPreviewFamilyChange,
}: QuickSettingsProps) {
  const paletteIndex = selectedFamily;
  const palettes = settings.live["koi-palettes"];
  const selectedPalette = palettes[paletteIndex] ?? palettes[0];

  const [koiCount, setKoiCount] = useSetting<number>(["koi", "initialCount"]);
  const [base, setBase] = useSetting<number>(["koi-palettes", paletteIndex, "base"]);
  const [accent, setAccent] = useSetting<number>(["koi-palettes", paletteIndex, "accent"]);
  const [marking, setMarking] = useSetting<number>(["koi-palettes", paletteIndex, "marking"]);
  const [fin, setFin] = useSetting<number>(["koi-palettes", paletteIndex, "fin"]);

  const [deepColor, setDeepColor] = useSetting<readonly [number, number, number]>(["pond-bed", "deepColor"]);
  const [shallowColor, setShallowColor] = useSetting<readonly [number, number, number]>(["pond-bed", "shallowColor"]);
  const [clarity, setClarity] = useSetting<number>(["water", "clarity"]);

  const [visibleLeafCount, setVisibleLeafCount] = useSetting<number>(["lotus", "visibleLeafCount"]);
  const [visibleFlowerCount, setVisibleFlowerCount] = useSetting<number>(["lotus", "visibleFlowerCount"]);
  const [visiblePatchCount, setVisiblePatchCount] = useSetting<number>(["duckweed", "visiblePatchCount"]);
  const [visibleButterflyCount, setVisibleButterflyCount] = useSetting<number>(["butterflies", "visibleCount"]);

  return (
    <div className="settings-quick">
      <section className="settings-quick__section" aria-labelledby="quick-koi-heading">
        <div className="settings-quick__heading">
          <div className="settings-quick__heading-row"><h3 id="quick-koi-heading">Cá Koi</h3><button type="button" className="settings-section-reset" onClick={() => onResetSection(["koi", "koi-palettes", "koi-patterns"])}><RotateCcw aria-hidden="true" /> Đặt lại</button></div>
          <p>Chọn số lượng cá bơi trong hồ và tùy chỉnh màu sắc cho từng dòng cá.</p>
        </div>
        <SettingSlider
          label="Số lượng cá Koi"
          description="Thêm hoặc bớt cá mà không cần khởi động lại mô phỏng."
          value={koiCount}
          min={1}
          max={48}
          onChange={setKoiCount}
        />
        <div className="quick-setting" data-base-ui-swipe-ignore>
          <div className="quick-setting__copy">
            <Label htmlFor="quick-koi-family">Dòng cá Koi</Label>
            <small>Các màu bên dưới sẽ áp dụng cho tất cả cá thuộc mẫu hoa văn này.</small>
          </div>
          <select
            id="quick-koi-family"
            className="quick-setting__select"
            value={paletteIndex}
            onChange={(event) => onFamilyChange(Number(event.target.value))}
          >
            {palettes.map((palette, index) => (
              <option key={palette.name} value={index}>{palette.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="family-preview-toggle"
          aria-pressed={previewFamily !== null}
          onClick={() => onPreviewFamilyChange(previewFamily === null ? paletteIndex : null)}
        >
          {previewFamily === null
            ? `Xem trước dòng cá ${selectedPalette.name} trong hồ`
            : `Đang xem dòng cá ${selectedPalette.name} · Hiện toàn bộ đàn`}
        </button>
        <div className="quick-colors">
          <QuickColor id="quick-koi-base" label="Thân cá" value={hexFromInt(base)} onChange={(hex) => setBase(Number.parseInt(hex.slice(1), 16))} />
          <QuickColor id="quick-koi-accent" label="Màu nổi bật" value={hexFromInt(accent)} onChange={(hex) => setAccent(Number.parseInt(hex.slice(1), 16))} />
          <QuickColor id="quick-koi-marking" label="Đốm hoa văn" value={hexFromInt(marking)} onChange={(hex) => setMarking(Number.parseInt(hex.slice(1), 16))} />
          <QuickColor id="quick-koi-fin" label="Vây cá" value={hexFromInt(fin)} onChange={(hex) => setFin(Number.parseInt(hex.slice(1), 16))} />
        </div>
      </section>

      <section className="settings-quick__section" aria-labelledby="quick-water-heading">
        <div className="settings-quick__heading">
          <div className="settings-quick__heading-row"><h3 id="quick-water-heading">Nước hồ</h3><button type="button" className="settings-section-reset" onClick={() => onResetSection(["pond-bed", "water", "ripples"])}><RotateCcw aria-hidden="true" /> Đặt lại</button></div>
          <p>Thay đổi màu nước hồ và độ trong suốt khi nhìn cá qua mặt nước.</p>
        </div>
        <div className="quick-colors">
          <QuickColor
            id="quick-deep-color"
            label="Vùng nước sâu"
            value={hexFromRgb(deepColor)}
            onChange={(hex) => setDeepColor(new THREE.Color(hex).toArray().map((c) => Number(c.toFixed(4))) as [number, number, number])}
          />
          <QuickColor
            id="quick-shallow-color"
            label="Vùng nước nông"
            value={hexFromRgb(shallowColor)}
            onChange={(hex) => setShallowColor(new THREE.Color(hex).toArray().map((c) => Number(c.toFixed(4))) as [number, number, number])}
          />
        </div>
        <SettingSlider
          label="Độ trong của nước"
          description="Làm dịu gợn sóng bề mặt để nhìn cá rõ ràng hơn."
          value={clarity}
          min={0}
          max={1}
          step={0.01}
          onChange={setClarity}
        />
      </section>

      <section className="settings-quick__section" aria-labelledby="quick-plants-heading">
        <div className="settings-quick__heading">
          <div className="settings-quick__heading-row"><h3 id="quick-plants-heading">Thực vật &amp; sinh thái</h3><button type="button" className="settings-section-reset" onClick={() => onResetSection(["lotus", "lotus-leaves", "lotus-flowers", "duckweed", "duckweed-patches", "butterflies", "butterfly-spawns"])}><RotateCcw aria-hidden="true" /> Đặt lại</button></div>
          <p>Tô điểm mặt hồ bằng cây cỏ mà không ảnh hưởng tới đàn cá.</p>
        </div>
        <SettingSlider
          label="Lá sen"
          description="Thêm các lá sen nổi quanh mặt hồ."
          value={visibleLeafCount}
          min={0}
          max={32}
          onChange={setVisibleLeafCount}
        />
        <SettingSlider
          label="Hoa sen"
          description="Thêm hoa sen nở trên các tán lá."
          value={visibleFlowerCount}
          min={0}
          max={16}
          onChange={setVisibleFlowerCount}
        />
        <SettingSlider
          label="Cụm bèo tấm"
          description="Thêm các khóm bèo tấm xanh trôi nổi."
          value={visiblePatchCount}
          min={0}
          max={16}
          onChange={setVisiblePatchCount}
        />
        <SettingSlider
          label="Đàn bướm"
          description="Thay đổi số lượng bướm dập dờn quanh hoa."
          value={visibleButterflyCount}
          min={0}
          max={12}
          onChange={setVisibleButterflyCount}
        />
      </section>

      <section className="settings-quick__section" aria-labelledby="quick-atmosphere-heading">
        <div className="settings-quick__heading">
          <div className="settings-quick__heading-row"><h3 id="quick-atmosphere-heading">Môi trường &amp; ánh sáng</h3><button type="button" className="settings-section-reset" onClick={onResetAtmosphere}><RotateCcw aria-hidden="true" /> Đặt lại</button></div>
          <p>Tùy chỉnh ánh sáng thời tiết, gợn sóng và âm thanh tiếng suối.</p>
        </div>
        <div className="quick-setting" data-base-ui-swipe-ignore>
          <div className="quick-setting__copy">
            <Label htmlFor="quick-weather">Thời tiết</Label>
            <small>Mỗi chế độ mang bảng màu nước và ánh sáng đặc trưng.</small>
          </div>
          <select
            id="quick-weather"
            className="quick-setting__select"
            value={weather}
            onChange={(event) => onWeatherChange(event.target.value as WeatherPresetId)}
          >
            {WEATHER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </div>
        <div className="quick-setting quick-setting--switch" data-base-ui-swipe-ignore>
          <div className="quick-setting__copy">
            <Label htmlFor="quick-rain">Gợn mưa rơi</Label>
            <small>Hiển thị các vòng sóng mưa rơi lăn tăn trên mặt nước.</small>
          </div>
          <Switch id="quick-rain" checked={rainEnabled} onCheckedChange={onRainChange} />
        </div>
        <div className="quick-setting quick-setting--switch" data-base-ui-swipe-ignore>
          <div className="quick-setting__copy">
            <Label htmlFor="quick-sound">Tiếng suối chảy</Label>
            <small>Phát âm thanh suối nước êm dịu làm nền (mặc định tắt).</small>
          </div>
          <Switch id="quick-sound" checked={soundEnabled} onCheckedChange={onSoundChange} />
        </div>
      </section>
    </div>
  );
}
