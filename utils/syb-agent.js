// utils/syb-agent.js - 拾遗补阙 智能体
// 负责将 API 返回的学术文献转换为小红书风格卡片
// 
// 方式一：直接分析 API 返回的内容，按字段渲染到卡片
// 方式二：对每篇文章链接 → 联网搜索 + 结合用户论文初稿 → 生成专属卡片

const sybApi = require('./syb-api');
const canvasRender = require('./canvas-render');

// DeepSeek API 配置（复用 config.js）
const apiConfig = require('./config');
const DS_BASE_URL = apiConfig.apiBaseUrl;
const DS_API_KEY = apiConfig.apiKey;
const DS_MODEL = apiConfig.model;

// ============================ 工具函数 ============================

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// ============================ DeepSeek 请求 ============================

/**
 * 调用 DeepSeek Chat API
 */
function dsChat(messages, options) {
  return new Promise(function (resolve, reject) {
    var data = {
      model: DS_MODEL,
      messages: messages,
      stream: false
    };
    if (options && options.jsonMode) {
      data.response_format = { type: 'json_object' };
    }
    wx.request({
      url: DS_BASE_URL + '/v1/chat/completions',
      method: 'POST',
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DS_API_KEY
      },
      timeout: (options && options.timeout) || 60000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.choices) {
          resolve(res.data);
        } else {
          reject({
            code: res.statusCode,
            message: (res.data && res.data.error && res.data.error.message) || 'DeepSeek 请求失败'
          });
        }
      },
      fail: function (err) {
        reject({ code: -1, message: err.errMsg || '网络请求失败' });
      }
    });
  });
}

// ============================ 方式一：直接解析 API 内容 → 卡片 ============================

/**
 * 方式一：从 API 分析结果中提取内容，直接生成卡片
 * - 分析摘要 → 一张总览卡片
 * - 每篇文章 → 一张卡片（最多 N 张）
 * 
 * @param {Object} apiResult - syb-api.analyze() 返回的完整结果
 * @param {string} userText - 用户原始输入文本
 * @returns {Array} 卡片数组
 */
function method1_DirectParse(apiResult, userText) {
  var cards = [];
  var ts = Date.now();
  var summary = sybApi.extractSummary(apiResult);
  var title = sybApi.extractTitle(apiResult);
  var papers = sybApi.extractPapers(apiResult);
  var colors = ['#7785AC', '#360568', '#5b2a86', '#9ac6c5', '#a5e6ba'];

  // 卡片0：分析总览
  if (summary) {
    cards.push({
      id: 'syb_overview_' + ts,
      title: title || '📋 文献分析总览',
      summary: summary.slice(0, 100),
      content: '## 📋 分析总览\n\n' + summary + '\n\n> 基于您提交的内容，从 ' + (papers.length || '多') + ' 个学术数据源中检索到相关文献。',
      category: '拾遗补阙',
      timestamp: ts,
      imageColor: colors[0],
      source: 'syb_direct'
    });
  }

  // 为每篇文章生成一张卡片
  papers.forEach(function (paper, i) {
    var p = sybApi.normalizePaper(paper);
    if (!p.title || p.title === '未知标题') return;

    var authorStr = '';
    if (p.authors) {
      if (Array.isArray(p.authors)) {
        authorStr = p.authors.slice(0, 3).join(', ');
        if (p.authors.length > 3) authorStr += ' 等';
      } else {
        authorStr = String(p.authors).slice(0, 60);
      }
    }

    var contentParts = [];
    if (authorStr) contentParts.push('**作者**: ' + authorStr);
    if (p.year) contentParts.push('**年份**: ' + p.year);
    if (p.source) contentParts.push('**来源**: ' + p.source);
    if (p.abstract) contentParts.push('\n### 📝 摘要\n\n' + p.abstract);
    // 强制输出论文信息板块
    var linkInfo = [];
    if (p.title) linkInfo.push('> **标题**: ' + p.title);
    if (p.url) linkInfo.push('> **链接**: ' + p.url);
    if (p.doi) linkInfo.push('> **DOI**: ' + p.doi);
    if (linkInfo.length > 0) {
      contentParts.push('\n## 📎 论文信息\n\n' + linkInfo.join('\n'));
    }
    if (p.citation_count > 0) contentParts.push('\n📊 被引 ' + p.citation_count + ' 次');

    cards.push({
      id: 'syb_paper_' + ts + '_' + i,
      title: p.title.slice(0, 40),
      summary: p.abstract ? p.abstract.slice(0, 80) : (authorStr || '学术文献'),
      content: contentParts.join('\n\n'),
      category: '拾遗补阙 · 文献',
      timestamp: ts - i * 60000,
      imageColor: colors[(i + 1) % colors.length],
      source: 'syb_direct',
      paperUrl: p.url || p.doi || '',
      paperTitle: p.title || '',
      paperDoi: p.doi
    });
  });

  return cards;
}

