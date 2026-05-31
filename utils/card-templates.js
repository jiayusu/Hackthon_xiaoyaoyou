// utils/card-templates.js - 小红书风格卡片模板库
// 每个模板函数接收 { title, summary, color, width, height } 参数，返回 SVG 字符串

const CARD_W = 680;

/**
 * 转义 XML 特殊字符
 */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 截断文字到指定长度
 */
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

/**
 * SVG 文字自动换行
 * 返回 <text> 或 <tspan> 元素数组的 SVG 字符串
 */
function wrapTextSVG(text, maxChars, fontSize, lineHeight, x, startY, color, fontWeight, textAnchor) {
  if (!text) return '';
  const lines = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((current + ch).length > maxChars && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  
  return lines.map((line, i) => {
    const y = startY + i * lineHeight;
    return `<text x="${x}" y="${y}" font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight || 'normal'}" text-anchor="${textAnchor || 'middle'}" dominant-baseline="middle">${esc(line)}</text>`;
  }).join('\n');
}

// ============================================================
// 调色板
// ============================================================
const PALETTES = {
  lavender:  { bg: '#F5F0FF', accent: '#7785AC', dark: '#4A5A7A', light: '#E8DFFA', warm: '#B8A9D4' },
  morandi:  { bg: '#F4EFEA', accent: '#B8A9C9', dark: '#6B5B7B', light: '#E8DDD3', warm: '#C9B99A' },
  blush:    { bg: '#FEF5F5', accent: '#D4A5A5', dark: '#8B6969', light: '#FCE8E8', warm: '#E8C4C4' },
  sage:     { bg: '#F5F9F3', accent: '#9AC6C5', dark: '#5A8A7A', light: '#E8F0E0', warm: '#A5E6BA' },
  dusk:     { bg: '#F6F3F8', accent: '#5B2A86', dark: '#360568', light: '#E8E0F0', warm: '#9B7FBF' },
  cream:    { bg: '#FDFBF7', accent: '#C9A96E', dark: '#7B6543', light: '#F5EFE0', warm: '#E0CFA0' },
  ocean:    { bg: '#F2F7FA', accent: '#6BA3BE', dark: '#3D6B80', light: '#DEEBF2', warm: '#8FC1D4' },
  sunset:   { bg: '#FEF9F4', accent: '#E8946A', dark: '#A0583A', light: '#FDE8D8', warm: '#F4B893' },
  mint:     { bg: '#F3FAF7', accent: '#6BBF8A', dark: '#3D7A55', light: '#DCF0E5', warm: '#95D5AA' },
  rose:     { bg: '#FDF5F8', accent: '#C77D8F', dark: '#8B4A5A', light: '#F8E0E8', warm: '#DBA0AE' },
  slate:    { bg: '#F5F6F8', accent: '#6B7D8E', dark: '#3D4D5A', light: '#E4E8EC', warm: '#95A5B0' },
  honey:    { bg: '#FFFDF5', accent: '#D4A853', dark: '#8B6D2A', light: '#FFF8DC', warm: '#E8C870' },
};

// ============================================================
// 辅助函数：渐变背景定义
// ============================================================
function defGradient(palette, id) {
  return `
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${palette.light};stop-opacity:1"/>
    </linearGradient>`;
}

function defGradientVertical(palette, id) {
  return `
    <linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.accent};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${palette.dark};stop-opacity:1"/>
    </linearGradient>`;
}

// ============================================================
// 模板 1: 极简几何 — 底部色块 + 顶部文字
// ============================================================
function t1_Geometric(params) {
  const { title, summary, palette, H } = params;
  const defs = defGradient(palette, 'bg1');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>${defs}</defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg1)" rx="0"/>
  <!-- 底部大色块 -->
  <path d="M0 ${H * 0.55} Q${CARD_W * 0.3} ${H * 0.45} ${CARD_W} ${H * 0.55} L${CARD_W} ${H} L0 ${H} Z" fill="${palette.accent}" opacity="0.12"/>
  <path d="M0 ${H * 0.7} Q${CARD_W * 0.5} ${H * 0.6} ${CARD_W} ${H * 0.7} L${CARD_W} ${H} L0 ${H} Z" fill="${palette.accent}" opacity="0.18"/>
  <!-- 装饰圆 -->
  <circle cx="${CARD_W - 80}" cy="80" r="50" fill="${palette.accent}" opacity="0.08"/>
  <circle cx="100" cy="${H - 120}" r="30" fill="${palette.warm}" opacity="0.15"/>
  <!-- 小装饰线 -->
  <line x1="60" y1="${H * 0.4}" x2="180" y2="${H * 0.4}" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
  <!-- 标题区 -->
  ${wrapTextSVG(truncate(title, 14), 12, '36', '48', CARD_W / 2, H * 0.32, palette.dark, 'bold', 'middle')}
  <!-- 副标题 -->
  ${summary ? wrapTextSVG(truncate(summary, 24), 14, '20', '30', CARD_W / 2, H * 0.48, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部标签 -->
  <rect x="${CARD_W - 200}" y="${H - 70}" width="140" height="36" rx="18" fill="${palette.accent}" opacity="0.15"/>
  <text x="${CARD_W - 130}" y="${H - 52}" font-family="-apple-system,PingFang SC,sans-serif" font-size="16" fill="${palette.accent}" text-anchor="middle" dominant-baseline="middle">拾遗补阙</text>
</svg>`;
}

// ============================================================
// 模板 2: 文艺渐变 — 全幅渐变 + 居中文字
// ============================================================
function t2_Gradient(params) {
  const { title, summary, palette, H } = params;
  const defs = defGradientVertical(palette, 'bg2') + `
    <radialGradient id="glow2" cx="50%" cy="40%" r="60%">
      <stop offset="0%" style="stop-color:${palette.light};stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:${palette.dark};stop-opacity:0"/>
    </radialGradient>`;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>${defs}</defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg2)" rx="0"/>
  <rect width="${CARD_W}" height="${H}" fill="url(#glow2)"/>
  <!-- 装饰圆环 -->
  <circle cx="${CARD_W - 100}" cy="${H * 0.25}" r="120" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <circle cx="${CARD_W - 100}" cy="${H * 0.25}" r="80" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  <circle cx="80" cy="${H * 0.75}" r="60" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1.5"/>
  <!-- 十字星装饰 -->
  <g transform="translate(${CARD_W - 60}, 80)" opacity="0.2">
    <line x1="-8" y1="0" x2="8" y2="0" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="0" y1="-8" x2="0" y2="8" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </g>
  <!-- 主标题 -->
  ${wrapTextSVG(truncate(title, 14), 12, '40', '52', CARD_W / 2, H * 0.38, '#ffffff', 'bold', 'middle')}
  <!-- 分隔线 -->
  <line x1="${CARD_W / 2 - 40}" y1="${H * 0.52}" x2="${CARD_W / 2 + 40}" y2="${H * 0.52}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 副标题 -->
  ${summary ? wrapTextSVG(truncate(summary, 30), 15, '18', '28', CARD_W / 2, H * 0.6, 'rgba(255,255,255,0.8)', 'normal', 'middle') : ''}
</svg>`;
}

// ============================================================
// 模板 3: 手账笔记风 — 横线纸纹理
// ============================================================
function t3_Notebook(params) {
  const { title, summary, palette, H } = params;
  
  let lines = '';
  for (let y = 0.12 * H; y < 0.95 * H; y += H * 0.06) {
    lines += `<line x1="60" y1="${y}" x2="${CARD_W - 60}" y2="${y}" stroke="${palette.accent}" stroke-width="0.8" opacity="0.1"/>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <rect width="${CARD_W}" height="${H}" fill="${palette.bg}" rx="0"/>
  <!-- 左侧红线 -->
  <line x1="75" y1="0" x2="75" y2="${H}" stroke="${palette.warm}" stroke-width="1.5" opacity="0.3"/>
  <!-- 横线 -->
  ${lines}
  <!-- 顶部彩色标签 -->
  <rect x="${CARD_W * 0.15}" y="0" width="${CARD_W * 0.22}" height="40" rx="0 0 10 10" fill="${palette.accent}" opacity="0.7"/>
  <text x="${CARD_W * 0.26}" y="24" font-family="-apple-system,PingFang SC,sans-serif" font-size="14" fill="#ffffff" text-anchor="middle" font-weight="600">NOTES</text>
  <!-- 回形针装饰 -->
  <g transform="translate(80, 30)" opacity="0.25">
    <rect x="0" y="0" width="16" height="50" rx="8" fill="none" stroke="${palette.dark}" stroke-width="2.5"/>
    <rect x="3" y="5" width="10" height="12" rx="3" fill="none" stroke="${palette.dark}" stroke-width="2"/>
  </g>
  <!-- 手写字体标题 -->
  ${wrapTextSVG(truncate(title, 14), 14, '32', '44', CARD_W / 2, H * 0.3, palette.dark, 'bold', 'middle')}
  <!-- 副标题 -->
  ${summary ? wrapTextSVG(truncate(summary, 30), 18, '18', '28', CARD_W / 2, H * 0.45, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部便签 -->
  <rect x="${CARD_W * 0.1}" y="${H * 0.82}" width="${CARD_W * 0.8}" height="2" rx="1" fill="${palette.warm}" opacity="0.4"/>
</svg>`;
}

// ============================================================
// 模板 4: 杂志排版 — 左对齐文字 + 右侧装饰
// ============================================================
function t4_Magazine(params) {
  const { title, summary, palette, H } = params;
  const defs = defGradient(palette, 'bg4');
  
  const titleX = 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>${defs}
    <clipPath id="clip4"><rect x="0" y="0" width="${CARD_W}" height="${H}" rx="0"/></clipPath>
  </defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg4)" rx="0"/>
  <!-- 右侧大圆形装饰 -->
  <circle cx="${CARD_W - 50}" cy="${H * 0.3}" r="${CARD_W * 0.35}" fill="${palette.accent}" opacity="0.06"/>
  <circle cx="${CARD_W + 20}" cy="${H * 0.7}" r="${CARD_W * 0.25}" fill="${palette.warm}" opacity="0.08"/>
  <!-- 顶部色条 -->
  <rect x="0" y="0" width="${CARD_W}" height="6" fill="${palette.accent}" opacity="0.3"/>
  <!-- 编号 -->
  <text x="55" y="${H * 0.2}" font-family="Georgia,serif" font-size="80" fill="${palette.accent}" opacity="0.1" font-weight="bold">0</text>
  <text x="75" y="${H * 0.2}" font-family="Georgia,serif" font-size="80" fill="${palette.accent}" opacity="0.1" font-weight="bold">1</text>
  <!-- 主标题左对齐 -->
  ${wrapTextSVG(truncate(title, 14), 10, '38', '50', titleX, H * 0.38, palette.dark, 'bold', 'start')}
  <!-- 下划线 -->
  <line x1="${titleX}" y1="${H * 0.55}" x2="${titleX + Math.min(title.length * 20, 200)}" y2="${H * 0.55}" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 40), 18, '17', '26', titleX, H * 0.64, palette.accent, 'normal', 'start') : ''}
  <!-- 右下标签 -->
  <rect x="${CARD_W - 190}" y="${H - 65}" width="160" height="34" rx="17" fill="${palette.accent}" opacity="0.12"/>
  <text x="${CARD_W - 110}" y="${H - 48}" font-family="-apple-system,PingFang SC,sans-serif" font-size="14" fill="${palette.dark}" text-anchor="middle" dominant-baseline="middle" opacity="0.7">✦ Read More</text>
