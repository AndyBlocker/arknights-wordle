<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="error-toast" :class="{ 'success': type === 'success' }">
        <div class="toast-content">
          <div class="toast-icon">
            <svg v-if="type === 'error'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <svg v-else-if="type === 'success'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div class="toast-message">{{ message }}</div>
          <button @click="close" class="toast-close">×</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';

export default {
  name: 'ErrorToast',
  props: {
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      default: 'error',
      validator: value => ['error', 'success', 'warning'].includes(value)
    },
    duration: {
      type: Number,
      default: 5000
    },
    autoClose: {
      type: Boolean,
      default: true
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const visible = ref(false);
    let timeoutId = null;

    const show = () => {
      visible.value = true;
      if (props.autoClose && props.duration > 0) {
        timeoutId = setTimeout(() => {
          close();
        }, props.duration);
      }
    };

    const close = () => {
      visible.value = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      emit('close');
    };

    onMounted(() => {
      show();
    });

    onBeforeUnmount(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });

    return {
      visible,
      close
    };
  }
};
</script>

<style>
.error-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background-color: #ff5252;
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  min-width: 300px;
}

.error-toast.success {
  background-color: #4caf50;
}

.toast-content {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  color: currentColor;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.toast-close:hover {
  opacity: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .error-toast {
    left: 20px;
    right: 20px;
    max-width: none;
    min-width: auto;
  }
}
</style>