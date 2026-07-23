(() => {
  'use strict';

  if (!window.YG_AUTH) {
    console.warn('Modul YG_AUTH tidak ditemukan. Editor inline dinonaktifkan.');
    return;
  }

  const session = window.YG_AUTH.readStoredSession();
  if (!session) {
    // Pengguna tidak login, jangan aktifkan editor.
    return;
  }

  const API_URL = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';

  async function saveTextBlock(key, label, content) {
    if (!window.YG_AUTH) throw new Error('Modul otentikasi tidak ditemukan.');
    const session = window.YG_AUTH.readStoredSession();
    if (!session) throw new Error('Sesi admin tidak valid.');

    const body = new URLSearchParams({
      action: 'update-web-content',
      token: session.token,
      key: key,
      label: label,
      content: content
    });

    await fetch(API_URL, {
      method: 'POST',
      body,
      mode: 'no-cors'
    });
  }

  let activeEditor = null;

  function activateEditMode(element, key) {
    if (activeEditor) {
      activeEditor.cancel();
    }

    const originalContent = element.innerHTML;
    element.style.display = 'none'; // Hide original element

    const editorContainer = document.createElement('div');
    editorContainer.className = 'pell-editor-container';
    element.parentNode.insertBefore(editorContainer, element.nextSibling);

    const cleanup = () => {
      editorContainer.remove();
      element.style.display = '';
      activeEditor = null;
    };

    const save = async (html) => {
      try {
        await saveTextBlock(key, element.dataset.originalLabel || key, html);
        element.innerHTML = html;
      } catch(e) {
        alert('Gagal menyimpan: ' + e.message);
        element.innerHTML = originalContent; // Revert on failure
      }
      cleanup();
    };

    const cancel = () => {
      cleanup();
    };

    activeEditor = { cancel };

    const editor = window.pell.init({
        element: editorContainer,
        onChange: () => {}, // We use the save button's action
        defaultParagraphSeparator: 'p',
        styleWithCSS: false,
        actions: [
            'bold',
            'italic',
            'underline',
            'strikethrough',
            'heading1',
            'heading2',
            'paragraph',
            'olist',
            'ulist',
            'link',
            {
                name: 'save',
                icon: '✓',
                title: 'Simpan Perubahan',
                result: () => {
                    const html = editor.content.innerHTML;
                    save(html);
                }
            },
            {
                name: 'cancel',
                icon: '✗',
                title: 'Batalkan',
                result: () => cancel()
            }
        ],
        classes: {
            actionbar: 'pell-actionbar',
            button: 'pell-button',
            content: 'pell-content',
            selected: 'pell-button-selected'
        }
    });

    editor.content.innerHTML = originalContent;
  }

  function initializeInlineEditor() {
    const editableElements = document.querySelectorAll('[data-editable-id]');
    
    editableElements.forEach(element => {
      element.classList.add('yg-editable-element');
      element.dataset.originalLabel = element.getAttribute('aria-label') || '';
      element.title = 'Klik untuk mengedit teks ini';

      element.addEventListener('click', (event) => {
        if (event.target.closest('.pell-editor-container')) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        
        const key = element.getAttribute('data-editable-id');
        activateEditMode(element, key);
      });
    });

    const style = document.createElement('style');
    style.id = 'yg-inline-editor-styles';
    style.textContent = `
      .yg-editable-element { position: relative; transition: all 0.2s ease; }
      .yg-editable-element:hover { cursor: pointer; box-shadow: 0 0 0 2px rgba(8, 118, 83, 0.5); background-color: rgba(232, 248, 242, 0.7); }
      
      .pell-editor-container .pell-content {
        border: 2px solid #087653;
        padding: 10px;
        min-height: 100px;
        background: #fff;
        border-radius: 0 0 8px 8px;
        outline: 0;
        overflow-y: auto;
      }
      .pell-editor-container .pell-actionbar {
        background-color: #f0f0f0;
        border: 2px solid #087653;
        border-bottom: 1px solid #dcdcdc;
        border-radius: 8px 8px 0 0;
      }
      .pell-button-save { color: #087653 !important; }
      .pell-button-cancel { color: #c62828 !important; }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInlineEditor);
  } else {
    initializeInlineEditor();
  }
})();