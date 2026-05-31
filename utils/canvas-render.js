// utils/canvas-render.js - 双引擎卡片图片渲染
// 引擎 1: 模板库（16 套预设风格）→ 即刻渲染，无延迟
// 引擎 2: AI 生成（8 组提示词 + DeepSeek）→ 异步生成，失败回退模板
const cardTemplates = require('./card-templates');
const svgGen = require('./svg-gen');

const CARD_WIDTH = 340;
const CARD_HEIGHT = 340;

// 预设卡片高度列表（宽度固定 680，高度变化产生不同比例）
const PRESET_HEIGHTS = [540, 620, 720, 800, 900];
const DEFAULT_HEIGHT = 680;

// ============================================================
// 引擎 1: Canvas 2D 离线渲染（保留兼容）
// ============================================================

function renderTextToImage(text, title, color) {
  return new Promise((resolve) => {
    var canvas;
    try {
      canvas = wx.createOffscreenCanvas({ type: '2d', width: CARD_WIDTH, height: CARD_HEIGHT });
    } catch (e) {
      canvas = null;
    }

    if (!canvas) {
      resolve(generatePlaceholderImage({ title: title, summary: text, color: color }));
      return;
    }

    var ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = color || '#7785AC';
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // 渐变叠加
    var gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    gradient.addColorStop(0, 'rgba(255,255,255,0.15)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // 装饰圆点
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(CARD_WIDTH - 60, 60, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(80, CARD_HEIGHT - 80, 60, 0, Math.PI * 2);
    ctx.fill();

    // 标题文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    var titleLines = wrapText(ctx, title || text, CARD_WIDTH - 60);
    titleLines.forEach(function (line, i) {
      ctx.fillText(line, CARD_WIDTH / 2, CARD_HEIGHT / 2 - 30 + i * 38);
    });

    // 底部文字
    if (text && text !== title) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '16px -apple-system, sans-serif';
      var textLines = wrapText(ctx, text.slice(0, 80) + '...', CARD_WIDTH - 60);
      var startY = CARD_HEIGHT / 2 + 50;
      textLines.slice(0, 2).forEach(function (line, i) {
        ctx.fillText(line, CARD_WIDTH / 2, startY + i * 24);
      });
    }

    canvas.toDataURL({
      success: function (res) { resolve(res.data); },
      fail: function () { resolve(generatePlaceholderImage({ title: title, summary: text, color: color })); }
    });
  });
}

function wrapText(ctx, text, maxWidth) {
  var lines = [];
  var currentLine = '';
  for (var i = 0; i < text.length; i++) {
    var char = text[i];
    var testLine = currentLine + char;
    var metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============================================================
// 引擎 2: Canvas 2D → PNG（微信不支持 SVG data URI，必须用 PNG）
// ============================================================

/**
 * AI 生成图片的比例：约 25% 的卡片会尝试 AI 生成
 */
var AI_GENERATION_RATIO = 0.25;

// ============================================================
// 方案 ①：Canvas PNG 缓存层（renderCache + 降分辨率）
// ============================================================

/** Canvas 渲染缓存：cardId → PNG data URI，避免重复绘制 */
var renderCache = {};
var CACHE_MAX_SIZE = 200;

/**
 * 生成缓存键
 */
function cacheKey(card) {
  return (card.id || '') + '|' + (card.imageColor || card.color || '#7785AC') + '|' + (card.cardHeight || card.height || DEFAULT_HEIGHT);
}

/**
 * 获取缓存的 PNG，没有则渲染并缓存
 */
function getOrRenderCard(card) {
  var key = cacheKey(card);
  if (renderCache[key]) return renderCache[key];

  var png = generatePlaceholderImage(card);
  if (png && png.length > 200) {
    // LRU 淘汰：超过上限清空一半
    var keys = Object.keys(renderCache);
    if (keys.length >= CACHE_MAX_SIZE) {
      var sorted = keys.sort(); // 简单 FIFO
      for (var k = 0; k < Math.floor(sorted.length / 2); k++) {
        delete renderCache[sorted[k]];
      }
    }
    renderCache[key] = png;
  }
  return png;
}

/**
 * 清空缓存（切换卡片时调用）
 */
function clearRenderCache() {
  renderCache = {};
}

// ============================================================
// Canvas 辅助函数
// ============================================================

/** 16 进制颜色变暗 */
function darkenHex(hex, factor) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  r = Math.round(r * (1 - factor));
  g = Math.round(g * (1 - factor));
  b = Math.round(b * (1 - factor));
  return '#' +
    ('0' + Math.max(0, Math.min(255, r)).toString(16)).slice(-2) +
    ('0' + Math.max(0, Math.min(255, g)).toString(16)).slice(-2) +
    ('0' + Math.max(0, Math.min(255, b)).toString(16)).slice(-2);
}

/** Canvas 文字自动换行，返回行数组 */
function wrapTextCanvas(ctx, text, maxWidth) {
  if (!text) return [];
  var lines = [];
  var current = '';
  for (var i = 0; i < text.length; i++) {
    var test = current + text[i];
    var metrics = ctx.measureText(test);
    if (metrics.width > maxWidth && current.length > 0) {
      lines.push(current);
      current = text[i];
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push('');
  return lines;
}

/**
 * 终极兜底 — Canvas 纯代码渲染，保证不出错
 * 返回 PNG data URI（微信 image 组件支持）
 */
function makeCanvasFallback(title, height) {
  try {
    var h = height || DEFAULT_HEIGHT;
    var canvas = wx.createOffscreenCanvas({ type: '2d', width: 680, height: h });
    var ctx = canvas.getContext('2d');

    var grad = ctx.createLinearGradient(0, 0, 680, h);
    grad.addColorStop(0, '#7785AC');
    grad.addColorStop(1, '#5b2a86');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 680, h);

    // 装饰圆
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(560, h * 0.2, 140, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(120, h * 0.78, 90, 0, Math.PI * 2); ctx.fill();

    // 标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px -apple-system,PingFang SC,Microsoft YaHei,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var safeTitle = String(title || '卡片').slice(0, 18);
    ctx.fillText(safeTitle, 340, h * 0.42);

    // 底部标签
    ctx.font = '15px -apple-system,PingFang SC,Microsoft YaHei,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('拾遗补阙 · 文献研读', 340, h - 42);

    return canvas.toDataURL('image/png');
  } catch (e) {
    // 极端兜底：纯色空白图
    try {
      var c2 = wx.createOffscreenCanvas({ type: '2d', width: 680, height: height || 680 });
      var cx2 = c2.getContext('2d');
      cx2.fillStyle = '#7785AC';
      cx2.fillRect(0, 0, 680, height || 680);
      cx2.fillStyle = '#fff';
      cx2.font = '30px sans-serif';
      cx2.textAlign = 'center';
      cx2.textBaseline = 'middle';
      cx2.fillText('卡片', 340, (height || 680) / 2);
      return c2.toDataURL('image/png');
    } catch (e2) {
      return '';
    }
  }
}

/**
 * 生成卡片图片（Canvas 2D → PNG，微信手机端完美兼容）
 * 总是成功，绝不空白
 * 
 * @param {Object} card { title, summary, color, height }
 * @returns {string} PNG data URI
 */
function generatePlaceholderImage(card) {
  try {
    var title = card.title || '';
    var summary = card.summary || '';
    var color = card.color || '#7785AC';
    var height = card.height || DEFAULT_HEIGHT;

    var canvas = wx.createOffscreenCanvas({ type: '2d', width: 680, height: height });
    var ctx = canvas.getContext('2d');
    var darkColor = darkenHex(color, 0.3);

    // 主渐变背景
    var bgGrad = ctx.createLinearGradient(0, 0, 680, height);
    bgGrad.addColorStop(0, color);
    bgGrad.addColorStop(1, darkColor);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 680, height);

    // 光照叠加
    var overlay = ctx.createLinearGradient(0, 0, 680, height);
    overlay.addColorStop(0, 'rgba(255,255,255,0.1)');
    overlay.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.07)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, 680, height);

    // 装饰元素
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(560, height * 0.15, 150, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.arc(140, height * 0.82, 100, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(500, height * 0.7, 60, 0, Math.PI * 2); ctx.fill();

    // 标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px -apple-system,PingFang SC,Microsoft YaHei,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var titleLines = wrapTextCanvas(ctx, title, 600);
    var titleY = height * 0.38;
    var maxTitleLines = Math.min(titleLines.length, 4);
    for (var ti = 0; ti < maxTitleLines; ti++) {
      ctx.fillText(titleLines[ti], 340, titleY + ti * 50);
    }

    // 分隔线
    var separatorY = titleY + maxTitleLines * 50 + 22;
    if (separatorY < height - 120) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(280, separatorY);
      ctx.lineTo(400, separatorY);
      ctx.stroke();
    }

    // 摘要文字（有空间才画）
    var summaryStart = separatorY + 36;
    if (summary && summaryStart < height - 130) {
      ctx.font = '20px -apple-system,PingFang SC,Microsoft YaHei,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      var summaryText = summary.slice(0, 110);
      var sumLines = wrapTextCanvas(ctx, summaryText, 580);
      var maxSumLines = Math.min(sumLines.length, 3);
      for (var si = 0; si < maxSumLines; si++) {
        ctx.fillText(sumLines[si], 340, summaryStart + si * 28);
      }
    }

    // 底部品牌标记
    ctx.font = '15px -apple-system,PingFang SC,Microsoft YaHei,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('拾遗补阙 · 文献研读', 340, height - 42);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('[canvas-render] Canvas 渲染异常:', e);
    return makeCanvasFallback(card.title, card.height);
  }
}

/**
 * 为单张卡片生成 AI 图片（异步）
 * 如果已有 image 则替换，失败保持原样
 * 
 * @param {Object} card - 卡片对象（会被原地修改 card.image）
 * @returns {Promise<boolean>} - 是否成功替换
 */
function upgradeCardWithAI(card) {
  return svgGen.generateAISVG({
    title: card.title,
    summary: card.summary || card.content || '',
    height: card.cardHeight || DEFAULT_HEIGHT,
    timeout: 25000
  }).then(function (svgUri) {
    if (svgUri) {
      card.image = svgUri;
      return true;
    }
    return false;
  }).catch(function () {
    return false;
  });
}

/**
 * 批量为卡片异步升级为 AI 图片
 * - 立即用模板渲染所有卡片（同步，不阻塞）
 * - 后台异步对部分卡片尝试 AI 生成
 * - 每成功一张就回调 onCardUpgraded
 * 
 * @param {Array} cards - 卡片数组
 * @param {Object} options
 * @param {number} [options.aiRatio] - AI 生成比例，默认 0.25
 * @param {number} [options.maxConcurrent] - 最大并发，默认 2
 * @param {Function} [options.onCardUpgraded] - 单张卡片升级成功回调(card)
 * @returns {Promise<Array>} - 完成时返回所有升级成功的卡片
 */
function renderCardsWithAI(cards, options) {
  options = options || {};
  var aiRatio = options.aiRatio !== undefined ? options.aiRatio : AI_GENERATION_RATIO;
  var maxConcurrent = options.maxConcurrent || 2;
  var onCardUpgraded = options.onCardUpgraded;

  // 第一步：同步渲染所有卡片（使用模板库），每张独立兜底
  cards.forEach(function (card) {
    if (!card.image) {
      try {
        card.image = generatePlaceholderImage({
          title: card.title,
          summary: card.summary || card.content || '',
          color: card.imageColor || '#7785AC',
          height: card.cardHeight || DEFAULT_HEIGHT
        });
      } catch (e2) {
        console.warn('[canvas-render] renderCardsWithAI 单张渲染异常:', e2);
        card.image = makeCanvasFallback(card.title, card.cardHeight);
      }
    }
  });

  // 第二步：挑选部分卡片进行 AI 升级
  var aiCards = [];
  cards.forEach(function (card, i) {
    if (Math.random() < aiRatio) {
      aiCards.push({ card: card, index: i });
    }
  });

  if (aiCards.length === 0) {
    return Promise.resolve([]);
  }

  // 第三步：并发控制异步升级
  var upgraded = [];
  var idx = 0;

  function processNext() {
    if (idx >= aiCards.length) return Promise.resolve();
    var item = aiCards[idx++];
    return upgradeCardWithAI(item.card).then(function (success) {
      if (success) {
        upgraded.push(item.card);
        if (onCardUpgraded) {
          try { onCardUpgraded(item.card); } catch (e) {}
        }
      }
      return processNext();
    });
  }

  var tasks = [];
  for (var j = 0; j < Math.min(maxConcurrent, aiCards.length); j++) {
    tasks.push(processNext());
  }

  return Promise.all(tasks).then(function () {
    return upgraded;
  });
}

/**
 * 批量渲染卡片图片（兼容旧接口）
 */
function renderCards(cards) {
  return Promise.all(cards.map(function (card) {
    return renderTextToImage(card.summary || card.content, card.title, card.imageColor || '#7785AC')
      .then(function (imagePath) {
        card.image = imagePath;
        return card;
      })
      .catch(function () {
        try {
          card.image = generatePlaceholderImage({
            title: card.title,
            summary: card.summary || card.content,
            color: card.imageColor || '#7785AC',
            height: card.cardHeight
          });
        } catch (e) {
          card.image = makeCanvasFallback(card.title, card.cardHeight);
        }
        return card;
      });
  }));
}

// ============================================================
// 获取双引擎统计
// ============================================================
function getEngineInfo() {
  return {
    templateCount: '16 套预设模板',
    aiPromptCount: '8 组 AI 风格',
    aiRatio: (AI_GENERATION_RATIO * 100) + '%',
    templateNames: cardTemplates.getTemplateNames(),
    aiPromptNames: svgGen.getPromptNames()
  };
}

module.exports = {
  // 核心 API
  renderTextToImage: renderTextToImage,
  renderCards: renderCards,
  generatePlaceholderImage: generatePlaceholderImage,

  // 双引擎
  renderCardsWithAI: renderCardsWithAI,
  upgradeCardWithAI: upgradeCardWithAI,
  getEngineInfo: getEngineInfo,
  makeCanvasFallback: makeCanvasFallback,
  getOrRenderCard: getOrRenderCard,
  clearRenderCache: clearRenderCache,

  // 子模块（方便外部直接调用）
  cardTemplates: cardTemplates,
  svgGen: svgGen,

  // 常量
  PRESET_HEIGHTS: PRESET_HEIGHTS
};