</svg>`;
}

// ============================================================
// 模板 5: 莫兰迪色 — 大面积留白 + 柔和小装饰
// ============================================================
function t5_Morandi(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <rect width="${CARD_W}" height="${H}" fill="${palette.bg}" rx="0"/>
  <!-- 柔色块 -->
  <ellipse cx="${CARD_W * 0.8}" cy="${H * 0.2}" rx="180" ry="120" fill="${palette.light}" opacity="0.6"/>
  <ellipse cx="${CARD_W * 0.15}" cy="${H * 0.85}" rx="100" ry="70" fill="${palette.warm}" opacity="0.4"/>
  <!-- 小圆点排列 -->
  <circle cx="${CARD_W * 0.1}" cy="${H * 0.12}" r="4" fill="${palette.accent}" opacity="0.3"/>
  <circle cx="${CARD_W * 0.15}" cy="${H * 0.12}" r="4" fill="${palette.accent}" opacity="0.2"/>
  <circle cx="${CARD_W * 0.2}" cy="${H * 0.12}" r="4" fill="${palette.accent}" opacity="0.15"/>
  <!-- 纤细装饰线 -->
  <line x1="${CARD_W * 0.25}" y1="${H * 0.75}" x2="${CARD_W * 0.75}" y2="${H * 0.75}" stroke="${palette.accent}" stroke-width="0.6" opacity="0.2"/>
  <!-- 标题 - 偏上居中 -->
  ${wrapTextSVG(truncate(title, 14), 12, '35', '50', CARD_W / 2, H * 0.35, palette.dark, 'bold', 'middle')}
  <!-- 副标题 -->
  ${summary ? wrapTextSVG(truncate(summary, 36), 20, '17', '26', CARD_W / 2, H * 0.55, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部小字 -->
  <text x="${CARD_W / 2}" y="${H - 40}" font-family="-apple-system,PingFang SC,sans-serif" font-size="13" fill="${palette.accent}" text-anchor="middle" opacity="0.4">拾 遗 补 阙</text>
</svg>`;
}

