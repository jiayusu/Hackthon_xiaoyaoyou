// utils/svg-gen.js - AI SVG 卡片生成引擎
// 调用 DeepSeek API 实时生成小红书风格 SVG 卡片
// 双引擎策略：混合 16 套模板库 + 8 组 AI 提示词

const CARD_WIDTH = 680;

// ============================================================
// DeepSeek API 调用（复用 config.js）
// ============================================================
const config = require('./config');
const BASE_URL = config.apiBaseUrl;
const API_KEY = config.apiKey;
const MODEL = config.model;

function apiRequest(messages, timeout) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + '/v1/chat/completions',
      method: 'POST',
      data: { model: MODEL, messages: messages, stream: false },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      timeout: timeout || 60000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.choices) {
          resolve(res.data);
        } else {
          reject({ code: res.statusCode, message: 'API 返回异常' });
        }
      },
      fail: function (err) {
        reject({ code: -1, message: err.errMsg || '网络请求失败' });
      }
    });
  });
}

// ============================================================
// SVG 提取：从 LLM 返回内容中提取纯 SVG 代码
// ============================================================
function extractSVG(raw) {
  if (!raw) return null;
  const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/i);
  return svgMatch ? svgMatch[0] : null;
}

// ============================================================
// 工具：SVG → 安全的 Data URI（base64 编码，手机端兼容）
// ============================================================
/**
 * 将 SVG 字符串编码为安全的 data URI（base64 编码，手机端兼容）
 */
function svgToDataURI(svgCode) {
  try {
    var base64 = wx.arrayBufferToBase64(stringToUTF8Buffer(svgCode));
    return 'data:image/svg+xml;base64,' + base64;
  } catch (e) {
    return fallbackBase64URI(svgCode);
  }
}

function stringToUTF8Buffer(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else if (code >= 55296 && code <= 56319) {
      i++;
      var code2 = str.charCodeAt(i);
      var cp = ((code - 55296) << 10) + (code2 - 56320) + 65536;
      bytes.push(240 | (cp >> 18), 128 | ((cp >> 12) & 63), 128 | ((cp >> 6) & 63), 128 | (cp & 63));
    } else {
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
  }
  var buf = new ArrayBuffer(bytes.length);
  var view = new Uint8Array(buf);
  for (var j = 0; j < bytes.length; j++) view[j] = bytes[j];
  return buf;
}

function fallbackBase64URI(str) {
  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) bytes.push(code);
    else if (code < 2048) bytes.push(192 | (code >> 6), 128 | (code & 63));
    else { bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63)); }
  }
  var result = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    result += CHARS[b0 >> 2];
    result += CHARS[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    result += b1 !== undefined ? CHARS[((b1 & 15) << 2) | ((b2 || 0) >> 6)] : '=';
    result += b2 !== undefined ? CHARS[b2 & 63] : '=';
  }
  return 'data:image/svg+xml;base64,' + result;
}

// ============================================================
// 8 组 AI 提示词 — 小红书视觉美学
// ============================================================

/**
 * 构建 system prompt（通用部分 + 角色设定）
 */
function buildSystemPrompt(style) {
  const base = '你是一位顶级视觉设计师，专精小红书图文卡片设计。你需要输出纯 SVG 代码，不包含任何 markdown 标记、代码块标记或额外解释。';
  const rules = [
    'SVG 尺寸严格为 width="680"，height 在 540-900 之间自适应',
    '使用 <defs> 定义渐变/滤镜，保持 SVG 整洁模块化',
    '字体族使用 "PingFang SC, Microsoft YaHei, -apple-system, sans-serif"',
    '标题文字必须在卡片视觉重心位置，且不得被装饰元素遮挡',
    '必须输出完整的 <svg>...</svg> 标签对，不得省略',
    '禁止使用外部图片、外部字体引用',
    '卡片要让人想点开、想收藏——视觉上要有小红书那种精致感',
  ];
  return base + '\n' + style + '\n\n' + rules.map(function (r) { return '· ' + r; }).join('\n');
}

/**
 * 构建 user prompt：注入标题和摘要
 */
