<template>
  <teleport to="body">
    <transition-group name="achievement-toast" tag="div" class="achievement-toast-container">
      <div
        v-for="achievement in visibleAchievements"
        :key="achievement.id + achievement.timestamp"
        class="achievement-toast"
        @click="dismissAchievement(achievement)"
      >
        <div class="achievement-toast-icon">{{ achievement.icon }}</div>
        <div class="achievement-toast-content">
          <div class="achievement-toast-title">🏆 成就达成！</div>
          <div class="achievement-toast-name">{{ achievement.name }}</div>
          <div class="achievement-toast-desc">{{ achievement.description }}</div>
        </div>
        <div class="achievement-toast-close">×</div>
      </div>
    </transition-group>
  </teleport>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';

export default {
  name: 'AchievementToast',
  setup() {
    const visibleAchievements = ref([]);
    const toastDuration = 4000; // 4秒后自动消失

    // 显示成就通知
    const showAchievement = (achievement) => {
      const toastAchievement = {
        ...achievement,
        timestamp: Date.now()
      };
      
      visibleAchievements.value.push(toastAchievement);
      
      // 自动消失
      setTimeout(() => {
        dismissAchievement(toastAchievement);
      }, toastDuration);
    };

    // 手动关闭成就通知
    const dismissAchievement = (achievement) => {
      const index = visibleAchievements.value.findIndex(
        a => a.id === achievement.id && a.timestamp === achievement.timestamp
      );
      if (index > -1) {
        visibleAchievements.value.splice(index, 1);
      }
    };

    // 监听成就事件
    const handleAchievementEarned = (event) => {
      showAchievement(event.detail);
    };

    onMounted(() => {
      window.addEventListener('achievement-earned', handleAchievementEarned);
    });

    onUnmounted(() => {
      window.removeEventListener('achievement-earned', handleAchievementEarned);
    });

    return {
      visibleAchievements,
      dismissAchievement
    };
  }
};
</script>

<style scoped>
.achievement-toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  pointer-events: none;
}

.achievement-toast {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, 
    rgba(245, 158, 11, 0.95), 
    rgba(249, 115, 22, 0.9)
  );
  color: white;
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 0.5rem;
  box-shadow: 
    0 4px 20px rgba(245, 158, 11, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  pointer-events: auto;
  min-width: 300px;
  max-width: 400px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.achievement-toast:hover {
  transform: translateX(-5px);
  box-shadow: 
    0 6px 25px rgba(245, 158, 11, 0.5),
    0 2px 5px rgba(0, 0, 0, 0.3);
}

.achievement-toast-icon {
  font-size: 2rem;
  flex-shrink: 0;
  animation: achievementBounce 0.6s ease-out;
}

@keyframes achievementBounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

.achievement-toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.achievement-toast-title {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.achievement-toast-name {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.achievement-toast-desc {
  font-size: 0.8rem;
  opacity: 0.9;
  line-height: 1.3;
}

.achievement-toast-close {
  font-size: 1.2rem;
  font-weight: bold;
  opacity: 0.7;
  cursor: pointer;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.achievement-toast-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
}

/* 动画效果 */
.achievement-toast-enter-active,
.achievement-toast-leave-active {
  transition: all 0.4s ease;
}

.achievement-toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.achievement-toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.achievement-toast-move {
  transition: transform 0.3s ease;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .achievement-toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }
  
  .achievement-toast {
    min-width: unset;
    max-width: unset;
    padding: 0.8rem 1rem;
  }
  
  .achievement-toast-icon {
    font-size: 1.5rem;
  }
  
  .achievement-toast-name {
    font-size: 0.9rem;
  }
  
  .achievement-toast-desc {
    font-size: 0.75rem;
  }
}

/* 深色主题适配 */
[data-theme="dark"] .achievement-toast {
  background: linear-gradient(135deg, 
    rgba(245, 158, 11, 0.9), 
    rgba(249, 115, 22, 0.8)
  );
  border: 1px solid rgba(245, 158, 11, 0.3);
}
</style>