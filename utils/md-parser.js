// utils/md-parser.js - 简易 Markdown → rich-text nodes 转换器

/**
 * 将 Markdown 字符串转为 rich-text nodes 数组
 * 支持的语法：##、###、**bold**、有序/无序列表、段落
 */
function parseMarkdown(md) {
  if (!md) return [];

  const lines = md.split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行跳过
    if (!line.trim()) {
      i++;
      continue;
    }

    // ## 二级标题
    if (/^##\s+/.test(line)) {
      const text = line.replace(/^##\s+/, '').trim();
      nodes.push({
        name: 'h2',
        attrs: {
          style: 'font-size:32rpx;font-weight:700;color:#333;margin:24rpx 0 16rpx;line-height:1.4;'
        },
        children: parseInline(text)
      });
      i++;
      continue;
    }

    // ### 三级标题
    if (/^###\s+/.test(line)) {
      const text = line.replace(/^###\s+/, '').trim();
      nodes.push({
        name: 'h3',
        attrs: {
          style: 'font-size:28rpx;font-weight:600;color:#555;margin:20rpx 0 12rpx;line-height:1.4;'
        },
        children: parseInline(text)
      });
      i++;
      continue;
    }

    // 有序列表 1. xxx / 1、
    if (/^\d+[\.\、]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\d+[\.\、]\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+[\.\、]\s*/, '').trim();
        listItems.push(text);
        i++;
      }
      const listNode = {
        name: 'ol',
        attrs: { style: 'padding-left:32rpx;margin:12rpx 0;' }
      };
      listNode.children = listItems.map(item => ({
        name: 'li',
        attrs: { style: 'font-size:26rpx;color:#666;line-height:1.8;' },
        children: parseInline(item)
      }));
      nodes.push(listNode);
      continue;
    }

    // 无序列表 - / * / •
    if (/^[\-\*\•]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^[\-\*\•]\s/.test(lines[i])) {
        const text = lines[i].replace(/^[\-\*\•]\s*/, '').trim();
        listItems.push(text);
        i++;
      }
      const listNode = {
        name: 'ul',
        attrs: { style: 'padding-left:32rpx;margin:12rpx 0;' }
      };
      listNode.children = listItems.map(item => ({
        name: 'li',
        attrs: { style: 'font-size:26rpx;color:#666;line-height:1.8;' },
        children: parseInline(item)
      }));
      nodes.push(listNode);
      continue;
    }

    // 普通段落：收集连续的非空非特殊行
    const paraLines = [];
    while (i < lines.length && lines[i].trim() &&
           !/^##\s/.test(lines[i]) &&
           !/^###\s/.test(lines[i]) &&
           !/^\d+[\.\、]\s/.test(lines[i]) &&
           !/^[\-\*\•]\s/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      // 段落内多行之间用 <br/> 分隔
      const children = [];
      paraLines.forEach((pl, idx) => {
        if (idx > 0) {
          children.push({ name: 'br' });
        }
        const inlineNodes = parseInline(pl);
        children.push(...inlineNodes);
      });
      nodes.push({
        name: 'p',
        attrs: {
          style: 'font-size:26rpx;color:#555;line-height:1.8;margin:12rpx 0;'
        },
        children: children
      });
    } else {
      i++;
    }
  }

  return nodes;
}

/**
 * 解析行内格式：**bold** 和普通文本
 */
function parseInline(text) {
  if (!text) return [];

  const children = [];
  // 匹配 **bold** 或普通文本
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 前面的普通文本
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) {
        children.push({ type: 'text', text: before });
      }
    }
    // 加粗文本
    children.push({
      name: 'span',
      attrs: { style: 'font-weight:700;color:#222;' },
      children: [{ type: 'text', text: match[1] }]
    });
    lastIndex = regex.lastIndex;
  }

  // 剩余文本
  if (lastIndex < text.length) {
    children.push({ type: 'text', text: text.slice(lastIndex) });
  }

  // 如果没有匹配到任何 bold，直接返回纯文本
  if (children.length === 0) {
    children.push({ type: 'text', text: text });
  }

  return children;
}

/**
 * 将 Markdown 转为纯文本（去除所有格式标记）
 */
function markdownToPlainText(md) {
  if (!md) return '';
  var lines = md.split('\n');
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) {
      result.push('');
      continue;
    }
    // 去除标题标记 ## / ### 等
    line = line.replace(/^#{1,6}\s+/, '');
    // 去除有序列表标记 1. / 1、
    line = line.replace(/^\d+[\.\、]\s*/, '');
    // 去除无序列表标记 - / * / •
    line = line.replace(/^[\-\*\•]\s*/, '');
    // 去除加粗标记 **text**
    line = line.replace(/\*\*(.+?)\*\*/g, '$1');
    result.push(line);
  }
  // 去掉首尾空行
  while (result.length > 0 && !result[0]) result.shift();
  while (result.length > 0 && !result[result.length - 1]) result.pop();
  return result.join('\n');
}

module.exports = {
  parseMarkdown: parseMarkdown,
  markdownToPlainText: markdownToPlainText
};