// ============================================================
// 工具：SVG → 安全的 Data URI（base64 编码，手机端兼容）
// ============================================================
function svgToDataURI(svgCode) {
  try {
    // 用微信原生 API 做 base64 编码（最可靠）
    var base64 = wx.arrayBufferToBase64(stringToUTF8ArrayBuffer(svgCode));
    return 'data:image/svg+xml;base64,' + base64;
  } catch (e) {
    // 降级：手动 base64
    return fallbackBase64URI(svgCode);
  }
}

function stringToUTF8ArrayBuffer(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else if (code >= 55296 && code <= 56319) {
      // 代理对
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
  for (var j = 0; j < bytes.length; j++) {
    view[j] = bytes[j];
  }
  return buf;
}

function fallbackBase64URI(str) {
  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else {
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
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
function t6_DarkPremium(params) {
  const { title, summary, palette, H } = params;
  
  const darkBg = palette.dark;
  const gold = palette.warm;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>
    <linearGradient id="bg6" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${darkBg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1"/>
    </linearGradient>
    <radialGradient id="spot6" cx="70%" cy="30%" r="50%">
      <stop offset="0%" style="stop-color:${gold};stop-opacity:0.08"/>
      <stop offset="100%" style="stop-color:${gold};stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg6)"/>
  <rect width="${CARD_W}" height="${H}" fill="url(#spot6)"/>
  <!-- 光晕装饰 -->
  <circle cx="${CARD_W - 60}" cy="100" r="3" fill="${gold}" opacity="0.3"/>
  <circle cx="${CARD_W - 90}" cy="120" r="1.5" fill="${gold}" opacity="0.2"/>
  <circle cx="${CARD_W - 45}" cy="140" r="2" fill="${gold}" opacity="0.25"/>
  <!-- 顶部金线 -->
  <line x1="60" y1="50" x2="${CARD_W - 60}" y2="50" stroke="${gold}" stroke-width="1" opacity="0.15"/>
  <!-- 主标题 -->
  ${wrapTextSVG(truncate(title, 14), 12, '38', '52', CARD_W / 2, H * 0.37, '#E8D5B7', 'bold', 'middle')}
  <!-- 装饰线 -->
  <line x1="${CARD_W / 2 - 50}" y1="${H * 0.5}" x2="${CARD_W / 2 + 50}" y2="${H * 0.5}" stroke="${gold}" stroke-width="1" opacity="0.25" stroke-linecap="round"/>
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 30), 16, '18', '28', CARD_W / 2, H * 0.6, 'rgba(232,213,183,0.6)', 'normal', 'middle') : ''}
  <!-- 底部金线 -->
  <line x1="${CARD_W * 0.3}" y1="${H - 50}" x2="${CARD_W * 0.7}" y2="${H - 50}" stroke="${gold}" stroke-width="0.6" opacity="0.1" stroke-linecap="round"/>
  <!-- 底部星标 -->
  <text x="${CARD_W / 2}" y="${H - 30}" font-family="-apple-system,PingFang SC,sans-serif" font-size="12" fill="${gold}" text-anchor="middle" opacity="0.3">✦ ✦ ✦</text>
</svg>`;
}

// ============================================================
// 模板 7: 清新切片 — 对角线分割 + 双色
// ============================================================
function t7_Diagonal(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>
    <linearGradient id="bg7a" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${palette.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${palette.light};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <!-- 左上三角 -->
  <path d="M0 0 L${CARD_W} 0 L0 ${H * 0.6} Z" fill="url(#bg7a)"/>
  <!-- 右下区域 -->
  <path d="M${CARD_W} ${H} L${CARD_W} 0 L0 ${H * 0.6} Z" fill="${palette.accent}" opacity="0.08"/>
  <!-- 装饰点阵 -->
  <circle cx="100" cy="${H * 0.15}" r="3" fill="${palette.accent}" opacity="0.25"/>
  <circle cx="130" cy="${H * 0.15}" r="3" fill="${palette.accent}" opacity="0.2"/>
  <circle cx="160" cy="${H * 0.15}" r="3" fill="${palette.accent}" opacity="0.15"/>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 11, '36', '50', CARD_W / 2, H * 0.33, palette.dark, 'bold', 'middle')}
  <!-- 副标题 -->
  ${summary ? wrapTextSVG(truncate(summary, 28), 16, '18', '28', CARD_W / 2, H * 0.5, palette.accent, 'normal', 'middle') : ''}
  <!-- 左下小标签 -->
  <rect x="40" y="${H - 65}" width="100" height="30" rx="15" fill="${palette.accent}" opacity="0.2"/>
  <text x="90" y="${H - 50}" font-family="-apple-system,PingFang SC,sans-serif" font-size="14" fill="${palette.dark}" text-anchor="middle" dominant-baseline="middle">▸ 阅读</text>
</svg>`;
}

// ============================================================
// 模板 8: 胶片复古 — 胶片框 + 做旧色调
// ============================================================
function t8_Film(params) {
  const { title, summary, palette, H } = params;
  
  // 胶片齿孔
  let sprockets = '';
  const sprocketCount = Math.floor(H / 48);
  for (let i = 0; i < sprocketCount; i++) {
    const y = 24 + i * 48;
    sprockets += `<rect x="16" y="${y}" width="14" height="20" rx="3" fill="${palette.bg}"/>\n`;
    sprockets += `<rect x="${CARD_W - 30}" y="${y}" width="14" height="20" rx="3" fill="${palette.bg}"/>\n`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <!-- 胶片底色 -->
  <rect width="${CARD_W}" height="${H}" fill="${palette.dark}"/>
  <!-- 画面区域 -->
  <rect x="40" y="20" width="${CARD_W - 80}" height="${H - 40}" fill="${palette.bg}"/>
  <!-- 胶片齿孔 -->
  ${sprockets}
  <!-- 内部装饰 -->
  <rect x="50" y="30" width="${CARD_W - 100}" height="${H - 60}" fill="none" stroke="${palette.accent}" stroke-width="0.5" opacity="0.2" stroke-dasharray="8 8"/>
  <!-- 日期戳 -->
  <text x="${CARD_W - 100}" y="${H - 45}" font-family="Courier New,monospace" font-size="12" fill="${palette.accent}" text-anchor="end" opacity="0.3">2026.05</text>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 11, '34', '48', CARD_W / 2, H * 0.35, palette.dark, 'bold', 'middle')}
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 32), 18, '17', '26', CARD_W / 2, H * 0.55, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部日期 -->
  <text x="80" y="${H - 40}" font-family="Courier New,monospace" font-size="14" fill="${palette.accent}" opacity="0.3">NO.${Math.floor(Math.random() * 900 + 100)}</text>
