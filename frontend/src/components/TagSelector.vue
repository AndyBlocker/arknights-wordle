<template>
  <div class="tag-selector">
    <div class="tag-groups">
      <div
        v-for="group in tagGroups"
        :key="group.id"
        class="tag-group-item"
        :class="{ active: selectedGroup.id === group.id }"
        @click="selectGroup(group.id)"
      >
        <div class="group-header">
          <span class="group-name">{{ group.name }}</span>
          <span v-if="selectedGroup.id === group.id" class="selected-indicator">✓</span>
        </div>
        <p class="group-description">{{ group.description }}</p>
        <div class="group-tags">
          <span v-for="tag in group.tags" :key="tag" class="tag-badge">
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TagSelector',
  props: {
    tagGroups: {
      type: Array,
      required: true
    },
    selectedGroup: {
      type: Object,
      required: true
    }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const selectGroup = (groupId) => {
      emit('select', groupId);
    };
    return {
      selectGroup
    };
  }
};
</script>

<style>
.tag-selector {
  /* 移除背景样式，由父容器提供 */
  padding: 0;
  margin: 0;
  color: var(--color-text);
}

.selector-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.selector-icon {
  font-size: 1.2em;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.selector-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.tag-groups {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
  justify-content: center;
}

.tag-groups::-webkit-scrollbar {
  height: 6px;
}
.tag-groups::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}
.tag-groups::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}
.tag-groups::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}

.tag-group-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
  min-height: 120px;
  padding: 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.06), 
    rgba(255,255,255,0.02)
  );
  border: 1px solid rgba(255,255,255,0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

[data-theme="dark"] .tag-group-item {
  background: linear-gradient(135deg, 
    rgba(100, 181, 246, 0.08), 
    rgba(100, 181, 246, 0.03)
  );
  border: 1px solid rgba(100, 181, 246, 0.15);
}

.tag-group-item:hover {
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.1), 
    rgba(255,255,255,0.05)
  );
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .tag-group-item:hover {
  background: linear-gradient(135deg, 
    rgba(100, 181, 246, 0.15), 
    rgba(100, 181, 246, 0.08)
  );
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.tag-group-item.active {
  background: linear-gradient(135deg, 
    rgba(52, 152, 219, 0.15), 
    rgba(52, 152, 219, 0.08)
  );
  border-color: var(--color-primary);
  box-shadow: 0 4px 16px rgba(52, 152, 219, 0.2);
}

[data-theme="dark"] .tag-group-item.active {
  background: linear-gradient(135deg, 
    rgba(100, 181, 246, 0.25), 
    rgba(100, 181, 246, 0.15)
  );
  border-color: var(--color-primary);
  box-shadow: 0 4px 16px rgba(100, 181, 246, 0.3);
}

.group-header {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}
.group-name {
  font-weight: 600;
  font-size: 16px;
}
.selected-indicator {
  margin-left: 8px;
  color: var(--color-primary);
  font-weight: bold;
  font-size: 18px;
}

.group-description {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.4;
}

.group-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.tag-badge {
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.2), 
    rgba(255,255,255,0.1)
  );
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text);
  border: 1px solid rgba(255,255,255,0.1);
  opacity: 0.8;
}

[data-theme="dark"] .tag-badge {
  background: linear-gradient(135deg, 
    rgba(100, 181, 246, 0.2), 
    rgba(100, 181, 246, 0.1)
  );
  border: 1px solid rgba(100, 181, 246, 0.2);
}

@media (max-width: 768px) {
  .selector-header {
    margin-bottom: 12px;
    padding-bottom: 8px;
  }
  
  .selector-title {
    font-size: 0.9rem;
  }
  
  .tag-groups {
    gap: 8px;
  }
  
  .tag-group-item {
    min-height: 80px;
    padding: 12px;
  }
  .group-name {
    font-size: 14px;
  }
  .group-description {
    display: none;
  }
  .group-tags {
    display: none;
  }
}
</style>