// ============================ 方式二：智能体搜索 → 深度卡片 ============================

/**
 * 方式一的 Agent 增强版：
 * 取每篇文章摘要 + 用户论文初稿，通过 DeepSeek 生成更有深度的卡片内容
 * 
 * @param {Object} apiResult - syb-api.analyze() 返回的完整结果
 * @param {string} userText - 用户原始论文/想法文本
 * @param {Function} onCardGenerated - 每生成一张卡片就回调 (card)
 * @param {number} maxCards - 最多生成多少张卡片（默认20）
 * @returns {Promise<Array>} 生成的卡片数组
 */
function method1_AgentEnhanced(apiResult, userText, onCardGenerated, maxCards) {
  maxCards = maxCards || 5;
  var papers = sybApi.extractPapers(apiResult);
  var summary = sybApi.extractSummary(apiResult);
  var generatedCards = [];
  var ts = Date.now();
  var colors = ['#7785AC', '#360568', '#5b2a86', '#9ac6c5', '#a5e6ba'];

  // 对摘要做一张总览卡片的增强
  var overviewCard = null;
  if (summary) {
    overviewCard = {
      id: 'syb_ae_overview_' + ts,
      title: '📋 文献分析总览',
      summary: summary.slice(0, 100),
      content: '## 📋 分析总览\n\n' + summary,
      category: '拾遗补阙 · 总览',
      timestamp: ts,
      imageColor: colors[0],
      source: 'syb_agent'
    };
  }

  // 限制卡片数量
  var papersToProcess = papers.slice(0, maxCards);

  // 串行处理每篇文章（避免 API 限流）
  function processSequential(index) {
    if (index >= papersToProcess.length) {
      // 所有处理完毕
      var allCards = overviewCard ? [overviewCard].concat(generatedCards) : generatedCards;
      return Promise.resolve(allCards);
    }

    var paper = sybApi.normalizePaper(papersToProcess[index]);

    return generateSingleDeepCard(paper, userText, index, ts, colors).then(function (card) {
      if (card) {
        generatedCards.push(card);
        if (onCardGenerated) {
          try { onCardGenerated(card); } catch (e) {}
        }
      }
      // 卡片间延迟 1.5s，防止多轮 DeepSeek 请求堆积
      return delay(1500).then(function () {
        return processSequential(index + 1);
      });
    }).catch(function () {
      // 某张卡片生成失败，用简单卡片兜底
      var fallback = makeFallbackCard(paper, index, ts, colors);
      if (fallback) {
        generatedCards.push(fallback);
        if (onCardGenerated) {
          try { onCardGenerated(fallback); } catch (e) {}
        }
      }
      return processSequential(index + 1);
    });
  }

  return processSequential(0).then(function (allCards) {
    return allCards;
  });
}

/**
 * 方式二：对每篇文章，调用 DeepSeek 深度生成一张卡片
 * 输入：文章信息 + 用户论文初稿
 * 输出：一张高质量的关联分析卡片
 */
