import {
  Radio,
  Cloud,
  CloudFog,
  CloudRain,
  EyeOff,
  Gauge,
  Maximize2,
  Minus,
  Minimize2,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Settings2,
  Shuffle,
  Smartphone,
  Sun,
  Sunset as SunsetIcon,
  Undo2,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { FoodSystem } from "./food-system";
import { LiveClient, type LiveStreamState } from "./live-client";
import { LiveOverlay } from "./components/live-overlay";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AUDIO } from "./audio-config";
import { ConfigEditor } from "./config-editor";
import {
  CANVAS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FISH,
  FIXED_STEP,
  setCanvasSize,
} from "./config";
import { FishRenderer } from "./fish-renderer";
import { createFrameLimiter } from "./frame-limiter";
import { useIsMobile } from "./hooks/use-mobile";
import { clamp, vec } from "./math";
import {
  FRAME_RATE_OPTIONS,
  effectiveFrameRate,
  frameRateOption,
  isFrameRateCap,
  loadPerformancePrefs,
  savePerformancePrefs,
  type PerformancePrefs,
} from "./performance-prefs";
import { connectSettingsEffects } from "./settings/effects";
import { connectPersistence, loadInto } from "./settings/persistence";
import { useSettingsMeta } from "./settings/react";
import { settings } from "./settings/store";
import type { SectionId } from "./settings/definition";
import { School } from "./school";
import { createRandomFishAppearance } from "./fish-appearance";
import {
  DEFAULT_WEATHER_PRESET_ID,
  getWeatherPreset,
  WEATHER_PRESETS,
  type WeatherPresetId,
} from "./weather";

interface SceneStats {
  koi: number;
}

interface PondRuntime {
  school: School;
  renderer: FishRenderer;
  foodSystem: FoodSystem;
  showDebug: boolean;
}

const emptyStats: SceneStats = {
  koi: FISH.initialCount,
};

const AMBIENT_IDLE_DELAY_MS = 2400;

// Restores v2 (or migrates v1) localStorage settings into the store before
// the first render, and wires up debounced+pagehide saving from then on.
loadInto(settings);
connectPersistence(settings);

