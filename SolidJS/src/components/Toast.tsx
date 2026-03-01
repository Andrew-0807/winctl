import { Component, For, Show } from 'solid-js';
import { toasts } from '../stores/ui';

const Toast: Component = () => {
  return (
    <div id="toast">
      <For each={toasts()}>
        {(toastItem) => (
          <div class={`toast-item ${toastItem.type}`}>
            {toastItem.msg}
          </div>
        )}
      </For>
    </div>
  );
};

export default Toast;