function generateSingleDeepCard(paper, userText, index, ts, colors) {
  var paperInfo = [
    '文章标题：' + (paper.title || '未知'),
    '作者：' + (paper.authors || '未知'),
    '年份：' + (paper.year || '未知'),
    '来源：' + (paper.source || '未知'),
    '摘要：' + (paper.abstract || '无摘要'),
    '链接：' + (paper.url || paper.doi || '无'),
  ].join('\n');

  var systemPrompt = '你是"拾遗补阙"智能体——一位擅长将学术文献与用户研究关联起来的分析助手。' +
    '你收到一篇文章的信息和用户正在写的论文/想法，你的任务是为用户生成一张"小红书风格"的关联分析卡片。' +
    '\n\n要求：' +
    '\n1. 标题：12-22字，要有"这篇文章与你研究的惊人关联"的惊喜感' +
    '\n2. 摘要：25-50字，点出这篇文章对用户研究的核心价值' +
    '\n3. 内容：Markdown 格式，包含以下板块：' +
    '\n   - ## 🔗 与你的研究有何关联（这篇文章的哪些观点/方法/数据可以直接支撑或挑战用户的研究）' +
    '\n   - ## 💡 你可以借用的 2-3 个具体思路（从文章中提取可操作的研究启发）' +
    '\n   - ## 📖 建议阅读重点（告诉用户这篇文章最值得精读的部分）' +
    '\n   - ## 📎 论文信息（**必须包含**原文链接和完整标题，格式：\n     > **标题**: xxx\n     > **链接**: xxx）' +
    '\n4. 口吻：像一位懂你的学术导师，温和但精准，不说套话' +
    '\n5. paper_title：必须给出论文的完整原始标题' +
    '\n6. paper_link：必须给出论文的原始链接（URL 或 DOI）' +
    '\n\n请返回 JSON：{"title":"...","summary":"...","content":"...","paper_title":"...","paper_link":"..."}' +
    '\n⚠️ paper_title 和 paper_link 必须与用户输入中提供的信息一致，不得编造。';

  var userPrompt = '以下是一篇学术文献的信息：\n\n' + paperInfo +
    '\n\n以下是用户正在撰写的论文/想法：\n\n' + (userText || '（无用户输入）') +
    '\n\n请基于以上信息生成一张关联分析卡片。';

  return dsChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { jsonMode: true, timeout: 45000 }).then(function (res) {
    var raw = ((res.choices || [])[0] || {}).message || {};
    var parsed;
    try {
      parsed = JSON.parse(raw.content || '{}');
    } catch (e) {
      return null;
    }

    if (!parsed.title && !parsed.content) return null;

    return {
      id: 'syb_ae_paper_' + ts + '_' + index,
      title: parsed.title || paper.title.slice(0, 40),
      summary: parsed.summary || (paper.abstract || '').slice(0, 80),
      content: parsed.content || '',
      category: '拾遗补阙 · 深度关联',
      timestamp: ts - index * 60000,
      imageColor: colors[(index + 1) % colors.length],
      source: 'syb_agent',
      paperUrl: parsed.paper_link || paper.url || paper.doi || '',
      paperDoi: paper.doi,
      paperTitle: parsed.paper_title || paper.title || ''
    };
  });
}

/**
 * 兜底卡片：当 DeepSeek 生成失败时，用文章原始信息生成卡片
 */
function makeFallbackCard(paper, index, ts, colors) {
  if (!paper || !paper.title || paper.title === '未知标题') return null;

  var contentParts = [];
  if (paper.authors) contentParts.push('**作者**: ' + paper.authors);
  if (paper.year) contentParts.push('**年份**: ' + paper.year);
  if (paper.abstract) contentParts.push('\n### 📝 摘要\n\n' + paper.abstract);
  if (paper.url) contentParts.push('\n**链接**: ' + paper.url);

  return {
    id: 'syb_fb_paper_' + ts + '_' + index,
    title: paper.title.slice(0, 40),
    summary: (paper.abstract || '').slice(0, 80),
    content: contentParts.join('\n\n'),
    category: '拾遗补阙 · 文献',
    timestamp: ts - index * 60000,
    imageColor: colors[(index + 1) % colors.length],
    source: 'syb_agent_fallback',
    paperUrl: paper.url || paper.doi || '',
    paperTitle: paper.title || '',
    paperDoi: paper.doi
  };
}

// ============================ 主入口 ============================

/**
 * 完整流程：提交文本 → 等待 API 分析 → 生成卡片
 * 
 * @param {string} userText - 用户论文/想法文本
 * @param {Object} options
 * @param {string} options.mode - 分析模式: 'quick' | 'standard' | 'fury'（默认 standard）
 * @param {string} options.method - 卡片生成方式: 'direct'(方式一) | 'agent'(方式二，默认)
 * @param {number} options.maxCards - 最多生成卡片数（默认20）
 * @param {Function} options.onProgress - API 进度回调 (progress: 0-100)
 * @param {Function} options.onCardGenerated - 每生成一张卡片回调 (card)
 * @returns {Promise<Object>} { apiResult, cards }
 */
function runFullPipeline(userText, options) {
  options = options || {};
  var mode = options.mode || 'standard';
  var method = options.method || 'agent';
  var maxCards = options.maxCards || 5;
  var onProgress = options.onProgress;
  var onCardGenerated = options.onCardGenerated;

  // 第一阶段：调用拾遗补阙 API
  var apiResult = null;

  return sybApi.analyze(userText, mode, onProgress).then(function (result) {
    apiResult = result;

    // 第二阶段：根据方法生成卡片
    if (method === 'direct') {
      var directCards = method1_DirectParse(apiResult, userText);
      return Promise.resolve({
        apiResult: apiResult,
        cards: directCards
      });
    } else {
      // agent 模式（方式二）
      return method1_AgentEnhanced(apiResult, userText, onCardGenerated, maxCards).then(function (agentCards) {
        return {
          apiResult: apiResult,
          cards: agentCards
        };
      });
    }
  }).catch(function (err) {
    console.error('[syb-agent] 完整流程失败:', err);
    return Promise.reject(err);
  });
}