</svg>`;
}

// ============================================================
// 模板 9: 气泡对话 — 对话框 + 轻松口语风
// ============================================================
function t9_Bubble(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>
    <linearGradient id="bg9" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.light};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${palette.bg};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg9)"/>
  <!-- 对话气泡背景 -->
  <path d="M${CARD_W * 0.1} ${H * 0.15} Q${CARD_W * 0.1} ${H * 0.05} ${CARD_W * 0.2} ${H * 0.05} L${CARD_W * 0.8} ${H * 0.05} Q${CARD_W * 0.9} ${H * 0.05} ${CARD_W * 0.9} ${H * 0.15} L${CARD_W * 0.9} ${H * 0.45} Q${CARD_W * 0.9} ${H * 0.55} ${CARD_W * 0.8} ${H * 0.55} L${CARD_W * 0.15} ${H * 0.55} L${CARD_W * 0.08} ${H * 0.68} L${CARD_W * 0.12} ${H * 0.55} Q${CARD_W * 0.1} ${H * 0.55} ${CARD_W * 0.1} ${H * 0.45} Z" fill="white" opacity="0.7"/>
  <!-- 小的引号装饰 -->
  <text x="${CARD_W * 0.15}" y="${H * 0.3}" font-family="Georgia,serif" font-size="${H * 0.12}" fill="${palette.accent}" opacity="0.15">"</text>
  <!-- 标题在气泡中 -->
  ${wrapTextSVG(truncate(title, 14), 12, '32', '45', CARD_W / 2, H * 0.32, palette.dark, 'bold', 'middle')}
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 28), 18, '16', '24', CARD_W / 2, H * 0.7, palette.accent, 'normal', 'middle') : ''}
  <!-- 小装饰点 -->
  <circle cx="${CARD_W * 0.65}" cy="${H - 60}" r="6" fill="${palette.accent}" opacity="0.2"/>
  <circle cx="${CARD_W * 0.7}" cy="${H - 60}" r="4" fill="${palette.accent}" opacity="0.15"/>
  <circle cx="${CARD_W * 0.74}" cy="${H - 60}" r="3" fill="${palette.accent}" opacity="0.1"/>
</svg>`;
}

