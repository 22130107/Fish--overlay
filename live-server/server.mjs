// Nagomi Koi Pond — TikTok LIVE Interactive Bridge Server
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { calculateTuTienRank, getTuTienVoiceLine, formatNumberToVietnamese } from './tu-tien.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TTS_DIR = path.join(__dirname, 'tts');
const LAST_CHANNEL_FILE = path.join(__dirname, 'last_channel.json');
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
fs.mkdirSync(TTS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

// Clear old TTS files on startup
for (const f of fs.readdirSync(TTS_DIR)) {
  try { fs.unlinkSync(path.join(TTS_DIR, f)); } catch {}
}

const PORT = +process.env.PORT || 3001;

/* ------------------------------------------------------------------ state */
const settings = {
  title: 'Hồ Cá Koi Tương Tác',
  voice: 'vi-VN-NamMinhNeural', // or vi-VN-HoaiMyNeural
  pitch: 0,
  rate: 0,
  readChat: true,
  readGifts: true,
  readJoin: true,
  readShare: true,
  readFollow: true,
  minGiftDiamonds: 1,
  rainKeyword: true,
  foodAmountPerChat: 1,
};

const donors = new Map(); // id -> { id, name, avatar, coins, count }
const viewerFish = new Map(); // id -> { id, name, eatCount, sizeCm }
let currentTribulation = null; // { targetFishId, ownerName, ownerAvatar, targetCm, timeLeft, requiredPower, currentPower, timer }
let totalCoins = 0;
let tiktok = null;
let tiktokState = { status: 'idle', uniqueId: '', error: '', roomId: '' };
const logHistory = [];

function addLog(s) {
  const line = `[${new Date().toLocaleTimeString('vi-VN')}] ${s}`;
  logHistory.push(line);
  if (logHistory.length > 200) logHistory.shift();
  broadcast({ t: 'log', line }, 'control');
  console.log(line);
}

function getTopDonors() {
  return [...donors.values()]
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 5);
}

function stateSnapshot() {
  return {
    t: 'state',
    settings,
    tiktok: tiktokState,
    totalCoins,
    topDonors: getTopDonors(),
    tribulation: currentTribulation ? {
      targetFishId: currentTribulation.targetFishId,
      ownerName: currentTribulation.ownerName,
      ownerAvatar: currentTribulation.ownerAvatar,
      targetCm: currentTribulation.targetCm,
      timeLeft: currentTribulation.timeLeft,
      requiredPower: currentTribulation.requiredPower,
      currentPower: currentTribulation.currentPower,
    } : null,
  };
}

/* ------------------------------------------------------------- Comment Parser */
const WEATHER_KEYWORDS = [
  { words: ['mưa', 'rain', 'mua'], preset: 'rain' },
  { words: ['nắng', 'nang', 'sunny'], preset: 'sunny' },
  { words: ['hoàng hôn', 'hoang hon', 'sunset'], preset: 'sunset' },
  { words: ['trăng', 'toi', 'tối', 'moon', 'moonlight', 'đêm'], preset: 'moonlight' },
  { words: ['sương mù', 'suong mu', 'mist'], preset: 'mist' },
  { words: ['trong xanh', 'clear'], preset: 'deep-clear' },
];

const SCATTER_KEYWORDS = ['chạy', 'chay', 'bien', 'biến', 'tản', 'tan', 'scatter', 'bão', 'scare'];

const seenUsers = new Set();
const userChatHistory = new Map(); // id -> { lastText, lastChatTime, lastSizeTime }

function isCommentSpam(id, text, isSize = false) {
  const now = Date.now();
  let history = userChatHistory.get(id);
  if (!history) {
    if (userChatHistory.size > 1500) {
      const oldest = userChatHistory.keys().next().value;
      userChatHistory.delete(oldest);
    }
    history = { lastText: '', lastChatTime: 0, lastSizeTime: 0 };
    userChatHistory.set(id, history);
  }

  // 1. Đối với lệnh đo size: giới hạn 7 giây mỗi lần để tránh spam giọng đọc
  if (isSize) {
    if (now - history.lastSizeTime < 7000) {
      return { spam: true, reason: 'cooldown_size' };
    }
    history.lastSizeTime = now;
    return { spam: false };
  }

  // 2. Ký tự có nghĩa: Bỏ qua bình luận quá ngắn (< 2 chữ cái/số, ví dụ: "H", "1", ".", "?")
  const clean = String(text || '').trim();
  const lettersOnly = clean.replace(/[^\p{L}\p{N}]/gu, '');
  if (lettersOnly.length < 2) {
    return { spam: true, reason: 'quá ngắn hoặc ký tự rác' };
  }

  // 3. Spam lặp ký tự vô nghĩa (ví dụ: "hhhhhhh", "aaaaaa", "111111", "......")
  const uniqueChars = new Set(lettersOnly.toLowerCase()).size;
  if (lettersOnly.length >= 3 && uniqueChars <= 1) {
    return { spam: true, reason: 'lặp ký tự vô nghĩa' };
  }
  if (lettersOnly.length >= 6 && uniqueChars <= 2) {
    return { spam: true, reason: 'lặp chuỗi vô nghĩa' };
  }

  // 4. Spam gửi lại nội dung y hệt từ cùng 1 người trong vòng 15 giây
  if (clean.toLowerCase() === history.lastText.toLowerCase() && now - history.lastChatTime < 15000) {
    return { spam: true, reason: 'lặp lại nội dung cũ' };
  }

  // 5. Spam bình luận dồn dập (Flood rate limit: tối đa 1 bình luận được đọc mỗi 3.5 giây/người)
  if (now - history.lastChatTime < 3500) {
    return { spam: true, reason: 'bình luận quá nhanh' };
  }

  // 6. Dãy số vô nghĩa không phải văn bản (ví dụ: "123123", "99999")
  if (/^\d{3,}$/.test(clean)) {
    return { spam: true, reason: 'dãy số vô nghĩa' };
  }

  history.lastText = clean;
  history.lastChatTime = now;
  return { spam: false, cleanText: clean };
}

