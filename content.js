// ==UserScript==
// @name         B站视频快进与回退快捷键 (UI优化版)
// @namespace    https://www.bilibili.com/
// @version      1.3.0
// @description  自定义快捷键控制视频快进和回退，并在播放器左下角添加快捷按钮。优化了加载时的显示位置问题。
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/*
// @match        https://live.bilibili.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    forwardKey: "=",
    backwardKey: "-",
    seekSeconds: 90,
  };
  const STORAGE_KEY = "bilibili_skipper_config";

  function getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        forwardKey:
          saved.forwardKey ||
          (saved.keyCode === 187 ? "=" : DEFAULT_CONFIG.forwardKey),
        backwardKey: saved.backwardKey || DEFAULT_CONFIG.backwardKey,
        seekSeconds:
          Number(saved.seekSeconds || saved.skipSeconds) ||
          DEFAULT_CONFIG.seekSeconds,
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  let config = getConfig();
  const keyLabel = (key) =>
    key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key;
  const saveConfig = () =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

  // --- UI Button Logic Start ---

  let skipButton = null;
  let observer = null;
  let isButtonInserted = false;

  function createSkipButtonElement() {
    if (skipButton) return skipButton;

    skipButton = document.createElement("div");
    skipButton.className = "bpx-player-ctrl-btn bilibili-skipper-btn";
    skipButton.id = "bilibili_skipper_btn"; // Add ID for easy selection

    // Styles to ensure it stays in flow and doesn't float to center
    skipButton.style.cssText = `
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      color: #fff;
      font-size: 13px;
      user-select: none;
      opacity: 0.8;
      transition: opacity 0.2s;
      position: relative; /* Ensure it follows the parent flow */
      z-index: 10; /* Ensure it's above background but below popups */
    `;

    skipButton.innerHTML = `<span style="font-weight:bold; margin-right:4px;">+${config.seekSeconds}s</span>`;
    skipButton.title = `快进 ${config.seekSeconds} 秒 (快捷键: ${keyLabel(config.forwardKey)})`;

    skipButton.onmouseenter = () => (skipButton.style.opacity = "1");
    skipButton.onmouseleave = () => (skipButton.style.opacity = "0.8");

    skipButton.addEventListener("click", (e) => {
      e.stopPropagation();
      seek(config.seekSeconds);
    });

    return skipButton;
  }

  function tryInsertButton() {
    // If already inserted and valid, skip
    if (isButtonInserted && skipButton && document.body.contains(skipButton)) {
      // Double check if it's still in the right place
      const parent = skipButton.parentElement;
      if (
        parent &&
        parent.classList.contains("bpx-player-control-bottom-left")
      ) {
        return;
      }
    }

    const leftControls = document.querySelector(
      ".bpx-player-control-bottom-left",
    );

    // Only insert if the control bar is visible and has dimensions
    // This prevents inserting when the player is in a transitional state
    if (
      leftControls &&
      leftControls.offsetHeight > 0 &&
      leftControls.offsetWidth > 0
    ) {
      const btn = createSkipButtonElement();

      // Check if already child
      if (!leftControls.contains(btn)) {
        leftControls.appendChild(btn);
        isButtonInserted = true;
      }
    }
  }

  function initObserver() {
    if (observer) observer.disconnect();

    // Debounce timer to avoid excessive DOM operations during load
    let debounceTimer;

    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        tryInsertButton();
      }, 100); // Wait 100ms after DOM changes settle
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // --- UI Button Logic End ---

  function createSettingsPanel() {
    if (document.getElementById("bilibili_skipper_settings")) return;
    const container = document.createElement("div");
    container.id = "bilibili_skipper_settings";
    container.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:99999;font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:flex-end;gap:10px";
    const toggle = document.createElement("button");
    toggle.textContent = "⚙️";
    toggle.title = "快进与回退设置";
    toggle.style.cssText =
      "width:40px;height:40px;border-radius:50%;background:#222;color:white;border:1px solid #777;cursor:pointer;font-size:20px";

    const panel = document.createElement("div");
    panel.style.cssText =
      "display:none;background:rgba(20,20,20,.96);padding:15px;border-radius:8px;color:white;width:230px;box-shadow:0 4px 15px #0008;border:1px solid #444";
    panel.innerHTML = `
      <div style="font-weight:bold;border-bottom:1px solid #444;padding-bottom:8px;margin-bottom:10px">视频快进与回退</div>
      <div style="margin-bottom:10px;font-size:12px;color:#bbb">快进按键</div>
      <button id="seek_forward_key" style="width:100%;padding:8px;margin:-5px 0 10px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer"></button>
      <div style="margin-bottom:10px;font-size:12px;color:#bbb">回退按键</div>
      <button id="seek_backward_key" style="width:100%;padding:8px;margin:-5px 0 10px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer"></button>
      <label style="display:block;margin-bottom:5px;font-size:12px;color:#bbb">每次跳转秒数</label>
      <input type="number" id="seek_seconds" min="1" step="1" style="width:100%;padding:8px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;box-sizing:border-box">
      <div style="text-align:right;margin-top:12px"><button id="seek_save" style="padding:6px 16px;background:#00a8ff;color:white;border:0;border-radius:4px;cursor:pointer">保存</button></div>`;
    container.append(panel, toggle);
    document.body.appendChild(container);

    const forwardBtn = panel.querySelector("#seek_forward_key");
    const backwardBtn = panel.querySelector("#seek_backward_key");
    const secondsInput = panel.querySelector("#seek_seconds");
    const saveBtn = panel.querySelector("#seek_save");

    const refreshLabels = () => {
      forwardBtn.textContent = `快进：${keyLabel(config.forwardKey)}（点击修改）`;
      backwardBtn.textContent = `回退：${keyLabel(config.backwardKey)}（点击修改）`;
      secondsInput.value = config.seekSeconds;

      // Update button text if it exists
      if (skipButton) {
        skipButton.title = `快进 ${config.seekSeconds} 秒 (快捷键: ${keyLabel(config.forwardKey)})`;
        skipButton.innerHTML = `<span style="font-weight:bold; margin-right:4px;">+${config.seekSeconds}s</span>`;
      }
    };

    refreshLabels();

    toggle.addEventListener(
      "click",
      () =>
        (panel.style.display =
          panel.style.display === "none" ? "block" : "none"),
    );

    function capture(button, property) {
      button.textContent = "请按下新按键…";
      const onKey = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return;
        config[property] = event.key;
        refreshLabels();
        window.removeEventListener("keydown", onKey, true);
      };
      window.addEventListener("keydown", onKey, true);
    }
    forwardBtn.addEventListener("click", () =>
      capture(forwardBtn, "forwardKey"),
    );
    backwardBtn.addEventListener("click", () =>
      capture(backwardBtn, "backwardKey"),
    );
    saveBtn.addEventListener("click", () => {
      const seconds = Number.parseInt(secondsInput.value, 10);
      if (Number.isFinite(seconds) && seconds > 0) config.seekSeconds = seconds;
      saveConfig();
      refreshLabels();
      panel.style.display = "none";
    });
  }

  function seek(delta) {
    const video = document.querySelector("video");
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(
      0,
      Math.min(video.duration, video.currentTime + delta),
    );
  }

  function init() {
    createSettingsPanel();

    // Delay the button insertion slightly to allow player layout to stabilize
    // and use an interval to keep checking until successful
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait (100ms * 50)

    const tryInitButton = setInterval(() => {
      attempts++;
      tryInsertButton();

      // If successful or max attempts reached, stop interval
      if (isButtonInserted || attempts >= maxAttempts) {
        clearInterval(tryInitButton);
        // Start observer only after initial attempt phase to reduce noise
        initObserver();
      }
    }, 100);

    document.addEventListener("keydown", (event) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const target = event.target;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)
      )
        return;
      if (event.key === config.forwardKey) {
        event.preventDefault();
        seek(config.seekSeconds);
      } else if (event.key === config.backwardKey) {
        event.preventDefault();
        seek(-config.seekSeconds);
      }
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