function pondRenderSize(
  display: HTMLElement,
  forceMobileView?: boolean,
): { width: number; height: number } {
  const { width, height } = display.getBoundingClientRect();
  const isPortrait =
    forceMobileView ||
    (width > 0 && height > 0 && width < height) ||
    (typeof window !== "undefined" &&
      window.matchMedia("(max-width: 700px) and (orientation: portrait)").matches);

  if (isPortrait) {
    // 9:16 mobile portrait ratio (270 x 480)
    return { width: 270, height: 480 };
  }
  return { width: CANVAS.width, height: CANVAS.height };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function sceneStats(runtime: PondRuntime): SceneStats {
  return {
    koi: runtime.school.count,
  };
}

function WeatherIcon({ id }: { id: WeatherPresetId }) {
  switch (id) {
    case "sunny":
      return <Sun aria-hidden="true" />;
    case "deep-clear":
      return <Waves aria-hidden="true" />;
    case "overcast":
      return <Cloud aria-hidden="true" />;
    case "mist":
      return <CloudFog aria-hidden="true" />;
    case "sunset":
      return <SunsetIcon aria-hidden="true" />;
    case "moonlight":
      return <Moon aria-hidden="true" />;
    case "rain":
      return <CloudRain aria-hidden="true" />;
  }
}

export function App() {
  const isMobile = useIsMobile();
  const foodSystemRef = useRef<FoodSystem>(new FoodSystem());
  const liveClientRef = useRef<LiveClient | null>(null);
  const [liveState, setLiveState] = useState<LiveStreamState>({
    connected: false,
    tiktokConnected: false,
    tiktokUsername: "",
    topDonors: [],
    currentGift: null,
    latestEvent: null,
  });
  const isLiveInitial =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("live") === "1";
  const isMobileInitial =
    typeof window !== "undefined" &&
    (() => {
      const p = new URLSearchParams(window.location.search);
      if (p.get("mobile") === "1" || p.get("portrait") === "1" || p.get("phone") === "1") return true;
      if (p.get("mobile") === "0" || p.get("desktop") === "1") return false;
      return window.innerWidth < window.innerHeight;
    })();
  const [liveMode, setLiveMode] = useState<boolean>(() => isLiveInitial);
  const [mobileView, setMobileView] = useState<boolean>(() => isMobileInitial);
  const mobileViewRef = useRef(mobileView);
  mobileViewRef.current = mobileView;
  const [activeSchool, setActiveSchool] = useState<School | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ambientAudioElRef = useRef<HTMLAudioElement | null>(null);
  const runtimeRef = useRef<PondRuntime | null>(null);
  const ambientModeRef = useRef(false);
  const soundEnabledRef = useRef<boolean>(AUDIO.defaultEnabled);
  const [stats, setStats] = useState<SceneStats>(emptyStats);
  const [showInterface, setShowInterface] = useState<boolean>(() => !isLiveInitial);
  const [ambientMode, setAmbientMode] = useState(false);
  const [ambientControlsVisible, setAmbientControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weatherMenuOpen, setWeatherMenuOpen] = useState(false);
  const [frameRateMenuOpen, setFrameRateMenuOpen] = useState(false);
  const [performancePrefs, setPerformancePrefs] =
    useState<PerformancePrefs>(loadPerformancePrefs);
  const frameRateCap = effectiveFrameRate(performancePrefs, ambientMode);
  // The render loop reads the cap from a ref so changing it never re-runs the
  // runtime effect (which would dispose and recreate the renderer).
  const frameRateCapRef = useRef(frameRateCap);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    AUDIO.defaultEnabled,
  );
  const settingsMeta = useSettingsMeta();
  const { weather: weatherPreset, rain: rainEnabled, canUndo } = settingsMeta;
  const [selectedFamily, setSelectedFamily] = useState(0);
  const [previewFamily, setPreviewFamily] = useState<number | null>(null);
  const previewFamilyRef = useRef<number | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const scatter = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.school.scatter();
    setStats(sceneStats(runtime));
  }, []);

  const setFamilyPreview = useCallback((index: number | null) => {
    previewFamilyRef.current = index;
    setPreviewFamily(index);
    runtimeRef.current?.renderer.setPreviewFamily(index);
  }, []);

  // Clears the family preview on any settings edit that doesn't keep it
  // (koi-palettes/koi-patterns edits and a few koi body/eye fields do).
  useEffect(() => {
    return settings.subscribe((batch) => {
      if (previewFamilyRef.current === null) return;
      if (batch.some((change) => !change.keepsFamilyPreview)) setFamilyPreview(null);
    });
  }, [setFamilyPreview]);

  // Keeps the koi count readout in sync after a koi:count effect runs
  // (settings/effects.ts calls school.setCount on the next animation frame).
  useEffect(() => {
    return settings.subscribe((batch) => {
      if (!batch.some((change) => change.effect === "koi:count")) return;
      requestAnimationFrame(() => {
        const runtime = runtimeRef.current;
        if (runtime) setStats(sceneStats(runtime));
      });
    });
  }, []);

  const toggleLiveMode = useCallback(() => {
    setLiveMode((current) => {
      const next = !current;
      setShowInterface(!next);
      if (next && runtimeRef.current) {
        const school = runtimeRef.current.school;
        const hasViewerFish = school.fish
          .slice(0, school.count)
          .some((f) => Boolean(f.ownerId));
        if (!hasViewerFish) {
          school.count = 1;
          school.fish[0].customAppearance = createRandomFishAppearance();
        }
      }
      return next;
    });
  }, []);

  const toggleMobileView = useCallback(() => {
    setMobileView((current) => {
      const next = !current;
      mobileViewRef.current = next;
      const runtime = runtimeRef.current;
      const display = displayRef.current;
      if (runtime && display) {
        const nextSize = pondRenderSize(display, next);
        const oldWidth = CANVAS_WIDTH;
        const oldHeight = CANVAS_HEIGHT;
        setCanvasSize(nextSize.width, nextSize.height);
        runtime.school.resize(nextSize.width / oldWidth, nextSize.height / oldHeight);
        runtime.renderer.resize(nextSize.width, nextSize.height, oldWidth, oldHeight);
        for (const p of runtime.foodSystem.pellets) {
          p.position.x = (p.position.x / oldWidth) * nextSize.width;
          p.position.y = (p.position.y / oldHeight) * nextSize.height;
        }
      }
      return next;
    });
  }, []);

  const changeKoiCount = useCallback((amount: number) => {
    const current = runtimeRef.current?.school.count ?? settings.live.koi.initialCount;
    settings.set(["koi", "initialCount"], clamp(current + amount, 1, 48));
  }, []);

  const setAmbientModeState = useCallback((active: boolean) => {
    ambientModeRef.current = active;
    setAmbientMode(active);
    setAmbientControlsVisible(true);
  }, []);

  useEffect(() => {
    frameRateCapRef.current = frameRateCap;
  }, [frameRateCap]);

  const changeFrameRate = useCallback((value: string) => {
    if (!isFrameRateCap(value)) return;
    const next: PerformancePrefs = { version: 1, frameRate: value, explicit: true };
    setPerformancePrefs(next);
    savePerformancePrefs(next);
  }, []);

  const toggleAmbientMode = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;

    if (ambientModeRef.current) {
      setAmbientModeState(false);
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      return;
    }

    setAmbientModeState(true);
    const fullscreenRoot = document.documentElement;
    if (!document.fullscreenElement && fullscreenRoot.requestFullscreen) {
      await fullscreenRoot.requestFullscreen().catch(() => undefined);
    }
  }, [setAmbientModeState]);

  // Keeps the renderer's weather look and the simulation's rain intensity in
  // sync with the store, whether they change via a slider, Undo, or reload.
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.renderer.setWeatherPreset(weatherPreset);
  }, [weatherPreset]);
  useEffect(() => {
    runtimeRef.current?.school.setRainIntensity(rainEnabled ? 1 : 0);
  }, [rainEnabled]);

  const startAmbientAudio = useCallback((): void => {
    if (!ambientAudioElRef.current) {
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/ambient-river-v1.m4a`);
      audio.loop = true;
      audio.volume = AUDIO.ambient.volume;
      ambientAudioElRef.current = audio;
    }
    const audio = ambientAudioElRef.current;
    if (audio && soundEnabledRef.current) {
      audio.play().catch(() => {
        const unlock = () => {
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("click", unlock);
          window.removeEventListener("keydown", unlock);
          if (soundEnabledRef.current && ambientAudioElRef.current) {
            ambientAudioElRef.current.play().catch(() => {});
          }
        };
        window.addEventListener("pointerdown", unlock);
        window.addEventListener("click", unlock);
        window.addEventListener("keydown", unlock);
      });
    }
  }, []);

  const setAmbientSoundEnabled = useCallback((enabled: boolean) => {
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    if (!ambientAudioElRef.current) {
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/ambient-river-v1.m4a`);
      audio.loop = true;
      audio.volume = AUDIO.ambient.volume;
      ambientAudioElRef.current = audio;
    }
    const audio = ambientAudioElRef.current;
    if (enabled) {
      startAmbientAudio();
    } else if (audio) {
      audio.pause();
    }
  }, [startAmbientAudio]);

  const undoLastInteraction = useCallback(() => {
    settings.undo();
  }, []);

  const resetSection = useCallback((sectionIds: readonly SectionId[]) => {
    settings.resetSections(sectionIds);
    if (previewFamilyRef.current !== null && sectionIds.some((id) => id !== "koi-palettes" && id !== "koi-patterns")) {
      setFamilyPreview(null);
    }
  }, [setFamilyPreview]);

  const resetSettings = useCallback(() => {
    settings.resetAll();
    setFamilyPreview(null);
    setConfirmResetAll(false);
  }, [setFamilyPreview]);

  const changeFamily = useCallback((index: number) => {
    setSelectedFamily(index);
    setFamilyPreview(index);
  }, [setFamilyPreview]);

  const handleSettingsOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setFamilyPreview(null);
      setConfirmResetAll(false);
    }
    setSettingsOpen(open);
  }, [setFamilyPreview]);

  useEffect(() => {
    startAmbientAudio();
    const onUserGesture = () => {
      startAmbientAudio();
    };
    window.addEventListener("pointerdown", onUserGesture, { once: true });
    window.addEventListener("click", onUserGesture, { once: true });
    window.addEventListener("keydown", onUserGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("click", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
    };
  }, [startAmbientAudio]);

  useEffect(() => () => {
    if (ambientAudioElRef.current) {
      ambientAudioElRef.current.pause();
      ambientAudioElRef.current = null;
    }
  }, []);

  const changeWeather = useCallback((id: WeatherPresetId) => {
    setFamilyPreview(null);
    settings.setWeather(id);
    setWeatherMenuOpen(false);
  }, [setFamilyPreview]);

  const handleRainChange = useCallback((enabled: boolean) => {
    settings.setRain(enabled);
  }, []);

  const handleSoundChange = useCallback((enabled: boolean) => {
    setAmbientSoundEnabled(enabled);
  }, [setAmbientSoundEnabled]);

  const resetAtmosphere = useCallback(() => {
    changeWeather(DEFAULT_WEATHER_PRESET_ID);
    setAmbientSoundEnabled(false);
  }, [changeWeather, setAmbientSoundEnabled]);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      if (document.fullscreenElement === document.documentElement) {
        setAmbientModeState(true);
      } else if (ambientModeRef.current && !document.fullscreenElement) {
        setAmbientModeState(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [setAmbientModeState]);

  useEffect(() => {
    if (!ambientMode || settingsOpen || weatherMenuOpen || frameRateMenuOpen) {
      setAmbientControlsVisible(true);
      return;
    }

    let idleTimer = window.setTimeout(
      () => setAmbientControlsVisible(false),
      AMBIENT_IDLE_DELAY_MS,
    );
    const revealControls = (): void => {
      setAmbientControlsVisible(true);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(
        () => setAmbientControlsVisible(false),
        AMBIENT_IDLE_DELAY_MS,
      );
    };

    window.addEventListener("pointermove", revealControls);
    window.addEventListener("pointerdown", revealControls);
    window.addEventListener("keydown", revealControls);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener("pointermove", revealControls);
      window.removeEventListener("pointerdown", revealControls);
      window.removeEventListener("keydown", revealControls);
    };
  }, [ambientMode, settingsOpen, weatherMenuOpen, frameRateMenuOpen]);

  useEffect(() => {
    if (!showInterface && previewFamilyRef.current !== null) setFamilyPreview(null);
  }, [showInterface, setFamilyPreview]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const display = displayRef.current;
    if (!canvas || !display) return;
    const initialSize = pondRenderSize(display, mobileViewRef.current);
    setCanvasSize(initialSize.width, initialSize.height);
    const isLive = new URLSearchParams(window.location.search).get("live") === "1";
    const school = new School(isLive ? 1 : FISH.initialCount);
    const renderer = new FishRenderer(canvas);
    (school as any).fishRenderer = renderer;
    const foodSystem = foodSystemRef.current;
    const runtime: PondRuntime = { school, renderer, foodSystem, showDebug: false };
    const liveClient = new LiveClient(school, foodSystem);
    liveClientRef.current = liveClient;
    const unsubscribeLive = liveClient.subscribe((next) => setLiveState(next));
    runtimeRef.current = runtime;
    setActiveSchool(school);
    const activeWeather = getWeatherPreset(settings.meta().weather);
    renderer.setWeatherPreset(activeWeather.id);
    school.setRainIntensity(settings.meta().rain ? 1 : 0);
    const disconnectEffects = connectSettingsEffects(settings, { school, renderer });

    const resizeObserver = new ResizeObserver(() => {
      const nextSize = pondRenderSize(display, mobileViewRef.current);
      if (nextSize.width === CANVAS_WIDTH && nextSize.height === CANVAS_HEIGHT) return;
      const oldWidth = CANVAS_WIDTH;
      const oldHeight = CANVAS_HEIGHT;
      setCanvasSize(nextSize.width, nextSize.height);
      school.resize(nextSize.width / oldWidth, nextSize.height / oldHeight);
      renderer.resize(nextSize.width, nextSize.height, oldWidth, oldHeight);
    });
    resizeObserver.observe(display);

    let animationFrame = 0;
    let accumulator = 0;
    let simulationTime = 0;
    let previousTime = performance.now();
    const frameLimiter = createFrameLimiter();
    const animate = (now: number): void => {
      const cap = frameRateOption(frameRateCapRef.current);
      if (!frameLimiter.shouldRender(now, cap.fps)) {
        // previousTime only advances on rendered frames, so the accumulator
        // below still receives the full real elapsed time.
        animationFrame = requestAnimationFrame(animate);
        return;
      }
      accumulator += Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      while (accumulator >= FIXED_STEP) {
        simulationTime += FIXED_STEP;
        school.update(FIXED_STEP, simulationTime);
        foodSystem.update(FIXED_STEP, school);
        liveClient.update(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }

      renderer.draw(school, simulationTime, runtime.showDebug);
      animationFrame = requestAnimationFrame(animate);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (isEditableTarget(event.target)) return;
      switch (event.code) {
        case "Space":
          event.preventDefault();
          school.scatter();
          break;
        case "BracketLeft":
          changeKoiCount(-1);
          break;
        case "BracketRight":
          changeKoiCount(1);
          break;
        case "KeyD":
          runtime.showDebug = !runtime.showDebug;
          break;
        case "KeyH":
          setShowInterface((current) => !current);
          break;
        case "KeyR":
          school.reset();
          break;
        case "KeyF":
          event.preventDefault();
          void toggleAmbientMode();
          break;
        case "KeyM":
          event.preventDefault();
          toggleMobileView();
          break;
        default:
          return;
      }
      setStats(sceneStats(runtime));
    };

    window.addEventListener("keydown", handleKeyDown);
    setStats(sceneStats(runtime));
    animationFrame = requestAnimationFrame(animate);

    // Keep simulation ticking in background without piling up WebGL frame renders
    let bgInterval = 0;
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        if (!bgInterval) {
          bgInterval = window.setInterval(() => {
            const now = performance.now();
            accumulator += Math.min((now - previousTime) / 1000, 0.1);
            previousTime = now;
            while (accumulator >= FIXED_STEP) {
              simulationTime += FIXED_STEP;
              school.update(FIXED_STEP, simulationTime);
              foodSystem.update(FIXED_STEP, school);
              liveClient.update(FIXED_STEP);
              accumulator -= FIXED_STEP;
            }
          }, 1000 / 20);
        }
      } else {
        if (bgInterval) {
          window.clearInterval(bgInterval);
          bgInterval = 0;
        }
        previousTime = performance.now();
        accumulator = 0;
        if (!animationFrame) {
          animationFrame = requestAnimationFrame(animate);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrame);
      if (bgInterval) window.clearInterval(bgInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      setActiveSchool(null);
      unsubscribeLive();
      liveClient.dispose();
      liveClientRef.current = null;
      disconnectEffects();
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      (school as any).fishRenderer = null;
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, [changeKoiCount, toggleAmbientMode]);

  const callFish = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    runtime.school.callTo(
      vec(
        clamp(
          ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
          0,
          CANVAS_WIDTH,
        ),
        clamp(
          ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
          0,
          CANVAS_HEIGHT,
        ),
      ),
    );
    setStats(sceneStats(runtime));
  };

  const revealHiddenInterfaceOnMobile = (
    event: ReactPointerEvent<HTMLElement>,
  ): void => {
    if (!isMobile || showInterface) return;
    event.preventDefault();
    event.stopPropagation();
    setShowInterface(true);
  };

  const selectedWeather = getWeatherPreset(weatherPreset);
  const selectedFrameRate = frameRateOption(frameRateCap);
  const ambientUiHeldOpen = settingsOpen || weatherMenuOpen || frameRateMenuOpen;
  const ambientUiHidden =
    ambientMode && !ambientControlsVisible && !ambientUiHeldOpen;

  return (
    <main
      ref={stageRef}
      className={`stage${ambientMode ? " stage--ambient" : ""}${
        mobileView ? " stage--mobile" : ""
      }${
        ambientUiHidden
          ? " stage--ambient-idle"
          : ""
      }`}
      aria-label="Procedural koi simulation"
      onPointerDownCapture={revealHiddenInterfaceOnMobile}
    >
      <div className="pond-shell">
        <div className="display" ref={displayRef}>
          <canvas
            ref={canvasRef}
            id="pond"
            aria-label="Animated procedural koi"
            onPointerDown={callFish}
          />
          {activeSchool && (
            <LiveOverlay
              school={activeSchool}
              foodSystem={foodSystemRef.current}
              liveState={liveState}
              showOverlay={liveMode}
            />
          )}
          {previewFamily !== null && settingsOpen && (
            <div className="pond-preview-label" aria-live="polite">
              Xem trước dòng cá {settings.live["koi-palettes"][previewFamily]?.name ?? "Koi"}
            </div>
          )}
        </div>

        {showInterface && (
          <div
            className={`pond-ui${
              ambientUiHidden
                ? " pond-ui--hidden"
                : ""
            }`}
          >
            <div className="top-actions">
              <Button
                variant={mobileView ? "secondary" : "ghost"}
                size="sm"
                className="view-mode-btn"
                onClick={toggleMobileView}
                aria-label={mobileView ? "Chuyển sang 16:9 Máy tính" : "Chuyển sang 9:16 Điện thoại"}
                title={mobileView ? "Chế độ máy tính 16:9 (Phím M)" : "Chế độ điện thoại 9:16 (Phím M)"}
                style={{ gap: "6px" }}
              >
                {mobileView ? (
                  <Monitor aria-hidden="true" style={{ width: "15px", height: "15px" }} />
                ) : (
                  <Smartphone aria-hidden="true" style={{ width: "15px", height: "15px" }} />
                )}
                <span>{mobileView ? "Điện thoại (9:16)" : "Máy tính (16:9)"}</span>
              </Button>
              <Separator orientation="vertical" />
              <Button
                variant={liveMode ? "secondary" : "ghost"}
                size="sm"
                className="live-toggle-btn"
                onClick={toggleLiveMode}
                aria-label="Bật tắt chế độ Live Stream"
                style={{ gap: "6px" }}
              >
                <Radio aria-hidden="true" style={{ width: "15px", height: "15px", color: liveState.connected ? "#10b981" : "inherit" }} />
                <span>{liveMode ? "Live Đang Bật" : "Bật Live"}</span>
              </Button>
              <Separator orientation="vertical" />
              <Drawer
                open={settingsOpen}
                onOpenChange={handleSettingsOpenChange}
                modal={false}
                swipeDirection={isMobile ? "down" : "right"}
                showSwipeHandle={isMobile}
                disablePointerDismissal
              >
              <DrawerTrigger
                render={
                  <Button
                    className="settings-trigger"
                    variant="ghost"
                    aria-label="Mở cài đặt hồ cá"
                  />
                }
              >
                <Settings2 aria-hidden="true" />
                <span>Cài đặt</span>
              </DrawerTrigger>
              <DrawerContent className="settings-drawer">
                <DrawerHeader className="settings-drawer__header">
                  <div>
                    <DrawerTitle>Cài đặt hồ cá</DrawerTitle>
                    <DrawerDescription>
                      Các thay đổi hiển thị trực tiếp trong hồ và được lưu trên thiết bị này.
                    </DrawerDescription>
                  </div>
                  <DrawerClose
                    render={
                      <Button variant="ghost" size="icon" aria-label="Đóng cài đặt" />
                    }
                  >
                    <X aria-hidden="true" />
                  </DrawerClose>
                </DrawerHeader>
                <div className="settings-scroll">
                  <ConfigEditor
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    weather={weatherPreset}
                    rainEnabled={rainEnabled}
                    soundEnabled={soundEnabled}
                    onWeatherChange={changeWeather}
                    onRainChange={handleRainChange}
                    onSoundChange={handleSoundChange}
                    onResetSection={resetSection}
                    onResetAtmosphere={resetAtmosphere}
                    selectedFamily={selectedFamily}
                    previewFamily={previewFamily}
                    onFamilyChange={changeFamily}
                    onPreviewFamilyChange={setFamilyPreview}
                  />
                </div>
                <DrawerFooter className="settings-drawer__footer">
                  {confirmResetAll ? (
                    <div className="settings-reset-confirm" role="group" aria-label="Xác nhận đặt lại tất cả cài đặt">
                      <span>Đặt lại tất cả cài đặt trên thiết bị này?</span>
                      <Button variant="ghost" onClick={() => setConfirmResetAll(false)}>Hủy</Button>
                      <Button variant="destructive" onClick={resetSettings}>Đặt lại tất cả</Button>
                    </div>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={undoLastInteraction} disabled={!canUndo}>
                        <Undo2 aria-hidden="true" /> Hoàn tác
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmResetAll(true)}>
                        <RotateCcw aria-hidden="true" /> Đặt lại tất cả
                      </Button>
                      <DrawerClose render={<Button />}>Xong</DrawerClose>
                    </>
                  )}
                </DrawerFooter>
              </DrawerContent>
              </Drawer>
            </div>
          </div>
        )}



        {showInterface && (
          <nav
            className={`control-dock${
              ambientUiHidden
                ? " control-dock--hidden"
                : ""
            }`}
            aria-label="Simulation controls"
          >
            <div className="control-group control-group--view">
              <Button
                variant={mobileView ? "secondary" : "ghost"}
                size="sm"
                onClick={toggleMobileView}
                aria-label={mobileView ? "Chế độ máy tính 16:9" : "Chế độ điện thoại 9:16"}
                aria-keyshortcuts="M"
                title={mobileView ? "Chuyển sang 16:9 máy tính (Phím M)" : "Chuyển sang 9:16 điện thoại (Phím M)"}
              >
                {mobileView ? (
                  <Monitor aria-hidden="true" />
                ) : (
                  <Smartphone aria-hidden="true" />
                )}
                <span className="control-label">{mobileView ? "Máy tính" : "Điện thoại"}</span>
                <Kbd className="control-shortcut">M</Kbd>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void toggleAmbientMode()}
                aria-label={ambientMode ? "Exit ambient mode" : "Enter ambient mode"}
                aria-keyshortcuts="F"
                aria-pressed={ambientMode}
              >
                {ambientMode ? (
                  <Minimize2 aria-hidden="true" />
                ) : (
                  <Maximize2 aria-hidden="true" />
                )}
                <span className="control-label">{ambientMode ? "Thoát" : "Thư giãn"}</span>
                <Kbd className="control-shortcut">F</Kbd>
              </Button>
              <DropdownMenu
                open={frameRateMenuOpen}
                onOpenChange={setFrameRateMenuOpen}
              >
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="frame-rate-trigger"
                      variant="ghost"
                      size="sm"
                      aria-label={`Frame rate: ${selectedFrameRate.label}`}
                    />
                  }
                >
                  <Gauge aria-hidden="true" />
                  <span className="control-label">{selectedFrameRate.label}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="frame-rate-menu"
                  side="top"
                  align="center"
                  sideOffset={8}
                >
                  <DropdownMenuRadioGroup
                    value={frameRateCap}
                    onValueChange={changeFrameRate}
                  >
                    <DropdownMenuLabel>Frame rate</DropdownMenuLabel>
                    {FRAME_RATE_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.id}
                        value={option.id}
                        closeOnClick
                      >
                        <span className="frame-rate-option">
                          <span className="frame-rate-option__label">{option.label}</span>
                          <span className="frame-rate-option__hint">{option.description}</span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInterface(false)}
                aria-label="Ẩn giao diện"
                aria-keyshortcuts="H"
              >
                <EyeOff aria-hidden="true" />
                <span className="control-label">Ẩn giao diện</span>
                <Kbd className="control-shortcut">H</Kbd>
              </Button>
            </div>
            <Separator className="control-divider" orientation="vertical" />
            <div className="control-group control-group--simulation">
              <Button
                variant="secondary"
                size="sm"
                onClick={scatter}
                aria-keyshortcuts="Space"
              >
                <Shuffle aria-hidden="true" />
                <span className="control-label">Khuấy động</span>
                <Kbd className="control-shortcut">Space</Kbd>
              </Button>
              <Separator orientation="vertical" />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeKoiCount(-1)}
                aria-label="Remove one koi"
                aria-keyshortcuts="["
              >
                <Minus aria-hidden="true" />
              </Button>
              <output className="koi-count" aria-live="polite">
                {stats.koi}
              </output>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeKoiCount(1)}
                aria-label="Add one koi"
                aria-keyshortcuts="]"
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
            <Separator className="control-divider" orientation="vertical" />
            <div className="control-group control-group--environment">
              <DropdownMenu
                open={weatherMenuOpen}
                onOpenChange={setWeatherMenuOpen}
              >
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="weather-trigger"
                      variant="ghost"
                      size="sm"
                      aria-label={`Weather: ${selectedWeather.label}`}
                    />
                  }
                >
                  <WeatherIcon id={weatherPreset} />
                  <span className="control-label">{selectedWeather.label}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="weather-menu"
                  side="top"
                  align="center"
                  sideOffset={8}
                >
                  <DropdownMenuRadioGroup
                    value={weatherPreset}
                    onValueChange={(value) =>
                      changeWeather(value as WeatherPresetId)
                    }
                  >
                    <DropdownMenuLabel>Weather and lighting</DropdownMenuLabel>
                    {WEATHER_PRESETS.map((preset) => (
                      <DropdownMenuRadioItem
                        key={preset.id}
                        value={preset.id}
                        closeOnClick
                      >
                        <WeatherIcon id={preset.id} />
                        {preset.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="rain-control">
                <CloudRain aria-hidden="true" />
                <span className="rain-control__label">Mưa</span>
                <Switch
                  size="sm"
                  checked={rainEnabled}
                  onCheckedChange={handleRainChange}
                  aria-label="Toggle rain ripples"
                />
              </div>
              <div className="rain-control">
                <Volume2 aria-hidden="true" />
                <span className="rain-control__label">Âm thanh</span>
                <Switch
                  size="sm"
                  checked={soundEnabled}
                  onCheckedChange={handleSoundChange}
                  aria-label="Toggle pond ambience"
                />
              </div>
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