function cleanSpokenName(name) {
  return String(name || '').replace(/[_@.]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim() || 'Bạn mới';
}

let lastJoinVoiceTime = 0;
function handleJoin(id, name, avatar, shouldSpeak = true) {
  id = id || name || `user_${Date.now()}`;
  name = name || 'Khán giả';
  const isFirstTime = !seenUsers.has(id);
  seenUsers.add(id);
  if (seenUsers.size > 2000) {
    const first = seenUsers.values().next().value;
    seenUsers.delete(first);
  }
  if (isFirstTime) {
    addLog(`👋 ${name} đã vào phòng Live! Đã cấp 1 chú cá.`);
  }

  // Tự động thả cá vào hồ ngay khi vào xem
  broadcast({
    t: 'join',
    id,
    user: name,
    avatar: avatar || '',
  });

  // Giọng đọc AI chào mừng khi tham gia phiên Live
  if (settings.readJoin && shouldSpeak && isFirstTime) {
    const now = Date.now();
    if (now - lastJoinVoiceTime >= 2500) {
      lastJoinVoiceTime = now;
      const spokenName = cleanSpokenName(name);
      say(`Chào mừng ${spokenName} đã vào hồ nhận linh ngư!`, { tag: 'join', id, user: name });
    }
  }
}

function handleShare(id, name, avatar) {
  id = id || name || `user_${Date.now()}`;
  name = name || 'Khán giả';
  addLog(`🚀 ${name} đã chia sẻ phiên Live!`);

  // Nếu người chia sẻ chưa có cá thì tự động cấp cá
  handleJoin(id, name, avatar, false);

  broadcast({
    t: 'share',
    id,
    user: name,
    avatar: avatar || '',
  });

  // Giọng đọc AI cảm ơn khi chia sẻ phiên Live
  if (settings.readShare) {
    const spokenName = cleanSpokenName(name);
    say(`Cảm ơn ${spokenName} đã chia sẻ phiên Live!`, { tag: 'share', id, user: name });
  }
}

function handleFollow(id, name, avatar) {
  id = id || name || `user_${Date.now()}`;
  name = name || 'Khán giả';
  addLog(`❤️ ${name} đã bấm theo dõi kênh!`);
  handleJoin(id, name, avatar, false);

  broadcast({
    t: 'follow',
    id,
    user: name,
    avatar: avatar || '',
  });

  if (settings.readFollow) {
    const spokenName = cleanSpokenName(name);
    say(`Cảm ơn ${spokenName} đã theo dõi kênh!`, { tag: 'follow', id, user: name });
  }
}

function handleChat(id, name, text, avatar) {
  text = String(text || '').trim().slice(0, 100);
  const lower = text.toLowerCase();

  // Track fish growth per viewer
  let fish = viewerFish.get(id);
  if (!fish) {
    if (viewerFish.size > 2000) {
      const oldest = viewerFish.keys().next().value;
      viewerFish.delete(oldest);
    }
    fish = { id, name, eatCount: 0, sizeCm: 20.0, avatar: avatar || '' };
    viewerFish.set(id, fish);
  }
  if (avatar && !fish.avatar) fish.avatar = avatar;
  fish.eatCount += 1;
  fish.sizeCm = Math.min(85.0, Math.round((20.0 + fish.eatCount * 0.5) * 10) / 10);

  // Check fish growth for automatic threshold trigger
  if (!currentTribulation) {
    if (fish.sizeCm >= 82.0 && !fish.passed82) {
      fish.passed72 = true;
      fish.passed82 = true;
      startTribulation(fish.id, fish.name, fish.avatar, 82.0);
    } else if (fish.sizeCm >= 72.0 && !fish.passed72) {
      fish.passed72 = true;
      startTribulation(fish.id, fish.name, fish.avatar, 72.0);
    }
  }

  // Check tribulation keywords
  const HO_PHAP_KEYWORDS = ['hộ pháp', 'ho phap', 'độ kiếp', 'do kiep', 'cố lên', 'co len', 'hóa rồng', 'hoa rong', 'lên', 'len'];
  if (currentTribulation && HO_PHAP_KEYWORDS.some(kw => lower.includes(kw))) {
    addTribulationPower('chat', name, 1, avatar);
  }

  // Check weather command
  if (settings.rainKeyword) {
    for (const item of WEATHER_KEYWORDS) {
      if (item.words.some((w) => lower.includes(w))) {
        if (currentTribulation) { return; } // Weather locked during tribulation
        addLog(`🌤️ ${name} đổi thời tiết: ${item.preset}`);
        broadcast({ t: 'weather', preset: item.preset, user: name });
        return;
      }
    }
  }

  // Check scatter command
  if (SCATTER_KEYWORDS.some((w) => lower.includes(w))) {
    addLog(`⚡ ${name} làm cá giật mình!`);
    broadcast({ t: 'scatter', user: name });
    return;
  }

  // Check size query command: Bất kỳ ai cũng có thể tra cứu size cá của mình, của người khác, hoặc cá to nhất hồ
  const SIZE_KEYWORDS = [
    'size', 'sz', 'kich thuoc', 'kích thước', 'chiều dài', 'chieu dai',
    'mấy cm', 'may cm', 'bao nhiêu cm', 'bao nhieu cm', 'bao cm', 'bao phân', 'bao phan', 'mấy phân', 'may phan',
    'dài bao', 'dai bao', 'dài không', 'dai khong', 'to chưa', 'to chuwa', 'to không', 'to khong', 'to ko', 'to quá',
    'cấp mấy', 'cap may', 'level', 'tu vi', 'cảnh giới', 'canh gioi',
    'đo cá', 'do ca', 'soi cá', 'soi ca', 'xem cá', 'xem ca', 'check size', 'xem size', 'đo size', 'do size',
    'cá tôi', 'ca toi', 'cá em', 'ca em', 'cá tao', 'ca tao', 'cá mình', 'ca minh'
  ];

  if (SIZE_KEYWORDS.some((kw) => lower.includes(kw))) {
    // 1. Tra cứu con cá to nhất hồ ("to nhất", "bự nhất", "top 1", "khủng nhất")
    const isTopQuery = /\b(to nhất|to nhat|bự nhất|bu nhat|lớn nhất|lon nhat|top 1|khủng nhất|khung nhat|trùm|trum)\b/i.test(lower);
    if (isTopQuery && viewerFish.size > 0) {
      let topFish = null;
      for (const f of viewerFish.values()) {
        if (!topFish || f.sizeCm > topFish.sizeCm) {
          topFish = f;
        }
      }
      if (topFish) {
        const topRank = calculateTuTienRank(topFish.sizeCm);
        const topSizeWords = formatNumberToVietnamese(topFish.sizeCm);
        const topVoice = `Linh ngư to nhất hồ hiện tại là của đạo hữu ${topFish.name}, dài ${topSizeWords} xăng ti mét, đạt cảnh giới ${topRank.realm} ${topRank.subStage}!`;
        addLog(`🏆 ${name} tra cứu cá to nhất: ${topFish.name} (${topFish.sizeCm}cm)`);
        say(topVoice, { tag: 'size', id: topFish.id, user: topFish.name, sizeCm: topFish.sizeCm });
        broadcast({
          t: 'query_size',
          id: topFish.id,
          user: topFish.name,
          targetId: topFish.id,
          targetName: topFish.name,
          avatar: topFish.avatar || '',
          sizeCm: topFish.sizeCm,
          eatCount: topFish.eatCount,
        });
        return;
      }
    }

    // 2. Tra cứu cá của người khác nếu bình luận nhắc tên (Ví dụ: "size @huynh8580", "size Huỳnh")
    let targetFish = fish; // Mặc định là cá của người đang bình luận
    const targetMatch = lower.match(/(?:size|kich thuoc|kích thước|tu vi|cảnh giới)\s+@?([\p{L}\p{N}_.]+)/u);
    if (targetMatch && targetMatch[1]) {
      const q = targetMatch[1].trim().toLowerCase();
      const ignoreWords = ['cá', 'ca', 'nè', 'ne', 'nha', 'ạ', 'a', 'ơi', 'oi', 'em', 'anh', 'tôi', 'toi', 'tao', 'mình', 'minh', 'hồ', 'ho'];
      if (!ignoreWords.includes(q)) {
        for (const [vId, vFish] of viewerFish.entries()) {
          if (vFish.name.toLowerCase().includes(q) || vId.toLowerCase().includes(q)) {
            targetFish = vFish;
            break;
          }
        }
      }
    }

    addLog(`📏 ${name} tra cứu kích thước cá của ${targetFish.name}: "${text}"`);
    const rank = calculateTuTienRank(targetFish.sizeCm);
    const voiceLine = targetFish.id === id
      ? getTuTienVoiceLine(name, targetFish.sizeCm, rank, targetFish.eatCount)
      : `Đạo hữu ${name} tra cứu: Linh ngư của đạo hữu ${targetFish.name} hiện dài ${formatNumberToVietnamese(targetFish.sizeCm)} xăng ti mét, đạt cảnh giới ${rank.realm} ${rank.subStage}!`;

    // Giới hạn tần suất đọc size để tránh spam giọng đọc
    const spamCheck = isCommentSpam(id, text, true);
    if (!spamCheck.spam) {
      say(voiceLine, { tag: 'size', id: targetFish.id, user: targetFish.name, sizeCm: targetFish.sizeCm });
    } else {
      console.log(`[AntiSpam] Bỏ qua đọc size dồn dập từ ${name}`);
    }

    const x = Math.floor(60 + Math.random() * (480 - 120));
    const y = Math.floor(40 + Math.random() * (270 - 80));
    broadcast({
      t: 'query_size',
      id: targetFish.id,
      user: targetFish.name,
      targetId: targetFish.id,
      targetName: targetFish.name,
      avatar: targetFish.avatar || avatar || '',
      x,
      y,
      sizeCm: targetFish.sizeCm,
      eatCount: targetFish.eatCount,
    });
    return;
  }

  // Default: Drop food pellet into pond
  const x = Math.floor(60 + Math.random() * (480 - 120));
  const y = Math.floor(40 + Math.random() * (270 - 80));
  broadcast({
    t: 'feed',
    id,
    user: name,
    text,
    avatar: avatar || '',
    x,
    y,
  });

  addLog(`💬 ${name}: ${text}`);

  // Speak chat comment with AI voice (Lọc bỏ spam)!
  if (settings.readChat) {
    const spamCheck = isCommentSpam(id, text, false);
    if (!spamCheck.spam) {
      const spokenName = String(name).replace(/[_@.]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim() || 'Khán giả';
      const spokenText = String(text).replace(/[^\p{L}\p{N}\s,?.!]/gu, '').trim();
      if (spokenText) {
        say(`${spokenName} nói: ${spokenText}`, { tag: 'chat', id, user: name });
      }
    } else {
      console.log(`[AntiSpam] Bỏ qua đọc bình luận "${text}" từ ${name} (${spamCheck.reason})`);
    }
  }
}

function handleGift(id, name, giftName, count, diamonds, avatar) {
  giftName = String(giftName || 'Quà').slice(0, 30);
  count = Math.max(1, Math.min(9999, +count || 1));
  const coins = Math.max(1, (diamonds || 1) * count);
  totalCoins += coins;

  let donor = donors.get(id);
  if (!donor) {
    donor = { id, name, avatar: avatar || '', coins: 0, count: 0 };
    donors.set(id, donor);
  }
  donor.coins += coins;
  donor.count += count;

  const tier = coins >= 99 ? 3 : coins >= 10 ? 2 : 1;
  const spokenName = String(name).replace(/[_@.]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim() || 'Bạn tốt';
  
  // Custom TTS text
  const line = `Cảm ơn ${spokenName} đã tặng ${giftName}${count > 1 ? ` ${count} lần` : ''} để chăm sóc đàn cá Koi!`;

  broadcast({
    t: 'gift',
    id,
    user: name,
    giftName,
    count,
    coins,
    tier,
    avatar: avatar || '',
    topDonors: getTopDonors(),
  });

  addLog(`🎁 ${name} tặng ${giftName} x${count} (${coins} kim cương)`);

  if (currentTribulation) {
    const pts = coins >= 10 ? Math.min(50, coins * 2) : Math.max(5, coins);
    addTribulationPower('gift', name, pts, avatar);
  }

  if (settings.readGifts && coins >= settings.minGiftDiamonds) {
    say(line, { tag: 'gift', id, user: name, giftName });
  }
}

function handleLike(id, name, count) {
  if (currentTribulation) {
    addTribulationPower('like', name, 1, '');
  }

  broadcast({
    t: 'like',
    id,
    user: name || 'Khán giả',
    count: Math.min(10, count || 1),
    x: Math.floor(40 + Math.random() * 400),
    y: Math.floor(30 + Math.random() * 210),
  });
}

/* ------------------------------------------------------------- Tribulation System */
function startTribulation(targetFishId, ownerName, ownerAvatar = '', targetCm = 72.0) {
  if (currentTribulation && currentTribulation.timer) {
    clearInterval(currentTribulation.timer);
    currentTribulation.timer = null;
  }

  targetCm = Number(targetCm) || 72.0;
  const isDragon = targetCm >= 82.0;
  const requiredPower = isDragon ? 60 : 40;

  currentTribulation = {
    targetFishId: targetFishId || 'test_fish_1',
    ownerName: ownerName || 'Đạo hữu Vô Danh',
    ownerAvatar: ownerAvatar || '',
    targetCm,
    timeLeft: 30.0,
    requiredPower,
    currentPower: 0,
    timer: null,
  };

  broadcast({
    t: 'tribulation_start',
    targetFishId: currentTribulation.targetFishId,
    ownerName: currentTribulation.ownerName,
    ownerAvatar: currentTribulation.ownerAvatar,
    targetCm: currentTribulation.targetCm,
  });

  addLog(`⚡ THIÊN KIẾP GIÁNG LÂM: Linh ngư của ${currentTribulation.ownerName} (${targetCm}cm) đang nghênh kiếp!`);

  const spokenName = cleanSpokenName(currentTribulation.ownerName);
  const voiceLine = isDragon
    ? `Cửu Trọng Lôi Kiếp giáng thế! Linh ngư của đạo hữu ${spokenName} chuẩn bị phi thăng Hóa Long! Toàn thể đạo hữu mau bình luận Hộ Pháp và tặng quà để hộ trì đắc đạo!`
    : `Thiên kiếp giáng lâm! Linh ngư của đạo hữu ${spokenName} bắt đầu nghênh đón lôi kiếp! Toàn thể đạo hữu mau bình luận Hộ Pháp hoặc thả tim để trợ lực!`;

  say(voiceLine, { tag: 'tribulation', priority: true }, true);

  currentTribulation.timer = setInterval(() => {
    if (!currentTribulation) return;
    currentTribulation.timeLeft -= 1;
    if (currentTribulation.timeLeft <= 0) {
      const win = currentTribulation.currentPower >= currentTribulation.requiredPower;
      resolveTribulation(win);
    }
  }, 1000);

  return currentTribulation;
}

function addTribulationPower(source, user, points = 1, avatar = '') {
  if (!currentTribulation) return;
  const pts = Math.max(1, Math.round(Number(points) || 1));
  currentTribulation.currentPower += pts;

  broadcast({
    t: 'tribulation_power',
    source: source || 'chat',
    user: user || 'Khán giả',
    points: pts,
    avatar: avatar || '',
  });

  addLog(`⚡ Trợ lực Thiên Kiếp (+${pts} lực từ ${user || 'Khán giả'} qua ${source}): ${currentTribulation.currentPower}/${currentTribulation.requiredPower}`);

  if (currentTribulation.currentPower >= currentTribulation.requiredPower) {
    resolveTribulation(true);
  }
}

function resolveTribulation(success) {
  if (!currentTribulation) return;
  if (currentTribulation.timer) {
    clearInterval(currentTribulation.timer);
    currentTribulation.timer = null;
  }

  const { targetFishId, ownerName, targetCm } = currentTribulation;
  currentTribulation = null;

  broadcast({
    t: 'tribulation_resolve',
    success: Boolean(success),
    targetFishId,
    ownerName,
    targetCm,
  });

  const fish = viewerFish.get(targetFishId);
  if (fish) {
    if (success) {
      fish.eatCount += 3;
      fish.sizeCm = Math.min(85.0, Math.round((20.0 + fish.eatCount * 0.5) * 10) / 10);
      if (targetCm >= 82) fish.passed82 = true;
      else fish.passed72 = true;
    } else {
      fish.eatCount = Math.max(0, fish.eatCount - 4);
      fish.sizeCm = Math.min(85.0, Math.round((20.0 + fish.eatCount * 0.5) * 10) / 10);
      if (targetCm >= 82) fish.passed82 = false;
      else fish.passed72 = false;
    }
  }

  const spokenName = cleanSpokenName(ownerName);
  if (success) {
    addLog(`🎉 ĐỘ KIẾP THÀNH CÔNG! Cá của ${ownerName} đã vượt lôi kiếp ${targetCm}cm!`);
    const line = targetCm >= 82.0
      ? `Kính báo toàn thể thiên hạ! Linh ngư của đạo hữu ${spokenName} đã độ kiếp thành công, cá chép vượt Vũ Môn hóa thành Chân Long thượng giới!`
      : `Chúc mừng đạo hữu ${spokenName}! Linh ngư đã vượt qua thiên kiếp, cảnh giới đại tiến!`;
    say(line, { tag: 'tribulation', priority: true }, true);
  } else {
    addLog(`🌩️ ĐỘ KIẾP THẤT BẠI! Cá của ${ownerName} bị thiên lôi đánh trúng, tổn hao tu vi!`);
    const line = `Độ kiếp thất bại! Linh ngư của đạo hữu ${spokenName} không chống đỡ nổi uy lực thiên lôi, bị thương tích tổn hao tu vi!`;
    say(line, { tag: 'tribulation', priority: true }, true);
  }
}

/* ------------------------------------------------------------------ TTS */
const ttsQueue = [];
let ttsBusy = false;
let ttsSeq = 0;

function escXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[c]));
}

