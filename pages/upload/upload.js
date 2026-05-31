// upload.js - 上传资源页
const api = require('../../utils/api');
const sybAgent = require('../../utils/syb-agent');
const app = getApp();

Page({
  data: {
    inputText: '',
    uploadedFiles: [],
    isSending: false,
    loadingProgress: 0,
    loadingText: '请稍候',
    showLoading: false,
    statusBarHeight: 0
  },

  onLoad() {
    // 获取状态栏高度
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20
    });

    // 清空之前的上传缓存
    this.clearUploadCache();
  },

  onShow() {
    // 每次进入页面时清空输入
    this.setData({
      inputText: '',
      uploadedFiles: []
    });
  },

  // 清空上传缓存
  clearUploadCache() {
    app.globalData.currentResource = null;
  },

  // 文字输入
  onTextInput(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  // 选择文件上传 (TXT/MD)
  onChooseFile() {
    const that = this;
    wx.chooseMessageFile({
      count: 3,
      type: 'file',
      extension: ['txt', 'md'],
      success(res) {
        const newFiles = res.tempFiles.map(f => ({
          name: f.name,
          path: f.path,
          size: f.size
        }));

        that.setData({
          uploadedFiles: [...that.data.uploadedFiles, ...newFiles]
        });

        // 读取文件内容填充到输入框
        newFiles.forEach(file => {
          const fs = wx.getFileSystemManager();
          try {
            const content = fs.readFileSync(file.path, 'utf-8');
            that.setData({
              inputText: that.data.inputText + '\n\n--- ' + file.name + ' ---\n' + content
            });
          } catch (e) {
            console.error('读取文件失败:', e);
          }
        });

        wx.showToast({
          title: `已添加${newFiles.length}个文件`,
          icon: 'success',
          duration: 1500
        });
      }
    });
  },

  // 移除已选文件
  onRemoveFile(e) {
    const index = e.currentTarget.dataset.index;
    const files = this.data.uploadedFiles;
    files.splice(index, 1);
    this.setData({ uploadedFiles: files });
  },

  // 关闭按钮 - 回到相关页
  onClose() {
    // 如果有之前的会话，回到main页
    const pages = getCurrentPages();
    const hasMainPage = pages.some(p => p.route === 'pages/main/main');

    if (hasMainPage) {
      wx.navigateBack();
    } else {
      // 没有main页面，跳转过去（但保留原有数据）
      wx.redirectTo({
        url: '/pages/main/main'
      });
    }
  },

  // 发送资源
  onSend() {
    const { inputText, uploadedFiles, isSending } = this.data;

    // Skyline 兼容: Skyline 不支持 pointer-events，无法阻止点击穿透
    // 在 JS 层添加防重复提交逻辑
    if (isSending) {
      return;
    }

    if (!inputText.trim() && uploadedFiles.length === 0) {
      wx.showToast({
        title: '请输入文字或上传文件',
        icon: 'none'
      });
      return;
    }

    // 保存资源到全局
    app.globalData.currentResource = {
      text: inputText,
      files: uploadedFiles.map(f => f.path)
    };

    // 显示加载弹窗
    this.setData({
      isSending: true,
      showLoading: true,
      loadingProgress: 0,
      loadingText: '请稍候'
    });

    // 发送到后端
    var that = this;
    api.sendResource(
      app.globalData.currentResource,
      function (progress) {
        // 将后端处理进度映射为 0-70%（留 30% 给补充卡片生成）
        var mappedProgress = Math.floor(progress * 0.7);
        that.setData({ loadingProgress: mappedProgress });
      }
    ).then(function (result) {
      // 保存会话数据
      if (result.sessionId) {
        app.globalData.currentSessionId = result.sessionId;
      }

      // 保存卡片数据
      app.globalData.currentCards = result.cards || [];

      // 保存历史会话
      if (app.globalData.currentCards.length > 0) {
        app.saveHistorySession({
          id: result.sessionId || 'session_' + Date.now(),
          cards: app.globalData.currentCards,
          resource: app.globalData.currentResource,
          time: new Date().toISOString(),
          title: inputText.slice(0, 30) || '未命名记录'
        });
      }

      // 标记 main 页需要刷新卡片数据
      app.globalData.needRefreshCards = true;

      // ======== 后台触发补充卡片生成 ========
      // 初始化补充卡片存储
      app.globalData.supplementaryCards = [];
      app.globalData.supplementaryStatus = 'pending'; // pending | loading | done | error

      // 检查用户输入是否足够（至少50字符）
      var userText = inputText.trim();
      var navigateDelay = 800; // 最短展示时间，确保加载动画可见

      if (userText.length >= 50) {
        that.setData({
          loadingText: '正在检索补充文献…',
          loadingProgress: 70
        });

        // 启动补充卡片生成流水线（后台执行，不阻塞页面跳转）
        // 注意：不传 onCardGenerated —— 避免逐张 setData 阻塞渲染
        // 卡片会在 main 页的 onShow 中通过 mergeSuppIntoFlow 批量加载
        var sybPipeline = sybAgent.runFullPipeline(userText, {
          mode: 'standard',
          method: 'agent',
          maxCards: 5,
          onProgress: function (progress) {
            var mappedProgress = 70 + Math.floor(progress * 0.15);
            that.setData({ loadingProgress: mappedProgress });
          }
        }).then(function (result) {
          app.globalData.supplementaryCards = result.cards || [];
          app.globalData.supplementaryStatus = 'done';
          app.globalData.sybApiResult = result.apiResult || null;
          that.setData({ loadingProgress: 100, loadingText: '完成！' });
        }).catch(function (err) {
          console.error('[upload] 补充卡片生成失败:', err);
          app.globalData.supplementaryStatus = 'error';
          that.setData({ loadingProgress: 100, loadingText: '完成！' });
        });

        // 等待 sybAgent 完成（最多再等 55 秒，匹配 standard 50s 超时）
        var maxSybWait = 55000;
        var sybWithTimeout = Promise.race([
          sybPipeline,
          new Promise(function (resolve) { setTimeout(resolve, maxSybWait); })
        ]);

        sybWithTimeout.then(function () {
          doNavigate();
        });
      } else {
        app.globalData.supplementaryStatus = 'done';
        setTimeout(doNavigate, navigateDelay);
      }

      function doNavigate() {
        wx.navigateBack({
          delta: 1,
          fail: function () {
            wx.redirectTo({ url: '/pages/main/main' });
          }
        });
      }
    }).catch(function (err) {
      console.error('发送资源失败:', err);
      that.setData({ showLoading: false, isSending: false });

      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      });
    });
  }
});
