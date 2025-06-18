<template>
  <div 
    ref="containerRef" 
    class="virtual-scroll-container"
    :style="{ height: containerHeight + 'px' }"
    @scroll="handleScroll"
  >
    <div 
      class="virtual-scroll-spacer" 
      :style="{ height: totalHeight + 'px' }"
    >
      <div 
        class="virtual-scroll-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <slot 
          :visible-items="visibleItems"
          :start-index="startIndex"
          :end-index="endIndex"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';

export default {
  name: 'VirtualScroll',
  props: {
    items: {
      type: Array,
      required: true
    },
    itemHeight: {
      type: Number,
      default: 60
    },
    containerHeight: {
      type: Number,
      default: 300
    },
    overscan: {
      type: Number,
      default: 5
    }
  },
  setup(props) {
    const containerRef = ref(null);
    const scrollTop = ref(0);

    const totalHeight = computed(() => props.items.length * props.itemHeight);
    
    const startIndex = computed(() => {
      const index = Math.floor(scrollTop.value / props.itemHeight);
      return Math.max(0, index - props.overscan);
    });

    const endIndex = computed(() => {
      const index = Math.ceil((scrollTop.value + props.containerHeight) / props.itemHeight);
      return Math.min(props.items.length - 1, index + props.overscan);
    });

    const visibleItems = computed(() => {
      return props.items.slice(startIndex.value, endIndex.value + 1);
    });

    const offsetY = computed(() => startIndex.value * props.itemHeight);

    const handleScroll = () => {
      if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop;
      }
    };

    // 响应式滚动处理
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    onMounted(() => {
      if (containerRef.value) {
        containerRef.value.addEventListener('scroll', throttledScroll, { passive: true });
      }
    });

    onBeforeUnmount(() => {
      if (containerRef.value) {
        containerRef.value.removeEventListener('scroll', throttledScroll);
      }
    });

    // 监听items变化，重置滚动位置
    watch(() => props.items.length, () => {
      scrollTop.value = 0;
      if (containerRef.value) {
        containerRef.value.scrollTop = 0;
      }
    });

    return {
      containerRef,
      scrollTop,
      totalHeight,
      startIndex,
      endIndex,
      visibleItems,
      offsetY,
      handleScroll
    };
  }
};
</script>

<style>
.virtual-scroll-container {
  overflow-y: auto;
  position: relative;
}

.virtual-scroll-spacer {
  position: relative;
}

.virtual-scroll-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
</style>