function say(text, meta = {}, priority = false) {
  const isPriority = priority || Boolean(meta.priority) || meta.tag === 'tribulation';

  // Tránh dồn ứ hàng đợi: nếu quá 3 tin nhắn chat đang chờ, lược bớt tin cũ nhất để giọng đọc luôn realtime
  if (ttsQueue.length >= 3 && meta.tag === 'chat') {
    const idx = ttsQueue.findIndex((q) => q.meta?.tag === 'chat');
    if (idx !== -1) ttsQueue.splice(idx, 1);
  }

  // Nếu là thông báo ưu tiên (ví dụ Thiên Kiếp), dọn dẹp các tin nhắn chat đang chờ để thông báo phát ngay
  if (isPriority) {
    for (let i = ttsQueue.length - 1; i >= 0; i--) {
      if (ttsQueue[i].meta?.tag === 'chat') {
        ttsQueue.splice(i, 1);
      }
    }
  } else if (ttsQueue.length >= 8) {
    console.log('[TTS] Hàng đợi đầy, bỏ qua');
    return;
  }

  const item = { text: String(text).slice(0, 300), meta };
  if (isPriority) {
    ttsQueue.unshift(item);
  } else {
    ttsQueue.push(item);
  }
  pumpTTS();
}

async function fetchGoogleTTS(text) {
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(String(text).slice(0, 200)) + '&tl=vi&client=tw-ob';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Google TTS status: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error('Google TTS payload too short');
  return buf;
}

