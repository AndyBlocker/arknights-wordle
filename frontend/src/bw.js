// src/bw.js - 移动端小头模式入口文件
import { createApp } from 'vue';
import MobilePuzzleApp from './MobilePuzzleApp.vue';

// 引入全局变量CSS
import './styles/variables.css';

// 初始化主题（移动端强制使用深色主题）
import { setTheme } from './themes';
setTheme('dark');

// 移动端专用样式
import './styles/mobile.css';

const app = createApp(MobilePuzzleApp);

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue应用错误:', err, info);
  
  // 显示用户友好的错误信息
  const errorMessage = err.message || '应用发生了未知错误';
  
  // 可以在这里添加错误上报逻辑
  if (window.gtag) {
    window.gtag('event', 'exception', {
      description: errorMessage,
      fatal: false
    });
  }
};

// 挂载应用
app.mount('#app');

// 移动端优化
if ('serviceWorker' in navigator) {
  // 可以在这里注册service worker
}

console.log('泰拉鉴定大师课毕业考试 - 移动端版本已启动');