// ============================================================
// 模板 10: 网格拼贴 — 色块拼接 + 现代感
// ============================================================
function t10_GridCollage(params) {
  const { title, summary, palette, H } = params;
  
  const blockW = CARD_W / 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <!-- 网格色块 -->
  <rect x="0" y="0" width="${blockW}" height="${H * 0.35}" fill="${palette.accent}" opacity="0.12"/>
  <rect x="${blockW * 2}" y="${H * 0.35}" width="${blockW}" height="${H * 0.35}" fill="${palette.warm}" opacity="0.12"/>
  <rect x="${blockW}" y="${H * 0.7}" width="${blockW}" height="${H * 0.3}" fill="${palette.light}" opacity="0.5"/>
  <rect x="0" y="${H * 0.35}" width="${blockW * 0.5}" height="${H * 0.35}" fill="${palette.accent}" opacity="0.06"/>
  <!-- 白底卡片区 -->
  <rect x="${CARD_W * 0.08}" y="${H * 0.08}" width="${CARD_W * 0.84}" height="${H * 0.84}" fill="white" opacity="0.85" rx="4"/>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 12, '34', '50', CARD_W / 2, H * 0.33, palette.dark, 'bold', 'middle')}
  <!-- 分隔 -->
  <rect x="${CARD_W / 2 - 14}" y="${H * 0.48}" width="28" height="4" rx="2" fill="${palette.accent}" opacity="0.4"/>
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 32), 20, '17', '26', CARD_W / 2, H * 0.6, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部页码 -->
  <text x="${CARD_W - 60}" y="${H - 30}" font-family="-apple-system,PingFang SC,sans-serif" font-size="12" fill="${palette.accent}" text-anchor="end" opacity="0.3">/ 0${Math.floor(Math.random() * 9) + 1}</text>