async function synthesizeAudio(text) {
  // 1. Try MsEdgeTTS
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(settings.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escXml(text));
    const chunks = [];
    await new Promise((res, rej) => {
      audioStream.on('data', (c) => chunks.push(c));
      audioStream.on('end', res);
      audioStream.on('error', (err) => {
        if (chunks.length > 2) res();
        else rej(err);
      });
      setTimeout(() => {
        if (chunks.length > 2) res();
        else rej(new Error('Edge TTS timeout'));
      }, 4000);
    });
    try { tts.close(); } catch {}
    if (chunks.length > 0) {
      return Buffer.concat(chunks);
    }
  } catch (err) {
    // Edge TTS failed, seamless fallback
  }

  // 2. High-speed reliable fallback: Google TTS
  try {
    const buf = await fetchGoogleTTS(text);
    return buf;
  } catch (err2) {
    addLog(`Giọng đọc dự phòng lỗi: ${err2?.message || err2}`);
    return null;
  }
}

async function pumpTTS() {
  if (ttsBusy || !ttsQueue.length) return;
  ttsBusy = true;
  const { text, meta } = ttsQueue.shift();

  try {
    const buf = await synthesizeAudio(text);
    if (buf && buf.length > 0) {
      const file = `tts_${Date.now()}_${++ttsSeq}.mp3`;
      fs.writeFileSync(path.join(TTS_DIR, file), buf);
      broadcast({ t: 'tts', url: `/tts/${file}`, text, ...meta });

      // Clean old files (keep max 15)
      const files = fs.readdirSync(TTS_DIR).sort();
      while (files.length > 15) {
        try { fs.unlinkSync(path.join(TTS_DIR, files.shift())); } catch {}
      }
    } else {
      broadcast({ t: 'tts', url: null, text, ...meta });
    }
  } catch (err) {
    addLog(`TTS Lỗi: ${err?.message || err}`);
    broadcast({ t: 'tts', url: null, text, ...meta });
  }

  ttsBusy = false;
  setTimeout(pumpTTS, 100);
}

