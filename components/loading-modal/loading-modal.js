Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    progress: {
      type: Number,
      value: 0
    },
    text: {
      type: String,
      value: '请稍候'
    }
  },

  data: {
    displayProgress: 0,
    stageText: ''
  },

  observers: {
    'progress'(val) {
      // 平滑过渡进度
      this.smoothProgress(val);

      // 根据进度切换提示文字
      if (val < 15) {
        this.setData({ stageText: '正在分析用户意图…' });
      } else if (val < 50) {
        this.setData({ stageText: '多智能体协同处理中…' });
      } else if (val < 80) {
        this.setData({ stageText: '正在生成相关文献卡片…' });
      } else if (val < 95) {
        this.setData({ stageText: '组装卡片内容…' });
      } else {
        this.setData({ stageText: '即将完成…' });
      }
    }
  },

  methods: {
    smoothProgress(target) {
      const current = this.data.displayProgress;
      if (Math.abs(target - current) < 0.5) {
        this.setData({ displayProgress: target });
        return;
      }

      const step = (target - current) * 0.15;
      const next = current + step;

      this.setData({ displayProgress: next });

      setTimeout(() => {
        this.smoothProgress(target);
      }, 40);
    }
  }
});
