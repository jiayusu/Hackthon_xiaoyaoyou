// main.js - 主页面（相关/历史记录/洞察）
const api = require('../../utils/api');
const canvasRender = require('../../utils/canvas-render');
const mdParser = require('../../utils/md-parser');
const sybAgent = require('../../utils/syb-agent');
const app = getApp();

// 预设卡片高度，用于瀑布流变化
const CARD_HEIGHTS = canvasRender.PRESET_HEIGHTS || [500, 620, 740, 860, 980];

// 渲染上限：两列合计最多 60 张（每列 30）
const MAX_RENDER_CARDS = 60;
// globalData.currentCards 最大保留数
const MAX_GLOBAL_CARDS = 100;

Page({
  data: {
    // 顶部栏
    activeTab: 0, // 0=相关, 1=历史记录, 2=洞察
    tabs: ['相关', '历史记录', '洞察'],

    // 状态栏高度
    statusBarHeight: 0,
    topBarHeight: 0,

    // --- 相关页 ---
    leftCards: [],
    rightCards: [],
    isRefreshing: false,
    hasMoreCards: true,
    currentOffset: 0,
    isTopRefreshing: false,

    // --- 卡片详情 ---
    showCardDetail: false,
    detailCard: null,
    detailImage: '',
    detailNotes: [],
    currentNote: '',
    isFavorited: false,
    detailContentNodes: [],
    detailContentPlain: '',

    // --- 收藏提示 ---
    showFavToast: false,

    // --- 历史记录 ---
    historyLeftCards: [],
    historyRightCards: [],

    // --- 洞察 ---
    insightText: '',
    insightLoading: false,
    insightStreaming: false,
    insightContentNodes: [],
    insightTaskActive: false,   // 是否后台正在生成洞察

    // --- 补充文献（混入主线卡片流） ---
    suppPollTimer: null,        // 轮询定时器

    // --- 加载弹窗 ---
    showLoading: false,
    loadingProgress: 0,
    loadingText: '',

    // --- 洞察历史弹窗 ---
    showInsightHistory: false,
    insightHistoryList: []
  },

  // 定时器追踪（用于 onHide 清理）
  _timers: [],

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20,
      topBarHeight: 80
    });
    // 加载首次卡片数据
    this.loadInitialCards();
    // 历史记录延后加载，避免与首屏卡片渲染争抢 setData
    var that = this;
    this._setTimeout(function () {
      that.loadHistory();
    }, 600);
  },

  onHide() {
    // 停止轮询
    if (this.data.suppPollTimer) {
      clearInterval(this.data.suppPollTimer);
      this.data.suppPollTimer = null;
    }
    // 清除所有待执行定时器
    this._clearAllTimers();
    // 释放大数组，减少内存占用
    this.setData({
      leftCards: [],
      rightCards: [],
      historyLeftCards: [],
      historyRightCards: [],
      insightContentNodes: [],
      detailNotes: [],
      detailContentPlain: '',
      detailCard: null,
      detailImage: ''
    });
    // 清除历史缓存强制重新加载
    this._historyCache = null;
    this._lastParsedInsightText = '';
  },

  onShow() {
    // 从 upload 页生成新卡片后返回，需要强制刷新
    if (app.globalData.needRefreshCards) {
      app.globalData.needRefreshCards = false;
      app.globalData.insightTask = { active: false, loading: false, text: '', cardCount: 0 };
      const cards = app.globalData.currentCards;
      this.setData({ leftCards: [], rightCards: [], currentOffset: 0, hasMoreCards: true, insightTaskActive: false });
      if (cards && cards.length > 0) {
        this.renderCardsToColumns(cards);
      }
      // 历史记录延后
      var that = this;
      this._setTimeout(function () { that.loadHistory(); }, 800);
      this.setData({
        insightHistoryList: app.globalData.insightHistory || []
      });

      // 补充文献延后混入，给首屏渲染留出时间
      // upload 页的 pipeline 等待 55s 才跳转，此时 supplementaryStatus 已是 done
      // 仅当状态为 done 时直接混入；若仍在 loading，启动轮询
      if (app.globalData.supplementaryStatus === 'done') {
        this._setTimeout(function () { that.mergeSuppIntoFlow(); }, 500);
      } else if (app.globalData.supplementaryStatus === 'loading') {
        this._setTimeout(function () {
          that.mergeSuppIntoFlow();
          that.startSuppPolling();
        }, 500);
      }
      return;
    }

    // 每次显示时检查是否有新卡片
    const cards = app.globalData.currentCards;
    if (cards && cards.length > 0 && this.data.leftCards.length === 0 && this.data.rightCards.length === 0) {
      this.renderCardsToColumns(cards);
    }
    this.setData({
      insightHistoryList: app.globalData.insightHistory || []
    });

    if (this.data.activeTab === 2) {
      this.syncInsightFromTask();
    }

    // 普通 onShow：已有补充卡片则混入
    if (app.globalData.supplementaryStatus === 'done' || app.globalData.supplementaryStatus === 'loading') {
      var self = this;
      this._setTimeout(function () { self.mergeSuppIntoFlow(); }, 400);
    }
  },

  // ==================== 补充文献（直接混入卡片流，无隔阂） ====================

  /**
   * 将补充卡片混入主线卡片流（防并发，带安全超时）
   */
  mergeSuppIntoFlow() {
    // 防并发：上一次 setData 未完成则跳过（不做排队，减少渲染压力）
    if (this._mergeInProgress) return;
    this._mergeInProgress = true;

    // 安全超时：500ms 后强制解锁，防止 setData 回调丢失导致死锁
    var that = this;
    var safetyTimer = setTimeout(function () {
      if (that._mergeInProgress) {
        that._mergeInProgress = false;
      }
    }, 1500);

    var suppCards = app.globalData.supplementaryCards || [];
    if (!suppCards.length) {
      this._mergeInProgress = false;
      return;
    }

    // 去重
    var existingIds = {};
    (this.data.leftCards || []).concat(this.data.rightCards || []).forEach(function (c) {
      existingIds[c.id] = true;
    });

    var newCards = suppCards.filter(function (c) { return !existingIds[c.id]; });
    if (!newCards.length) {
      this._mergeInProgress = false;
      return;
    }

    // 生成图片
    var rendered = sybAgent.renderCardImages(newCards);
    rendered.forEach(function (c) { c._isFav = app.isFavorite(c.id); });

    // 新卡放开头，两列平衡
    var allLeft = [];
    var allRight = [];

    if (rendered.length > 0) {
      // 先把渲染好的新卡入列
      rendered.forEach(function (card) {
        if (allLeft.length <= allRight.length) {
          allLeft.push(card);
        } else {
          allRight.push(card);
        }
      });
    }
    // 再把原有卡片追加到后面
    (this.data.leftCards || []).forEach(function (c) {
      if (allLeft.length <= allRight.length) {
        allLeft.push(c);
      } else {
        allRight.push(c);
      }
    });
    (this.data.rightCards || []).forEach(function (c) {
      if (allLeft.length <= allRight.length) {
        allLeft.push(c);
      } else {
        allRight.push(c);
      }
    });

    // 终极去重：确保同一列内没有重复 key（微信 wx:key 硬要求）
    [allLeft, allRight].forEach(function (col) {
      var seen = {};
      for (var i = col.length - 1; i >= 0; i--) {
        var id = col[i].id;
        if (seen[id]) {
          col.splice(i, 1);
        } else {
          seen[id] = true;
        }
      }
    });

    // 裁剪渲染卡片数
    var trimmedSupp = this._trimRenderCards(allLeft, allRight);
    allLeft = trimmedSupp.left;
    allRight = trimmedSupp.right;

    var that = this;
    this.setData({ leftCards: allLeft, rightCards: allRight }, function () {
      clearTimeout(safetyTimer);
      that._mergeInProgress = false;
    });
  },

  /**
   * 轮询补充卡片：仅在后台生成任务活跃时运行，有新卡就混入流中
   */
  startSuppPolling() {
    if (this.data.suppPollTimer) return; // 已在轮询
    var that = this;
    var timer = setInterval(function () {
      var status = app.globalData.supplementaryStatus || 'idle';
      if (status === 'done' || status === 'error') {
        clearInterval(timer);
        that.setData({ suppPollTimer: null });
        that.mergeSuppIntoFlow(); // 最后一次兜底刷新
        return;
      }
      that.mergeSuppIntoFlow();
    }, 3000); // 3 秒间隔，减少渲染压力
    this.setData({ suppPollTimer: timer });
  },

  /**
   * 手动触发补充文献检索
   */
  onTriggerSupplement() {
    var resource = app.globalData.currentResource;
    var userText = resource ? resource.text : '';
    if (!userText || userText.trim().length < 50) {
      wx.showToast({ title: '请先上传足够长的文本', icon: 'none' });
      return;
    }

    app.globalData.supplementaryCards = [];
    app.globalData.supplementaryStatus = 'loading';

    var that = this;

    // 防抖刷新：每 2.5s 最多做一次 setData
    var _debounceTimer = null;
    function scheduleMerge() {
      if (_debounceTimer) return;
      _debounceTimer = setTimeout(function () {
        _debounceTimer = null;
        that.mergeSuppIntoFlow();
      }, 2500);
    }

    sybAgent.runFullPipeline(userText, {
      mode: 'standard',
      method: 'agent',
      maxCards: 5,
      onCardGenerated: function (card) {
        app.globalData.supplementaryCards.push(card);
        scheduleMerge();
      }
    }).then(function (result) {
      app.globalData.supplementaryCards = result.cards || [];
      app.globalData.supplementaryStatus = 'done';
      app.globalData.sybApiResult = result.apiResult || null;
      if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
      that.mergeSuppIntoFlow();
    }).catch(function (err) {
      console.error('[main] 补充文献生成失败:', err);
      app.globalData.supplementaryStatus = 'error';
    });
  },

  // ==================== 工具方法 ====================

  // 可追踪的 setTimeout（onHide 时自动清理）
  _setTimeout(fn, delay) {
    var id = setTimeout(fn, delay);
    this._timers.push(id);
    return id;
  },

  _clearAllTimers() {
    var timers = this._timers;
    for (var i = 0; i < timers.length; i++) {
      clearTimeout(timers[i]);
    }
    this._timers = [];
  },

  // 裁剪渲染卡片数（左右列合计不超过 MAX_RENDER_CARDS）
  _trimRenderCards(left, right) {
    var total = left.length + right.length;
    if (total <= MAX_RENDER_CARDS) return { left: left, right: right };
    // 等比例裁剪左/右列，优先移除前面的旧卡片
    var removeCount = total - MAX_RENDER_CARDS;
    var leftRemove = Math.min(left.length, Math.floor(removeCount / 2));
    var rightRemove = removeCount - leftRemove;
    if (rightRemove > right.length) {
      leftRemove = removeCount - right.length;
      rightRemove = right.length;
    }
    return {
      left: left.slice(leftRemove),
      right: right.slice(rightRemove)
    };
  },

  // 限制 globalData.currentCards 最大长度
  _capGlobalCards() {
    var cards = app.globalData.currentCards;
    if (cards && cards.length > MAX_GLOBAL_CARDS) {
      app.globalData.currentCards = cards.slice(cards.length - MAX_GLOBAL_CARDS);
    }
  },

  // 检查卡片是否已收藏
  isCardFavorite(cardId) {
    return app.isFavorite(cardId);
  },

  // 为卡片附加收藏状态
  attachFavoriteStatus(cards) {
    return cards.map(card => {
      card._isFav = app.isFavorite(card.id);
      return card;
    });
  },

  // 格式化时间
  formatTime(timeStr) {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hour = d.getHours();
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${month}月${day}日 ${hour}:${min}`;
    } catch (e) {
      return timeStr;
    }
  },

  // ==================== 数据加载 ====================

  // 加载初始卡片
  loadInitialCards() {
    const cards = app.globalData.currentCards;
    if (cards && cards.length > 0) {
      this.renderCardsToColumns(cards);
    }
  },

  // 构建单张卡片的模板图片（同步，永不空白）
  _buildCardImage(card) {
    try {
      return canvasRender.getOrRenderCard({
        id: card.id,
        title: card.title,
        summary: card.summary || card.content,
        color: card.imageColor || '#7785AC',
        height: card.cardHeight || 680
      });
    } catch (e) {
      console.warn('[main] _buildCardImage 异常:', e);
      return canvasRender.makeCanvasFallback(card.title, card.cardHeight);
    }
  },

  // 渲染卡片为两列布局 + 后台 AI 图片升级
  renderCardsToColumns(cards, options) {
    if (!cards || cards.length === 0) return;

    var leftCards = [];
    var rightCards = [];
    const colors = ['#7785AC', '#360568', '#5b2a86', '#9ac6c5', '#a5e6ba'];  // not used for built cards, but kept for reference
    var page = this;

    cards.forEach((card, i) => {
      const cardCopy = { ...card };
      if (!cardCopy.imageColor) {
        cardCopy.imageColor = colors[i % colors.length];
      }
      cardCopy.cardHeight = CARD_HEIGHTS[i % CARD_HEIGHTS.length];
      // 即刻使用模板渲染（不阻塞 UI）
      cardCopy.image = page._buildCardImage(cardCopy);
      cardCopy._isFav = app.isFavorite(cardCopy.id);

      if (leftCards.length <= rightCards.length) {
        leftCards.push(cardCopy);
      } else {
        rightCards.push(cardCopy);
      }
    });

    // 裁剪渲染卡片数
    var trimmed = this._trimRenderCards(leftCards, rightCards);
    leftCards = trimmed.left;
    rightCards = trimmed.right;

    this.setData({ leftCards, rightCards, currentOffset: Math.floor(cards.length / 10) });

    // === 后台异步 AI 图片升级 ===
    // 从所有卡片中随机挑选 ~25% 尝试 AI 生成
    // 每成功一张，使用 setData 增量更新该卡片图片（无闪烁）
    var allBuiltCards = leftCards.concat(rightCards);
    canvasRender.renderCardsWithAI(allBuiltCards, {
      aiRatio: (options && options.aiRatio !== undefined) ? options.aiRatio : 0.25,
      maxConcurrent: 2,
      onCardUpgraded: function (upgradedCard) {
        // 增量更新：只修改被升级的那张卡片的 image 字段
        var updateData = {};
        // 更新左列
        var newLeft = page.data.leftCards.map(function (c) {
          if (c.id === upgradedCard.id) {
            return Object.assign({}, c, { image: upgradedCard.image });
          }
          return c;
        });
        // 更新右列
        var newRight = page.data.rightCards.map(function (c) {
          if (c.id === upgradedCard.id) {
            return Object.assign({}, c, { image: upgradedCard.image });
          }
          return c;
        });
        updateData.leftCards = newLeft;
        updateData.rightCards = newRight;
        page.setData(updateData);
      }
    }).catch(function (err) {
      console.warn('[main] 后台AI图片升级整体失败:', err && err.message);
    });
  },

  // ==================== 顶部栏切换 ====================

  // Tab 切换去抖标志（防止快速连续点击导致重复操作）
  _tabSwitchPending: false,

  onTabTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    if (this.data.activeTab === idx) return;

    // 立即切换 UI（hidden 方式，DOM 常驻，瞬间切换）
    this.setData({ activeTab: idx });

    // 如果上一次延迟任务还未执行，取消它
    if (this._tabSwitchTimer) {
      clearTimeout(this._tabSwitchTimer);
      this._tabSwitchTimer = null;
    }

    var that = this;

    if (idx === 0) {
      // 相关页 - 仅在首屏数据为空时才加载
      if (this.data.leftCards.length === 0 && this.data.rightCards.length === 0) {
        wx.nextTick(() => that.loadInitialCards());
      }
    } else if (idx === 1) {
      // 历史记录页 - 推迟到下一帧，避免阻塞切换动画
      wx.nextTick(() => that.loadHistory());
    } else if (idx === 2) {
      // 洞察页 - 推迟到下一帧同步后台生成任务状态
      wx.nextTick(() => that.syncInsightFromTask());
    }
  },

  // 从全局 insightTask 同步洞察页状态（切回洞察页时调用）
  // 优化：缓存已解析的 Markdown 节点，避免重复解析阻塞 UI
  _lastParsedInsightText: '',

  syncInsightFromTask() {
    var task = app.globalData.insightTask;
    if (!task || !task.active) {
      // 没有活跃任务，检查是否有已完成文本需要渲染
      this.setData({ insightTaskActive: false });
      if (this.data.insightText && !this.data.insightStreaming && this.data.insightContentNodes.length === 0) {
        // 仅当文本变化时才重新解析
        if (this.data.insightText !== this._lastParsedInsightText) {
          this._lastParsedInsightText = this.data.insightText;
          this.setData({
            insightContentNodes: mdParser.parseMarkdown(this.data.insightText)
          });
        }
      }
      return;
    }

    // 有活跃的生成任务，恢复状态
    this.setData({ insightTaskActive: true });
    if (task.loading) {
      // 还在等待第一个chunk
      this.setData({
        insightLoading: true,
        insightStreaming: true,
        insightText: '',
        insightContentNodes: []
      });
      this._lastParsedInsightText = '';
    } else if (task.text) {
      // 已有流式内容，恢复显示。若文本未变则复用已解析节点
      if (task.text !== this._lastParsedInsightText) {
        this._lastParsedInsightText = task.text;
        this.setData({
          insightLoading: false,
          insightStreaming: true,
          insightText: task.text,
          insightContentNodes: mdParser.parseMarkdown(task.text)
        });
      } else {
        this.setData({
          insightLoading: false,
          insightStreaming: true,
          insightText: task.text
        });
      }
    }
  },

  // ==================== 相关页 - 瀑布流 ====================

  // 下滑加载更多
  onScrollToLower() {
    if (this.data.activeTab !== 0) return;
    if (this.data.isRefreshing || !this.data.hasMoreCards) return;

    this.setData({
      isRefreshing: true,
      currentOffset: this.data.currentOffset + 1
    });

    api.loadMoreCards(app.globalData.currentSessionId, this.data.currentOffset)
      .then(result => {
        const newCards = result.cards || [];
        if (newCards.length === 0) {
          this.setData({ hasMoreCards: false, isRefreshing: false });
          return;
        }

        app.globalData.currentCards = [...app.globalData.currentCards, ...newCards];
        this._capGlobalCards();

        const colors = ['#7785AC', '#360568', '#5b2a86', '#9ac6c5', '#a5e6ba'];
        var leftCards = [...this.data.leftCards];
        var rightCards = [...this.data.rightCards];

        newCards.forEach((card, i) => {
          const cardCopy = { ...card };
          if (!cardCopy.imageColor) cardCopy.imageColor = colors[i % colors.length];
          cardCopy.cardHeight = CARD_HEIGHTS[(i + leftCards.length + rightCards.length) % CARD_HEIGHTS.length];
          cardCopy.image = canvasRender.getOrRenderCard({ id: cardCopy.id, title: cardCopy.title, summary: cardCopy.summary || cardCopy.content, color: cardCopy.imageColor, height: cardCopy.cardHeight });
          cardCopy._isFav = false;

          if (leftCards.length <= rightCards.length) {
            leftCards.push(cardCopy);
          } else {
            rightCards.push(cardCopy);
          }
        });

        // 裁剪渲染卡片数
        var trimmedLower = this._trimRenderCards(leftCards, rightCards);
        leftCards = trimmedLower.left;
        rightCards = trimmedLower.right;

        this.setData({ leftCards, rightCards, isRefreshing: false });
      })
      .catch(() => {
        this.setData({ isRefreshing: false });
      });
  },

  // 上滑刷新
  onScrollToUpper(e) {
    if (this.data.activeTab !== 0) return;
    if (this.data.isTopRefreshing) return;

    this.setData({
      isTopRefreshing: true
    });

    api.loadMoreCards(app.globalData.currentSessionId, -1)
      .then(result => {
        const newCards = result.cards || [];
        if (newCards.length > 0) {
          const colors = ['#7785AC', '#360568', '#5b2a86', '#9ac6c5', '#a5e6ba'];
          const leftCards = [];
          const rightCards = [];

          newCards.forEach((card, i) => {
            const cardCopy = { ...card };
            if (!cardCopy.imageColor) cardCopy.imageColor = colors[i % colors.length];
            cardCopy.cardHeight = CARD_HEIGHTS[i % CARD_HEIGHTS.length];
            cardCopy.image = canvasRender.getOrRenderCard({ id: cardCopy.id, title: cardCopy.title, summary: cardCopy.summary || cardCopy.content, color: cardCopy.imageColor, height: cardCopy.cardHeight });
            cardCopy._isFav = false;

            if (leftCards.length <= rightCards.length) {
              leftCards.push(cardCopy);
            } else {
              rightCards.push(cardCopy);
            }
          });

          var allLeft = [...leftCards, ...this.data.leftCards];
          var allRight = [...rightCards, ...this.data.rightCards];

          app.globalData.currentCards = [...newCards, ...app.globalData.currentCards];
          this._capGlobalCards();

          // 裁剪渲染卡片数
          var trimmedUpper = this._trimRenderCards(allLeft, allRight);
          allLeft = trimmedUpper.left;
          allRight = trimmedUpper.right;

          this.setData({ leftCards: allLeft, rightCards: allRight });
        }
      })
      .finally(() => {
        this.setData({
          isTopRefreshing: false
        });
      });
  },

  // ==================== 卡片详情 ====================

  onCardTap(e) {
    var card = e.currentTarget.dataset.card;
    var notes = app.getNotes(card.id);
    var isFavorited = app.isFavorite(card.id);
    var contentPlain = mdParser.markdownToPlainText(card.content || card.summary || '');

    this.setData({
      showCardDetail: true,
      detailCard: card,
      detailImage: card.image,
      detailNotes: notes,
      currentNote: '',
      isFavorited: isFavorited,
      detailContentNodes: mdParser.parseMarkdown(card.content || ''),
      detailContentPlain: contentPlain
    });
  },

  onCloseCardDetail() {
    this.setData({
      showCardDetail: false,
      detailCard: null
    });
  },

  onCardDetailOverlayTap() {
    this.onCloseCardDetail();
  },

  // 详情图片加载失败时，用本地图标兜底
  onDetailImageError() {
    var card = this.data.detailCard;
    if (!card) return;
    // 用 canvas 渲染一个简单的带文字色块兜底
    try {
      var fallbackImg = canvasRender.getOrRenderCard({
        id: card.id,
        title: card.title,
        summary: card.summary || card.content || '',
        color: card.imageColor || '#7785AC',
        height: card.cardHeight || 680
      });
      this.setData({ detailImage: fallbackImg });
    } catch (e) {
      console.warn('[main] 详情图片兜底失败:', e);
    }
  },

  // 收藏/取消收藏
  onToggleFavorite() {
    const card = this.data.detailCard;
    if (!card) return;

    const isFav = app.toggleFavorite(card.id);
    this.setData({ isFavorited: isFav });

    // 同步更新瀑布流中的卡片收藏状态
    this.updateCardFavInList(card.id, isFav);

    if (isFav) {
      this.setData({ showFavToast: true });
      this._setTimeout(function () {
        this.setData({ showFavToast: false });
      }.bind(this), 2000);
    }
  },

  // 列表卡片收藏
  onCardFavorite(e) {
    const card = e.currentTarget.dataset.card;

    const isFav = app.toggleFavorite(card.id);
    this.updateCardFavInList(card.id, isFav);

    if (isFav) {
      this.setData({ showFavToast: true });
      this._setTimeout(function () {
        this.setData({ showFavToast: false });
      }.bind(this), 2000);
    }
  },

  // 更新列表中卡片的收藏状态
  updateCardFavInList(cardId, isFav) {
    const leftCards = this.data.leftCards.map(c => {
      if (c.id === cardId) { c._isFav = isFav; }
      return c;
    });
    const rightCards = this.data.rightCards.map(c => {
      if (c.id === cardId) { c._isFav = isFav; }
      return c;
    });
    this.setData({ leftCards, rightCards });
  },

  // 笔记输入
  onNoteInput(e) {
    this.setData({ currentNote: e.detail.value });
  },

  // 发送笔记
  onSendNote() {
    const note = this.data.currentNote.trim();
    if (!note) return;

    const card = this.data.detailCard;
    if (!card) return;

    app.saveNote(card.id, note);
    api.sendNote(card.id, note);

    const notes = app.getNotes(card.id);
    this.setData({
      detailNotes: notes,
      currentNote: ''
    });

    wx.showToast({
      title: '笔记已保存',
      icon: 'success',
      duration: 1000
    });
  },

  // ==================== 历史记录 ====================

  // 历史卡片缓存：{ versionKey, leftCards, rightCards }
  _historyCache: null,

  loadHistory() {
    const sessions = app.globalData.historySessions;
    // 生成版本键：用 session id 拼接，检测历史列表是否变化
    const versionKey = sessions.map(s => s.id).join(',');
    if (this._historyCache && this._historyCache.versionKey === versionKey) {
      // 命中缓存，直接使用已生成的数据，零阻塞
      this.setData({
        historyLeftCards: this._historyCache.leftCards,
        historyRightCards: this._historyCache.rightCards
      });
      return;
    }

    const leftCards = [];
    const rightCards = [];
    const colors = ['#7785AC', '#360568', '#5b2a86', '#9ac6c5', '#a5e6ba'];

    sessions.forEach((session, i) => {
      const card = {
        id: session.id,
        title: session.title || '未命名记录',
        summary: (session.resource && session.resource.text) ? session.resource.text.slice(0, 50) : '',
        imageColor: colors[i % colors.length],
        image: canvasRender.getOrRenderCard({ id: session.id, title: session.title || '历史记录', summary: (session.resource && session.resource.text) ? session.resource.text.slice(0, 50) : '', color: colors[i % colors.length], height: CARD_HEIGHTS[i % CARD_HEIGHTS.length] }),
        time: this.formatTime(session.time),
        sessionData: session
      };

      if (leftCards.length <= rightCards.length) {
        leftCards.push(card);
      } else {
        rightCards.push(card);
      }
    });

    // 写入缓存
    this._historyCache = {
      versionKey: versionKey,
      leftCards: leftCards,
      rightCards: rightCards
    };

    this.setData({
      historyLeftCards: leftCards,
      historyRightCards: rightCards
    });
  },

  // 点击历史卡片：加载历史会话内容
  onHistoryCardTap(e) {
    const session = e.currentTarget.dataset.card.sessionData;
    if (!session) return;

    wx.showLoading({ title: '加载中…' });

    api.loadHistoryCards(session.id)
      .then(result => {
        wx.hideLoading();
        app.globalData.currentCards = result.cards || [];
        app.globalData.currentSessionId = session.id;
        this.setData({ leftCards: [], rightCards: [] });
        this.renderCardsToColumns(app.globalData.currentCards);
        this.setData({ activeTab: 0 });
      })
      .catch(() => {
        wx.hideLoading();
        app.globalData.currentCards = session.cards || [];
        app.globalData.currentSessionId = session.id;
        this.setData({ leftCards: [], rightCards: [] });
        this.renderCardsToColumns(app.globalData.currentCards);
        this.setData({ activeTab: 0 });
      });
  },

  // ==================== 洞察 ====================

  // 用户点击「生成洞察」按钮
  onGenerateInsight() {
    if (this.data.insightStreaming || this.data.insightLoading) return;
    this.startInsight();
  },

  startInsight() {
    // 防止重复生成
    if (this.data.insightStreaming || this.data.insightLoading) return;
    if (app.globalData.insightTask.active) return;

    const favorites = app.globalData.favorites;
    const allCards = app.globalData.currentCards;
    const favoritedCards = allCards.filter(c => favorites.indexOf(c.id) > -1);

    if (favoritedCards.length === 0) {
      // 清除可能残留的 task 状态
      app.globalData.insightTask = { active: false, loading: false, text: '', cardCount: 0 };
      this.setData({
        insightText: '您还没有收藏任何卡片。\n\n请先浏览相关卡片，点击星号收藏感兴趣的内容，然后来这里获取深度洞察分析。',
        insightContentNodes: mdParser.parseMarkdown('您还没有收藏任何卡片。\n\n请先浏览相关卡片，点击星号收藏感兴趣的内容，然后来这里获取深度洞察分析。'),
        insightStreaming: false
      });
      return;
    }

    // 注册全局任务状态，支持切换页面时后台继续生成
    app.globalData.insightTask = {
      active: true,
      loading: true,
      text: '',
      cardCount: favoritedCards.length
    };

    this.setData({
      insightLoading: true,
      insightStreaming: true,
      insightText: '',
      insightContentNodes: [],
      insightTaskActive: true
    });

    let fullText = '';
    var page = this;

    // 流式解析节流：避免每个 chunk 都全量重解析 Markdown（O(n²) 卡顿）
    var _lastChunkTime = 0;
    var _pendingChunkParse = null;
    var THROTTLE_MS = 150;

    api.analyzeInsight(favoritedCards, function(chunk) {
      fullText += chunk;
      // 同步更新全局任务状态，确保切页后能恢复
      app.globalData.insightTask.text = fullText;
      app.globalData.insightTask.loading = false;

      var now = Date.now();
      if (now - _lastChunkTime >= THROTTLE_MS) {
        _lastChunkTime = now;
        page.setData({
          insightText: fullText,
          insightLoading: false,
          insightContentNodes: mdParser.parseMarkdown(fullText)
        });
      } else {
        // 合并短间隔内的多个 chunk，一次性解析
        if (_pendingChunkParse) clearTimeout(_pendingChunkParse);
        _pendingChunkParse = setTimeout(function () {
          _lastChunkTime = Date.now();
          _pendingChunkParse = null;
          page.setData({
            insightText: fullText,
            insightLoading: false,
            insightContentNodes: mdParser.parseMarkdown(fullText)
          });
        }, THROTTLE_MS);
      }
    }).then(function(completeText) {
      // 清除待处理的节流定时器
      if (_pendingChunkParse) {
        clearTimeout(_pendingChunkParse);
        _pendingChunkParse = null;
      }
      // 完成后将 Markdown 解析为 rich-text nodes
      const contentNodes = mdParser.parseMarkdown(completeText);
      page._lastParsedInsightText = completeText;

      // 更新全局任务状态
      app.globalData.insightTask.active = false;
      app.globalData.insightTask.text = completeText;

      // 如果用户仍在洞察页，更新 UI
      page.setData({
        insightText: completeText,
        insightStreaming: false,
        insightContentNodes: contentNodes,
        insightTaskActive: false
      });

      app.saveInsightHistory({
        id: 'insight_' + Date.now(),
        text: completeText,
        time: new Date().toISOString(),
        cardCount: favoritedCards.length
      });

      page.setData({
        insightHistoryList: app.globalData.insightHistory || []
      });
    });
  },

  // 打开洞察历史
  onOpenInsightHistory() {
    this.setData({
      showInsightHistory: true,
      insightHistoryList: app.globalData.insightHistory || []
    });
  },

  // 关闭洞察历史
  onCloseInsightHistory() {
    this.setData({
      showInsightHistory: false
    });
  },

  // 点击洞察历史项
  onInsightHistoryTap(e) {
    const insight = e.currentTarget.dataset.insight;
    this._lastParsedInsightText = insight.text;
    this.setData({
      insightText: insight.text,
      insightStreaming: false,
      insightContentNodes: mdParser.parseMarkdown(insight.text),
      showInsightHistory: false
    });
  },

  // ==================== 底部导航 ====================

  onGoUpload() {
    wx.navigateTo({
      url: '/pages/upload/upload'
    });
  },

  // ==================== 阻止事件冒泡 ====================

  stopPropagation() {}
});