function buildUserPrompt(title, summary, height) {
  var h = height || 680;
  var parts = [
    '请为以下内容生成一张小红书风格的知识卡片 SVG：',
    '',
    '【卡片标题】' + (title || '未命名'),
  ];
  if (summary) {
    parts.push('【卡片摘要】' + summary.slice(0, 80));
  }
  parts.push('【画布尺寸】width="680" height="' + h + '"');
  parts.push('');
  parts.push('要求：标题醒目、排版精致、有小红书的高级感，让人忍不住想点赞收藏。纯 SVG 输出。');
  return parts.join('\n');
}

// ═══════════════════════════════════════════════
// 提示词 1: 李继刚式 · 新中式美学诗人
// ═══════════════════════════════════════════════
function prompt1_LiJiGang() {
  return {
    name: '新中式美学',
    system: buildSystemPrompt(
      ';; ━━━━━━━━━━━━━━\n' +
      ';; 角色: 李继刚 · SVG 图形诗人\n' +
      ';; ━━━━━━━━━━━━━━\n' +
      '你的设计哲学：\n' +
      '- 留白是呼吸——大片素净背景上的文字才有重量\n' +
      '- 你钟爱极细边框线、淡墨晕染、古籍排版般的错落节奏\n' +
      '- 用色克制：象牙白底、灰蓝主调、赭石点缀\n' +
      '- 排版如宋版书：标题居中大字、摘要小字横排、底部落款\n' +
      '- 装饰只用圆形和细线，拒绝一切花哨\n' +
      '- 整体气质："温润如玉，字字千钧"'
    )
  };
}

// ═══════════════════════════════════════════════
// 提示词 2: 孟菲斯波普 · 大胆撞色实验室
// ═══════════════════════════════════════════════
function prompt2_Memphis() {
  return {
    name: '孟菲斯波普',
    system: buildSystemPrompt(
      '你是孟菲斯设计风格的狂热信徒。\n' +
      '你的设计法则：\n' +
      '- 大面积几何色块碰撞（圆形、三角形、波浪线、点阵）\n' +
      '- 用色大胆：粉撞蓝、黄撞紫、橙撞绿——但控制在 3-4 个主色\n' +
      '- 圆点和短线是标志性装饰，散落在空白处像音符\n' +
      '- 标题用白色粗体浮在对比强烈的色块上\n' +
      '- 要有趣味性：像一本有趣的杂志封面，不拘一格\n' +
      '- 避免沉闷，每个角落都要有视觉惊喜'
    )
  };
}

// ═══════════════════════════════════════════════
// 提示词 3: 日系手账 · 温暖治愈风
// ═══════════════════════════════════════════════
function prompt3_Diary() {
  return {
    name: '温暖手账',
    system: buildSystemPrompt(
      '你是日系手账风格的插画师。\n' +
      '你的笔记本里藏着整个温柔宇宙：\n' +
      '- 背景是米白或淡奶油色的"纸"，略带做旧纹理感（用低透明度叠加）\n' +
      '- 左上角有胶带贴纸般的彩色小标签（圆角矩形）\n' +
      '- 你爱画虚线边框、手写体风格的横线装饰\n' +
      '- 小元素不能少：回形针、小星星、小箭头、虚线框\n' +
      '- 标题用深棕色或深灰，像手写钢笔字\n' +
      '- 摘要用更小更淡的字号，像铅笔批注\n' +
      '- 整体氛围："在咖啡馆靠窗的位置翻开笔记本的那一页"'
    )
  };
}

// ═══════════════════════════════════════════════
// 提示词 4: 莫兰迪高级灰 · 克制美学
// ═══════════════════════════════════════════════
function prompt4_Morandi() {
  return {
    name: '莫兰迪高级灰',
    system: buildSystemPrompt(
      '你是莫兰迪画室的学徒，终身追求"低饱和度的优雅"。\n' +
      '你的调色盘：\n' +
      '- 雾霾蓝、灰豆绿、烟粉色、燕麦色——所有颜色都蒙着一层薄雾\n' +
      '- 背景用极浅的灰调（如 #F4F1EC），决不用纯白\n' +
      '- 形状偏爱浑圆的椭圆和柔和的曲线，没有尖锐的直角\n' +
      '- 装饰是两组半透明的椭圆色块在角落静静叠加\n' +
      '- 标题用中灰色（非纯黑），略带字距\n' +
      '- 气质关键词："静谧 · 克制 · 不争不抢的高级感"\n' +
      '- 像一件羊绒开衫，质感写在每一处细节里'
    )
  };
}

