import type { School } from "./school";
import type { FoodSystem } from "./food-system";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import { vec } from "./math";
import { settings } from "./settings/store";
import type { WeatherPresetId } from "./weather";
import { TribulationManager } from "./tribulation-manager";
import { PvpArenaManager } from "./pvp-arena-manager";
import type { PvpArenaState } from "./pvp-arena-types";
import type { TribulationState } from "./tribulation-types";

export interface TopDonor {
  id: string;
  name: string;
  avatar: string;
  coins: number;
  count: number;
}

export interface GiftAlert {
  id: string;
  user: string;
  giftName: string;
  count: number;
  coins: number;
  tier: number;
}

export interface EventAlert {
  id: number;
  text: string;
  type: "spawn" | "hook" | "info" | "size";
}

export interface LiveStreamState {
  connected: boolean;
  tiktokConnected: boolean;
  tiktokUsername: string;
  topDonors: TopDonor[];
  currentGift: GiftAlert | null;
  latestEvent: EventAlert | null;
  tribulation?: TribulationState | null;
  arena?: PvpArenaState | null;
}

export class LiveClient {
  public state: LiveStreamState = {
    connected: false,
    tiktokConnected: false,
    tiktokUsername: "",
    topDonors: [],
    currentGift: null,
    latestEvent: null,
    tribulation: null,
  };

  public tribulation = new TribulationManager();
  public arena = new PvpArenaManager();

  private ws: WebSocket | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private audioQueue: Array<{ url?: string; text: string }> = [];
  private isAudioPlaying = false;
  private listeners: Set<(s: LiveStreamState) => void> = new Set();
  private reconnectTimer: number | null = null;
  private giftDismissTimer: number | null = null;
  private alertDismissTimer: number | null = null;
  private alertSeq = 1;
  private transformationTimers: any[] = [];