/**
 * 仅使用 DeepSeek 从文章链接生成卡片（不依赖拾遗补阙 API 结果）
 * 用于用户手动输入文章链接的场景
 * 
 * @param {Array} articleLinks - 文章链接数组 [{ url, title? }]
 * @param {string} userText - 用户论文/想法文本
 * @param {Function} onCardGenerated - 每生成一张卡片回调
 * @returns {Promise<Array>} 卡片数组
 */
function generateCardsFromLinks(articleLinks, userText, onCardGenerated) {
  var ts = Date.now();
  var colors = ['#7785AC', '#360568', '#5b2a86', '#9ac6c5', '#a5e6ba'];
  var cards = [];

  function processSequential(i) {
    if (i >= articleLinks.length) return Promise.resolve(cards);

    var link = articleLinks[i];
    var systemPrompt = '你是"拾遗补阙"智能体。用户给了你一个文章链接和一个论文/想法，你的任务是生成一张卡片。' +
      '\n\n要求：' +
      '\n- 标题12-22字，要有"这篇文章和你的研究撞出了火花"的惊喜感' +
      '\n- 摘要25-50字' +
      '\n- 内容Markdown：## 🔗 关联分析 | ## 💡 可借用的思路 | ## 📖 阅读建议 | ## 📎 论文信息（**必须包含**原文链接和完整标题）' +
      '\n- paper_title：必须给出论文的完整原始标题' +
      '\n- paper_link：必须给出论文的原始链接' +
      '\n\n返回JSON：{"title":"...","summary":"...","content":"...","paper_title":"...","paper_link":"..."}' +
      '\n⚠️ paper_title 和 paper_link 必须与用户输入中提供的信息一致，不得编造。';

    var userPrompt = '文章链接：' + (link.url || link) +
      '\n文章标题：' + (link.title || '未知') +
      '\n\n用户论文/想法：\n' + (userText || '无') +
      '\n\n请基于以上信息生成关联分析卡片。';

    return dsChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { jsonMode: true, timeout: 45000 }).then(function (res) {
      var raw = ((res.choices || [])[0] || {}).message || {};
      var parsed;
      try { parsed = JSON.parse(raw.content || '{}'); } catch (e) { parsed = {}; }

      if (parsed.title || parsed.content) {
        var card = {
          id: 'syb_link_' + ts + '_' + i,
          title: parsed.title || '关联文章',
          summary: parsed.summary || '',
          content: parsed.content || '',
          category: '拾遗补阙 · 链接分析',
          timestamp: ts - i * 60000,
          imageColor: colors[i % colors.length],
          source: 'syb_link_agent',
          paperUrl: parsed.paper_link || link.url || link,
          paperTitle: parsed.paper_title || link.title || ''
        };
        cards.push(card);
        if (onCardGenerated) {
          try { onCardGenerated(card); } catch (e) {}
        }
      }
      return delay(1500).then(function () {
        return processSequential(i + 1);
      });
    }).catch(function () {
      return delay(1500).then(function () {
        return processSequential(i + 1);
      });
    });
  }

  return processSequential(0);
}

// ============================ 卡片图片渲染 ============================

/**
 * 为卡片列表生成 SVG 图片
 * @param {Array} cards - 卡片数组
 * @returns {Array} 带 image 字段的卡片数组
 */
function renderCardImages(cards) {
  var presetHeights = [540, 620, 720, 800, 900];
  return cards.map(function (card, i) {
    var cardCopy = Object.assign({}, card);
    if (!cardCopy.imageColor) {
      cardCopy.imageColor = '#7785AC';
    }
    cardCopy.cardHeight = presetHeights[i % presetHeights.length];
    try {
      cardCopy.image = canvasRender.generatePlaceholderImage({
        title: cardCopy.title,
        summary: cardCopy.summary,
        color: cardCopy.imageColor,
        height: cardCopy.cardHeight
      });
    } catch (e) {
      cardCopy.image = canvasRender.makeCanvasFallback(cardCopy.title, cardCopy.cardHeight);
    }
    return cardCopy;
  });
}

module.exports = {
  // 方式一：直接解析
  method1_DirectParse: method1_DirectParse,
  // 方式一增强：Agent 深度生成
  method1_AgentEnhanced: method1_AgentEnhanced,
  // 方式二：从链接生成
  generateCardsFromLinks: generateCardsFromLinks,
  // 完整流水线
  runFullPipeline: runFullPipeline,
  // 工具
  renderCardImages: renderCardImages,
  generateSingleDeepCard: generateSingleDeepCard
};
