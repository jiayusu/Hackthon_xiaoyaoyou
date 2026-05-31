// app.js
const config = require('./utils/config');

App({
  globalData: {
    // API 配置
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,

    // 当前会话数据
    currentSessionId: null,
    currentCards: [],       // 当前相关页卡片
    currentResource: null,  // 当前上传的资源

    // 收藏卡片
    favorites: [],

    // 笔记
    notes: {},

    // 历史记录
    historySessions: [],

    // 洞察历史
    insightHistory: [],

    // 洞察生成任务（支持切换页面时后台继续生成）
    insightTask: {
      active: false,       // 是否正在生成
      loading: false,      // 初始loading状态
      text: '',            // 当前已生成的流式文本
      cardCount: 0         // 使用的收藏卡片数
    },

    // 页面刷新标记
    needRefreshCards: false,

    // 补充文献
    supplementaryCards: [],   // 补充生成的卡片
    supplementaryStatus: 'idle', // idle | pending | loading | done | error
    sybApiResult: null,       // API 原始返回
    suppMethod: 'agent',      // 补充文献生成方式: 'direct' | 'agent'

    // 颜色方案
    colors: {
      primary: '#7785AC',
      secondary1: '#360568',
      secondary2: '#5b2a86',
      secondary3: '#9ac6c5',
      secondary4: '#a5e6ba'
    }
  },

  onLaunch() {
    // 从本地存储恢复数据
    this.loadFromStorage();
  },

  loadFromStorage() {
    try {
      const favorites = wx.getStorageSync('favorites');
      if (favorites) this.globalData.favorites = JSON.parse(favorites);

      const notes = wx.getStorageSync('notes');
      if (notes) this.globalData.notes = JSON.parse(notes);

      const historySessions = wx.getStorageSync('historySessions');
      if (historySessions) this.globalData.historySessions = JSON.parse(historySessions);

      const insightHistory = wx.getStorageSync('insightHistory');
      if (insightHistory) this.globalData.insightHistory = JSON.parse(insightHistory);
    } catch (e) {
      console.error('加载本地存储失败:', e);
    }
  },

  saveToStorage() {
    try {
      wx.setStorageSync('favorites', JSON.stringify(this.globalData.favorites));
      wx.setStorageSync('notes', JSON.stringify(this.globalData.notes));
      wx.setStorageSync('historySessions', JSON.stringify(this.globalData.historySessions));
      wx.setStorageSync('insightHistory', JSON.stringify(this.globalData.insightHistory));
    } catch (e) {
      console.error('保存到本地存储失败:', e);
    }
  },

  // 收藏/取消收藏卡片
  toggleFavorite(cardId) {
    const idx = this.globalData.favorites.indexOf(cardId);
    if (idx > -1) {
      this.globalData.favorites.splice(idx, 1);
    } else {
      this.globalData.favorites.push(cardId);
    }
    this.saveToStorage();
    return idx === -1; // true = 已收藏, false = 已取消
  },

  isFavorite(cardId) {
    return this.globalData.favorites.indexOf(cardId) > -1;
  },

  // 保存笔记
  saveNote(cardId, note) {
    if (!this.globalData.notes[cardId]) {
      this.globalData.notes[cardId] = [];
    }
    this.globalData.notes[cardId].push({
      content: note,
      time: new Date().toISOString()
    });
    this.saveToStorage();
  },

  getNotes(cardId) {
    return this.globalData.notes[cardId] || [];
  },

  // 保存历史会话
  saveHistorySession(session) {
    // 只存储摘要而非全文，大幅减少内存和本地存储占用
    if (session.resource && session.resource.text) {
      var fullText = session.resource.text;
      session.resource.text = fullText.slice(0, 120) + (fullText.length > 120 ? '…' : '');
    }
    this.globalData.historySessions.unshift(session);
    if (this.globalData.historySessions.length > 50) {
      this.globalData.historySessions = this.globalData.historySessions.slice(0, 50);
    }
    this.saveToStorage();
  },

  // 保存洞察历史
  saveInsightHistory(insight) {
    this.globalData.insightHistory.unshift(insight);
    if (this.globalData.insightHistory.length > 30) {
      this.globalData.insightHistory = this.globalData.insightHistory.slice(0, 30);
    }
    this.saveToStorage();
  }
});
