// splash.js - 开屏动画页
Page({
  data: {
    animationState: ''
  },

  onLoad() {
    // 阶段1: 渐现
    setTimeout(() => {
      this.setData({ animationState: 'fade-in' });
    }, 300);

    // 阶段2: 渐隐 + 跳转
    setTimeout(() => {
      this.setData({ animationState: 'fade-out' });
    }, 2500);

    // 阶段3: 跳转到上传页
    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/upload/upload'
      });
    }, 3200);
  }
});