</svg>`;
}

// ============================================================
// 模板 11: 水彩晕染 — 柔和水彩效果
// ============================================================
function t11_Watercolor(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>
    <filter id="blur11">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
    <filter id="blur11b">
      <feGaussianBlur stdDeviation="25"/>
    </filter>
    <radialGradient id="wc1" cx="30%" cy="40%" r="60%">
      <stop offset="0%" style="stop-color:${palette.accent};stop-opacity:0.2"/>
      <stop offset="100%" style="stop-color:${palette.accent};stop-opacity:0"/>
    </radialGradient>
    <radialGradient id="wc2" cx="70%" cy="60%" r="50%">
      <stop offset="0%" style="stop-color:${palette.warm};stop-opacity:0.15"/>
      <stop offset="100%" style="stop-color:${palette.warm};stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="${CARD_W}" height="${H}" fill="${palette.bg}"/>
  <!-- 水彩晕染色块 -->
  <ellipse cx="${CARD_W * 0.35}" cy="${H * 0.4}" rx="280" ry="200" fill="url(#wc1)"/>
  <ellipse cx="${CARD_W * 0.65}" cy="${H * 0.55}" rx="240" ry="180" fill="url(#wc2)"/>
  <ellipse cx="${CARD_W * 0.15}" cy="${H * 0.8}" rx="150" ry="100" fill="${palette.light}" opacity="0.3" filter="url(#blur11b)"/>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 12, '36', '50', CARD_W / 2, H * 0.36, palette.dark, 'bold', 'middle')}
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 28), 16, '18', '28', CARD_W / 2, H * 0.58, palette.accent, 'normal', 'middle') : ''}
  <!-- 装饰小点 -->
  <circle cx="${CARD_W * 0.2}" cy="${H * 0.15}" r="2.5" fill="${palette.accent}" opacity="0.2"/>
  <circle cx="${CARD_W * 0.25}" cy="${H * 0.13}" r="1.8" fill="${palette.accent}" opacity="0.15"/>
</svg>`;
}

// ============================================================
// 模板 12: 圆环聚焦 — 同心圆引导视线
// ============================================================
function t12_RingFocus(params) {
  const { title, summary, palette, H } = params;
  const cx = CARD_W / 2;
  const cy = H * 0.42;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>
    <linearGradient id="bg12" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.light};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${palette.bg};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg12)"/>
  <!-- 同心圆环 -->
  <circle cx="${cx}" cy="${cy}" r="220" fill="none" stroke="${palette.accent}" stroke-width="0.6" opacity="0.08"/>
  <circle cx="${cx}" cy="${cy}" r="180" fill="none" stroke="${palette.accent}" stroke-width="0.8" opacity="0.1"/>
  <circle cx="${cx}" cy="${cy}" r="140" fill="none" stroke="${palette.accent}" stroke-width="1" opacity="0.15"/>
  <circle cx="${cx}" cy="${cy}" r="50" fill="${palette.accent}" opacity="0.06"/>
  <!-- 标题在圆心 -->
  ${wrapTextSVG(truncate(title, 14), 10, '36', '50', cx, H * 0.3, palette.dark, 'bold', 'middle')}
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 24), 16, '17', '26', cx, H * 0.62, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部装饰 -->
  <text x="${CARD_W / 2}" y="${H - 33}" font-family="Georgia,serif" font-size="14" fill="${palette.accent}" text-anchor="middle" opacity="0.2">Find Your Missing Pieces</text>
</svg>`;
}

// ============================================================
// 模板 13: 书签条带 — 彩色书签 + 文字卡片
// ============================================================
function t13_Bookmark(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <rect width="${CARD_W}" height="${H}" fill="${palette.bg}"/>
  <!-- 左侧彩色书签条 -->
  <rect x="0" y="0" width="16" height="${H}" fill="${palette.accent}" opacity="0.6"/>
  <rect x="16" y="0" width="4" height="${H}" fill="${palette.accent}" opacity="0.2"/>
  <!-- 顶部横条书签 -->
  <rect x="40" y="40" width="120" height="36" rx="18" fill="${palette.accent}" opacity="0.15"/>
  <text x="100" y="58" font-family="-apple-system,PingFang SC,sans-serif" font-size="14" fill="${palette.dark}" text-anchor="middle" dominant-baseline="middle">✦ 灵感碎片</text>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 12, '34', '50', CARD_W / 2, H * 0.33, palette.dark, 'bold', 'middle')}
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 28), 18, '17', '26', CARD_W / 2, H * 0.55, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部彩条 -->
  <rect x="${CARD_W * 0.15}" y="${H - 18}" width="${CARD_W * 0.7}" height="3" rx="1.5" fill="${palette.warm}" opacity="0.3"/>
  <rect x="${CARD_W * 0.2}" y="${H - 28}" width="${CARD_W * 0.6}" height="2" rx="1" fill="${palette.accent}" opacity="0.2"/>
</svg>`;
}

