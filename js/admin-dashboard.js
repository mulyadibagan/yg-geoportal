(function(){
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  // Constants for localStorage keys
  const STORAGE_KEY_VISITS = 'ygAdminVisits';
  const STORAGE_KEY_TEXTS = 'ygAdminTextBlocks';

  // DOM Elements
  const elements = {
    // Statistics & History
    statTotalVisits: document.getElementById('stat-total-visits'),
    statTodayVisits: document.getElementById('stat-today-visits'),
    statTextBlocks: document.getElementById('stat-text-blocks'),
    statLastUpdated: document.getElementById('stat-last-updated'),
    visitHistoryContainer: document.getElementById('visit-history'),
    logVisitButton: document.getElementById('log-visit'),
    resetStatsButton: document.getElementById('reset-stats'),

    // Text Blocks Editor
    form: document.getElementById('text-block-form'),
    keyList: document.getElementById('text-block-list'),
    keyInput: document.getElementById('text-block-key'),
    labelInput: document.getElementById('text-block-label'),
    contentInput: document.getElementById('text-block-content'),
    clearFormButton: document.getElementById('clear-form')
  };

  /**
   * Formats a timestamp into a human-readable date string.
   * @param {number} timestamp - The timestamp to format.
   * @returns {string} The formatted date string.
   */
  function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Loads admin content (text blocks) from the server.
   * @returns {Promise<Array>} The parsed data or an empty array.
   */
  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Respons server tidak dalam format JSON.');
    }
  }

  async function loadAdminContent() {
    const session = window.YG_AUTH?.readStoredSession();
    const pageName = session ? 'admin-web-content' : 'web-content';
    const tokenParam = session ? `&token=${encodeURIComponent(session.token)}` : '';
    const apiUrl = `${API_URL}?page=${pageName}${tokenParam}&t=${Date.now()}`;

    async function fetchPage(page) {
      return new Promise((resolve, reject) => {
        const callback = 'ygAdminContentCallback_' + Date.now();
        const script = document.createElement('script');
        function cleanup() {
          try { delete window[callback]; } catch (e) {}
          script.remove();
        }

        window[callback] = (data) => {
          cleanup();
          if (data && data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data || []);
          }
        };

        script.onerror = () => {
          cleanup();
          reject(new Error('Gagal memuat skrip konten.'));
        };

        script.src = `${API_URL}?page=${page}${tokenParam}&callback=${callback}&t=${Date.now()}`;
        document.head.appendChild(script);
      });
    }

    try {
      return await fetchJson(apiUrl);
    } catch (fetchError) {
      console.warn('Fetch JSON gagal, mencoba JSONP fallback:', fetchError);
      try {
        return await fetchPage(pageName);
      } catch (jsonpError) {
        if (pageName === 'admin-web-content') {
          try {
            return await fetchPage('web-content');
          } catch (fallbackError) {
            console.error(fetchError, jsonpError, fallbackError);
            alert('Gagal memuat konten dari server: ' + fallbackError.message);
            return [];
          }
        }
        console.error(fetchError, jsonpError);
        alert('Gagal memuat konten dari server: ' + jsonpError.message);
        return [];
      }
    }
  }

  /**
   * Loads and parses JSON data from localStorage.
   * @param {string} key - The localStorage key.
   * @returns {Array} The parsed data or an empty array.
   */
  function loadJson(key) {
    try {
      const data = window.localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Gagal memuat JSON dari localStorage', e);
      return [];
    }
  }
  /**
   * Saves a JavaScript object to localStorage as a JSON string.
   * @param {string} key - The localStorage key.
   * @param {any} value - The value to save.
   */
  function saveJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Gets the current date as a 'YYYY-MM-DD' string.
   * @returns {string}
   */
  function getTodayKey() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Renders all text blocks to the list.
   */
  async function renderTextBlocksView() {
    if (!elements.keyList) return;
    elements.keyList.innerHTML = '<div class="empty-state"><p>Memuat blok teks...</p></div>';

    const texts = await loadAdminContent();
    if (!texts.length) {
      elements.keyList.innerHTML = '<div class="empty-state"><p>Belum ada blok teks. Tambahkan teks baru di form di atas.</p></div>';
      return;
    }

    const sortedTexts = texts.slice().sort((a, b) => a.key.localeCompare(b.key));
    
    elements.keyList.innerHTML = sortedTexts.map(item => `
      <div class="text-block-item">
        <div class="text-block-key">${item.key}</div>
        <div class="text-block-label">${item.label || item.key}</div>
        <div class="text-block-content">${item.content.replace(/\n/g, '<br>')}</div>
        <div class="text-block-actions">
          <button type="button" data-key="${item.key}" class="edit-text btn btn-small btn-secondary">✎ Edit</button>
          <button type="button" data-key="${item.key}" class="delete-text btn btn-small btn-outline">🗑 Hapus</button>
        </div>
      </div>
    `).join('');
  }
  
  /**
   * Renders the visit history.
   * @param {Array} visits - The array of visit objects.
   */
  function renderHistory(visits) {
    if (!elements.visitHistoryContainer) return;
    if (!visits.length) {
      elements.visitHistoryContainer.innerHTML = '<div class="empty-state"><p class="history-note">Belum ada riwayat. Klik "Catat Kunjungan" untuk memulai.</p></div>';
      return;
    }

    const sortedVisits = visits.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 8); // Show last 8

    elements.visitHistoryContainer.innerHTML = sortedVisits.map(item => `
      <div class="history-entry">
        <div class="history-entry-title">${item.title}</div>
        <div class="history-entry-time">${formatDate(item.timestamp)}</div>
      </div>
    `).join('');
  }

  /**
   * Renders the main dashboard view (stats and history).
   */
  async function renderDashboardView() {
    const visits = loadJson(STORAGE_KEY_VISITS);
    const texts = await loadAdminContent(); // Still need count for stats
    const todayKey = getTodayKey();
    const todayCount = visits.filter(item => item.day === todayKey).length;

    if (elements.statTotalVisits) elements.statTotalVisits.textContent = visits.length;
    if (elements.statTodayVisits) elements.statTodayVisits.textContent = todayCount;
    if (elements.statTextBlocks) elements.statTextBlocks.textContent = texts.length;
    
    const lastVisit = visits.length ? visits[0].timestamp : 0;
    const lastTextUpdate = texts.length ? Math.max(...texts.map(t => t.updatedAt)) : 0;
    if (elements.statLastUpdated) elements.statLastUpdated.textContent = formatDate(Math.max(lastVisit, lastTextUpdate));

    renderHistory(visits);
  }

  /**
   * Saves or updates a text block.
   * @param {string} key - The unique key for the text block.
   * @param {string} label - The admin-facing label.
   * @param {string} content - The text content.
   */
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

    await fetch(API_URL, { method: 'POST', body, mode: 'no-cors' });
    await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for DB to update
    await renderTextBlocksView(); // Refresh the text block list
    await setupPreviewInteractivity(); // Refresh preview with new content
  }

  /**
   * Deletes a text block by its key.
   * @param {string} key - The key of the block to delete.
   */
  async function deleteTextBlock(key) {
    if (!window.confirm(`Anda yakin ingin menghapus blok teks "${key}"?`)) return;
    // Mengosongkan konten akan menghapus baris di backend
    const texts = await loadAdminContent();
    const item = texts.find(t => t.key === key);
    await saveTextBlock(key, item ? item.label : '', '');
  }

  /**
   * Populates the form with data from a text block for editing.
   * @param {object} item - The text block object.
   */
  function populateFormForEdit(item) {
    elements.keyInput.value = item.key;
    elements.labelInput.value = item.label;
    elements.contentInput.value = item.content;
    elements.keyInput.readOnly = true; // Prevent changing key during edit
    elements.contentInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Load and render preview elements with inline click-to-edit functionality
   */
  async function setupPreviewInteractivity() {
    const previewElements = document.querySelectorAll('[data-editable-id]');
    if (previewElements.length === 0) return;

    try {
      let textMap = new Map();
      const texts = await loadAdminContent();
      
      // Handle API response
      if (Array.isArray(texts)) {
        textMap = new Map(texts.map(t => [t.key, t]));
      } else if (texts && typeof texts === 'object') {
        console.warn('API returned non-array:', texts);
        // Continue with empty map - preview will still work
      }

      previewElements.forEach(element => {
        const editableId = element.getAttribute('data-editable-id');
        const textBlock = textMap.get(editableId);

        // Update preview if data exists
        if (textBlock) {
          const hintEl = element.querySelector('.preview-hint');
          if (hintEl) {
            element.innerHTML = '';
            element.appendChild(hintEl);
            element.insertAdjacentText('afterbegin', textBlock.content);
          } else {
            element.textContent = textBlock.content;
          }
        }

        // Store original content for cancel
        element.dataset.originalContent = element.textContent;

        // Add click handler for inline editing
        element.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Don't edit if already editing
          if (element.classList.contains('editing')) return;
          
          // Enter edit mode
          enterEditMode(element, editableId, textBlock);
        });
      });
    } catch (error) {
      console.error('setupPreviewInteractivity error:', error);
    }
  }

  /**
   * Enter inline edit mode for a preview element
   */
  function enterEditMode(element, editableId, textBlock) {
    // Remove editing class from other elements
    document.querySelectorAll('.preview-text.editing').forEach(el => {
      if (el !== element) {
        exitEditMode(el, false);
      }
    });

    // Remove .selected from all elements
    document.querySelectorAll('[data-editable-id]').forEach(el => {
      el.classList.remove('selected');
    });

    // Enable contenteditable
    element.contentEditable = 'true';
    element.classList.add('editing');
    element.classList.add('selected');

    // Hide hint element if it exists
    const hintEl = element.querySelector('.preview-hint');
    if (hintEl) {
      hintEl.style.display = 'none';
    }

    // Focus at end of text
    element.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    // Create toolbar with save/cancel buttons
    const toolbar = document.createElement('div');
    toolbar.className = 'edit-toolbar';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'edit-btn edit-btn-save';
    saveBtn.textContent = '✓ Simpan';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'edit-btn edit-btn-cancel';
    cancelBtn.textContent = 'Batal';

    toolbar.appendChild(saveBtn);
    toolbar.appendChild(cancelBtn);
    element.parentNode.insertBefore(toolbar, element.nextSibling);

    // Save handler
    saveBtn.addEventListener('click', async () => {
      const newContent = element.textContent;
      
      // Show loading state
      saveBtn.textContent = '⏳ Menyimpan...';
      saveBtn.disabled = true;
      
      try {
        // Save to form fields for manual submission if needed
        elements.keyInput.value = editableId;
        elements.keyInput.readOnly = true;
        elements.labelInput.value = editableId;
        elements.contentInput.value = newContent;
        
        // Could also auto-submit here if desired
        // await submitTextBlock(editableId, newContent);
        
        // Exit edit mode
        exitEditMode(element, true);
        toolbar.remove();
        
        alert('✓ Perubahan tersimpan di form. Klik "Simpan Teks" di editor untuk confirm.');
      } catch (error) {
        console.error('Gagal menyimpan:', error);
        saveBtn.textContent = '✓ Simpan';
        saveBtn.disabled = false;
      }
    });

    // Cancel handler
    cancelBtn.addEventListener('click', () => {
      exitEditMode(element, false);
      toolbar.remove();
    });

    // Handle Escape key to cancel
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        exitEditMode(element, false);
        toolbar.remove();
        element.removeEventListener('keydown', handleEscape);
      }
    };
    element.addEventListener('keydown', handleEscape);
  }

  /**
   * Exit inline edit mode for a preview element
   */
  function exitEditMode(element, saved) {
    element.contentEditable = 'false';
    element.classList.remove('editing');
    element.classList.remove('selected');

    // Show hint element again if it exists
    const hintEl = element.querySelector('.preview-hint');
    if (hintEl) {
      hintEl.style.display = 'block';
    }

    // Restore original content if not saved
    if (!saved) {
      element.textContent = element.dataset.originalContent;
      // Re-add hint if needed
      if (hintEl) {
        element.appendChild(hintEl);
      }
    }

    element.blur();
  }

  /**
   * Loads initial data and renders dashboard.
   */
  async function initializePage() {
    await renderDashboardView();
    await renderTextBlocksView();
    await setupPreviewInteractivity();
  }

  /**
   * Sets up all event listeners for the page.
   */
  function setupEventListeners() {
    // Add focus/blur handlers to form fields for active state
    if (elements.form) {
      const formInputs = elements.form.querySelectorAll('input, textarea');
      formInputs.forEach(input => {
        input.addEventListener('focus', function() {
          this.closest('.form-group')?.classList.add('active');
        });
        input.addEventListener('blur', function() {
          this.closest('.form-group')?.classList.remove('active');
        });
      });
    }
    if (elements.logVisitButton) {
      elements.logVisitButton.addEventListener('click', () => {
        const visits = loadJson(STORAGE_KEY_VISITS);
        visits.unshift({
          timestamp: Date.now(),
          day: getTodayKey(),
          title: 'Kunjungan admin',
          description: 'Diklik dari dashboard admin.'
        });
        saveJson(STORAGE_KEY_VISITS, visits);
        renderDashboardView(); // Refresh dashboard
      });
    }

    if (elements.resetStatsButton) {
      elements.resetStatsButton.addEventListener('click', () => {
        if (!window.confirm('Reset semua statistik pengunjung? Tindakan ini tidak dapat dibatalkan.')) return;
        window.localStorage.removeItem(STORAGE_KEY_VISITS);
        renderDashboardView(); // Refresh dashboard
      });
    }

    if (elements.clearFormButton) {
      elements.clearFormButton.addEventListener('click', () => {
        elements.form.reset();
        elements.keyInput.readOnly = false;
        // Remove .selected from all preview elements
        document.querySelectorAll('.preview-text.selected').forEach(el => {
          el.classList.remove('selected');
        });
      });
    }

    if (elements.form) {
      elements.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const key = elements.keyInput.value.trim();
        const label = elements.labelInput.value.trim() || key;
        const content = elements.contentInput.value.trim();
        const submitButton = elements.form.querySelector('button[type="submit"]');

        if (!key || !content) {
          window.alert('ID Unik dan Isi Teks wajib diisi.');
          return;
        }
        submitButton.disabled = true;
        submitButton.textContent = '⏳ Menyimpan...';
        try {
          await saveTextBlock(key, label, content);
          event.target.reset();
          elements.keyInput.readOnly = false;
          await renderDashboardView();
        } catch (e) {
          alert('Gagal menyimpan: ' + e.message);
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = '💾 Simpan Teks';
        }
      });
    }

    if (elements.keyList) {
      elements.keyList.addEventListener('click', async (event) => {
        const editButton = event.target.closest('.edit-text');
        if (editButton) {
          const key = editButton.dataset.key;
          const texts = await loadAdminContent();
          const item = texts.find(x => x.key === key);
          if (item) {
            populateFormForEdit(item);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }

        const deleteButton = event.target.closest('.delete-text');
        if (deleteButton) {
          const key = deleteButton.dataset.key;
          deleteTextBlock(key);
        }
      });
    }
  }

  // Initial load
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializePage();
    setupTabNavigation();
    initializePolygonEditor();
  });

  /**
   * Sets up tab navigation between text editor and polygon editor
   */
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        
        // Remove active from all buttons and panes
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        
        // Add active to clicked button and corresponding pane
        button.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        // Initialize polygon editor map if switching to it
        if (tabId === 'polygon-editor') {
          setTimeout(() => initPolygonMap(), 100);
        }
      });
    });
  }

  /**
   * Polygon Editor State
   */
  let polygonMap = null;
  let polygonLayers = {};
  let selectedObjectKey = null;
  let isEditingPolygon = false;
  const polygonGeoJsonData = {};
  let allObjects = [];

  /**
   * Initialize Polygon Editor
   */
  async function initializePolygonEditor() {
    const layerFilter = document.getElementById('polygon-layer-filter');
    const searchInput = document.getElementById('polygon-search');
    const startEditBtn = document.getElementById('polygon-start-edit');
    const saveEditBtn = document.getElementById('polygon-save-edit');
    const cancelEditBtn = document.getElementById('polygon-cancel-edit');
    const objectList = document.getElementById('polygon-object-list');

    if (layerFilter) {
      // Load layer config
      if (window.YG_LAYER_CONFIG) {
        window.YG_LAYER_CONFIG.forEach(layer => {
          const option = document.createElement('option');
          option.value = layer.id;
          option.textContent = layer.label;
          layerFilter.appendChild(option);
        });
      }

      // Layer filter change
      layerFilter.addEventListener('change', filterPolygonObjects);
      
      // Search input
      if (searchInput) {
        searchInput.addEventListener('input', filterPolygonObjects);
      }
    }

    // Edit button handlers
    if (startEditBtn) {
      startEditBtn.addEventListener('click', startPolygonEdit);
    }
    if (saveEditBtn) {
      saveEditBtn.addEventListener('click', savePolygonEdit);
    }
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', cancelPolygonEdit);
    }

    // Load initial objects
    await loadPolygonObjects();
  }

  /**
   * Initialize Polygon Map
   */
  function initPolygonMap() {
    if (polygonMap) return; // Already initialized
    
    const mapElement = document.getElementById('polygon-map');
    if (!mapElement) return;

    const baseMaps = {
      "Peta Jalan": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }),
      "Citra Satelit": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 17,
        maxZoom: 20,
        attribution: 'Tiles © Esri'
      })
    };

    polygonMap = L.map('polygon-map', {
      layers: [baseMaps["Peta Jalan"]]
    }).setView([1.15, 101.95], 8);
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(polygonMap);

    L.control.scale({ imperial: false }).addTo(polygonMap);

    // Load GeoJSON layers
    // Perbaiki race condition: muat layer jika data sudah siap.
    if (Object.keys(polygonGeoJsonData).length > 0) {
      loadPolygonMapLayers();
    }
  }

  // --- Helper functions from dashboard-v3.js ---
  function layerIdOf(feature) {
    const props = feature.properties || {};
    const normalizedProps = Object.keys(props).reduce((acc, key) => {
      acc[key.toLowerCase()] = props[key];
      return acc;
    }, {});

    const candidates = [
      "layer_id", "source_layer", "layerid", "layer", "id"
    ];

    for (const candidate of candidates) {
      const value = normalizedProps[candidate];
      if (value !== null && value !== undefined) {
        const normalized = String(value).trim();
        if (normalized) return normalized.toLowerCase();
      }
    }
    return "";
  }

  function firstValue(props, keys) {
    for (const key of keys) {
      const value = String(props[key] == null ? "" : props[key]).trim();
      if (value) return value;
    }
    return "";
  }

  function donorOf(props) {
    let donor = firstValue(props, [
      "Donor", "Nama_Donor", "Funding_Source",
      "donor", "nama_donor", "funding_source"
    ]);
    if (!donor) {
      let nested = props && (
        props.targetFeatureProperties || props.proposedChanges
      );
      if (typeof nested === "string") {
        try {
          nested = JSON.parse(nested);
        } catch (error) {
          nested = {};
        }
      }
      donor = firstValue(nested || {}, [
        "Donor", "Nama_Donor", "Funding_Source",
        "donor", "nama_donor", "funding_source"
      ]);
    }
    const normalized = donor.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const aliases = {
      aramco: "Aramco Asia Singapore",
      "aramco asia singapore": "Aramco Asia Singapore",
      ppcf: "Pan Pacific Conservation Foundation (PPCF)",
      "pan pacific conservation foundation": "Pan Pacific Conservation Foundation (PPCF)",
      "pan pacific conservation foundation ppcf": "Pan Pacific Conservation Foundation (PPCF)"
    };
    return aliases[normalized] || donor;
  }

  function normalizedText(props) {
    return [
      firstValue(props, ["Nama_Objek", "title", "locationName"]),
      firstValue(props, ["Kategori", "Layer_Label", "reportType"]),
      firstValue(props, ["Program", "Nama_Program"]),
      firstValue(props, ["description", "Ket", "Keterangan"])
    ].join(" ").toLowerCase();
  }

  function featureIdentity(feature, index) {
    const props = (feature && feature.properties) || {};
    return firstValue(props, [
      "Object_ID", "objectId", "Target_Object_ID", "reportId", "Monitoring_ID"
    ]) || [layerIdOf(feature), normalizedText(props), index].join("|");
  }

  function uniqueFeatures(features) {
    const seen = new Set();
    return features.filter((feature, index) => {
      const identity = featureIdentity(feature, index).toLowerCase();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  async function mergeOfficialLayers(features) {
    const OFFICIAL_LAYERS = [
      { id: "area_mangrove", url: "data/area_mangrove.geojson" },
      { id: "area_kopi", url: "data/area_kopi.geojson" },
      { id: "kopi", url: "data/kopi.geojson" }
    ];
    let merged = features.slice();

    for (const source of OFFICIAL_LAYERS) {
      try {
        const response = await fetch(source.url + "?t=" + Date.now(), { cache: "no-store" });
        if (!response.ok) continue;
        const data = await response.json();
        if (!data || !Array.isArray(data.features)) continue;

        const official = data.features.map(feature => ({
          ...feature,
          properties: { ...(feature.properties || {}), Layer_ID: source.id, Source_Layer: source.id }
        }));

        if (source.id === "area_kopi") {
          const sourceReportIds = new Set(official.map(f => String((f.properties || {}).Source_Report_ID || "").trim().toLowerCase()).filter(Boolean));
          merged = merged.filter(f => !sourceReportIds.has(String((f.properties || {}).reportId || "").trim().toLowerCase()));
        } else {
          merged = merged.filter(f => layerIdOf(f) !== source.id);
        }
        merged.push(...official);
      } catch (error) {
        console.warn("Layer resmi dashboard gagal dimuat:", source.id, error);
      }
    }
    return merged;
  }

  function applyPematangDukuDonorPolicy(feature) {
    const props = feature && feature.properties || {};
    const village = firstValue(props, ["Desa", "WADMKD", "NAMA_DESA", "village", "locationName"]).toLowerCase();
    if (village.includes("pematang duku")) {
      props.Donor = "Pan Pacific Conservation Foundation";
      props.Donor_Cluster = "Pan Pacific Conservation Foundation";
    }
    return feature;
  }

  function applyAramcoCoastalAssetPolicy(feature) {
    const props = feature && feature.properties || {};
    const layerId = layerIdOf(feature).toLowerCase();
    if (layerId === "nursery_mangrove" || layerId === "apo" || layerId === "area_mangrove") {
      props.Donor = "Aramco Asia Singapore";
      props.Donor_Cluster = "Aramco Asia Singapore";
    }
    return feature;
  }

  function applyExternalPeatInfrastructureDonorPolicy(feature) {
    const props = feature && feature.properties || {};
    const layerId = layerIdOf(feature).toLowerCase();
    const village = firstValue(props, ["Desa", "WADMKD", "NAMA_DESA", "village", "locationName"]).toLowerCase();
    if ((layerId === "sekat_kanal" || layerId === "fdrs") && !village.includes("pematang duku")) {
      props.Donor = "Global Environment Centre";
      props.Donor_Cluster = "Global Environment Centre";
    }
    return feature;
  }

  function applyRequestedDonorCorrections(feature) {
    const props = feature && feature.properties || {};
    const layerId = layerIdOf(feature).toLowerCase();
    const identity = [props.title, props.locationName, props.Nama_Objek, props.description, props.Keterangan].filter(Boolean).join(" ").toLowerCase();
    let donor = "";
    if (layerId === "kopi") donor = "Global Environment Centre";
    if (identity.includes("rumah jemur semi permanen kopi liberika") || identity.includes("menara tampung air nursery ktwmj")) donor = "Yayasan Penabulu";
    if (!identity.includes("menara tampung air") && (identity.includes("nursery ktwmj desa temiang") || identity.includes("nursery ktwmj"))) donor = "Global Environment Centre";
    if (identity.includes("plang restorasi hutan adat imbo putui") || identity.includes("restorasi hutan adat imbo putui") || identity.includes("lokasi pup 2")) donor = "Aliansi Kolibri";
    if (donor) {
      props.Donor = donor;
      props.Donor_Cluster = donor;
    }
    return feature;
  }

  /**
   * Load GeoJSON layers to map
   */
  async function loadPolygonMapLayers() {
    if (!polygonMap) return;

    // Gunakan data yang sudah dimuat oleh loadPolygonObjects
    for (const layerId in polygonGeoJsonData) {
      const config = window.YG_LAYER_CONFIG.find(c => c.id === layerId);
      const data = polygonGeoJsonData[layerId];
      if (config && data && data.features?.length > 0) {
        const geoJsonLayer = L.geoJSON(data, {
          style: feature => ({
            color: config.color || '#666',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.3
          }),
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            radius: 7,
            fillColor: config.color,
            color: "#fff", weight: 1.5, opacity: 1, fillOpacity: 0.9
          }),
          onEachFeature: (feature, layer) => {
            layer.on('click', () => selectPolygonObject(feature, config.id, layer));
            layer.bindTooltip(feature.properties?.NAMA_DESA || feature.properties?.Keterangan || `Objek ${config.label}`);
          }
        }).addTo(polygonMap);
        polygonLayers[config.id] = geoJsonLayer;
      }
    }
  }

  /**
   * Load polygon objects list
   */
  async function loadPolygonObjects() {
    const objectListContainer = document.getElementById('polygon-object-list');
    if (!objectListContainer) return;

    objectListContainer.innerHTML = '<div class="list-status">Memuat daftar objek dari Master Database...</div>';

    // Menggunakan logika yang sama dengan WebGIS publik untuk memuat dan memproses data
    try {
      // 1. Ambil data dari Master Database (sama seperti di map-v4.js)
      const response = await fetch(`${API_URL}?page=objects&t=${Date.now()}`);
      if (!response.ok) throw new Error(`Database utama gagal dimuat: HTTP ${response.status}`);
      const data = await response.json();

      // 2. Terapkan logika penggabungan dan kebijakan yang sama dari map-v4.js
      // (Fungsi-fungsi ini perlu disalin dari js/map-v4.js ke js/admin-dashboard.js)
      const mergedFeatures = (await mergeOfficialLayers(data.features))
        .map(applyPematangDukuDonorPolicy)
        .map(applyAramcoCoastalAssetPolicy)
        .map(applyExternalPeatInfrastructureDonorPolicy)
        .map(applyRequestedDonorCorrections);

      const activeFeatures = uniqueFeatures(mergedFeatures.filter(feature => {
        if (!feature || !feature.geometry) return false;
        const props = feature.properties || {};
        const status = String(props.Status_Objek || props.status || "Aktif").toLowerCase();
        return !["nonaktif", "ditolak", "menunggu verifikasi", "perlu perbaikan"].includes(status);
      }));

      // 3. Kelompokkan fitur berdasarkan layerId untuk diproses
      const groups = {};
      activeFeatures.forEach(feature => {
        const layerId = layerIdOf(feature);
        if (!groups[layerId]) groups[layerId] = [];
        groups[layerId].push(feature);
      });

      // 4. Siapkan data untuk daftar dan peta
      allObjects = []; // Pastikan array global dikosongkan sebelum diisi ulang
      for (const layerId in groups) {
        polygonGeoJsonData[layerId] = { type: 'FeatureCollection', features: groups[layerId] };
        const config = window.YG_LAYER_CONFIG.find(c => c.id === layerId) || { id: layerId, label: layerId };
        groups[layerId].forEach((feature, idx) => {
          allObjects.push({
            id: `${layerId}_${idx}`, layerId: layerId, layerLabel: config.label, feature: feature,
            name: feature.properties?.Nama_Objek || feature.properties?.NAMA_DESA || `Objek ${idx + 1}`,
            type: feature.geometry.type
          });
        });
      }

      if (allObjects.length === 0) {
        objectListContainer.innerHTML = '<div class="list-status">Tidak ada objek ditemukan.</div>';
        return;
      }

      renderPolygonObjectList(allObjects);

      // Panggil pemuat layer peta di sini setelah polygonGeoJsonData diisi
      if (polygonMap) {
        loadPolygonMapLayers();
      }
    } catch (e) {
      console.error('Error loading objects:', e);
      objectListContainer.innerHTML = `<div class="list-error">Gagal memuat objek: ${e.message}</div>`;
    }
  }

  /**
   * Render polygon objects list
   */
  function renderPolygonObjectList(objects) {
    const objectList = document.getElementById('polygon-object-list');
    if (!objectList) return;

    objectList.innerHTML = objects.map(obj => `
      <div class="polygon-object-item" data-id="${obj.id}" data-layer-id="${obj.layerId}">
        <div class="polygon-object-name">${obj.name}</div>
        <div class="polygon-object-meta">${obj.type} • ${obj.layerLabel}</div>
      </div>
    `).join('');

    // Add click handlers
    objectList.querySelectorAll('.polygon-object-item').forEach(item => {
      item.addEventListener('click', () => {
        objectList.querySelectorAll('.polygon-object-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        
        const objId = item.dataset.id;
        const obj = allObjects.find(o => o.id === objId);
        
        if (obj && polygonMap) {
          const bounds = L.geoJSON(obj.feature).getBounds();
          polygonMap.fitBounds(bounds);

          // Temukan layer Leaflet yang sesuai dengan fitur ini agar atribut bisa dirender
          let targetLayer = null;
          const mapLayer = polygonLayers[obj.layerId];
          if (mapLayer) {
            mapLayer.eachLayer(l => { if (l.feature === obj.feature) targetLayer = l; });
          }
          
          selectPolygonObject(obj.feature, obj.layerId, targetLayer);
        }
      });
    });
  }

  /**
   * Filter polygon objects
   */
  function filterPolygonObjects() {
    const layerFilter = document.getElementById('polygon-layer-filter');
    const searchInput = document.getElementById('polygon-search');
    const objectListContainer = document.getElementById('polygon-object-list');
    if (!objectListContainer) return;

    const selectedLayer = layerFilter?.value || '';
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const allItems = objectListContainer.querySelectorAll('.polygon-object-item');

    let visibleCount = 0;
    allItems.forEach(item => {
      const layerId = item.dataset.layerId;
      const name = (item.querySelector('.polygon-object-name')?.textContent || '').toLowerCase();
      const meta = (item.querySelector('.polygon-object-meta')?.textContent || '').toLowerCase();

      const isLayerMatch = !selectedLayer || layerId === selectedLayer;
      const isSearchMatch = !searchTerm || name.includes(searchTerm) || meta.includes(searchTerm);

      item.style.display = (isLayerMatch && isSearchMatch) ? '' : 'none';
      if (isLayerMatch && isSearchMatch) {
        visibleCount++;
      }
    });

    // Kontrol visibilitas layer di peta
    if (polygonMap) {
      for (const layerId in polygonLayers) {
        const mapLayer = polygonLayers[layerId];
        if (!selectedLayer || layerId === selectedLayer) {
          if (!polygonMap.hasLayer(mapLayer)) mapLayer.addTo(polygonMap);
        } else {
          if (polygonMap.hasLayer(mapLayer)) polygonMap.removeLayer(mapLayer);
        }
      }
    }
  }

  /**
   * Select polygon object
   */
  let selectedFeatureLayer = null;
  function highlightSelectedFeature(layer) {
    if (selectedFeatureLayer) {
      // Reset style of the previously selected layer
      if (polygonLayers[selectedFeatureLayer.featureLayerConfigId]) {
        polygonLayers[selectedFeatureLayer.featureLayerConfigId].resetStyle(selectedFeatureLayer);
      }
    }
    selectedFeatureLayer = layer;
    if (layer && typeof layer.setStyle === 'function') {
      layer.setStyle({
        color: '#ffc107',
        weight: 4,
        opacity: 1,
        fillOpacity: 0.5
      });
      if (typeof layer.bringToFront === 'function') {
        layer.bringToFront();
      }
    }
  }
  function selectPolygonObject(feature, layerId, layer) {
    const features = polygonGeoJsonData[layerId]?.features || [];
    const featureIndex = features.findIndex(f => f === feature);

    if (featureIndex !== -1) {
      selectedObjectKey = `${layerId}_${featureIndex}`;
    }

    const props = feature.properties || {};
    const values = {
      'polygon-object-id': props.Object_ID || '',
      'polygon-name': props.Nama_Objek || props.name || '',
      'polygon-description': props.Deskripsi || props.Keterangan || '',
      'polygon-category': props.Kategori || '',
      'polygon-donor': props.Donor || props.Nama_Donor || props.Funding_Source || '',
      'polygon-program': props.Program || '',
      'polygon-project-name': props.Nama_Proyek || '',
      'polygon-project-id': props.Project_ID || '',
      'polygon-agreement-number': props.Nomor_Perjanjian || '',
      'polygon-phase': props.Fase || '',
      'polygon-year': props.Tahun || '',
      'polygon-regency': props.Kabupaten || '',
      'polygon-district': props.Kecamatan || '',
      'polygon-village': props.Desa || '',
      'polygon-area': props.Luas_Ha || '',
      'polygon-planted-count': props.Jumlah_Tanam || ''
    };

    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });

    const container = document.getElementById('polygon-attributes-dynamic');
    if (container) {
      renderDynamicPolygonAttributes(feature.properties, container);
    }
    if (layer) {
      layer.featureLayerConfigId = layerId;
      highlightSelectedFeature(layer);
    }
  }

  function renderDynamicPolygonAttributes(properties, container) {
    const p = properties || {};
    const hiddenKeys = /^(objectid|fid|_|id|no|x|y|foto)/i;
    const fields = Object.entries(p)
      .filter(([key, value]) => !hiddenKeys.test(key) && value !== null && typeof value !== 'object')
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (fields.length === 0) {
      container.innerHTML = '<small class="form-help">Tidak ada atribut yang dapat diedit pada objek ini.</small>';
      return;
    }

    container.innerHTML = fields.map(([key, value]) => `
      <label>${key.replace(/_/g, ' ')}
        <input type="text" name="prop_${key}" value="${String(value).replace(/"/g, '&quot;')}">
      </label>
    `).join('');
  }

  /**
   * Start editing polygon
   */
  function startPolygonEdit() {
    if (!polygonMap || !selectedObjectKey) {
      alert('Pilih objek terlebih dahulu');
      return;
    }

    isEditingPolygon = true;
    
    if (polygonMap.pm) {
      polygonMap.pm.addControls({
        position: 'topright',
        drawMarker: false,
        drawPolyline: false,
        drawPolygon: false,
        editMode: true,
        dragMode: true,
        cutPolygon: true,
        removalMode: true,
      });
    }

    document.getElementById('polygon-start-edit').style.display = 'none';
    document.getElementById('polygon-save-edit').style.display = 'inline-flex';
    document.getElementById('polygon-cancel-edit').style.display = 'inline-flex';
  }

  /**
   * Save polygon edits
   */
  async function savePolygonEdit() {
    if (!isEditingPolygon) return;

    const reason = document.getElementById('polygon-change-reason')?.value?.trim();
    if (!reason) {
      alert('Masukkan alasan perubahan untuk tujuan audit.');
      return;
    }

    const editedLayers = polygonMap.pm ? polygonMap.pm.getGeomanDrawLayers() : [];
    const [layerId, objectIndex] = selectedObjectKey.split('_');
    const originalFeature = polygonGeoJsonData[layerId]?.features[objectIndex];

    if (!originalFeature) {
      alert('Objek asli tidak ditemukan. Gagal menyimpan.');
      return;
    }

    const newGeometry = editedLayers.length > 0
      ? editedLayers[0].toGeoJSON().geometry
      : originalFeature.geometry;

    const updatedProperties = { ...originalFeature.properties };
    document.querySelectorAll('#polygon-attributes-dynamic input[name^="prop_"]').forEach(input => {
      const key = input.name.substring(5); // Hapus prefix 'prop_'
      updatedProperties[key] = input.value;
    });

    const propertyFields = [
      ['Nama_Objek', 'polygon-name'],
      ['Deskripsi', 'polygon-description'],
      ['Kategori', 'polygon-category'],
      ['Donor', 'polygon-donor'],
      ['Program', 'polygon-program'],
      ['Nama_Proyek', 'polygon-project-name'],
      ['Project_ID', 'polygon-project-id'],
      ['Nomor_Perjanjian', 'polygon-agreement-number'],
      ['Fase', 'polygon-phase'],
      ['Tahun', 'polygon-year'],
      ['Kabupaten', 'polygon-regency'],
      ['Kecamatan', 'polygon-district'],
      ['Desa', 'polygon-village']
    ];

    propertyFields.forEach(([propKey, elementId]) => {
      const input = document.getElementById(elementId);
      if (input) {
        updatedProperties[propKey] = String(input.value || '').trim();
      }
    });

    const areaInput = document.getElementById('polygon-area');
    const plantedInput = document.getElementById('polygon-planted-count');
    if (areaInput) {
      updatedProperties.Luas_Ha = areaInput.value === '' ? '' : Number(areaInput.value);
    }
    if (plantedInput) {
      updatedProperties.Jumlah_Tanam = plantedInput.value === '' ? '' : Number(plantedInput.value);
    }

    const objectData = {
      objectId: updatedProperties.Object_ID || `feature_${objectIndex}`,
      layerId: updatedProperties.Layer_ID || updatedProperties.Source_Layer || layerId,
      layerLabel: updatedProperties.Layer_Label || '',
      objectName: updatedProperties.Nama_Objek || '',
      category: updatedProperties.Kategori || '',
      sourceType: updatedProperties.Source_Type || 'program_layer',
      sourceReportId: updatedProperties.Source_Report_ID || '',
      program: updatedProperties.Program || '',
      donor: updatedProperties.Donor || '',
      projectName: updatedProperties.Nama_Proyek || '',
      projectId: updatedProperties.Project_ID || '',
      agreementNumber: updatedProperties.Nomor_Perjanjian || '',
      phase: updatedProperties.Fase || '',
      year: updatedProperties.Tahun || '',
      province: updatedProperties.Provinsi || '',
      regency: updatedProperties.Kabupaten || '',
      district: updatedProperties.Kecamatan || '',
      village: updatedProperties.Desa || '',
      areaHa: updatedProperties.Luas_Ha === '' ? '' : Number(updatedProperties.Luas_Ha || 0),
      lengthM: updatedProperties.Panjang_M === '' ? '' : Number(updatedProperties.Panjang_M || 0),
      plantedCount: updatedProperties.Jumlah_Tanam === '' ? '' : Number(updatedProperties.Jumlah_Tanam || 0),
      status: updatedProperties.Status_Objek || 'Aktif',
      geometry: newGeometry,
      properties: updatedProperties
    };

    const saveEditBtn = document.getElementById('polygon-save-edit');
    const cancelEditBtn = document.getElementById('polygon-cancel-edit');
    if (saveEditBtn) {
      saveEditBtn.disabled = true;
      saveEditBtn.textContent = 'Menyimpan...';
    }
    if (cancelEditBtn) {
      cancelEditBtn.disabled = true;
    }

    try {
      const sessionToken = window.YG_AUTH?.readStoredSession()?.token;
      if (!sessionToken) throw new Error('Sesi editor tidak valid. Silakan login ulang.');

      await sendUpdateMasterObject(objectData, sessionToken, reason);
      selectedFeature.properties = updatedProperties;
      selectedFeature.geometry = newGeometry;
      setStatus('Perubahan objek polygon berhasil dikirim. Mode edit tetap aktif.', 'ok');
    } catch (error) {
      console.error(error);
      setStatus('Gagal mengirim perubahan: ' + (error.message || 'Tidak diketahui'), 'error');
    } finally {
      if (saveEditBtn) {
        saveEditBtn.disabled = false;
        saveEditBtn.textContent = '💾 Simpan Perubahan';
      }
      if (cancelEditBtn) {
        cancelEditBtn.disabled = false;
      }
    }
  }

  async function sendUpdateMasterObject(objectData, sessionToken, reason) {
    if (!sessionToken) throw new Error('Sesi editor tidak valid.');
    const body = new URLSearchParams();
    body.set('action', 'update-master-object');
    body.set('token', sessionToken);
    body.set('sessionToken', sessionToken);
    body.set('reason', reason);
    body.set('objectData', JSON.stringify(objectData));

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body.toString()
    });
  }

  /**
   * Cancel polygon editing
   */
  function cancelPolygonEdit() {
    if (selectedFeatureLayer) {
       highlightSelectedFeature(null); // Clear highlight
    }

    // Hapus layer hasil gambar yang belum disimpan
    polygonMap.pm.getGeomanDrawLayers().forEach(layer => layer.remove());

    isEditingPolygon = false;
    
    if (polygonMap && polygonMap.pm) {
      polygonMap.pm.disableDraw();
      polygonMap.pm.removeControls();
    }

    document.getElementById('polygon-start-edit').style.display = 'inline-flex';
    document.getElementById('polygon-save-edit').style.display = 'none';
    document.getElementById('polygon-cancel-edit').style.display = 'none';
  }

})();