// ═══════════════════════════════════════════════
// 提示词 5: 赛博朋克 · 霓虹暗夜
// ═══════════════════════════════════════════════
function prompt5_Cyberpunk() {
  return {
    name: '赛博霓虹',
    system: buildSystemPrompt(
      '你是赛博朋克美学设计师，用代码绘制霓虹。\n' +
      '你的视觉语法：\n' +
      '- 深色底（#0D0D1A 或类似深邃暗蓝），霓虹色文字（#00FFC8 青绿、#FF6B9D 粉紫、#FFD700 金）\n' +
      '- 标题要有发光效果：用多个 text 元素叠加不同透明度模拟 glow\n' +
      '- 装饰：细网格线背景、扫描线、几何框架边框\n' +
      '- 四角各有一个小直角标记（像UI准星）\n' +
      '- 标题下方有发光的细横线分隔\n' +
      '- 底部有像终端提示符一样的小字 "> READ_MORE"\n' +
      '- 关键词："未来感 · 电子屏 · 数字时代的诗意"'
    )
  };
}

// ═══════════════════════════════════════════════
// 提示词 6: 极简日式 · 侘寂之风
// ═══════════════════════════════════════════════
function prompt6_WabiSabi() {
  return {
    name: '侘寂之风',
    system: buildSystemPrompt(
      '你是侘寂美学的修行者。\n' +
      '你的设计信条：\n' +
      '- "少即是多"的极致演绎——整个画面只有标题、一条线、一个圆、一处留白\n' +
      '- 背景：米白或极浅灰，带有微不可察的纹理噪点（小圆点散布）\n' +
      '- 墨色浓淡：标题用近乎黑的深灰，装饰线用极淡的灰\n' +
      '- 唯一装饰：一个手工感的不规则圆（stroke-dasharray 模拟毛笔枯笔）\n' +
      '- 排版：标题竖排或偏左上，大量留白在右下\n' +
      '- 气质："像一幅水墨画里只画了一枝梅花"'
    )
  };
}

// ═══════════════════════════════════════════════
// 提示词 7: 杂志排版风 · Editorial
// ═══════════════════════════════════════════════
function prompt7_Editorial() {
  return {
    name: '杂志排版',
    system: buildSystemPrompt(
      '你是 VOGUE 中文版的艺术总监。\n' +
      '你的版面法则：\n' +
      '- 大标题左对齐，字号巨大（40-48px），字重 Bold，行距紧凑\n' +
      '- 标题下方一条粗线（3-4px）作为视觉锚点\n' +
      '- 右上角有小的分类标签（如"✦ 深度阅读"）\n' +
      '- 用大号的半透明数字或字母做背景水印（如"01"）\n' +
      '- 配色：白底 + 一个主色（优雅的蓝/红/绿）贯穿始终\n' +
      '- 底部有细细的页脚线和页码\n' +
      '- 气质："翻开一本精装杂志，这一页讲的就是你的故事"'
    )
  };
}

// ═══════════════════════════════════════════════
// 提示词 8: 几何构成 · 包豪斯现代主义
// ═══════════════════════════════════════════════
function prompt8_Bauhaus() {
  return {
    name: '包豪斯几何',
    system: buildSystemPrompt(
      '你是包豪斯设计学院的毕业生。\n' +
      '你的设计原则：\n' +
      '- 形式追随功能——每个几何形状都有其结构意义\n' +
      '- 用基本几何：矩形、圆形、三角形、直线构建整个画面\n' +
      '- 配色：原色红蓝黄 + 黑白灰，但降低饱和度使其现代\n' +
      '- 标题放在一个由几何色块构成的"框架"内\n' +
      '- 大量使用 45 度斜线和不对称构图\n' +
      '- 装饰元素精简到极致：3-5 个色块 + 1 条斜线 + 文字\n' +
      '- 气质："像一张现代艺术博物馆的海报"'
    )
  };
}