/* --------------------------------------------------------------- TikTok Connector */
let TikTokLib = null;

async function connectTikTok(uniqueId) {
  uniqueId = String(uniqueId || '')
    .trim()
    .replace(/^.*tiktok\.com\/@?/i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '');

  if (!uniqueId) return;
  await disconnectTikTok();

  tiktokState = { status: 'connecting', uniqueId, error: '', roomId: '' };
  broadcast({ t: 'tiktok', ...tiktokState });

  try {
    TikTokLib ||= await import('tiktok-live-connector');
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = TikTokLib;
    const conn = new TikTokLiveConnection(uniqueId, {
      enableExtendedGiftInfo: false,
      processInitialData: true,
    });

    const getUserId = (u) =>
      u?.displayId ||
      u?.uniqueId ||
      u?.idStr ||
      (u?.id ? String(u.id) : '') ||
      u?.userId ||
      u?.nickname ||
      '';

    const getName = (u) =>
      u?.nickname ||
      u?.displayId ||
      u?.uniqueId ||
      'Bạn mới';

    const getAv = (u) =>
      u?.avatarThumb?.urlList?.[0] ||
      u?.avatarMedium?.urlList?.[0] ||
      u?.avatarLarge?.urlList?.[0] ||
      u?.profilePicture?.url?.[0] ||
      u?.profilePicture?.urlList?.[0] ||
      '';

    conn.on(WebcastEvent.CHAT, (d) => {
      const commentText = d.comment || d.content || d.text || '';
      handleChat(getUserId(d.user), getName(d.user), commentText, getAv(d.user));
    });

    conn.on(WebcastEvent.EMOTE, (d) => {
      const emoteName = d.emoteDetails?.emoteId || 'nhãn dán';
      handleChat(getUserId(d.user), getName(d.user), `thả ${emoteName}`, getAv(d.user));
    });

    conn.on(WebcastEvent.MEMBER, (d) => {
      handleJoin(getUserId(d.user), getName(d.user), getAv(d.user));
    });

    conn.on(WebcastEvent.ROOM_USER, (d) => {
      const list = d.ranksList || d.ranks || d.topViewers || [];
      for (const item of list) {
        const u = item?.user;
        if (u) {
          const uid = getUserId(u);
          const uname = getName(u);
          const uav = getAv(u);
          if (uid && !seenUsers.has(uid)) {
            handleJoin(uid, uname, uav, false);
          }
        }
      }
    });

    conn.on(WebcastEvent.SHARE, (d) => {
      handleShare(getUserId(d.user), getName(d.user), getAv(d.user));
    });

    conn.on(WebcastEvent.SOCIAL, (d) => {
      const key = d.common?.displayText?.key || d.displayType || '';
      if (key.includes('share')) {
        handleShare(getUserId(d.user), getName(d.user), getAv(d.user));
      } else if (key.includes('follow')) {
        handleFollow(getUserId(d.user), getName(d.user), getAv(d.user));
      }
    });

    conn.on(WebcastEvent.FOLLOW, (d) => {
      handleFollow(getUserId(d.user), getName(d.user), getAv(d.user));
    });

    conn.on(WebcastEvent.GIFT, (d) => {
      const type = d.giftDetails?.giftType ?? d.extendedGiftInfo?.type;
      if (type === 1 && !d.repeatEnd) return; // streak still running
      const gname = d.giftDetails?.giftName || d.extendedGiftInfo?.name || 'Hoa hồng';
      const dia = d.giftDetails?.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? 1;
      handleGift(
        getUserId(d.user),
        getName(d.user),
        gname,
        d.repeatCount || 1,
        dia,
        getAv(d.user)
      );
    });

    conn.on(WebcastEvent.LIKE, (d) => {
      handleLike(getUserId(d.user), getName(d.user), d.likeCount || 1);
    });

    conn.on(ControlEvent.DISCONNECTED, () => {
      tiktokState = { ...tiktokState, status: 'disconnected' };
      broadcast({ t: 'tiktok', ...tiktokState });
      addLog('TikTok: Mất kết nối');
    });

    conn.on(ControlEvent.ERROR, (e) => {
      addLog(`TikTok lỗi: ${e?.info || e?.message || e}`);
    });

    const st = await conn.connect();
    tiktok = conn;
    tiktokState = { status: 'connected', uniqueId, error: '', roomId: st?.roomId || '' };
    addLog(`✅ Đã kết nối phòng Live: @${uniqueId}`);
    try { fs.writeFileSync(LAST_CHANNEL_FILE, JSON.stringify({ uniqueId })); } catch {}
  } catch (err) {
    const errMsg = String(err?.message || err);
    tiktokState = { status: 'error', uniqueId, error: errMsg };
    if (errMsg.includes("isn't online") || errMsg.includes('offline')) {
      addLog(`ℹ️ Kênh @${uniqueId} hiện chưa mở phát Live (Offline).`);
      addLog(`👉 Hồ cá và bảng điều khiển vẫn chạy bình thường! Khi nào bạn live trên TikTok, vào trang điều khiển bấm Kết nối nhé.`);
    } else {
      addLog(`❌ Không kết nối được @${uniqueId}: ${errMsg}`);
    }
  }
  broadcast({ t: 'tiktok', ...tiktokState });
}