// ============================================================
// 模板 14: 窗格光影 — 模拟光线透过窗户
// ============================================================
function t14_WindowLight(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>
    <linearGradient id="bg14" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${palette.light};stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="ray14" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.5"/>
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg14)"/>
  <!-- 光线斜射效果 -->
  <polygon points="${CARD_W * 0.05},0 ${CARD_W * 0.5},0 0,${H * 0.6} 0,${H * 0.1}" fill="url(#ray14)"/>
  <!-- 窗格十字 -->
  <line x1="${CARD_W / 2}" y1="0" x2="${CARD_W / 2}" y2="${H}" stroke="${palette.accent}" stroke-width="0.5" opacity="0.06"/>
  <line x1="0" y1="${H / 2}" x2="${CARD_W}" y2="${H / 2}" stroke="${palette.accent}" stroke-width="0.5" opacity="0.06"/>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 12, '36', '50', CARD_W / 2, H * 0.32, palette.dark, 'bold', 'middle')}
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 28), 16, '18', '28', CARD_W / 2, H * 0.55, palette.accent, 'normal', 'middle') : ''}
  <!-- 小太阳图标 -->
  <circle cx="${CARD_W * 0.85}" cy="${H * 0.18}" r="20" fill="${palette.warm}" opacity="0.15"/>
  <circle cx="${CARD_W * 0.85}" cy="${H * 0.18}" r="10" fill="${palette.warm}" opacity="0.25"/>
</svg>`;
}

// ============================================================
// 模板 15: 折纸艺术 — 折角效果
// ============================================================
function t15_Origami(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <defs>
    <linearGradient id="bg15a" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${palette.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_W}" height="${H}" fill="url(#bg15a)"/>
  <!-- 折角效果 - 右上 -->
  <polygon points="${CARD_W},0 ${CARD_W - 100},0 ${CARD_W},100" fill="${palette.light}" opacity="0.7"/>
  <polygon points="${CARD_W},0 ${CARD_W - 80},0 ${CARD_W},80" fill="${palette.accent}" opacity="0.12"/>
  <!-- 左下彩色三角 -->
  <polygon points="0,${H} 0,${H - 120} 120,${H}" fill="${palette.accent}" opacity="0.08"/>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 11, '34', '50', CARD_W / 2, H * 0.35, palette.dark, 'bold', 'middle')}
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 28), 18, '17', '26', CARD_W / 2, H * 0.55, palette.accent, 'normal', 'middle') : ''}
  <!-- 底部小三角装饰 -->
  <polygon points="${CARD_W * 0.45},${H - 35} ${CARD_W * 0.5},${H - 25} ${CARD_W * 0.55},${H - 35}" fill="${palette.accent}" opacity="0.15"/>
</svg>`;
}

// ============================================================
// 模板 16: 禅意留白 — 极致简约
// ============================================================
function t16_ZenMinimal(params) {
  const { title, summary, palette, H } = params;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}">
  <rect width="${CARD_W}" height="${H}" fill="${palette.bg}"/>
  <!-- 极细顶部线 -->
  <line x1="${CARD_W * 0.15}" y1="${H * 0.22}" x2="${CARD_W * 0.85}" y2="${H * 0.22}" stroke="${palette.accent}" stroke-width="0.5" opacity="0.15"/>
  <!-- 标题 -->
  ${wrapTextSVG(truncate(title, 14), 14, '34', '50', CARD_W / 2, H * 0.34, palette.dark, 'bold', 'middle')}
  <!-- 单点 -->
  <circle cx="${CARD_W / 2}" cy="${H * 0.48}" r="3" fill="${palette.accent}" opacity="0.25"/>
  <!-- 摘要 -->
  ${summary ? wrapTextSVG(truncate(summary, 36), 22, '16', '26', CARD_W / 2, H * 0.6, palette.accent, 'normal', 'middle') : ''}
  <!-- 极细底部线 -->
  <line x1="${CARD_W * 0.25}" y1="${H - 45}" x2="${CARD_W * 0.75}" y2="${H - 45}" stroke="${palette.accent}" stroke-width="0.5" opacity="0.1"/>
