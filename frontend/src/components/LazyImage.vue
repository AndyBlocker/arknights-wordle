<template>
  <div 
    ref="containerRef"
    class="lazy-image-container"
    :class="{ 'loaded': isLoaded, 'error': hasError }"
  >
    <img
      v-if="shouldLoad"
      :src="src"
      :alt="alt"
      :class="imageClass"
      @load="handleLoad"
      @error="handleError"
      loading="lazy"
    />
    <div v-if="!isLoaded && !hasError" class="lazy-image-placeholder">
      <slot name="placeholder">
        <div class="placeholder-content">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
        </div>
      </slot>
    </div>
    <div v-if="hasError" class="lazy-image-error">
      <slot name="error">
        <div class="error-content">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span>加载失败</span>
        </div>
      </slot>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';

export default {
  name: 'LazyImage',
  props: {
    src: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    imageClass: {
      type: String,
      default: ''
    },
    rootMargin: {
      type: String,
      default: '50px'
    }
  },
  setup(props) {
    const containerRef = ref(null);
    const shouldLoad = ref(false);
    const isLoaded = ref(false);
    const hasError = ref(false);
    let observer = null;

    const handleLoad = () => {
      isLoaded.value = true;
      hasError.value = false;
    };

    const handleError = () => {
      hasError.value = true;
      isLoaded.value = false;
    };

    const startLoading = () => {
      shouldLoad.value = true;
    };

    onMounted(() => {
      if (!window.IntersectionObserver) {
        // 降级处理：直接加载
        startLoading();
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              startLoading();
              observer.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: props.rootMargin
        }
      );

      if (containerRef.value) {
        observer.observe(containerRef.value);
      }
    });

    onBeforeUnmount(() => {
      if (observer && containerRef.value) {
        observer.unobserve(containerRef.value);
      }
    });

    return {
      containerRef,
      shouldLoad,
      isLoaded,
      hasError,
      handleLoad,
      handleError
    };
  }
};
</script>

<style>
.lazy-image-container {
  position: relative;
  background-color: #f5f5f5;
  overflow: hidden;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lazy-image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease;
}

.lazy-image-placeholder,
.lazy-image-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.placeholder-content,
.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.lazy-image-error .error-content {
  color: #f44336;
}

.loaded .lazy-image-placeholder {
  display: none;
}
</style>