async function disconnectTikTok() {
  if (tiktok) {
    try { await tiktok.disconnect(); } catch {}
    tiktok = null;
  }
  tiktokState = { status: 'idle', uniqueId: '', error: '', roomId: '' };
  broadcast({ t: 'tiktok', ...tiktokState });
}

/* ------------------------------------------------------------- Bot Simulation */
const BOT_NAMES = ['Bảo Ngọc', 'Minh Tuấn', 'Phương Thảo', 'Hải Đăng', 'Thu Hà', 'Đức Anh', 'Diệu Linh', 'Trung Kiên', 'Lan Anh', 'Thanh Tùng'];
const BOT_COMMENTS = ['cho ăn nè', 'cá đẹp quá', 'an di e', 'mưa mát mẻ', 'hoàng hôn đẹp thế', 'đớp mồi', 'nuôi cá', 'cá koi bơi', 'size', 'size cá', 'kích thước'];
const BOT_GIFTS = [
  { name: 'Hoa hồng', diamonds: 1 },
  { name: 'Trái tim', diamonds: 5 },
  { name: 'Kem', diamonds: 1 },
  { name: 'Mũ miện', diamonds: 99 },
];

let botTimer = null;
function toggleBots(enable) {
  clearInterval(botTimer);
  if (!enable) {
    addLog('Đã dừng Bot mô phỏng');
    return;
  }
  addLog('Đã bật Bot mô phỏng tự động');
  botTimer = setInterval(() => {
    const roll = Math.random();
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    if (roll < 0.20) {
      handleJoin(`bot_${name}`, name, '', true);
    } else if (roll < 0.32) {
      handleShare(`bot_${name}`, name, '');
    } else if (roll < 0.65) {
      const comment = BOT_COMMENTS[Math.floor(Math.random() * BOT_COMMENTS.length)];
      handleChat(`bot_${name}`, name, comment, '');
    } else if (roll < 0.85) {
      handleLike(`bot_${name}`, name, Math.floor(1 + Math.random() * 5));
    } else {
      const gift = BOT_GIFTS[Math.floor(Math.random() * BOT_GIFTS.length)];
      handleGift(`bot_${name}`, name, gift.name, 1, gift.diamonds, '');
    }
  }, 3500);
}