</svg>`;
}

// ============================================================
// 模板注册表
// ============================================================
const TEMPLATES = [
  { name: '极简几何',   fn: t1_Geometric,    weight: 1 },
  { name: '文艺渐变',   fn: t2_Gradient,      weight: 1 },
  { name: '手账笔记',   fn: t3_Notebook,      weight: 1 },
  { name: '杂志排版',   fn: t4_Magazine,      weight: 1 },
  { name: '莫兰迪色',   fn: t5_Morandi,       weight: 1 },
  { name: '暗色高级感', fn: t6_DarkPremium,   weight: 1 },
  { name: '清新切片',   fn: t7_Diagonal,       weight: 1 },
  { name: '胶片复古',   fn: t8_Film,          weight: 1 },
  { name: '气泡对话',   fn: t9_Bubble,        weight: 1 },
  { name: '网格拼贴',   fn: t10_GridCollage,  weight: 1 },
  { name: '水彩晕染',   fn: t11_Watercolor,   weight: 1 },
  { name: '圆环聚焦',   fn: t12_RingFocus,    weight: 1 },
  { name: '书签条带',   fn: t13_Bookmark,     weight: 1 },
  { name: '窗格光影',   fn: t14_WindowLight,  weight: 1 },
  { name: '折纸艺术',   fn: t15_Origami,      weight: 1 },
  { name: '禅意留白',   fn: t16_ZenMinimal,   weight: 1 },
];

// ============================================================
// 调色板轮转
// ============================================================
const PALETTE_KEYS = Object.keys(PALETTES);

/**
 * 基于索引选择调色板
 */
function pickPalette(index) {
  return PALETTES[PALETTE_KEYS[index % PALETTE_KEYS.length]];
}

/**
 * 基于颜色的调色板映射
 * 将项目的5个品牌色映射到对应的调色板
 */
function paletteFromColor(color) {
  const map = {
    '#7785AC': PALETTES.lavender,
    '#360568': PALETTES.dusk,
    '#5b2a86': PALETTES.dusk,
    '#9ac6c5': PALETTES.sage,
    '#a5e6ba': PALETTES.mint,
  };
  return map[color] || PALETTES.lavender;
}

// ============================================================
// 主渲染函数
// ============================================================

/**
 * 根据标题哈希选择模板，保证同一标题总用同一模板
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 转32位整数
  }
  return Math.abs(hash);
}

/**
 * 渲染卡片图片为 SVG data URI
 * @param {Object} params
 * @param {string} params.title - 卡片标题
 * @param {string} params.summary - 卡片摘要
 * @param {string} params.color - 品牌色
 * @param {number} params.height - 图片高度
 * @param {number} [params.templateIndex] - 指定模板索引（可选）
 * @returns {string} SVG data URI
 */
function renderCardSVG({ title, summary, color, height, templateIndex }) {
  try {
    const H = height || 680;
    const palette = paletteFromColor(color || '#7785AC');

    // 基于标题哈希选择模板（保证一致性），或手动指定
    let tplIndex;
    if (templateIndex !== undefined && templateIndex >= 0 && templateIndex < TEMPLATES.length) {
      tplIndex = templateIndex;
    } else {
      tplIndex = hashString(title || 'default') % TEMPLATES.length;
    }

    const template = TEMPLATES[tplIndex];
    const svg = template.fn({
      title: title || '',
      summary: summary || '',
      palette: palette,
      H: H,
    });

    var uri = svgToDataURI(svg);
    // 防御：如果生成的 URI 太短（可能是空 SVG），用兜底
    if (uri.length < 400) {
      return makeFallbackSVG(title, height);
    }
    return uri;
  } catch (e) {
    console.warn('[card-templates] SVG 生成异常，使用兜底:', e);
    return makeFallbackSVG(title, height);
  }
}

/**
 * 终极兜底 SVG — 纯代码生成，不依赖任何模板函数
 * 无论标题是什么、字符多奇怪，这条保证不出错
 */
function makeFallbackSVG(title, height) {
  var h = height || 680;
  var safeTitle = String(title || '卡片').replace(/[<>&"]/g, '').slice(0, 18);
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="680" height="' + h + '" viewBox="0 0 680 ' + h + '">' +
    '<defs><linearGradient id="fbg" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" style="stop-color:#7785AC;stop-opacity:1"/>' +
    '<stop offset="100%" style="stop-color:#5b2a86;stop-opacity:1"/>' +
    '</linearGradient></defs>' +
    '<rect width="680" height="' + h + '" fill="url(#fbg)" rx="0"/>' +
    '<circle cx="560" cy="' + (h * 0.15) + '" r="160" fill="rgba(255,255,255,0.06)"/>' +
    '<circle cx="140" cy="' + (h * 0.82) + '" r="100" fill="rgba(255,255,255,0.05)"/>' +
    '<text x="340" y="' + (h * 0.4) + '" font-family="-apple-system,PingFang SC,sans-serif" font-size="38" fill="white" font-weight="bold" text-anchor="middle">' + safeTitle + '</text>' +
    '<line x1="290" y1="' + (h * 0.52) + '" x2="390" y2="' + (h * 0.52) + '" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round"/>' +
    '<text x="340" y="' + (h - 45) + '" font-family="-apple-system,PingFang SC,sans-serif" font-size="14" fill="rgba(255,255,255,0.4)" text-anchor="middle">拾遗补阙</text>' +
    '</svg>';
  return svgToDataURI(svg);
}

/**
 * 获取模板总数
 */
function getTemplateCount() {
  return TEMPLATES.length;
}

/**
 * 获取模板名称列表
 */
function getTemplateNames() {
  return TEMPLATES.map(t => t.name);
}

module.exports = {
  renderCardSVG,
  getTemplateCount,
  getTemplateNames,
  makeFallbackSVG,
  PALETTES,
  TEMPLATES,
  CARD_W,
};
