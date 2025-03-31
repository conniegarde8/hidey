import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types, getContext, chat_metadata, updateChatMetadata } from "../../../../script.js";
import { hideChatMessageRange } from "../../../chat-logic.js"; // Adjust path if needed
import { debounce } from "../../../utils.js"; // Adjust path if needed

const extensionName = "hide-helper";
const metadataKey = 'hideHelperSettings';

const defaultChatSettings = {
    hideLastN: 0,
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
}

function createUI() {
    let hideHelperPanel = document.getElementById('hide-helper-panel');
    if (hideHelperPanel) {
        console.log("Hide Helper Panel already exists.");
        return;
    }

    hideHelperPanel = document.createElement('div');
    hideHelperPanel.id = 'hide-helper-panel';
    hideHelperPanel.classList.add('extension_panel');
    hideHelperPanel.innerHTML = `
        <h4>隐藏助手 (Hide Helper)</h4>
        <div class="hide-helper-section inline-settings-item">
            <div class="inline-setting">
                 <label for="hide-last-n">隐藏最后N层之前的消息:</label>
                 <input type="number" id="hide-last-n" min="0" placeholder="输入数字">
            </div>
             <div class="inline-setting inline-button">
                <button id="hide-apply-btn" class="menu_button">应用</button>
             </div>
        </div>
        <div class="inline-settings-item">
             <p>当前聊天隐藏设置: <span id="current-chat-hide-setting-display">无</span></p>
        </div>
        <hr class="sysHR">
    `;

    const settingsContainer = document.getElementById('extensions_settings');
    if (settingsContainer) {
        settingsContainer.appendChild(hideHelperPanel);
    } else {
        console.warn('Hide Helper: Could not find #extensions_settings container. Appending to body.');
        document.body.appendChild(hideHelperPanel);
    }

    setupEventListeners();
}

function updateUIDisplay(settings) {
    const currentSetting = settings?.hideLastN ?? 0;
    const displaySpan = document.getElementById('current-chat-hide-setting-display');
    const inputField = document.getElementById('hide-last-n');

    if (displaySpan) {
        displaySpan.textContent = currentSetting > 0 ? `${currentSetting}` : "无";
    }
    if (inputField) {
        inputField.value = currentSetting > 0 ? currentSetting : '';
    }
}

async function applyHideLogic(hideLastNValue) {
    const context = getContext();
    const chat = context?.chat;
    if (!chat || chat.length === 0) {
        console.log("Hide Helper: No chat messages to apply hiding to.");
        return;
    }

    const chatLength = chat.length;
    const numToHide = Math.max(0, hideLastNValue);

    console.log(`Hide Helper: Applying setting - hideLastN = ${numToHide}. Chat length = ${chatLength}`);

    try {
        await hideChatMessageRange(0, chatLength - 1, true);

        if (numToHide > 0 && numToHide < chatLength) {
            const visibleStartIndex = chatLength - numToHide;
             console.log(`Hide Helper: Hiding messages from index 0 to ${visibleStartIndex - 1}`);
            await hideChatMessageRange(0, visibleStartIndex - 1, false);
        } else if (numToHide === 0) {
             console.log(`Hide Helper: Unhiding all messages (hideLastN is 0).`);
        } else if (numToHide >= chatLength) {
             console.log(`Hide Helper: hideLastN (${numToHide}) >= chatLength (${chatLength}), keeping all visible.`);
        }
    } catch (error) {
        console.error("Hide Helper: Error applying hide/unhide:", error);
        toastr.error("应用隐藏设置时出错。");
    }
}

async function applyAndSaveHideSettings() {
    const context = getContext();
    if (!context || !context.chatId) {
        toastr.warning("无法获取当前聊天信息。");
        console.warn("Hide Helper: Cannot get current context or chatId.");
        return;
    }

    const inputField = document.getElementById('hide-last-n');
    const hideLastN = parseInt(inputField.value) || 0;

    await applyHideLogic(hideLastN);

    const currentMetadata = context.chatMetadata || {};
    const newSettings = { hideLastN: hideLastN };

    try {
        await updateChatMetadata({ [metadataKey]: newSettings });
        console.log(`Hide Helper: Saved settings to chat metadata:`, newSettings);
        toastr.success(`隐藏设置 (${hideLastN > 0 ? hideLastN : '无'}) 已应用并保存到当前聊天。`);
        updateUIDisplay(newSettings);
    } catch (error) {
        console.error("Hide Helper: Failed to save settings to chat metadata:", error);
        toastr.error("保存隐藏设置到聊天元数据失败。");
    }
}

const handleChatUpdate = debounce(async () => {
    const context = getContext();
    if (!context || !context.chatId) {
        console.log("Hide Helper (handleChatUpdate): No active chat context.");
        updateUIDisplay(defaultChatSettings);
        return;
    }

    console.log("Hide Helper: CHAT_UPDATED event triggered for chat:", context.chatId);

    const chatSettings = context.chatMetadata?.[metadataKey] ?? defaultChatSettings;

    updateUIDisplay(chatSettings);

    await applyHideLogic(chatSettings.hideLastN);

}, 250);

function setupEventListeners() {
    const hideLastNInput = document.getElementById('hide-last-n');
    const applyButton = document.getElementById('hide-apply-btn');

    if (!hideLastNInput) {
        console.error("Hide Helper: Could not find #hide-last-n input.");
    }

    if (applyButton) {
        applyButton.addEventListener('click', applyAndSaveHideSettings);
    } else {
        console.error("Hide Helper: Could not find #hide-apply-btn button.");
    }

    eventSource.on(event_types.CHAT_UPDATED, handleChatUpdate);
}

jQuery(async () => {
    console.log("Loading Hide Helper Extension...");
    loadSettings();
    createUI();
    setTimeout(handleChatUpdate, 500);
    console.log("Hide Helper Extension Loaded.");
});