/* ------------------------------------------------------------- HTTP Server */
function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method !== 'POST') {
      return resolve({});
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle /api/tribulation/* endpoints
  if (url.pathname.startsWith('/api/tribulation/')) {
    const action = url.pathname.replace('/api/tribulation/', '').replace(/\/.*$/, '');
    parseBody(req).then((body) => {
      const params = { ...Object.fromEntries(url.searchParams), ...body };
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      if (action === 'test') {
        const targetCm = Number(params.targetCm || params.cm || 72.0);
        const name = params.name || params.ownerName || 'Đạo hữu Test';
        const id = params.id || params.targetFishId || 'test_fish_1';
        const avatar = params.avatar || '';

        let fish = viewerFish.get(id);
        if (!fish) {
          fish = {
            id,
            user: name,
            avatar,
            eatCount: targetCm >= 82 ? 124 : 104,
            sizeCm: targetCm,
            passed72: false,
            passed82: false,
            lastFed: Date.now(),
          };
          viewerFish.set(id, fish);
        } else {
          fish.user = name;
          fish.eatCount = Math.max(fish.eatCount, targetCm >= 82 ? 124 : 104);
          fish.sizeCm = targetCm;
        }

        // Guarantee fish is spawned in all connected ponds
        broadcast({
          t: 'join',
          id,
          user: name,
          avatar,
        });

        const trib = startTribulation(id, name, avatar, targetCm);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          tribulation: {
            targetFishId: trib.targetFishId,
            ownerName: trib.ownerName,
            targetCm: trib.targetCm,
            requiredPower: trib.requiredPower,
            currentPower: trib.currentPower,
            timeLeft: trib.timeLeft,
          },
        }));
        return;
      }

      if (action === 'instant_dragon') {
        const name = params.name || 'Thái Cổ Chân Long';
        const id = params.id || 'test_dragon_1';
        const avatar = params.avatar || '';

        let fish = viewerFish.get(id);
        if (!fish) {
          fish = {
            id,
            user: name,
            avatar,
            eatCount: 130,
            sizeCm: 85.0,
            passed72: true,
            passed82: true,
            lastFed: Date.now(),
          };
          viewerFish.set(id, fish);
        } else {
          fish.passed72 = true;
          fish.passed82 = true;
          fish.eatCount = Math.max(fish.eatCount, 130);
          fish.sizeCm = 85.0;
        }

        // Broadcast join so all pond clients have the fish
        broadcast({
          t: 'join',
          id,
          user: name,
          avatar,
        });

        // Broadcast instant dragon transformation
        broadcast({
          t: 'instant_dragon',
          id,
          name,
          avatar,
        });

        addLog(`🐉 CHÂN LONG XUẤT THẾ: Đạo hữu ${name} đã hóa thân thành Hoàng Kim Chân Long!`);

        const spokenName = cleanSpokenName(name);
        say(`Kính báo toàn thể thiên hạ! Đạo hữu ${spokenName} đã hóa thân thành Hoàng Kim Chân Long, uy chấn bát hoang!`, { tag: 'tribulation', priority: true }, true);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          dragon: { id, name, sizeCm: 85.0 }
        }));
        return;
      }

      if (action === 'power') {
        const points = Number(params.points || params.power || 5);
        const source = params.source || 'chat';
        const user = params.user || params.name || 'Hộ Pháp Khách';
        const avatar = params.avatar || '';
        if (!currentTribulation) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Chưa có Thiên Kiếp nào đang diễn ra' }));
          return;
        }
        addTribulationPower(source, user, points, avatar);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          currentPower: currentTribulation ? currentTribulation.currentPower : 0,
          requiredPower: currentTribulation ? currentTribulation.requiredPower : 0,
        }));
        return;
      }

      if (action === 'resolve') {
        const win = params.success !== undefined
          ? (params.success === true || params.success === 'true' || params.success === '1')
          : (params.result === 'win' || params.win === '1' || params.win === true);
        if (!currentTribulation) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Chưa có Thiên Kiếp nào đang diễn ra' }));
          return;
        }
        resolveTribulation(win);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, result: win ? 'success' : 'failed' }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint không tồn tại' }));
    }).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Serve Control Panel
  if (url.pathname === '/control' || url.pathname === '/control.html') {
    const htmlPath = path.join(__dirname, 'control.html');
    fs.readFile(htmlPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading control.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      }
    });
    return;
  }

  // Serve TTS Audio files
  if (url.pathname.startsWith('/tts/')) {
    const filename = path.basename(url.pathname);
    const filepath = path.join(TTS_DIR, filename);
    if (fs.existsSync(filepath)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      fs.createReadStream(filepath).pipe(res);
      return;
    }
  }

  // Serve Built Frontend (Production Bundle from dist/)
  if (fs.existsSync(DIST_DIR)) {
    let rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    let targetPath = path.join(DIST_DIR, rel);

    if (!targetPath.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      const ext = path.extname(targetPath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(targetPath).pipe(res);
      return;
    }

    // SPA fallback
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end('Not Found');
});

/* ------------------------------------------------------------- WebSocket Server */
const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcast(msg, target = 'all') {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      if (target === 'all' || ws.role === target) {
        ws.send(payload);
      }
    }
  }
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const url = new URL(req.url, `http://${req.headers.host}`);
  ws.role = url.searchParams.get('role') || 'client'; // 'client' (nagomi app) or 'control'

  // Send initial state snapshot
  ws.send(JSON.stringify(stateSnapshot()));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.cmd) {
        case 'connect':
          connectTikTok(msg.uniqueId);
          break;
        case 'disconnect':
          disconnectTikTok();
          addLog('Đã ngắt kết nối TikTok');
          break;
        case 'join':
          handleJoin(msg.id || ('test_' + (msg.name || 'Test')), msg.name || 'Người xem', msg.avatar || '');
          break;
        case 'chat':
          handleChat('test_' + (msg.name || 'Test'), msg.name || 'Người xem', msg.text || 'Cho cá ăn nè', '');
          break;
        case 'query_size':
          handleChat('test_' + (msg.name || 'Test'), msg.name || 'Người xem', 'size cá', '');
          break;
        case 'toggleReadChat':
          settings.readChat = Boolean(msg.enabled);
          addLog(`Giọng đọc bình luận: ${settings.readChat ? 'ĐÃ BẬT 🔊' : 'ĐÃ TẮT 🔇'}`);
          broadcast(stateSnapshot());
          break;
        case 'toggleReadJoin':
          settings.readJoin = Boolean(msg.enabled);
          addLog(`Giọng đọc người vào xem: ${settings.readJoin ? 'ĐÃ BẬT 🔊' : 'ĐÃ TẮT 🔇'}`);
          broadcast(stateSnapshot());
          break;
        case 'toggleReadShare':
          settings.readShare = Boolean(msg.enabled);
          addLog(`Giọng đọc chia sẻ live: ${settings.readShare ? 'ĐÃ BẬT 🔊' : 'ĐÃ TẮT 🔇'}`);
          broadcast(stateSnapshot());
          break;
        case 'share':
          handleShare(msg.id || ('test_' + (msg.name || 'Test')), msg.name || 'Người xem', msg.avatar || '');
          break;
        case 'say':
          if (msg.text) {
            say(msg.text, { tag: 'size' });
          }
          break;
        case 'gift':
          handleGift(
            'test_' + (msg.name || 'Test'),
            msg.name || 'Người xem',
            msg.gift || 'Hoa hồng',
            +msg.count || 1,
            +msg.diamonds || 1,
            ''
          );
          break;
        case 'like':
          handleLike('test_' + (msg.name || 'Test'), msg.name || 'Người xem', +msg.count || 5);
          break;
        case 'weather':
          broadcast({ t: 'weather', preset: msg.preset, user: 'Streamer' });
          break;
        case 'scatter':
          broadcast({ t: 'scatter', user: 'Streamer' });
          break;
        case 'bots':
          toggleBots(Boolean(msg.enabled));
          break;
        case 'tribulation_test':
          startTribulation(
            msg.id || 'test_fish_1',
            msg.name || 'Đạo hữu Test',
            msg.avatar || '',
            Number(msg.targetCm || msg.cm || 72.0)
          );
          break;
        case 'tribulation_power':
          if (currentTribulation) {
            addTribulationPower(msg.source || 'chat', msg.user || 'Hộ Pháp Khách', Number(msg.points || 5), msg.avatar || '');
          }
          break;
        case 'tribulation_resolve':
          if (currentTribulation) {
            resolveTribulation(Boolean(msg.success));
          }
          break;
        case 'clearDonors':
          donors.clear();
          totalCoins = 0;
          broadcast(stateSnapshot());
          addLog('Đã xóa danh sách nhà tài trợ');
          break;
      }
    } catch (e) {
      console.error('WS Parse error', e);
    }
  });

  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🌊 Nagomi Live Server đang chạy tại:`);
  console.log(`   👉 Bảng điều khiển: http://localhost:${PORT}/control`);
  console.log(`   👉 WebSocket:      ws://localhost:${PORT}`);
  console.log(`======================================================\n`);

  // Auto-reconnect to last active TikTok live channel if saved
  try {
    if (fs.existsSync(LAST_CHANNEL_FILE)) {
      const saved = JSON.parse(fs.readFileSync(LAST_CHANNEL_FILE, 'utf8'));
      if (saved?.uniqueId) {
        console.log(`Đang tự động kết nối lại kênh: @${saved.uniqueId}...`);
        setTimeout(() => connectTikTok(saved.uniqueId), 1000);
      }
    }
  } catch {}
});
