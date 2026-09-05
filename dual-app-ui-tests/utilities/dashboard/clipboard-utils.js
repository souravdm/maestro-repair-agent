/**
 * Clipboard Utilities for Electron Apps
 * Provides easy copy-to-clipboard functionality for any text element
 */

window.ClipboardUtils = {
  /**
   * Copy text to clipboard.
   * Prefers Electron IPC; falls back to navigator.clipboard for browser use.
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} - Success status
   */
  async copy(text) {
    // Electron IPC path
    if (window.electron?.copyToClipboard) {
      try {
        const result = await window.electron.copyToClipboard(text);
        if (result && result.success) return true;
        console.warn('[ClipboardUtils] IPC copy returned failure, trying fallback');
      } catch (e) {
        console.warn('[ClipboardUtils] IPC copy threw, trying fallback:', e);
      }
    }

    // Browser / fallback path (works in Electron renderer too)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        console.warn('[ClipboardUtils] navigator.clipboard failed:', e);
      }
    }

    // Last resort: execCommand (deprecated but universal)
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) return true;
    } catch (e) {
      console.warn('[ClipboardUtils] execCommand fallback failed:', e);
    }

    console.error('[ClipboardUtils] All copy methods failed. window.electron available:', !!window.electron);
    return false;
  },

  /**
   * Paste from clipboard.
   * Prefers Electron IPC; falls back to navigator.clipboard.
   * @returns {Promise<string|null>} - Pasted text or null if failed
   */
  async paste() {
    if (window.electron?.pasteFromClipboard) {
      try {
        const result = await window.electron.pasteFromClipboard();
        if (result && result.success) return result.text;
      } catch (e) {
        console.warn('[ClipboardUtils] IPC paste threw, trying fallback:', e);
      }
    }
    if (navigator.clipboard && window.isSecureContext) {
      try {
        return await navigator.clipboard.readText();
      } catch (e) {
        console.warn('[ClipboardUtils] navigator.clipboard.readText failed:', e);
      }
    }
    return null;
  },

  /**
   * Add copy-on-click to an element
   * @param {HTMLElement|string} element - Element or selector
   * @param {string} [customText] - Optional custom text to copy (if not provided, uses element.textContent)
   */
  makeClickToCopy(element, customText = null) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return;

    el.style.cursor = 'pointer';
    el.title = 'Click to copy';
    el.classList.add('clipboard-copyable');

    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const textToCopy = customText || el.textContent;
      const success = await this.copy(textToCopy);
      
      if (success) {
        const originalText = el.textContent;
        el.textContent = '✓ Copied!';
        setTimeout(() => {
          el.textContent = originalText;
        }, 1500);
      }
    });
  },

  /**
   * Add copy button next to an element
   * @param {HTMLElement|string} element - Element or selector
   * @param {string} [customText] - Optional custom text to copy
   * @returns {HTMLElement} - The copy button
   */
  addCopyButton(element, customText = null) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return null;

    const button = document.createElement('button');
    button.className = 'clipboard-copy-btn';
    button.textContent = '📋';
    button.title = 'Copy to clipboard';
    button.style.cssText = `
      margin-left: 8px;
      padding: 4px 8px;
      background: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    `;

    button.addEventListener('mouseover', () => {
      button.style.background = '#e0e0e0';
    });

    button.addEventListener('mouseout', () => {
      button.style.background = '#f0f0f0';
    });

    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      const textToCopy = customText || el.textContent;
      const success = await this.copy(textToCopy);
      
      if (success) {
        const originalText = button.textContent;
        button.textContent = '✓';
        button.style.background = '#90EE90';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '#f0f0f0';
        }, 1500);
      }
    });

    el.parentNode.insertBefore(button, el.nextSibling);
    return button;
  },

  /**
   * Make all elements with a specific class copyable
   * @param {string} className - CSS class name
   * @param {boolean} [addButton=true] - Whether to add copy button
   */
  makeClassCopyable(className, addButton = true) {
    const elements = document.querySelectorAll(`.${className}`);
    elements.forEach(el => {
      if (addButton) {
        this.addCopyButton(el);
      } else {
        this.makeClickToCopy(el);
      }
    });
  },

  /**
   * Make all code blocks copyable
   */
  makeCodeBlocksCopyable() {
    const codeBlocks = document.querySelectorAll('code, pre, .code-block, .terminal-output');
    codeBlocks.forEach(block => {
      this.addCopyButton(block);
    });
  }
};

function _clipboardInit() {
  const style = document.createElement('style');
  style.textContent = `
    .clipboard-copyable {
      user-select: text;
      transition: background-color 0.2s;
    }
    .clipboard-copyable:hover {
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 4px;
    }
    .clipboard-copy-btn {
      transition: all 0.2s;
    }
    .clipboard-copy-btn:active {
      transform: scale(0.95);
    }
    .cmd-code {
      cursor: pointer;
    }
    .cmd-code:hover {
      background-color: rgba(0,0,0,0.06) !important;
      border-radius: 3px;
    }
  `;
  document.head.appendChild(style);

  // Wire up .cmd-code elements — click copies the command text
  document.querySelectorAll('.cmd-code').forEach(el => {
    el.title = 'Click to copy';
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await window.ClipboardUtils.copy(el.textContent.trim());
      if (success) {
        const orig = el.textContent;
        el.textContent = '✓ Copied!';
        setTimeout(() => { el.textContent = orig; }, 1200);
      }
    });
  });

  // Add copy button to terminal output container
  const termHeader = document.querySelector('.term-header');
  const terminal   = document.getElementById('terminal');
  if (termHeader && terminal && !termHeader.querySelector('.clipboard-copy-btn')) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost clipboard-copy-btn';
    btn.textContent = '📋 Copy Output';
    btn.style.cssText = 'font-size:11px;padding:3px 10px;margin-left:6px';
    btn.title = 'Copy terminal output to clipboard';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await window.ClipboardUtils.copy(terminal.innerText.trim());
      if (success) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1200);
      }
    });
    termHeader.appendChild(btn);
  }
}

// DOMContentLoaded may already have fired by the time this script loads
// (script is at the bottom of <body>), so guard with readyState check.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _clipboardInit);
} else {
  _clipboardInit();
}
