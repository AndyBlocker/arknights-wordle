// src/main.js
import { createApp } from 'vue';
import App from './App.vue';

// 引入全局变量CSS
import './styles/variables.css';

// 初始化主题
import { initTheme } from './themes';
initTheme();

createApp(App).mount('#app');