  public constructor(
    private readonly school: School,
    private readonly foodSystem: FoodSystem,
    private readonly serverUrl: string = typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("ws") ||
         `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
           window.location.port === "5173"
             ? `${window.location.hostname}:3001`
             : window.location.host
         }`)
      : "ws://localhost:3001",
  ) {
    this.audioEl = new Audio();

    // Auto-unlock browser audio policy on first user interaction
    const unlock = () => {
      if (!this.audioEl) this.audioEl = new Audio();
      this.audioEl.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      this.audioEl.play().catch(() => {});
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

        // Wire up school events
    this.school.arena = this.arena;
    this.arena.onEvent = (evt) => {
      this.pushEventAlert(
        evt.text,
        evt.type === "knockout" || evt.type === "eat" ? "hook" : "info"
      );
      this.queueTTS({ text: evt.text });
      this.notify();
    };
    this.school.onViewerSpawned = (name) => {
      this.pushEventAlert(`✨ ${name} vừa vào hồ và nhận 1 chú cá!`, "spawn");
    };

    this.school.onFishHooked = (name) => {
      this.pushEventAlert(`🎣 Cá của ${name} bị câu mất vì bị bỏ đói!`, "hook");
    };

    // Wire up tribulation events
    this.tribulation.onStart = (st) => {
      this.state.tribulation = { ...st };
      this.school.tribulation = { ...st };

      // Ensure target fish exists in pond
      let fish = this.school.fish
        .slice(0, this.school.count)
        .find(
          (f) =>
            f.ownerId === st.targetFishId ||
            (f.ownerName && f.ownerName.toLowerCase() === st.ownerName.toLowerCase())
        );

      if (!fish) {
        fish = this.school.spawnFishForViewer(st.targetFishId, st.ownerName, st.ownerAvatar);
      }

      if (fish) {
        fish.ownerId = st.targetFishId;
        fish.ownerName = st.ownerName;
        fish.ownerAvatar = st.ownerAvatar || fish.ownerAvatar;
        fish.hunger = 100;
        fish.hungerTimeLeft = fish.maxHungerTime;
        if (st.targetCm >= 82) {
          fish.eatCount = Math.max(fish.eatCount, 124);
        } else if (st.targetCm >= 72) {
          fish.eatCount = Math.max(fish.eatCount, 104);
        }
      }

      this.pushEventAlert(
        `⚡ THIÊN KIẾP! Cá của ${st.ownerName} (${st.targetCm}cm) đang nghênh đón lôi kiếp!`,
        "info"
      );
      this.notify();
    };

    this.tribulation.onProgress = (st) => {
      this.state.tribulation = { ...st };
      this.school.tribulation = { ...st };
      this.notify();
    };

    this.tribulation.onSuccess = (st) => {
      this.state.tribulation = { ...st };
      this.school.tribulation = null;
      let fish = this.school.fish
        .slice(0, this.school.count)
        .find(
          (f) =>
            f.ownerId === st.targetFishId ||
            (f.ownerName && f.ownerName.toLowerCase() === st.ownerName.toLowerCase())
        );

      if (!fish) {
        fish =
          this.school.spawnFishForViewer(st.targetFishId, st.ownerName, st.ownerAvatar) ||
          this.school.fish[0];
      }

      if (fish) {
        fish.ownerId = st.targetFishId;
        fish.ownerName = st.ownerName;
        fish.ownerAvatar = st.ownerAvatar || fish.ownerAvatar;
        fish.hunger = 100;
        fish.hungerTimeLeft = fish.maxHungerTime;
        fish.eatCount += 3; // +1.5cm bonus

        if (st.targetCm >= 82) {
          fish.passedTribulation82 = true;
          fish.passedTribulation72 = true;
          fish.tribulationAura = "dragon";
          fish.eatCount = Math.max(fish.eatCount, 130);
          fish.updateDimensions();
          (this.school as any).fishRenderer?.lightning?.triggerBurstFlash?.();
          this.school.ripples.trigger("touch", fish.position);
          const t1 = setTimeout(() => this.school.ripples.trigger("touch", fish.position), 150);
          const t2 = setTimeout(() => this.school.ripples.trigger("touch", fish.position), 300);
          this.transformationTimers.push(t1, t2);
        } else {
          fish.passedTribulation72 = true;
          fish.tribulationAura = "dragon";
        }
      }

      // Trigger celebratory rain of 30 food pellets
      for (let i = 0; i < 30; i++) {
        const rx = 30 + Math.random() * (CANVAS_WIDTH - 60);
        const ry = 30 + Math.random() * (CANVAS_HEIGHT - 60);
        this.foodSystem.spawn(vec(rx, ry), "Thiên Đạo Chúc Phúc", undefined, i < 3);
      }
      this.school.callTo(vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5));

      const alertMsg =
        st.targetCm >= 82
          ? `🎉 CHÚC MỪNG! ${st.ownerName} đã độ kiếp thành công hóa Hoàng Kim Chân Long!`
          : `🎉 CHÚC MỪNG! ${st.ownerName} đã độ kiếp thành công vượt 72cm!`;
      this.pushEventAlert(alertMsg, "size");
      this.notify();
    };

    this.tribulation.onFail = (st) => {
      this.state.tribulation = { ...st };
      this.school.tribulation = null;
      let fish = this.school.fish
        .slice(0, this.school.count)
        .find(
          (f) =>
            f.ownerId === st.targetFishId ||
            (f.ownerName && f.ownerName.toLowerCase() === st.ownerName.toLowerCase())
        );

      if (fish) {
        fish.eatCount = Math.max(0, fish.eatCount - 4); // -2.0cm penalty
        fish.hunger = 20;
        fish.hungerTimeLeft = fish.maxHungerTime * 0.2;
        fish.tribulationAura = "smoke";
        fish.smokeTimer = 20.0;
      }

      this.pushEventAlert(
        `🌩️ ĐỘ KIẾP THẤT BẠI! Cá của ${st.ownerName} bị thương tích -2cm!`,
        "hook"
      );
      this.notify();
    };

    this.connect();
  }

  public pushEventAlert(text: string, type: "spawn" | "hook" | "info" | "size" = "info"): void {
    this.state.latestEvent = {
      id: this.alertSeq++,
      text,
      type,
    };
    this.notify();

    if (this.alertDismissTimer) window.clearTimeout(this.alertDismissTimer);
    this.alertDismissTimer = window.setTimeout(() => {
      this.state.latestEvent = null;
      this.notify();
    }, 4000);
  }

  public subscribe(listener: (s: LiveStreamState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  public connect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }

    try {
      this.ws = new WebSocket(`${this.serverUrl}/?role=client`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.state.connected = true;
      this.notify();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error("LiveClient WS parse error", err);
      }
    };

    this.ws.onclose = () => {
      this.state.connected = false;
      this.notify();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.state.connected = false;
      this.notify();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private refreshFishNameTimer(id?: string, name?: string): void {
    if (!id && !name) return;
    const fish = this.school.fish
      .slice(0, this.school.count)
      .find(
        (f) =>
          (id && f.ownerId === id) ||
          (name && f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase())
      );
    if (fish) {
      fish.nameVisibleTimer = 5.0;
    }
  }

  private handleMessage(msg: any): void {
    switch (msg.t) {
      case "state":
        if (msg.tiktok) {
          this.state.tiktokConnected = msg.tiktok.status === "connected";
          this.state.tiktokUsername = msg.tiktok.uniqueId || "";
        }
        if (msg.topDonors) {
          this.state.topDonors = msg.topDonors;
        }
        if (msg.tribulation && msg.tribulation.active) {
          this.tribulation.start(
            msg.tribulation.targetFishId,
            msg.tribulation.ownerName,
            msg.tribulation.ownerAvatar,
            msg.tribulation.targetCm
          );
          this.tribulation.state.currentPower = msg.tribulation.currentPower || 0;
          this.tribulation.state.timeLeft = msg.tribulation.timeLeft || 30.0;
          this.state.tribulation = { ...this.tribulation.state };
        }
        this.notify();
        break;

      case "tiktok":
        this.state.tiktokConnected = msg.status === "connected";
        this.state.tiktokUsername = msg.uniqueId || "";
        this.notify();
        break;

      case "join": {
        const id = msg.id || msg.user;
        const name = msg.user || "Khán giả";
        const avatar = msg.avatar || "";
        const fish = this.school.spawnFishForViewer(id, name, avatar);
        if (fish) {
          this.school.ripples.trigger("touch", fish.position);
        }
        break;
      }

      case "share": {
        const id = msg.id || msg.user;
        const name = msg.user || "Khán giả";
        const avatar = msg.avatar || "";
        let fish = this.school.fish
          .slice(0, this.school.count)
          .find((f) => f.ownerId === id || (f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase()));
        if (!fish) {
          fish = this.school.spawnFishForViewer(id, name, avatar);
        }
        if (fish) {
          fish.hunger = 100;
          fish.hungerTimeLeft = fish.maxHungerTime;
          fish.state = 3;
        }
        this.pushEventAlert(`🚀 ${name} vừa chia sẻ phiên Live!`, "info");
        this.refreshFishNameTimer(id, name);
        // Drop bonus 5 pellets to celebrate share!
        for (let i = 0; i < 5; i++) {
          const rx = 40 + Math.random() * (CANVAS_WIDTH - 80);
          const ry = 40 + Math.random() * (CANVAS_HEIGHT - 80);
          this.foodSystem.spawn(vec(rx, ry), name, avatar);
        }
        this.school.callTo(vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5));
        break;
      }

      case "follow": {
        const id = msg.id || msg.user;
        const name = msg.user || "Khán giả";
        const avatar = msg.avatar || "";
        let fish = this.school.fish
          .slice(0, this.school.count)
          .find((f) => f.ownerId === id || (f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase()));
        if (!fish) {
          fish = this.school.spawnFishForViewer(id, name, avatar);
        }
        if (fish) {
          fish.hunger = 100;
          fish.hungerTimeLeft = fish.maxHungerTime;
        }
        this.pushEventAlert(`❤️ ${name} vừa theo dõi kênh!`, "info");
        this.refreshFishNameTimer(id, name);
        break;
      }

      case "query_size": {
        const id = msg.targetId || msg.id || msg.user;
        const name = msg.targetName || msg.user || "Khán giả";
        const avatar = msg.avatar || "";

        let fish = this.school.fish
          .slice(0, this.school.count)
          .find((f) => f.ownerId === id || (f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase()));

        if (!fish) {
          // If viewer doesn't have a fish yet, spawn one immediately!
          fish = this.school.spawnFishForViewer(id, name, avatar);
        }

        if (fish) {
          fish.hunger = 100;
          fish.hungerTimeLeft = fish.maxHungerTime;
          if (msg.eatCount !== undefined) {
            fish.eatCount = Math.max(fish.eatCount, msg.eatCount);
            fish.updateDimensions();
          }
          fish.sizeAlertTimer = 7.0; // Show floating Tu Tiên talisman for 7 seconds
          fish.state = 3; // burst animation

          const cm = fish.sizeCm;
          const tuTien = fish.tuTien;

          this.pushEventAlert(
            `☯️ ${name}: ${cm}cm • ${tuTien.badge} ${tuTien.fullName} (${tuTien.title})`,
            "size"
          );

          // Drop food pellet as a bonus for interacting!
          const point = vec(
            msg.x ? (msg.x / 480) * CANVAS_WIDTH : fish.position.x,
            msg.y ? (msg.y / 270) * CANVAS_HEIGHT : fish.position.y
          );
          this.foodSystem.spawn(point, name, avatar);
          this.school.callTo(point);
          this.refreshFishNameTimer(id, name);
        }
        break;
      }

      case "feed":
      case "chat": {
        const id = msg.id || msg.user;
        const name = msg.user || "Khán giả";
        const avatar = msg.avatar || "";

        // Check if viewer already owns a fish in the pond
        let fish = this.school.fish
          .slice(0, this.school.count)
          .find((f) => f.ownerId === id);

        if (!fish) {
          // If viewer hadn't spawned yet upon joining, spawn one now
          fish = this.school.spawnFishForViewer(id, name, avatar);
        }

        // Dropping food pellet feeds the fish!
        const point = vec(
          msg.x ? (msg.x / 480) * CANVAS_WIDTH : Math.random() * (CANVAS_WIDTH - 80) + 40,
          msg.y ? (msg.y / 270) * CANVAS_HEIGHT : Math.random() * (CANVAS_HEIGHT - 80) + 40,
        );
        this.foodSystem.spawn(point, name, avatar);
        this.school.callTo(point);
        this.school.ripples.trigger("touch", point);
        if (fish) {
          fish.hunger = 100;
          fish.hungerTimeLeft = fish.maxHungerTime;
          fish.state = 3; // burst of excitement
        }

        const comment = (msg.comment || msg.text || "").trim().toLowerCase();
        if (comment === "pvp" || comment === "!pvp" || comment.startsWith("pvp ")) {
          this.arena.registerChallenger(id, name, avatar);
        }
        if (this.arena.isActive) {
          if (/^(huc|day|push|1|chien|len)$/i.test(comment) || comment.includes("huc") || comment.includes("day")) {
            this.arena.addCheerPower(name, 2);
          }
        }
        this.refreshFishNameTimer(id, name);
        break;
      }

      case "like": {
        const point = vec(
          msg.x ? (msg.x / 480) * CANVAS_WIDTH : CANVAS_WIDTH * 0.5,
          msg.y ? (msg.y / 270) * CANVAS_HEIGHT : CANVAS_HEIGHT * 0.5,
        );
        this.school.ripples.trigger("touch", point);
        if (this.arena.isActive && (msg.user || msg.id)) {
          this.arena.addCheerPower(msg.user || msg.id, 1);
        }
        this.refreshFishNameTimer(msg.id || msg.user, msg.user);
        break;
      }

      case "gift": {
        const coins = Math.max(1, msg.coins || 1);
        const count = Math.max(1, msg.count || 1);
        const pelletCount = Math.min(60, Math.max(10, Math.floor(coins * 1.5) + count * 2));

        for (let i = 0; i < pelletCount; i++) {
          const rx = 30 + Math.random() * (CANVAS_WIDTH - 60);
          const ry = 30 + Math.random() * (CANVAS_HEIGHT - 60);
          const point = vec(rx, ry);
          this.foodSystem.spawn(point, msg.user, msg.avatar, i < 3);
          if (i % 5 === 0) {
            this.school.ripples.trigger("touch", point);
          }
        }

        // Call all fish to feast
        this.school.callTo(vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5));

        // Refill donor's fish hunger
        const donorFish = this.school.fish
          .slice(0, this.school.count)
          .find((f) => f.ownerId === msg.id || (f.ownerName && f.ownerName === msg.user));
        if (donorFish) {
          donorFish.hunger = 100;
          donorFish.hungerTimeLeft = donorFish.maxHungerTime;
        }
        this.refreshFishNameTimer(msg.id || msg.user, msg.user);

        if (this.arena.isActive && msg.user) {
          this.arena.addCheerPower(msg.user, Math.max(1, coins) * 3);
        }

        // Update donors
        if (msg.topDonors) {
          this.state.topDonors = msg.topDonors;
        }

        // Show Gift Alert Banner
        this.state.currentGift = {
          id: msg.id || String(Date.now()),
          user: msg.user,
          giftName: msg.giftName,
          count: msg.count,
          coins: msg.coins,
          tier: msg.tier || 1,
        };
        this.notify();

        if (this.giftDismissTimer) window.clearTimeout(this.giftDismissTimer);
        this.giftDismissTimer = window.setTimeout(() => {
          this.state.currentGift = null;
          this.notify();
        }, 5000);
        break;
      }

      case "tts": {
        // Enqueue and play TTS voice announcement
        const text = msg.text || "";
        const origin = typeof window !== "undefined"
          ? (window.location.port === "5173" ? "http://localhost:3001" : window.location.origin)
          : "http://localhost:3001";
        const url = msg.url ? `${origin}${msg.url}` : undefined;
        this.queueTTS({ url, text });
        break;
      }

      case "weather":
        if (msg.preset) {
          settings.setWeather(msg.preset as WeatherPresetId);
        }
        break;

      case "scatter":
        this.school.scatter();
        break;

      case "tribulation_start": {
        let startFish = this.school.fish
          .slice(0, this.school.count)
          .find(
            (f) =>
              f.ownerId === msg.targetFishId ||
              (f.ownerName && f.ownerName.toLowerCase() === msg.ownerName.toLowerCase())
          );
        if (!startFish) {
          startFish = this.school.spawnFishForViewer(
            msg.targetFishId,
            msg.ownerName,
            msg.ownerAvatar
          );
        }
        if (startFish) {
          startFish.ownerId = msg.targetFishId;
          startFish.ownerName = msg.ownerName;
          startFish.ownerAvatar = msg.ownerAvatar || startFish.ownerAvatar;
          startFish.hunger = 100;
          startFish.hungerTimeLeft = startFish.maxHungerTime;
          if (msg.targetCm >= 82) {
            startFish.eatCount = Math.max(startFish.eatCount, 124);
          } else if (msg.targetCm >= 72) {
            startFish.eatCount = Math.max(startFish.eatCount, 104);
          }
        }
        this.tribulation.start(
          msg.targetFishId,
          msg.ownerName,
          msg.ownerAvatar,
          msg.targetCm
        );
        break;
      }

      case "tribulation_power":
        this.tribulation.addPower(msg.source, msg.user, msg.points, msg.avatar);
        break;

      case "tribulation_resolve": {
        const wasActive = this.tribulation.state.active;
        const st = { ...this.tribulation.state };
        if (msg.targetFishId && !st.targetFishId) st.targetFishId = msg.targetFishId;
        if (msg.ownerName && !st.ownerName) st.ownerName = msg.ownerName;
        if (msg.targetCm && !st.targetCm) st.targetCm = msg.targetCm;
        if (wasActive) {
          this.tribulation.resolve(msg.success);
        } else if (msg.success) {
          this.tribulation.onSuccess?.(st);
        }
        break;
      }

      case "instant_dragon": {
        const id = msg.id || "dragon_test_1";
        const name = msg.name || "Thái Cổ Chân Long";
        const avatar = msg.avatar || "";
        let dragonFish = this.school.fish
          .slice(0, this.school.count)
          .find(
            (f) =>
              f.ownerId === id ||
              (f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase())
          );
        if (!dragonFish) {
          dragonFish =
            this.school.spawnFishForViewer(id, name, avatar) || this.school.fish[0];
        }
        if (dragonFish) {
          dragonFish.ownerId = id;
          dragonFish.ownerName = name;
          dragonFish.ownerAvatar = avatar || dragonFish.ownerAvatar;
          dragonFish.eatCount = Math.max(dragonFish.eatCount, 130);
          dragonFish.passedTribulation82 = true;
          dragonFish.passedTribulation72 = true;
          dragonFish.tribulationAura = "dragon";
          dragonFish.hunger = 100;
          dragonFish.hungerTimeLeft = dragonFish.maxHungerTime;
          dragonFish.updateDimensions();
          (this.school as any).fishRenderer?.lightning?.triggerBurstFlash?.();
          this.school.ripples.trigger("touch", dragonFish.position);
          const t1 = setTimeout(() => this.school.ripples.trigger("touch", dragonFish.position), 150);
          const t2 = setTimeout(() => this.school.ripples.trigger("touch", dragonFish.position), 300);
          this.transformationTimers.push(t1, t2);

          this.pushEventAlert(
            `🐉 CHÂN LONG XUẤT THẾ! ${name} đã hóa thân thành Hoàng Kim Chân Long!`,
            "size"
          );
          this.notify();
        }
        break;
      }
    }
  }

  private queueTTS(item: { url?: string; text: string }): void {
    // Keep voice responsive: drop older queued voice lines if chat is moving too fast
    if (this.audioQueue.length >= 4) {
      this.audioQueue.splice(0, this.audioQueue.length - 2);
    }
    this.audioQueue.push(item);
    this.processAudioQueue();
  }

  private processAudioQueue(): void {
    if (this.isAudioPlaying || this.audioQueue.length === 0) return;
    const item = this.audioQueue.shift()!;
    this.isAudioPlaying = true;

    const onDone = () => {
      this.isAudioPlaying = false;
      window.setTimeout(() => this.processAudioQueue(), 250);
    };

    if (item.url) {
      if (!this.audioEl) this.audioEl = new Audio();
      this.audioEl.src = item.url;
      this.audioEl.onended = onDone;
      this.audioEl.onerror = () => {
        if (item.text) this.speakWebSpeech(item.text, onDone);
        else onDone();
      };
      this.audioEl.play().catch(() => {
        if (item.text) this.speakWebSpeech(item.text, onDone);
        else onDone();
      });
    } else if (item.text) {
      this.speakWebSpeech(item.text, onDone);
    } else {
      onDone();
    }
  }

  private speakWebSpeech(text: string, onEnd?: () => void): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_~`]+/g, "").trim();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = "vi-VN";
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.onend = () => onEnd?.();
      utter.onerror = () => onEnd?.();
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(
        (v) =>
          v.lang.startsWith("vi") ||
          v.name.includes("Vietnamese") ||
          v.name.includes("HoaiMy") ||
          v.name.includes("NamMinh"),
      );
      if (viVoice) utter.voice = viVoice;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("SpeechSynthesis fallback error:", e);
      onEnd?.();
    }
  }

  public update(dt: number): void {
    if (this.tribulation.state.active) {
      this.tribulation.update(dt);
      this.school.tribulation = this.tribulation.state;
      if (this.state.tribulation) {
        this.state.tribulation.timeLeft = this.tribulation.state.timeLeft;
      }
      // Continuous protection for target fish during tribulation
      const targetFish = this.school.fish
        .slice(0, this.school.count)
        .find((f) => f.ownerId === this.tribulation.state.targetFishId);
      if (targetFish) {
        targetFish.isBeingFished = false;
        targetFish.fishHookProgress = 0;
        targetFish.hunger = Math.max(targetFish.hunger, 50);
        targetFish.hungerTimeLeft = Math.max(targetFish.hungerTimeLeft, targetFish.maxHungerTime * 0.5);
      }
    } else {
      this.school.tribulation = null;
    }

    for (let i = 0; i < this.school.count; i++) {
      const fish = this.school.fish[i];
      if (fish && fish.smokeTimer > 0) {
        fish.smokeTimer = Math.max(0, fish.smokeTimer - dt);
        if (fish.smokeTimer === 0 && fish.tribulationAura === "smoke") {
          fish.tribulationAura = null;
        }
      }
    }
  }

  public dispose(): void {
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    for (const t of this.transformationTimers) clearTimeout(t);
    this.transformationTimers = [];
    if (this.giftDismissTimer) window.clearTimeout(this.giftDismissTimer);
    if (this.alertDismissTimer) window.clearTimeout(this.alertDismissTimer);
    if (this.ws) {
      this.ws.onclose = null;
      try { this.ws.close(); } catch {}
    }
    this.listeners.clear();
  }
}
