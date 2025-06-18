=== FILE START: ./src/AppWrapper.vue ===
<template>
  <div class="app-wrapper">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'AppWrapper'
}
</script>

<style>
/* 全局或通用样式（如果需要） */
.app-wrapper {
  width: 100%;
  min-height: 100vh;
  background: var(--background-color);
}
</style>
=== FILE END: ./src/AppWrapper.vue ===