// ═══════════════════════════════════════════════
// 所有提示词注册表
// ═══════════════════════════════════════════════
var PROMPTS = [
  prompt1_LiJiGang,
  prompt2_Memphis,
  prompt3_Diary,
  prompt4_Morandi,
  prompt5_Cyberpunk,
  prompt6_WabiSabi,
  prompt7_Editorial,
  prompt8_Bauhaus
];

// ============================================================
// 核心：AI 生成 SVG 卡片
// ============================================================

/**
 * 基于标题哈希选择提示词风格
 */
function pickPrompt(title) {
  var hash = 0;
  for (var i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash |= 0;
  }
  return PROMPTS[Math.abs(hash) % PROMPTS.length];
}

/**
 * 调用 AI 生成 SVG 卡片
 * @param {Object} params
 * @param {string} params.title - 卡片标题
 * @param {string} params.summary - 卡片摘要
 * @param {number} params.height - 图片高度
 * @param {number} [params.promptIndex] - 指定提示词索引（可选）
 * @param {number} [params.timeout] - API 超时时间（ms）
 * @returns {Promise<string>} - 返回 SVG data URI
 */
function generateAISVG(params) {
  var title = params.title || '';
  var summary = params.summary || '';
  var height = params.height || 680;
  var promptIndex = params.promptIndex;
  var timeout = params.timeout || 30000;

  // 选择提示词
  var promptFn;
  if (promptIndex !== undefined && promptIndex >= 0 && promptIndex < PROMPTS.length) {
    promptFn = PROMPTS[promptIndex];
  } else {
    promptFn = pickPrompt(title);
  }
  var prompt = promptFn();

  // 构建消息
  var messages = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: buildUserPrompt(title, summary, height) }
  ];

  // 返回 Promise
  return apiRequest(messages, timeout).then(function (res) {
    var raw = ((res.choices || [])[0] || {}).message || {};
    var svgCode = extractSVG(raw.content || '');
    if (!svgCode) {
      throw new Error('AI 未返回有效 SVG');
    }
    // 防御：可能因异常字符失败
    try {
      var uri = svgToDataURI(svgCode);
      if (uri.length < 400) {
        throw new Error('生成的 SVG 数据太短');
      }
      return uri;
    } catch (encErr) {
      console.warn('[svg-gen] SVG DataURI 生成失败:', encErr);
      throw encErr;
    }
  });
}

/**
 * 批量 AI 生成（带并发控制，最多同时 3 个请求）
 * @param {Array} cards - 卡片数据数组
 * @param {number} maxConcurrent - 最大并发数
 * @returns {Promise<Array>} - 返回带 image 的卡片数组
 */
function batchGenerateAISVG(cards, maxConcurrent) {
  maxConcurrent = maxConcurrent || 3;
  var results = [];
  var index = 0;

  function next() {
    if (index >= cards.length) return Promise.resolve();
    var i = index++;
    var card = cards[i];
    return generateAISVG({
      title: card.title,
      summary: card.summary || card.content,
      height: card.cardHeight || 680,
      timeout: 25000
    }).then(function (svgUri) {
      results[i] = svgUri;
    }).catch(function () {
      results[i] = null; // 失败标记
    }).then(next);
  }

  // 启动并发
  var tasks = [];
  for (var j = 0; j < Math.min(maxConcurrent, cards.length); j++) {
    tasks.push(next());
  }

  return Promise.all(tasks).then(function () {
    return results;
  });
}

// ============================================================
// 导出
// ============================================================
module.exports = {
  generateAISVG: generateAISVG,
  batchGenerateAISVG: batchGenerateAISVG,
  getPromptCount: function () { return PROMPTS.length; },
  getPromptNames: function () { return PROMPTS.map(function (p) { return p().name; }); },
  pickPrompt: pickPrompt,
};
