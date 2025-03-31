import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { Popup } from '../../../popup.js';

// Plugin identifiers
const extensionName = "message-hider";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Settings initialization
if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = {};
}
const defaultSettings = {
    hideN: null,    // Number of messages to keep visible from the end
    hideX: null,    // Start index for advanced hiding
    hideY: null,    // End index for advanced hiding
    findX: '',      // Regex start tag
    findY: '',      // Regex end tag
    depthZ: null    // Minimum depth for regex
};
const extensionSettings = extension_settings[extensionName];
Object.assign(extensionSettings, { ...defaultSettings, ...extensionSettings });

// Load settings and update UI
async function loadSettings() {
    $("#hide-n").val(extensionSettings.hideN || '');
    $("#find-x").val(extensionSettings.findX);
    $("#find-y").val(extensionSettings.findY);
    $("#depth-z").val(extensionSettings.depthZ || '');
}

// Save and apply all settings
function onSaveSettingsClick() {
    // Update settings from inputs
    extensionSettings.hideN = $("#hide-n").val() ? parseInt($("#hide-n").val()) : null;
    extensionSettings.findX = $("#find-x").val();
    extensionSettings.findY = $("#find-y").val();
    extensionSettings.depthZ = $("#depth-z").val() ? parseInt($("#depth-z").val()) : null;

    applyFloorHiding();
    setupRegexScript();
    saveSettingsDebounced();
}

// Apply floor hiding based on settings
function applyFloorHiding() {
    const chat = getContext().chat;
    if (!chat || chat.length === 0) return;

    const M = chat.length - 1; // Latest message index

    // Basic hiding with N
    if (extensionSettings.hideN !== null) {
        const N = extensionSettings.hideN;
        if (N >= 0 && N <= M + 1) { // Allow N up to total messages
            const end = M - N;
            if (end >= -1) { // -1 means hide nothing
                hideChatMessageRange(0, end);
            }
        }
    }

    // Advanced hiding with X and Y
    if (extensionSettings.hideX !== null && extensionSettings.hideY !== null) {
        const X = extensionSettings.hideX;
        const Y = extensionSettings.hideY;
        const start = X + 1;
        const end = Y - 1;
        if (start <= end && start >= 0 && end <= M) {
            hideChatMessageRange(start, end);
        }
    }
}

// Configure or update the RegexScript
function setupRegexScript() {
    const { findX, findY, depthZ } = extensionSettings;

    // Ensure regex extension settings exist
    if (!extension_settings.regex) extension_settings.regex = { scripts: [] };
    let regexScripts = extension_settings.regex.scripts;

    const scriptName = "Message Hider Regex";
    let script = regexScripts.find(s => s.scriptName === scriptName);

    // If either tag is empty, disable the script
    if (!findX || !findY) {
        if (script) script.disabled = true;
        return;
    }

    const escapedX = escapeRegExp(findX);
    const escapedY = escapeRegExp(findY);
    const findRegex = `${escapedX}[\\s\\S]*?${escapedY}`;

    if (!script) {
        script = {
            scriptName,
            disabled: false,
            replaceString: '',
            trimStrings: [],
            findRegex,
            substituteRegex: 1, // RAW
            markdownOnly: false,
            promptOnly: true,
            runOnEdit: true,
            minDepth: depthZ !== null ? depthZ : 0,
            maxDepth: null,
            placement: [1, 2, 6] // USER_INPUT, AI_OUTPUT, REASONING
        };
        regexScripts.push(script);
    } else {
        script.disabled = false;
        script.findRegex = findRegex;
        script.minDepth = depthZ !== null ? depthZ : 0;
    }
}

// Escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Handle advanced settings popup
async function onAdvancedSettingsClick() {
    const M = getContext().chat.length - 1;
    const defaultX = -1;
    const defaultY = M + 1;
    const currentX = extensionSettings.hideX !== null ? extensionSettings.hideX : defaultX;
    const currentY = extensionSettings.hideY !== null ? extensionSettings.hideY : defaultY;

    const popupHtml = `
        <div>
            <label for="hide-x">X:</label>
            <input type="number" id="hide-x" value="${currentX}">
        </div>
        <div>
            <label for="hide-y">Y:</label>
            <input type="number" id="hide-y" value="${currentY}">
        </div>
    `;
    const popup = new Popup(popupHtml, 'text', null, { okButton: 'Confirm', cancelButton: 'Cancel' });
    const result = await popup.show();
    if (result === 'ok') {
        extensionSettings.hideX = $("#hide-x").val() ? parseInt($("#hide-x").val()) : null;
        extensionSettings.hideY = $("#hide-y").val() ? parseInt($("#hide-y").val()) : null;
        saveSettingsDebounced();
    }
}

// Initialize the plugin
jQuery(async () => {
    const settingsHtml = `
        <div class="message-hider-panel">
            <div class="hide-floors">
                <h3>Hide Floors</h3>
                <input type="number" id="hide-n" placeholder="N" min="0">
                <div>
                    <button id="advanced-settings">Advanced Settings</button>
                    <button id="save-floors">Save</button>
                </div>
            </div>
            <div class="regex-hide">
                <h3>Regex Hide</h3>
                <div>
                    <label>Find Tags:</label>
                    <input type="text" id="find-x" placeholder="X">
                    <input type="text" id="find-y" placeholder="Y">
                </div>
                <div>
                    <label>Specify Depth:</label>
                    <input type="number" id="depth-z" placeholder="Z" min="0">
                </div>
            </div>
            <button id="save-settings">Save Current Settings</button>
        </div>
    `;
    $("#extensions_settings").append(settingsHtml);

    // Event bindings
    $("#save-settings").on("click", onSaveSettingsClick);
    $("#advanced-settings").on("click", onAdvancedSettingsClick);
    $("#save-floors").on("click", () => {
        extensionSettings.hideN = $("#hide-n").val() ? parseInt($("#hide-n").val()) : null;
        saveSettingsDebounced();
        applyFloorHiding();
    });

    await loadSettings();
});
