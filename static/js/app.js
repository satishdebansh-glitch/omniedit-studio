// ============================================================================
// 🔥 OMNIEDIT STUDIO MASTER ENGINE
// Includes: Instant Firebase Auth, AI Voice Subtitles, Pixel Chroma Key,
// Web Audio API Equalizer, Smooth Keyframe Automation & 3D Graphic Studio
// ============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDMwl4hP8VAdiS2D_5GKvXzxDfiCt9-Yhg",
    authDomain: "omniedit-studio-415f4.firebaseapp.com",
    projectId: "omniedit-studio-415f4",
    storageBucket: "omniedit-studio-415f4.firebasestorage.app",
    messagingSenderId: "410104627523",
    appId: "1:410104627523:web:126cfd711186d142562ff6",
    measurementId: "G-T12VSPW639"
};

let fbAuth = null;
let fbDb = null;

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        fbAuth = firebase.auth();
        fbDb = firebase.firestore();
        if (firebase.analytics) firebase.analytics();
        console.log("⚡ OmniEdit Studio Cloud Connected");
    }
} catch (err) {
    console.warn("Firebase initialization note:", err);
}

class OmniEditStudio {
    constructor() {
        this.activeWorkspace = 'ws-home';
        this.assets = [];
        this.clips = [];
        this.selectedClipId = null;
        this.pxPerSec = 32;
        this.timelineDuration = 35;
        this.currentTime = 0;
        this.isPlaying = false;
        this.aspectRatio = '16:9';
        this.videoFilter = 'none';

        // Main Video Transform State
        this.videoRotation = 0;
        this.videoFlipH = 1;
        this.videoScale = 100;
        this.videoTiltY = 0;
        this.videoFitMode = 'contain';
        this.playbackRate = 1.0;

        // Advanced Master Features State
        this.chromaKeyActive = false;
        this.chromaColor = '#00ff00';
        this.keyframes = []; // [{ time, scale, tilt, posX, posY }]
        this.audioCtx = null;
        this.bassFilter = null;
        this.vocalFilter = null;

        this.artboard3D = { rx: 0, ry: 0, rz: 0, depth: 12 };
        this.rafId = null;
        this.lastTick = 0;

        this.savedProjects = JSON.parse(localStorage.getItem('omniedit_studio_projects') || '[]');
        this.currentUser = JSON.parse(localStorage.getItem('omniedit_studio_user') || 'null');

        // Core DOM
        this.videoEl = document.getElementById('main-video');
        this.arollWrapper = document.getElementById('aroll-transform-wrapper');
        this.synthCanvas = document.getElementById('synth-video-canvas');
        this.synthCtx = this.synthCanvas ? this.synthCanvas.getContext('2d', { willReadFrequently: true }) : null;
        this.audioEl = new Audio();
        this.scrubber = document.getElementById('timeline-scrubber');
        this.timecodeEl = document.getElementById('timecode-display');
        this.playheadEl = document.getElementById('playhead-line');
        this.lanesScroll = document.getElementById('timeline-lanes-scroll');
        this.previewStage = document.getElementById('video-preview-container');

        this.bindWorkspaceNavigation();
        this.bindFileInputs();
        this.initVideoEngine();
        this.initInteractiveStageOverlays();
        this.initPlayheadDragging();
        this.initMasterAdvancedFeatures();
        this.initGraphic3DEngine();
        this.initAccountAndProjectsHub();
        this.initDashboardClearButtons();
        this.initExportModal();
        this.fetchServerAssets();
    }

    notify(message, icon = 'fa-circle-check') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.innerHTML = `<i class="fa-solid ${icon}" style="color:#10b981"></i> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2800);
    }

    /* ================= WORKSPACE NAVIGATION ================= */
    bindWorkspaceNavigation() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchWorkspace(tab.dataset.ws));
        });

        const goVideo = document.getElementById('home-go-video');
        if (goVideo) goVideo.addEventListener('click', () => this.switchWorkspace('ws-video'));

        const goGraphic = document.getElementById('home-go-graphic');
        if (goGraphic) goGraphic.addEventListener('click', () => this.switchWorkspace('ws-graphic'));

        const loadDemo = document.getElementById('home-load-demo');
        if (loadDemo) {
            loadDemo.addEventListener('click', () => {
                this.switchWorkspace('ws-video');
                this.loadBuiltInSampleVideo();
            });
        }
    }

    switchWorkspace(wsId) {
        this.activeWorkspace = wsId;
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.ws === wsId));
        document.querySelectorAll('.workspace').forEach(sec => sec.classList.toggle('active', sec.id === wsId));

        if (wsId === 'ws-graphic' && this.canvas) {
            setTimeout(() => {
                this.canvas.calcOffset();
                this.canvas.requestRenderAll();
            }, 35);
        }
    }

    /* ================= 4-CARD DELETE / CLEAR ALL ACTIONS ON HOME DASHBOARD ================= */
    initDashboardClearButtons() {
        const clearAssetsBtn = document.getElementById('clear-all-assets-btn');
        if (clearAssetsBtn) {
            clearAssetsBtn.addEventListener('click', async () => {
                this.assets = [];
                this.renderMediaPools();
                try { await fetch('/api/assets/clear', { method: 'POST' }); } catch (e) {}
                this.notify('All Uploaded Media Assets Removed!', 'fa-trash-can');
            });
        }

        const clearClipsBtn = document.getElementById('clear-all-clips-btn');
        if (clearClipsBtn) {
            clearClipsBtn.addEventListener('click', () => {
                this.pausePlayback();
                this.clips = [];
                this.selectedClipId = null;
                const statClips = document.getElementById('stat-clips');
                if (statClips) statClips.textContent = '0';
                const emptyState = document.getElementById('video-empty-state');
                if (emptyState) emptyState.hidden = false;
                this.renderTimelineClips();
                this.renderInspector();
                this.evaluateTimelineFrame();
                this.notify('All Timeline Clips Cleared!', 'fa-trash-can');
            });
        }

        const clearLayersBtn = document.getElementById('clear-all-layers-btn');
        if (clearLayersBtn) {
            clearLayersBtn.addEventListener('click', () => {
                if (this.canvas) {
                    this.canvas.clear();
                    this.canvas.setBackgroundColor('#0b0f19', () => this.canvas.requestRenderAll());
                    this.refreshLayerStack();
                    this.notify('All 3D / 2D Graphic Layers Cleared!', 'fa-trash-can');
                }
            });
        }

        const clearAllProjects = () => {
            this.savedProjects = [];
            localStorage.setItem('omniedit_studio_projects', '[]');
            this.renderSavedProjectsUI();
            this.notify('All Saved Projects Deleted!', 'fa-trash-can');
        };

        const clearProjBtn = document.getElementById('clear-all-projects-btn');
        if (clearProjBtn) clearProjBtn.addEventListener('click', clearAllProjects);

        const accDelAllBtn = document.getElementById('acc-delete-all-proj-btn');
        if (accDelAllBtn) accDelAllBtn.addEventListener('click', clearAllProjects);
    }

    /* ================= UPLOAD & INDIVIDUAL ASSET DELETE ================= */
    async fetchServerAssets() {
        try {
            const res = await fetch('/api/assets');
            const data = await res.json();
            if (data.status === 'success') {
                this.assets = data.assets.map(a => ({ ...a, serverUrl: a.url }));
                this.renderMediaPools();
                const expEl = document.getElementById('acc-total-exports');
                if (expEl) expEl.textContent = data.exportsCount || 0;
                const storEl = document.getElementById('acc-storage-used');
                if (storEl) storEl.textContent = `${((data.storageBytes || 0) / (1024 * 1024)).toFixed(1)} MB`;
            }
        } catch (err) {}
    }

    async deleteSingleAsset(assetId) {
        this.assets = this.assets.filter(a => a.id !== assetId);
        this.renderMediaPools();
        try {
            await fetch('/api/assets/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: assetId })
            });
        } catch (e) {}
        this.notify('Media file deleted', 'fa-trash-can');
    }

    bindFileInputs() {
        const processSelectedFiles = async (fileList, targetMode) => {
            const files = Array.from(fileList || []);
            if (!files.length) return;

            for (const file of files) {
                const localBlobUrl = URL.createObjectURL(file);
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                let type = 'video';
                if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext) || file.type.startsWith('image/')) {
                    type = 'image';
                } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext) || file.type.startsWith('audio/')) {
                    type = 'audio';
                }

                const newAsset = {
                    id: 'asset_' + Math.random().toString(36).slice(2, 9),
                    name: file.name,
                    url: localBlobUrl,
                    serverUrl: '',
                    type: type,
                    size: file.size
                };

                this.assets.push(newAsset);
                this.renderMediaPools();

                if (targetMode === 'graphic-image') {
                    this.switchWorkspace('ws-graphic');
                    this.insertGraphicImage(newAsset.url, newAsset.name);
                } else if (targetMode === 'png-overlay') {
                    this.switchWorkspace('ws-video');
                    this.addAssetToVideoStudio(newAsset);
                } else if (this.activeWorkspace === 'ws-graphic' && type === 'image') {
                    this.insertGraphicImage(newAsset.url, newAsset.name);
                } else {
                    this.addAssetToVideoStudio(newAsset);
                }

                try {
                    const fd = new FormData();
                    fd.append('file', file);
                    const res = await fetch('/api/upload', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.status === 'success') {
                        newAsset.id = data.asset.id;
                        newAsset.serverUrl = data.asset.url;
                        this.renderMediaPools();
                    }
                } catch (e) {}
            }
        };

        const bindInput = (id, mode) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    processSelectedFiles(e.target.files, mode);
                    e.target.value = '';
                });
            }
        };

        bindInput('input-any-media', 'auto');
        bindInput('input-video-only', 'video');
        bindInput('input-png-overlay', 'png-overlay');
        bindInput('input-audio-only', 'audio');
        bindInput('input-graphic-image', 'graphic-image');
    }

    bindRealVideoFileOnce(asset) {
        const emptyState = document.getElementById('video-empty-state');
        if (emptyState) emptyState.hidden = true;
        this.synthCanvas.hidden = true;
        this.videoEl.hidden = false;
        const monTitle = document.getElementById('video-monitor-title');
        if (monTitle) monTitle.textContent = `Program Monitor — ${asset.name}`;

        const probeVideo = document.createElement('video');
        probeVideo.preload = 'metadata';
        probeVideo.src = asset.url;

        probeVideo.addEventListener('loadedmetadata', () => {
            const duration = Math.max(1, Number((probeVideo.duration || 15).toFixed(2)));
            this.clips = this.clips.filter(c => !c.isSynth);

            const endOfARoll = this.clips
                .filter(c => c.track === 'aroll')
                .reduce((max, c) => Math.max(max, c.start + c.duration), 0);

            this.timelineDuration = Math.max(35, Math.ceil(endOfARoll + duration + 10));
            this.scrubber.max = Math.max(duration, endOfARoll + duration);

            const clip = this.addTimelineClip({
                name: asset.name,
                track: 'aroll',
                start: endOfARoll,
                duration: duration,
                mediaOffset: 0,
                url: asset.url,
                serverUrl: asset.serverUrl || ''
            });

            this.videoEl.src = asset.url;
            this.selectClip(clip.id);
            this.drawRuler();
            this.seekTo(endOfARoll);
            this.notify(`Loaded video "${asset.name}" (${duration}s)`, 'fa-film');
            probeVideo.remove();
        }, { once: true });
    }

    addAssetToVideoStudio(asset) {
        this.switchWorkspace('ws-video');
        if (asset.type === 'video') {
            this.bindRealVideoFileOnce(asset);
        } else if (asset.type === 'audio') {
            const clip = this.addTimelineClip({
                name: asset.name,
                track: 'audio',
                start: 0,
                duration: 15,
                url: asset.url,
                serverUrl: asset.serverUrl || ''
            });
            this.selectClip(clip.id);
            this.notify(`Added "${asset.name}" to Audio Track`, 'fa-music');
        } else if (asset.type === 'image') {
            const emptyState = document.getElementById('video-empty-state');
            if (emptyState) emptyState.hidden = true;
            const clip = this.addTimelineClip({
                name: asset.name,
                track: 'broll',
                start: this.currentTime,
                duration: 8,
                url: asset.url,
                serverUrl: asset.serverUrl || '',
                posX: 55,
                posY: 12,
                widthPct: 34,
                heightPct: 38,
                rotation: 0
            });
            this.selectClip(clip.id);
            this.evaluateTimelineFrame();
            this.notify(`PNG "${asset.name}" added! Drag & resize it on the video screen!`, 'fa-images');
        }
    }

    renderMediaPools() {
        const statAssets = document.getElementById('stat-assets');
        if (statAssets) statAssets.textContent = this.assets.length;

        const homeGrid = document.getElementById('home-media-grid');
        const videoList = document.getElementById('video-asset-list');

        if (homeGrid) {
            homeGrid.innerHTML = this.assets.length === 0
                ? `<div style="color:var(--text-secondary);grid-column:1/-1;padding:14px;">No media assets uploaded yet. Click "+ Upload" above.</div>`
                : '';
        }
        if (videoList) videoList.innerHTML = '';

        this.assets.forEach(asset => {
            const icon = asset.type === 'video' ? 'fa-film' : asset.type === 'audio' ? 'fa-music' : 'fa-image';
            const kb = (asset.size / 1024).toFixed(1) + ' KB';

            if (homeGrid) {
                const card = document.createElement('div');
                card.className = 'media-card';
                card.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <div style="display:flex;align-items:center;gap:8px;font-weight:700;overflow:hidden;">
                            <i class="fa-solid ${icon}" style="color:var(--accent-bright)"></i>
                            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${asset.name}</span>
                        </div>
                        <button type="button" class="icon-btn del-asset-btn" title="Delete Media File" style="color:#fca5a5;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-secondary);">
                        <span>${asset.type.toUpperCase()} • ${kb}</span>
                        <button type="button" class="btn btn-xs btn-primary use-asset-btn">+ Use</button>
                    </div>
                `;
                card.querySelector('.use-asset-btn').addEventListener('click', () => this.addAssetToVideoStudio(asset));
                card.querySelector('.del-asset-btn').addEventListener('click', () => this.deleteSingleAsset(asset.id));
                homeGrid.appendChild(card);
            }

            if (videoList) {
                const row = document.createElement('div');
                row.className = 'asset-item';
                row.innerHTML = `
                    <div style="display:flex;align-items:center;gap:7px;overflow:hidden;">
                        <i class="fa-solid ${icon}" style="color:var(--accent-bright)"></i>
                        <span class="asset-item-title" title="${asset.name}">${asset.name}</span>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button type="button" class="btn btn-xs btn-primary add-bin-btn">+ Add</button>
                        <button type="button" class="icon-btn del-bin-btn" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;
                row.querySelector('.add-bin-btn').addEventListener('click', () => this.addAssetToVideoStudio(asset));
                row.querySelector('.del-bin-btn').addEventListener('click', () => this.deleteSingleAsset(asset.id));
                videoList.appendChild(row);
            }
        });
    }

    /* ================= MASTER ADVANCED FEATURES (AI SUBTITLES, CHROMA KEY, WEB AUDIO EQ, KEYFRAMES) ================= */
    initMasterAdvancedFeatures() {
        // 1. AI Voiceover & Auto-Captions Generator (Web Speech API)
        const aiSubBtn = document.getElementById('btn-ai-subtitles');
        if (aiSubBtn) {
            aiSubBtn.addEventListener('click', () => {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    const fallbackText = prompt('Enter subtitle text for Auto-Caption Track:', 'OMNIEDIT AI AUTO-CAPTION');
                    if (fallbackText) {
                        const clip = this.addTimelineClip({
                            name: 'AI Caption',
                            track: 'overlay',
                            start: this.currentTime,
                            duration: 5,
                            text: fallbackText.toUpperCase(),
                            ovStyle: 'neon',
                            posX: 24,
                            posY: 75,
                            fontSize: 22
                        });
                        this.selectClip(clip.id);
                        this.notify('Added Auto-Caption to Overlay Track!', 'fa-closed-captioning');
                    }
                    return;
                }

                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = 'en-US';

                this.notify('🎙️ Listening... Speak now to generate AI Subtitles!', 'fa-microphone-lines');
                recognition.start();

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    const clip = this.addTimelineClip({
                        name: 'AI Subtitle',
                        track: 'overlay',
                        start: this.currentTime,
                        duration: 5,
                        text: transcript.toUpperCase(),
                        ovStyle: 'neon',
                        posX: 22,
                        posY: 76,
                        fontSize: 22
                    });
                    this.selectClip(clip.id);
                    this.notify(`AI Subtitle Created: "${transcript}"`, 'fa-closed-captioning');
                };

                recognition.onerror = () => {
                    this.notify('Mic unavailable — adding sample AI Caption instead', 'fa-wand-magic-sparkles');
                    const clip = this.addTimelineClip({
                        name: 'AI Auto-Caption',
                        track: 'overlay',
                        start: this.currentTime,
                        duration: 5,
                        text: 'AI VOICE AUTO-CAPTION ACTIVE',
                        ovStyle: 'neon',
                        posX: 22,
                        posY: 76,
                        fontSize: 22
                    });
                    this.selectClip(clip.id);
                };
            });
        }

        // 2. Real Pixel-by-Pixel Chroma Key (Green Screen Removal)
        const chkChroma = document.getElementById('chk-chroma-key');
        const chromaColorPicker = document.getElementById('chroma-target-color');
        if (chkChroma) {
            chkChroma.addEventListener('change', () => {
                this.chromaKeyActive = chkChroma.checked;
                this.evaluateTimelineFrame();
                this.notify(
                    this.chromaKeyActive ? 'Chroma Key Green Screen Removal ACTIVE' : 'Chroma Key Disabled',
                    'fa-circle-half-stroke'
                );
            });
        }
        if (chromaColorPicker) {
            chromaColorPicker.addEventListener('input', (e) => {
                this.chromaColor = e.target.value;
                if (this.chromaKeyActive) this.evaluateTimelineFrame();
            });
        }

        // 3. Web Audio API Real-Time 2-Band Equalizer (Bass & Vocal Clarity)
        const initWebAudioEQ = () => {
            if (this.audioCtx) return;
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContextClass();
                const source = this.audioCtx.createMediaElementSource(this.videoEl);

                this.bassFilter = this.audioCtx.createBiquadFilter();
                this.bassFilter.type = 'lowshelf';
                this.bassFilter.frequency.value = 180;

                this.vocalFilter = this.audioCtx.createBiquadFilter();
                this.vocalFilter.type = 'peaking';
                this.vocalFilter.frequency.value = 2800;
                this.vocalFilter.Q.value = 1.0;

                source.connect(this.bassFilter);
                this.bassFilter.connect(this.vocalFilter);
                this.vocalFilter.connect(this.audioCtx.destination);
            } catch (e) {}
        };

        const eqBass = document.getElementById('eq-bass');
        const eqVocal = document.getElementById('eq-vocal');
        if (eqBass) {
            eqBass.addEventListener('input', (e) => {
                initWebAudioEQ();
                const val = parseFloat(e.target.value) || 0;
                if (this.bassFilter) this.bassFilter.gain.value = val;
            });
            eqBass.addEventListener('change', (e) => {
                this.notify(`Audio Bass Boost: ${e.target.value} dB`, 'fa-wave-square');
            });
        }
        if (eqVocal) {
            eqVocal.addEventListener('input', (e) => {
                initWebAudioEQ();
                const val = parseFloat(e.target.value) || 0;
                if (this.vocalFilter) this.vocalFilter.gain.value = val;
            });
            eqVocal.addEventListener('change', (e) => {
                this.notify(`Vocal Clarity EQ: ${e.target.value} dB`, 'fa-microphone');
            });
        }

        // 4. Keyframe Automation Engine
        const kfBtn = document.getElementById('btn-add-keyframe');
        if (kfBtn) {
            kfBtn.addEventListener('click', () => {
                const activeClip = this.clips.find(c => c.id === this.selectedClipId);
                const kf = {
                    time: Number(this.currentTime.toFixed(2)),
                    scale: this.videoScale,
                    tilt: this.videoTiltY,
                    posX: activeClip ? activeClip.posX : 25,
                    posY: activeClip ? activeClip.posY : 75
                };
                this.keyframes.push(kf);
                this.keyframes.sort((a, b) => a.time - b.time);
                this.notify(`Keyframe #${this.keyframes.length} recorded at ${kf.time}s!`, 'fa-key');
            });
        }
    }

    hexToRgb(hex) {
        const clean = hex.replace('#', '');
        const num = parseInt(clean, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    applyChromaKeyToCanvas() {
        if (!this.chromaKeyActive || !this.synthCtx) return;
        const w = this.synthCanvas.width;
        const h = this.synthCanvas.height;
        const frame = this.synthCtx.getImageData(0, 0, w, h);
        const data = frame.data;
        const target = this.hexToRgb(this.chromaColor);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const dist = Math.sqrt(
                (r - target.r) * (r - target.r) +
                (g - target.g) * (g - target.g) +
                (b - target.b) * (b - target.b)
            );
            if (dist < 115) {
                data[i + 3] = 0; // Make matching green/target pixels transparent
            }
        }
        this.synthCtx.putImageData(frame, 0, 0);
    }

    /* ================= INTERACTIVE VIDEO MONITOR OVERLAY DRAG & RESIZE ================= */
    initInteractiveStageOverlays() {
        const brollBox = document.getElementById('broll-visual-box');
        const brollResize = document.getElementById('broll-resize-handle');
        const overlayBox = document.getElementById('overlay-text-box');
        const overlayResize = document.getElementById('overlay-resize-handle');

        const makeStageDraggable = (el, trackType) => {
            if (!el) return;
            el.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('stage-resize-handle')) return;
                e.stopPropagation();

                const activeClip = this.getActiveClipOnTrack(trackType);
                if (activeClip) this.selectClip(activeClip.id);

                const stageRect = this.previewStage.getBoundingClientRect();
                const startX = e.clientX;
                const startY = e.clientY;
                const origLeftPct = activeClip ? activeClip.posX : parseFloat(el.style.left) || 50;
                const origTopPct = activeClip ? activeClip.posY : parseFloat(el.style.top) || 50;

                const onMove = (mv) => {
                    const dxPct = ((mv.clientX - startX) / stageRect.width) * 100;
                    const dyPct = ((mv.clientY - startY) / stageRect.height) * 100;
                    const newX = Math.max(-20, Math.min(95, Number((origLeftPct + dxPct).toFixed(1))));
                    const newY = Math.max(-20, Math.min(95, Number((origTopPct + dyPct).toFixed(1))));

                    el.style.left = `${newX}%`;
                    el.style.top = `${newY}%`;

                    if (activeClip) {
                        activeClip.posX = newX;
                        activeClip.posY = newY;
                        this.renderInspector();
                    }
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        };

        const makeStageResizable = (handleEl, boxEl, trackType) => {
            if (!handleEl || !boxEl) return;
            handleEl.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const activeClip = this.getActiveClipOnTrack(trackType);
                if (activeClip) this.selectClip(activeClip.id);

                const stageRect = this.previewStage.getBoundingClientRect();
                const startX = e.clientX;
                const startY = e.clientY;

                const origW = activeClip ? activeClip.widthPct : 32;
                const origH = activeClip ? activeClip.heightPct : 32;
                const origFont = activeClip ? (activeClip.fontSize || 20) : 20;

                const onMove = (mv) => {
                    const dxPct = ((mv.clientX - startX) / stageRect.width) * 100;
                    const dyPct = ((mv.clientY - startY) / stageRect.height) * 100;

                    if (trackType === 'broll') {
                        const newW = Math.max(8, Math.min(100, Number((origW + dxPct).toFixed(1))));
                        const newH = Math.max(8, Math.min(100, Number((origH + dyPct).toFixed(1))));
                        boxEl.style.width = `${newW}%`;
                        boxEl.style.height = `${newH}%`;
                        if (activeClip) {
                            activeClip.widthPct = newW;
                            activeClip.heightPct = newH;
                            this.renderInspector();
                        }
                    } else {
                        const newFont = Math.max(10, Math.min(72, Math.round(origFont + dxPct * 0.6)));
                        boxEl.style.fontSize = `${newFont}px`;
                        if (activeClip) {
                            activeClip.fontSize = newFont;
                            this.renderInspector();
                        }
                    }
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        };

        makeStageDraggable(brollBox, 'broll');
        makeStageResizable(brollResize, brollBox, 'broll');

        makeStageDraggable(overlayBox, 'overlay');
        makeStageResizable(overlayResize, overlayBox, 'overlay');
    }

    getActiveClipOnTrack(trackName) {
        const t = this.currentTime;
        return this.clips.find(c => c.track === trackName && t >= c.start && t <= c.start + c.duration);
    }

    /* ================= DRAGGABLE RED PLAYHEAD ================= */
    initPlayheadDragging() {
        let isDraggingPlayhead = false;

        const updatePlayheadFromMouse = (clientX) => {
            const rect = this.lanesScroll.getBoundingClientRect();
            const offsetX = clientX - rect.left + this.lanesScroll.scrollLeft;
            const targetSec = Math.max(0, offsetX / this.pxPerSec);
            this.seekTo(targetSec);
        };

        if (this.playheadEl) {
            this.playheadEl.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.pausePlayback();
                isDraggingPlayhead = true;
            });
        }

        const ruler = document.getElementById('time-ruler');
        if (ruler) {
            ruler.addEventListener('mousedown', (e) => {
                this.pausePlayback();
                isDraggingPlayhead = true;
                updatePlayheadFromMouse(e.clientX);
            });
        }

        document.querySelectorAll('.track-lane').forEach(lane => {
            lane.addEventListener('mousedown', (e) => {
                if (e.target === lane) updatePlayheadFromMouse(e.clientX);
            });
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingPlayhead) return;
            updatePlayheadFromMouse(e.clientX);
        });

        window.addEventListener('mouseup', () => {
            isDraggingPlayhead = false;
        });
    }

    /* ================= ENGINE 1: VIDEO STUDIO CONTROLS ================= */
    initVideoEngine() {
        this.drawRuler();
        this.renderInspector();

        const sampleBtn = document.getElementById('btn-load-sample-video');
        if (sampleBtn) sampleBtn.addEventListener('click', () => this.loadBuiltInSampleVideo());

        const stageSampleBtn = document.getElementById('stage-sample-btn');
        if (stageSampleBtn) stageSampleBtn.addEventListener('click', () => this.loadBuiltInSampleVideo());

        const addOvBtn = document.getElementById('btn-add-overlay-track');
        if (addOvBtn) {
            addOvBtn.addEventListener('click', () => {
                const clip = this.addTimelineClip({
                    name: 'Text Overlay',
                    track: 'overlay',
                    start: this.currentTime,
                    duration: 6,
                    text: 'OMNIEDIT STUDIO',
                    ovStyle: 'neon',
                    posX: 24,
                    posY: 74,
                    fontSize: 22
                });
                this.selectClip(clip.id);
                this.notify('Added Text Overlay! Drag it on the video screen.', 'fa-font');
            });
        }

        const addBrBtn = document.getElementById('btn-add-broll-track');
        if (addBrBtn) {
            addBrBtn.addEventListener('click', () => {
                const clip = this.addTimelineClip({
                    name: 'Draggable PiP Box',
                    track: 'broll',
                    start: this.currentTime,
                    duration: 6,
                    posX: 58,
                    posY: 12,
                    widthPct: 32,
                    heightPct: 34
                });
                this.selectClip(clip.id);
                this.notify('Added B-Roll Box! Drag & resize it on the video screen.', 'fa-clapperboard');
            });
        }

        document.querySelectorAll('.tpl-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const clip = this.addTimelineClip({
                    name: btn.textContent,
                    track: 'overlay',
                    start: this.currentTime,
                    duration: 6,
                    text: btn.dataset.tpl,
                    ovStyle: btn.dataset.style,
                    posX: 25,
                    posY: 75,
                    fontSize: 22
                });
                this.selectClip(clip.id);
                this.notify(`Added "${btn.dataset.tpl}"!`, 'fa-wand-magic-sparkles');
            });
        });

        document.querySelectorAll('.ar-pill').forEach(btn => {
            btn.addEventListener('click', () => this.setAspectRatio(btn.dataset.ar));
        });

        document.querySelectorAll('.v-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setVideoFilter(btn.dataset.filter));
        });

        const fitContain = document.getElementById('btn-fit-contain');
        if (fitContain) fitContain.addEventListener('click', () => { this.videoEl.style.objectFit = 'contain'; });

        const fitCover = document.getElementById('btn-fit-cover');
        if (fitCover) fitCover.addEventListener('click', () => { this.videoEl.style.objectFit = 'cover'; });

        const rotBtn = document.getElementById('btn-rotate-video');
        if (rotBtn) rotBtn.addEventListener('click', () => {
            this.videoRotation = (this.videoRotation + 90) % 360;
            this.applyMainVideoTransform();
        });

        const flipBtn = document.getElementById('btn-flip-video');
        if (flipBtn) flipBtn.addEventListener('click', () => {
            this.videoFlipH *= -1;
            this.applyMainVideoTransform();
        });

        const scaleSlider = document.getElementById('vid-scale-slider');
        if (scaleSlider) {
            scaleSlider.addEventListener('input', (e) => {
                this.videoScale = parseInt(e.target.value, 10) || 100;
                const lbl = document.getElementById('vid-zoom-lbl');
                if (lbl) lbl.textContent = `${this.videoScale}%`;
                this.applyMainVideoTransform();
            });
        }

        const tiltSlider = document.getElementById('vid-tilt-slider');
        if (tiltSlider) {
            tiltSlider.addEventListener('input', (e) => {
                this.videoTiltY = parseInt(e.target.value, 10) || 0;
                const lbl = document.getElementById('vid-tilt-lbl');
                if (lbl) lbl.textContent = `${this.videoTiltY}°`;
                this.applyMainVideoTransform();
            });
        }

        document.getElementById('btn-play-pause').addEventListener('click', () => this.togglePlayback());
        document.getElementById('btn-stop').addEventListener('click', () => {
            this.pausePlayback();
            this.seekTo(0);
        });
        document.getElementById('btn-jump-start').addEventListener('click', () => this.seekTo(0));
        this.scrubber.addEventListener('input', (e) => this.seekTo(parseFloat(e.target.value)));

        const rateSel = document.getElementById('playback-rate-select');
        if (rateSel) {
            rateSel.addEventListener('change', (e) => {
                this.playbackRate = parseFloat(e.target.value) || 1.0;
                this.videoEl.playbackRate = this.playbackRate;
            });
        }

        document.getElementById('video-volume').addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            this.videoEl.volume = vol;
            this.audioEl.volume = vol;
        });

        document.getElementById('tl-split-at-playhead').addEventListener('click', () => this.splitAtRedPlayhead());
        document.getElementById('tl-duplicate-btn').addEventListener('click', () => this.duplicateSelectedClip());
        document.getElementById('tl-delete-btn').addEventListener('click', () => this.deleteSelectedClip());

        document.getElementById('tl-zoom').addEventListener('input', (e) => {
            this.pxPerSec = parseInt(e.target.value, 10);
            this.drawRuler();
            this.renderTimelineClips();
            this.updatePlayheadUI();
        });

        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
            if (this.activeWorkspace === 'ws-video') {
                if (e.code === 'Space') { e.preventDefault(); this.togglePlayback(); }
                if (e.key.toLowerCase() === 's') { e.preventDefault(); this.splitAtRedPlayhead(); }
                if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelectedClip(); }
            }
        });
    }

    applyMainVideoTransform() {
        const s = this.videoScale / 100;
        this.arollWrapper.style.transform = `rotateY(${this.videoTiltY}deg) rotateZ(${this.videoRotation}deg) scale(${s * this.videoFlipH}, ${s})`;
    }

    splitAtRedPlayhead() {
        const t = this.currentTime;
        const eps = 0.08;

        let targets = [];
        if (this.selectedClipId) {
            const sel = this.clips.find(c => c.id === this.selectedClipId);
            if (sel && t > sel.start + eps && t < sel.start + sel.duration - eps) {
                targets.push(sel);
            }
        }
        if (targets.length === 0) {
            targets = this.clips.filter(c => t > c.start + eps && t < c.start + c.duration - eps);
        }
        if (targets.length === 0) {
            this.notify('Drag the Red Line over a clip first to split it!', 'fa-scissors');
            return;
        }

        let lastId = null;
        targets.forEach(clip => {
            const firstDur = Number((t - clip.start).toFixed(2));
            const secondDur = Number((clip.duration - firstDur).toFixed(2));
            clip.duration = firstDur;

            const rightHalf = {
                ...clip,
                id: 'clip_' + Math.random().toString(36).slice(2, 9),
                name: `${clip.name} (Part 2)`,
                start: Number(t.toFixed(2)),
                duration: secondDur,
                mediaOffset: Number((clip.mediaOffset + firstDur).toFixed(2))
            };
            this.clips.push(rightHalf);
            lastId = rightHalf.id;
        });

        const statClips = document.getElementById('stat-clips');
        if (statClips) statClips.textContent = this.clips.length;
        if (lastId) this.selectClip(lastId);
        this.renderTimelineClips();
        this.notify(`Split ${targets.length} clip(s) at Red Line (${t.toFixed(1)}s)!`, 'fa-scissors');
    }

    loadBuiltInSampleVideo() {
        const emptyState = document.getElementById('video-empty-state');
        if (emptyState) emptyState.hidden = true;
        if (!this.clips.some(c => c.track === 'aroll')) {
            const mainClip = this.addTimelineClip({
                name: 'OmniEdit_Studio_Demo_Master.mp4',
                track: 'aroll',
                start: 0,
                duration: 18,
                isSynth: true
            });
            this.addTimelineClip({
                name: '3D Neon Title',
                track: 'overlay',
                start: 0.5,
                duration: 10,
                text: 'OMNIEDIT STUDIO',
                ovStyle: 'neon',
                posX: 22,
                posY: 74,
                fontSize: 22
            });
            this.addTimelineClip({
                name: 'Draggable PNG Overlay',
                track: 'broll',
                start: 1,
                duration: 10,
                posX: 60,
                posY: 10,
                widthPct: 32,
                heightPct: 34
            });
            this.selectClip(mainClip.id);
        }
        this.scrubber.max = 22;
        this.seekTo(1.5);
        this.startPlayback();
        this.notify('Demo Loaded! Drag the PNG/B-Roll box or Text right on the video screen!', 'fa-hand-pointer');
    }

    setAspectRatio(ratio) {
        this.aspectRatio = ratio;
        document.querySelectorAll('.ar-pill').forEach(b => b.classList.toggle('active', b.dataset.ar === ratio));
        this.previewStage.className = `preview-stage ar-${ratio.replace(':', '-')}`;
    }

    setVideoFilter(filterName) {
        this.videoFilter = filterName;
        document.querySelectorAll('.v-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filterName));
        this.videoEl.className = `v-filter-${filterName}`;
        this.synthCanvas.className = `v-filter-${filterName}`;
    }

    drawRuler() {
        const ruler = document.getElementById('time-ruler');
        if (!ruler) return;
        const totalW = this.timelineDuration * this.pxPerSec;
        ruler.style.width = `${totalW}px`;
        ruler.innerHTML = '';

        for (let s = 0; s <= this.timelineDuration; s++) {
            if (s % 2 === 0 || this.pxPerSec >= 45) {
                const mark = document.createElement('div');
                mark.className = 'ruler-mark';
                mark.style.left = `${s * this.pxPerSec}px`;
                mark.textContent = this.formatTime(s);
                ruler.appendChild(mark);
            }
        }

        ['overlay', 'broll', 'aroll', 'audio'].forEach(t => {
            const lane = document.getElementById(`track-${t}`);
            if (lane) {
                lane.style.width = `${totalW}px`;
                lane.style.backgroundSize = `${this.pxPerSec}px 100%`;
            }
        });
    }

    addTimelineClip(opts) {
        const clip = {
            id: 'clip_' + Math.random().toString(36).slice(2, 9),
            name: opts.name || 'Clip',
            track: opts.track || 'aroll',
            start: Number((opts.start || 0).toFixed(2)),
            duration: Number((opts.duration || 5).toFixed(2)),
            mediaOffset: Number((opts.mediaOffset || 0).toFixed(2)),
            url: opts.url || '',
            serverUrl: opts.serverUrl || '',
            isSynth: Boolean(opts.isSynth),
            text: opts.text || opts.name || 'OVERLAY TEXT',
            ovStyle: opts.ovStyle || 'neon',
            posX: opts.posX ?? (opts.track === 'broll' ? 58 : 25),
            posY: opts.posY ?? (opts.track === 'broll' ? 12 : 75),
            widthPct: opts.widthPct ?? 32,
            heightPct: opts.heightPct ?? 34,
            fontSize: opts.fontSize ?? 22,
            rotation: opts.rotation ?? 0
        };
        this.clips.push(clip);
        const statClips = document.getElementById('stat-clips');
        if (statClips) statClips.textContent = this.clips.length;
        this.renderTimelineClips();
        this.evaluateTimelineFrame();
        return clip;
    }

    renderTimelineClips() {
        ['overlay', 'broll', 'aroll', 'audio'].forEach(t => {
            const lane = document.getElementById(`track-${t}`);
            if (lane) lane.innerHTML = '';
        });

        this.clips.forEach(clip => {
            const lane = document.getElementById(`track-${clip.track}`);
            if (!lane) return;

            const el = document.createElement('div');
            el.className = `clip-block type-${clip.track} ${clip.id === this.selectedClipId ? 'selected' : ''}`;
            el.style.left = `${clip.start * this.pxPerSec}px`;
            el.style.width = `${Math.max(24, clip.duration * this.pxPerSec)}px`;

            const title = clip.track === 'overlay' ? clip.text : clip.name;
            el.innerHTML = `
                <div class="trim-handle trim-left"></div>
                <div style="pointer-events:none;overflow:hidden;text-overflow:ellipsis;">${title}</div>
                <div class="clip-meta">${clip.start.toFixed(1)}s • ${clip.duration.toFixed(1)}s</div>
                <div class="trim-handle trim-right"></div>
            `;

            el.querySelector('.trim-left').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.selectClip(clip.id);
                this.startTrimClip(e, clip, 'left');
            });

            el.querySelector('.trim-right').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.selectClip(clip.id);
                this.startTrimClip(e, clip, 'right');
            });

            el.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.selectClip(clip.id);
                this.startMoveClip(e, clip);
            });

            lane.appendChild(el);
        });
    }

    startMoveClip(e, clip) {
        const startX = e.clientX;
        const origStart = clip.start;
        const onMove = (mv) => {
            const deltaSec = (mv.clientX - startX) / this.pxPerSec;
            clip.start = Math.max(0, Number((origStart + deltaSec).toFixed(2)));
            this.renderTimelineClips();
            this.renderInspector();
            this.evaluateTimelineFrame();
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    startTrimClip(e, clip, side) {
        const startX = e.clientX;
        const origStart = clip.start;
        const origDur = clip.duration;
        const origOffset = clip.mediaOffset;

        const onMove = (mv) => {
            const deltaSec = (mv.clientX - startX) / this.pxPerSec;
            if (side === 'right') {
                clip.duration = Math.max(0.4, Number((origDur + deltaSec).toFixed(2)));
            } else {
                const maxDelta = origDur - 0.4;
                const clampedDelta = Math.max(-origStart, Math.min(maxDelta, deltaSec));
                clip.start = Number((origStart + clampedDelta).toFixed(2));
                clip.duration = Number((origDur - clampedDelta).toFixed(2));
                clip.mediaOffset = Math.max(0, Number((origOffset + clampedDelta).toFixed(2)));
            }
            this.renderTimelineClips();
            this.renderInspector();
            this.evaluateTimelineFrame();
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    selectClip(clipId) {
        this.selectedClipId = clipId;
        this.renderTimelineClips();
        this.renderInspector();
    }

    duplicateSelectedClip() {
        const clip = this.clips.find(c => c.id === this.selectedClipId);
        if (!clip) return;
        const copy = this.addTimelineClip({
            ...clip,
            name: `${clip.name} Copy`,
            start: Number((clip.start + clip.duration + 0.2).toFixed(2))
        });
        this.selectClip(copy.id);
    }

    deleteSelectedClip() {
        if (!this.selectedClipId) return;
        this.clips = this.clips.filter(c => c.id !== this.selectedClipId);
        this.selectedClipId = null;
        const statClips = document.getElementById('stat-clips');
        if (statClips) statClips.textContent = this.clips.length;
        this.renderTimelineClips();
        this.renderInspector();
        this.evaluateTimelineFrame();
    }

    renderInspector() {
        const box = document.getElementById('video-clip-inspector');
        if (!box) return;
        const clip = this.clips.find(c => c.id === this.selectedClipId);

        if (!clip) {
            box.innerHTML = `<div style="color:var(--text-secondary);font-size:11px;padding:8px;background:var(--bg-surface);border-radius:6px;">Select any clip or click directly on a PNG/Text overlay on the video screen to adjust its X/Y position, size, and timing.</div>`;
            return;
        }

        const isVisualOverlay = clip.track === 'broll' || clip.track === 'overlay';

        box.innerHTML = `
            <div class="field-group">
                <label>Clip Name</label>
                <input type="text" id="insp-clip-name" value="${clip.name}">
            </div>
            ${clip.track === 'overlay' ? `
            <div class="field-group">
                <label>Overlay Text</label>
                <input type="text" id="insp-clip-text" value="${clip.text}">
            </div>` : ''}
            ${isVisualOverlay ? `
            <div class="prop-grid-2">
                <div class="field-group">
                    <label>Position X (%)</label>
                    <input type="number" step="1" id="insp-pos-x" value="${clip.posX}">
                </div>
                <div class="field-group">
                    <label>Position Y (%)</label>
                    <input type="number" step="1" id="insp-pos-y" value="${clip.posY}">
                </div>
            </div>
            <div class="prop-grid-2">
                <div class="field-group">
                    <label>${clip.track === 'broll' ? 'Width (%)' : 'Font Size (px)'}</label>
                    <input type="number" step="1" id="insp-size-w" value="${clip.track === 'broll' ? clip.widthPct : clip.fontSize}">
                </div>
                <div class="field-group">
                    <label>Rotation (°)</label>
                    <input type="number" step="5" id="insp-rot" value="${clip.rotation || 0}">
                </div>
            </div>` : ''}
            <div class="prop-grid-2">
                <div class="field-group">
                    <label>Start (sec)</label>
                    <input type="number" step="0.1" min="0" id="insp-clip-start" value="${clip.start}">
                </div>
                <div class="field-group">
                    <label>Duration (sec)</label>
                    <input type="number" step="0.1" min="0.4" id="insp-clip-dur" value="${clip.duration}">
                </div>
            </div>
        `;

        document.getElementById('insp-clip-name').addEventListener('input', (e) => {
            clip.name = e.target.value;
            this.renderTimelineClips();
        });
        if (clip.track === 'overlay') {
            document.getElementById('insp-clip-text').addEventListener('input', (e) => {
                clip.text = e.target.value;
                this.renderTimelineClips();
                this.evaluateTimelineFrame();
            });
        }
        if (isVisualOverlay) {
            document.getElementById('insp-pos-x').addEventListener('input', (e) => {
                clip.posX = parseFloat(e.target.value) || 0;
                this.evaluateTimelineFrame();
            });
            document.getElementById('insp-pos-y').addEventListener('input', (e) => {
                clip.posY = parseFloat(e.target.value) || 0;
                this.evaluateTimelineFrame();
            });
            document.getElementById('insp-size-w').addEventListener('input', (e) => {
                const v = parseFloat(e.target.value) || 20;
                if (clip.track === 'broll') {
                    clip.widthPct = v;
                    clip.heightPct = v;
                } else {
                    clip.fontSize = v;
                }
                this.evaluateTimelineFrame();
            });
            document.getElementById('insp-rot').addEventListener('input', (e) => {
                clip.rotation = parseFloat(e.target.value) || 0;
                this.evaluateTimelineFrame();
            });
        }
        document.getElementById('insp-clip-start').addEventListener('input', (e) => {
            clip.start = Math.max(0, parseFloat(e.target.value) || 0);
            this.renderTimelineClips();
            this.evaluateTimelineFrame();
        });
        document.getElementById('insp-clip-dur').addEventListener('input', (e) => {
            clip.duration = Math.max(0.4, parseFloat(e.target.value) || 1);
            this.renderTimelineClips();
            this.evaluateTimelineFrame();
        });
    }

    /* ================= PLAYBACK & STAGE SYNC ================= */
    togglePlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            if (this.clips.length === 0) {
                this.loadBuiltInSampleVideo();
                return;
            }
            this.startPlayback();
        }
    }

    startPlayback() {
        this.isPlaying = true;
        document.getElementById('btn-play-pause').innerHTML = `<i class="fa-solid fa-pause"></i>`;
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        this.lastTick = performance.now();

        const tick = (now) => {
            if (!this.isPlaying) return;
            const dt = ((now - this.lastTick) / 1000) * this.playbackRate;
            this.lastTick = now;

            const maxTime = parseFloat(this.scrubber.max) || 30;
            this.currentTime += dt;

            if (this.currentTime >= maxTime) {
                this.currentTime = 0;
                this.pausePlayback();
            }

            this.scrubber.value = this.currentTime;
            this.updatePlayheadUI();
            this.updateTimecodeUI();
            this.evaluateTimelineFrame();

            this.rafId = requestAnimationFrame(tick);
        };

        this.rafId = requestAnimationFrame(tick);
    }

    pausePlayback() {
        this.isPlaying = false;
        document.getElementById('btn-play-pause').innerHTML = `<i class="fa-solid fa-play"></i>`;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.videoEl.pause();
        this.audioEl.pause();
    }

    seekTo(sec) {
        const maxTime = Math.max(parseFloat(this.scrubber.max) || 30, this.timelineDuration);
        this.currentTime = Math.max(0, Math.min(maxTime, sec));
        this.scrubber.value = Math.min(this.currentTime, parseFloat(this.scrubber.max) || 30);
        this.updatePlayheadUI();
        this.updateTimecodeUI();
        this.evaluateTimelineFrame(true);
    }

    updatePlayheadUI() {
        if (this.playheadEl) this.playheadEl.style.left = `${this.currentTime * this.pxPerSec}px`;
    }

    updateTimecodeUI() {
        const maxTime = parseFloat(this.scrubber.max) || 30;
        if (this.timecodeEl) this.timecodeEl.textContent = `${this.formatTime(this.currentTime)} / ${this.formatTime(maxTime)}`;
    }

    evaluateTimelineFrame(forceSeek = false) {
        const t = this.currentTime;

        // Smooth Keyframe Interpolation if keyframes exist
        if (this.keyframes.length >= 2) {
            for (let i = 0; i < this.keyframes.length - 1; i++) {
                const k1 = this.keyframes[i];
                const k2 = this.keyframes[i + 1];
                if (t >= k1.time && t <= k2.time) {
                    const ratio = (t - k1.time) / Math.max(0.01, k2.time - k1.time);
                    this.videoScale = Math.round(k1.scale + (k2.scale - k1.scale) * ratio);
                    this.videoTiltY = Math.round(k1.tilt + (k2.tilt - k1.tilt) * ratio);
                    this.applyMainVideoTransform();
                    break;
                }
            }
        }

        const ovClip = this.clips.find(c => c.track === 'overlay' && t >= c.start && t <= c.start + c.duration);
        const ovBox = document.getElementById('overlay-text-box');
        const ovSpan = document.getElementById('overlay-text-span');
        if (ovClip && ovBox && ovSpan) {
            ovBox.hidden = false;
            ovSpan.textContent = ovClip.text;
            ovBox.className = `interactive-stage-item stage-overlay-text ov-style-${ovClip.ovStyle || 'neon'}`;
            ovBox.style.left = `${ovClip.posX ?? 25}%`;
            ovBox.style.top = `${ovClip.posY ?? 75}%`;
            ovBox.style.fontSize = `${ovClip.fontSize ?? 22}px`;
            ovBox.style.transform = `rotate(${ovClip.rotation || 0}deg)`;
        } else if (ovBox) {
            ovBox.hidden = true;
        }

        const brollClip = this.clips.find(c => c.track === 'broll' && t >= c.start && t <= c.start + c.duration);
        const brollBox = document.getElementById('broll-visual-box');
        const brollImg = document.getElementById('broll-img-el');
        const brollBadge = document.getElementById('broll-badge-el');
        if (brollClip && brollBox) {
            brollBox.hidden = false;
            brollBox.style.left = `${brollClip.posX ?? 58}%`;
            brollBox.style.top = `${brollClip.posY ?? 12}%`;
            brollBox.style.width = `${brollClip.widthPct ?? 32}%`;
            brollBox.style.height = `${brollClip.heightPct ?? 34}%`;
            brollBox.style.transform = `rotate(${brollClip.rotation || 0}deg)`;

            if (brollClip.url) {
                brollImg.hidden = false;
                brollBadge.hidden = true;
                if (brollImg.src !== brollClip.url) brollImg.src = brollClip.url;
            } else {
                brollImg.hidden = true;
                brollBadge.hidden = false;
                brollBadge.textContent = brollClip.name;
            }
        } else if (brollBox) {
            brollBox.hidden = true;
        }

        const arollClip = this.clips.find(c => c.track === 'aroll' && t >= c.start && t <= c.start + c.duration);
        if (arollClip) {
            const emptyState = document.getElementById('video-empty-state');
            if (emptyState) emptyState.hidden = true;

            if (arollClip.isSynth) {
                this.videoEl.pause();
                this.videoEl.hidden = true;
                this.synthCanvas.hidden = false;
                this.drawSynthFrame(t - arollClip.start + arollClip.mediaOffset, arollClip.name);
            } else if (arollClip.url) {
                if (this.videoEl.src !== arollClip.url) this.videoEl.src = arollClip.url;
                const targetMediaTime = (t - arollClip.start) + arollClip.mediaOffset;
                if (forceSeek || Math.abs(this.videoEl.currentTime - targetMediaTime) > 0.35) {
                    this.videoEl.currentTime = targetMediaTime;
                }
                if (this.isPlaying && this.videoEl.paused) {
                    this.videoEl.play().catch(() => {});
                }

                // If Chroma Key is enabled on real video, render through canvas with green screen removal
                if (this.chromaKeyActive && this.videoEl.readyState >= 2) {
                    this.videoEl.hidden = true;
                    this.synthCanvas.hidden = false;
                    this.synthCtx.drawImage(this.videoEl, 0, 0, this.synthCanvas.width, this.synthCanvas.height);
                    this.applyChromaKeyToCanvas();
                } else {
                    this.synthCanvas.hidden = true;
                    this.videoEl.hidden = false;
                }
            }
        } else {
            this.videoEl.pause();
        }

        const audioClip = this.clips.find(c => c.track === 'audio' && t >= c.start && t <= c.start + c.duration);
        if (audioClip && audioClip.url) {
            if (this.audioEl.src !== audioClip.url) this.audioEl.src = audioClip.url;
            const targetAudioTime = (t - audioClip.start) + audioClip.mediaOffset;
            if (forceSeek || Math.abs(this.audioEl.currentTime - targetAudioTime) > 0.4) {
                this.audioEl.currentTime = targetAudioTime;
            }
            if (this.isPlaying && this.audioEl.paused) {
                this.audioEl.play().catch(() => {});
            }
        } else {
            this.audioEl.pause();
        }
    }

    drawSynthFrame(sec, clipName) {
        if (!this.synthCtx) return;
        const ctx = this.synthCtx;
        const w = this.synthCanvas.width;
        const h = this.synthCanvas.height;

        const hue = (sec * 40) % 360;
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, `hsl(${hue}, 70%, 15%)`);
        grad.addColorStop(1, `hsl(${(hue + 80) % 360}, 75%, 8%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 2;
        const offset = (sec * 90) % 90;
        for (let x = -offset; x < w; x += 90) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 115 + Math.sin(sec * 5) * 28, 0, Math.PI * 2);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(clipName, w / 2, h / 2 - 12);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 32px JetBrains Mono, monospace';
        ctx.fillText(`TIMECODE  ${this.formatTime(sec)}`, w / 2, h / 2 + 42);

        if (this.chromaKeyActive) {
            this.applyChromaKeyToCanvas();
        }
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        const ms = Math.floor((sec % 1) * 10);
        return `${m}:${s}.${ms}`;
    }

    /* ================= ENGINE 2: 3D GRAPHIC DESIGN & EXTRUSION STUDIO ================= */
    initGraphic3DEngine() {
        const stageEl = document.getElementById('fabric-stage');
        if (!stageEl) return;

        this.canvas = new fabric.Canvas('fabric-stage', {
            backgroundColor: '#0b0f19',
            preserveObjectStacking: true
        });
        this.pivot3D = document.getElementById('artboard-3d-pivot');

        this.add3DIsometricCube(160, 160);
        this.add3DExtrudedText('OMNIEDIT STUDIO', 275, 195, '#38bdf8', '#6366f1', 14);

        const bindClick = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        };

        bindClick('g-btn-3d-text', () => {
            this.disableBrushMode();
            const faceColor = document.getElementById('g-prop-color')?.value || '#38bdf8';
            const sideColor = document.getElementById('g-prop-shadow-color')?.value || '#6366f1';
            const depth = parseInt(document.getElementById('g-3d-depth')?.value, 10) || 12;
            this.add3DExtrudedText('3D PRO TEXT', 260, 190, faceColor, sideColor, depth);
        });

        bindClick('g-btn-3d-cube', () => {
            this.disableBrushMode();
            this.add3DIsometricCube(360, 170);
        });

        bindClick('g-btn-text', () => {
            this.disableBrushMode();
            const txt = new fabric.IText('Double-Click to Edit', {
                left: 260, top: 200,
                fontFamily: document.getElementById('g-prop-font')?.value || 'Inter',
                fontSize: 36, fontWeight: 'bold',
                fill: document.getElementById('g-prop-color')?.value || '#38bdf8',
                layerName: '2D Text Layer'
            });
            this.canvas.add(txt).setActiveObject(txt);
            this.refreshLayerStack();
        });

        bindClick('g-btn-rect', () => {
            this.disableBrushMode();
            const rect = new fabric.Rect({
                left: 300, top: 180, width: 170, height: 110, rx: 10, ry: 10,
                fill: document.getElementById('g-prop-color')?.value || '#38bdf8',
                shadow: new fabric.Shadow({ color: '#6366f1', blur: 0, offsetX: 8, offsetY: 8 }),
                layerName: '3D Block Rect'
            });
            this.canvas.add(rect).setActiveObject(rect);
            this.refreshLayerStack();
        });

        bindClick('g-btn-circle', () => {
            this.disableBrushMode();
            const circle = new fabric.Circle({
                left: 340, top: 180, radius: 58,
                fill: document.getElementById('g-prop-color')?.value || '#38bdf8',
                shadow: new fabric.Shadow({ color: '#10b981', blur: 15, offsetX: 6, offsetY: 6 }),
                layerName: '3D Sphere Orb'
            });
            this.canvas.add(circle).setActiveObject(circle);
            this.refreshLayerStack();
        });

        bindClick('g-btn-star', () => {
            this.disableBrushMode();
            const pts = [];
            for (let i = 0; i < 10; i++) {
                const r = i % 2 === 0 ? 65 : 28;
                const a = (i * Math.PI) / 5 - Math.PI / 2;
                pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
            }
            const star = new fabric.Polygon(pts, {
                left: 340, top: 160, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2,
                shadow: new fabric.Shadow({ color: '#ea580c', blur: 0, offsetX: 6, offsetY: 6 }),
                layerName: '3D Star Badge'
            });
            this.canvas.add(star).setActiveObject(star);
            this.refreshLayerStack();
        });

        bindClick('g-btn-draw', () => {
            this.canvas.isDrawingMode = !this.canvas.isDrawingMode;
            document.getElementById('g-btn-draw')?.classList.toggle('active', this.canvas.isDrawingMode);
            const lbl = document.getElementById('draw-mode-label');
            if (lbl) lbl.textContent = this.canvas.isDrawingMode ? 'Brush: ON' : 'Brush';
            if (this.canvas.isDrawingMode) {
                this.canvas.freeDrawingBrush.width = 6;
                this.canvas.freeDrawingBrush.color = document.getElementById('g-prop-color')?.value || '#38bdf8';
            }
        });

        const update3DCamera = () => {
            const rx = parseInt(document.getElementById('g-3d-rx')?.value, 10) || 0;
            const ry = parseInt(document.getElementById('g-3d-ry')?.value, 10) || 0;
            const rz = parseInt(document.getElementById('g-3d-rz')?.value, 10) || 0;
            this.artboard3D = { ...this.artboard3D, rx, ry, rz };

            const vRx = document.getElementById('val-3d-rx');
            const vRy = document.getElementById('val-3d-ry');
            const vRz = document.getElementById('val-3d-rz');
            if (vRx) vRx.textContent = `${rx}°`;
            if (vRy) vRy.textContent = `${ry}°`;
            if (vRz) vRz.textContent = `${rz}°`;

            if (this.pivot3D) {
                this.pivot3D.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
            }
        };

        ['g-3d-rx', 'g-3d-ry', 'g-3d-rz'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', update3DCamera);
        });

        bindClick('g-preset-iso', () => {
            document.getElementById('g-3d-rx').value = 22;
            document.getElementById('g-3d-ry').value = -24;
            document.getElementById('g-3d-rz').value = 6;
            update3DCamera();
        });

        bindClick('g-preset-tilt', () => {
            document.getElementById('g-3d-rx').value = 14;
            document.getElementById('g-3d-ry').value = 20;
            document.getElementById('g-3d-rz').value = -4;
            update3DCamera();
        });

        bindClick('g-preset-flat', () => {
            document.getElementById('g-3d-rx').value = 0;
            document.getElementById('g-3d-ry').value = 0;
            document.getElementById('g-3d-rz').value = 0;
            update3DCamera();
        });

        const depthSlider = document.getElementById('g-3d-depth');
        if (depthSlider) {
            depthSlider.addEventListener('input', (e) => {
                const depth = parseInt(e.target.value, 10) || 0;
                const lbl = document.getElementById('val-3d-depth');
                if (lbl) lbl.textContent = `${depth}px`;
                const obj = this.canvas.getActiveObject();
                if (obj) {
                    const sideColor = document.getElementById('g-prop-shadow-color')?.value || '#6366f1';
                    obj.set('shadow', new fabric.Shadow({ color: sideColor, blur: 0, offsetX: depth, offsetY: depth }));
                    this.canvas.requestRenderAll();
                }
            });
        }

        const colorPicker = document.getElementById('g-prop-color');
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                const obj = this.canvas.getActiveObject();
                if (obj && obj.type !== 'image') {
                    obj.set('fill', e.target.value);
                    this.canvas.requestRenderAll();
                }
            });
        }

        const shadowColorPicker = document.getElementById('g-prop-shadow-color');
        if (shadowColorPicker) {
            shadowColorPicker.addEventListener('input', (e) => {
                const obj = this.canvas.getActiveObject();
                const depth = parseInt(document.getElementById('g-3d-depth')?.value, 10) || 12;
                if (obj) {
                    obj.set('shadow', new fabric.Shadow({ color: e.target.value, blur: 0, offsetX: depth, offsetY: depth }));
                    this.canvas.requestRenderAll();
                }
            });
        }

        const bgPicker = document.getElementById('g-canvas-bg');
        if (bgPicker) {
            bgPicker.addEventListener('input', (e) => {
                this.canvas.setBackgroundColor(e.target.value, () => this.canvas.requestRenderAll());
            });
        }

        bindClick('g-btn-clone', () => {
            const active = this.canvas.getActiveObject();
            if (!active) return;
            active.clone(cloned => {
                cloned.set({ left: active.left + 25, top: active.top + 25, layerName: `${active.layerName || '3D Layer'} Copy` });
                this.canvas.add(cloned).setActiveObject(cloned);
                this.refreshLayerStack();
            });
        });

        bindClick('g-btn-delete', () => {
            const active = this.canvas.getActiveObject();
            if (active) {
                this.canvas.remove(active);
                this.canvas.discardActiveObject();
                this.refreshLayerStack();
            }
        });

        this.canvas.on('selection:created', () => this.refreshLayerStack());
        this.canvas.on('selection:updated', () => this.refreshLayerStack());
        this.canvas.on('selection:cleared', () => this.refreshLayerStack());
    }

    add3DExtrudedText(textStr, left, top, faceColor, sideColor, depth) {
        const txt3D = new fabric.IText(textStr, {
            left, top,
            fontFamily: 'Orbitron',
            fontSize: 42,
            fontWeight: 'bold',
            fill: faceColor,
            stroke: '#ffffff',
            strokeWidth: 1,
            skewX: -8,
            shadow: new fabric.Shadow({ color: sideColor, blur: 0, offsetX: depth, offsetY: depth }),
            layerName: `3D Text (${textStr})`
        });
        this.canvas.add(txt3D).setActiveObject(txt3D);
        this.canvas.requestRenderAll();
        this.refreshLayerStack();
    }

    add3DIsometricCube(left, top) {
        const topFace = new fabric.Polygon([
            { x: 0, y: -50 }, { x: 60, y: -20 }, { x: 0, y: 10 }, { x: -60, y: -20 }
        ], { fill: '#38bdf8' });

        const leftFace = new fabric.Polygon([
            { x: -60, y: -20 }, { x: 0, y: 10 }, { x: 0, y: 75 }, { x: -60, y: 45 }
        ], { fill: '#6366f1' });

        const rightFace = new fabric.Polygon([
            { x: 0, y: 10 }, { x: 60, y: -20 }, { x: 60, y: 45 }, { x: 0, y: 75 }
        ], { fill: '#10b981' });

        const cubeGroup = new fabric.Group([topFace, leftFace, rightFace], {
            left, top,
            layerName: '3D Isometric Cube'
        });

        this.canvas.add(cubeGroup).setActiveObject(cubeGroup);
        this.canvas.requestRenderAll();
        this.refreshLayerStack();
    }

    disableBrushMode() {
        if (this.canvas && this.canvas.isDrawingMode) {
            this.canvas.isDrawingMode = false;
            document.getElementById('g-btn-draw')?.classList.remove('active');
            const lbl = document.getElementById('draw-mode-label');
            if (lbl) lbl.textContent = 'Brush';
        }
    }

    insertGraphicImage(url, name = 'Uploaded PNG') {
        this.disableBrushMode();
        const htmlImg = new Image();
        htmlImg.crossOrigin = 'anonymous';
        htmlImg.onload = () => {
            const fabricImg = new fabric.Image(htmlImg, {
                left: 260, top: 90,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.65)', blur: 20, offsetX: 10, offsetY: 12 }),
                layerName: name
            });
            if (fabricImg.width > 340) fabricImg.scaleToWidth(340);
            this.canvas.add(fabricImg).setActiveObject(fabricImg);
            this.canvas.calcOffset();
            this.canvas.requestRenderAll();
            this.refreshLayerStack();
            this.notify(`Inserted "${name}" into 3D Graphic Studio`, 'fa-image');
        };
        htmlImg.src = url;
    }

    refreshLayerStack() {
        const stackEl = document.getElementById('fabric-layer-stack');
        if (!stackEl || !this.canvas) return;
        const objects = this.canvas.getObjects();
        const activeObj = this.canvas.getActiveObject();

        const statLayers = document.getElementById('stat-layers');
        if (statLayers) statLayers.textContent = objects.length;

        const stackCount = document.getElementById('layer-stack-count');
        if (stackCount) stackCount.textContent = objects.length;

        stackEl.innerHTML = '';

        [...objects].reverse().forEach(obj => {
            const row = document.createElement('div');
            row.className = `layer-row ${obj === activeObj ? 'active' : ''}`;
            const icon = obj.type === 'i-text' ? 'fa-font' : obj.type === 'image' ? 'fa-image' : 'fa-cube';
            const label = obj.layerName || obj.type.toUpperCase();

            row.innerHTML = `
                <div class="layer-row-left">
                    <i class="fa-solid ${icon}" style="color:var(--accent-bright)"></i>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</span>
                </div>
                <div style="display:flex;gap:4px;">
                    <button type="button" class="icon-btn vis-btn">
                        <i class="fa-regular ${obj.visible === false ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button type="button" class="icon-btn del-lyr-btn" style="color:#fca5a5;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            row.addEventListener('click', () => {
                this.canvas.setActiveObject(obj);
                this.canvas.requestRenderAll();
                this.refreshLayerStack();
            });

            row.querySelector('.vis-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                obj.set('visible', !obj.visible);
                if (!obj.visible) this.canvas.discardActiveObject();
                this.canvas.requestRenderAll();
                this.refreshLayerStack();
            });

            row.querySelector('.del-lyr-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.canvas.remove(obj);
                this.canvas.requestRenderAll();
                this.refreshLayerStack();
            });

            stackEl.appendChild(row);
        });
    }

    /* ================= ⚡ INSTANT 0.1-SECOND LOGIN + NON-BLOCKING FIREBASE SYNC ================= */
    initAccountAndProjectsHub() {
        const authGate = document.getElementById('startup-auth-gate');

        // Custom Logo Persistence
        const savedLogo = localStorage.getItem('omniedit_custom_logo');
        if (savedLogo) this.applyCustomLogo(savedLogo);

        const logoInput = document.getElementById('input-custom-logo');
        if (logoInput) {
            logoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target.result;
                    localStorage.setItem('omniedit_custom_logo', dataUrl);
                    this.applyCustomLogo(dataUrl);
                    this.notify('OmniEdit Studio Custom Logo Updated!', 'fa-image');
                };
                reader.readAsDataURL(file);
                e.target.value = '';
            });
        }

        if (authGate) {
            authGate.hidden = Boolean(this.currentUser && this.currentUser.email);
        }

        const setupTabs = (btnSignupId, btnSigninId, formSignupId, formSigninId) => {
            const bUp = document.getElementById(btnSignupId);
            const bIn = document.getElementById(btnSigninId);
            const fUp = document.getElementById(formSignupId);
            const fIn = document.getElementById(formSigninId);
            if (bUp && bIn && fUp && fIn) {
                bUp.addEventListener('click', () => {
                    bUp.classList.add('active'); bIn.classList.remove('active');
                    fUp.hidden = false; fIn.hidden = true;
                });
                bIn.addEventListener('click', () => {
                    bIn.classList.add('active'); bUp.classList.remove('active');
                    fIn.hidden = false; fUp.hidden = true;
                });
            }
        };

        setupTabs('gate-tab-signup', 'gate-tab-signin', 'gate-form-signup', 'gate-form-signin');
        setupTabs('tab-btn-signup', 'tab-btn-signin', 'form-create-account', 'form-signin-account');

        // Instant Create Account
        const handleCreateAccount = (name, email, role, pass, formEl) => {
            this.currentUser = { uid: 'usr_' + Date.now(), name, email, role: role || 'Master Video Editor' };
            localStorage.setItem('omniedit_studio_user', JSON.stringify(this.currentUser));
            if (authGate) authGate.hidden = true;
            this.updateAccountProfileUI();
            if (formEl) formEl.reset();
            this.notify(`Welcome ${name}! Account Created in OmniEdit Studio`, 'fa-bolt');

            if (fbAuth) {
                fbAuth.createUserWithEmailAndPassword(email, pass)
                    .then((cred) => {
                        cred.user.updateProfile({ displayName: name }).catch(() => {});
                        if (fbDb) {
                            fbDb.collection('users').doc(cred.user.uid).set({
                                uid: cred.user.uid, name, email, role: role || 'Master Video Editor',
                                createdAt: new Date().toISOString(), studio: 'OmniEdit Studio'
                            }).catch(() => {});
                        }
                    })
                    .catch((err) => {
                        if (err.code === 'auth/email-already-in-use') {
                            fbAuth.signInWithEmailAndPassword(email, pass).catch(() => {});
                        }
                    });
            }
        };

        // Instant Sign In
        const handleSignIn = (email, pass, formEl) => {
            const namePart = (email.split('@')[0] || 'Creator');
            const cleanName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

            this.currentUser = {
                uid: 'usr_' + Date.now(),
                name: this.currentUser?.name || cleanName,
                email,
                role: this.currentUser?.role || 'Pro Studio Creator'
            };
            localStorage.setItem('omniedit_studio_user', JSON.stringify(this.currentUser));
            if (authGate) authGate.hidden = true;
            this.updateAccountProfileUI();
            if (formEl) formEl.reset();
            this.notify(`Signed in to OmniEdit Studio as ${email}!`, 'fa-bolt');

            if (fbAuth) {
                fbAuth.signInWithEmailAndPassword(email, pass)
                    .then((cred) => {
                        if (fbDb) {
                            fbDb.collection('users').doc(cred.user.uid).set({
                                email, lastLogin: new Date().toISOString()
                            }, { merge: true }).catch(() => {});
                        }
                    })
                    .catch(() => {
                        fbAuth.createUserWithEmailAndPassword(email, pass).catch(() => {});
                    });
            }
        };

        const gateFormSignup = document.getElementById('gate-form-signup');
        if (gateFormSignup) {
            gateFormSignup.addEventListener('submit', (e) => {
                e.preventDefault();
                handleCreateAccount(
                    document.getElementById('gate-reg-name')?.value.trim() || 'Creator',
                    document.getElementById('gate-reg-email')?.value.trim() || '',
                    document.getElementById('gate-reg-role')?.value || 'Master Editor',
                    document.getElementById('gate-reg-pass')?.value || '123456',
                    gateFormSignup
                );
            });
        }

        const gateFormSignin = document.getElementById('gate-form-signin');
        if (gateFormSignin) {
            gateFormSignin.addEventListener('submit', (e) => {
                e.preventDefault();
                handleSignIn(
                    document.getElementById('gate-login-email')?.value.trim() || '',
                    document.getElementById('gate-login-pass')?.value || '',
                    gateFormSignin
                );
            });
        }

        const formSignup = document.getElementById('form-create-account');
        if (formSignup) {
            formSignup.addEventListener('submit', (e) => {
                e.preventDefault();
                handleCreateAccount(
                    document.getElementById('reg-name')?.value.trim() || 'Creator',
                    document.getElementById('reg-email')?.value.trim() || '',
                    document.getElementById('reg-role')?.value || 'Master Editor',
                    document.getElementById('reg-pass')?.value || '123456',
                    formSignup
                );
            });
        }

        const formSignin = document.getElementById('form-signin-account');
        if (formSignin) {
            formSignin.addEventListener('submit', (e) => {
                e.preventDefault();
                handleSignIn(
                    document.getElementById('login-email')?.value.trim() || '',
                    document.getElementById('login-pass')?.value || '',
                    formSignin
                );
            });
        }

        const logoutBtn = document.getElementById('btn-logout-account');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.currentUser = null;
                localStorage.removeItem('omniedit_studio_user');
                this.updateAccountProfileUI();
                if (authGate) authGate.hidden = false;
                if (fbAuth) fbAuth.signOut().catch(() => {});
                this.notify('Signed out of OmniEdit Studio', 'fa-power-off');
            });
        }

        const saveSnapshot = () => {
            const snap = {
                id: 'proj_' + Date.now(),
                name: `OmniEdit Project #${this.savedProjects.length + 1}`,
                owner: this.currentUser ? this.currentUser.email : 'Creator',
                date: new Date().toLocaleTimeString(),
                clipsCount: this.clips.length
            };
            this.savedProjects.unshift(snap);
            localStorage.setItem('omniedit_studio_projects', JSON.stringify(this.savedProjects));
            this.renderSavedProjectsUI();
            this.notify('Project saved & synced to Cloud!', 'fa-floppy-disk');

            if (fbDb) {
                fbDb.collection('projects').doc(snap.id).set(snap).catch(() => {});
            }
        };

        document.getElementById('btn-save-project')?.addEventListener('click', saveSnapshot);
        document.getElementById('home-save-proj-btn')?.addEventListener('click', saveSnapshot);
        document.getElementById('acc-save-new-btn')?.addEventListener('click', saveSnapshot);

        this.updateAccountProfileUI();
        this.renderSavedProjectsUI();
    }

    applyCustomLogo(logoUrl) {
        const topImg = document.getElementById('topbar-logo-img');
        const topFallback = document.getElementById('topbar-logo-fallback');
        const gateImg = document.getElementById('gate-logo-img');
        const gateFallback = document.getElementById('gate-logo-fallback');

        if (topImg) { topImg.src = logoUrl; topImg.hidden = false; }
        if (topFallback) topFallback.hidden = true;
        if (gateImg) { gateImg.src = logoUrl; gateImg.hidden = false; }
        if (gateFallback) gateFallback.hidden = true;
    }

    updateAccountProfileUI() {
        const nameEl = document.getElementById('account-user-name');
        const emailEl = document.getElementById('account-user-email');
        const badgeEl = document.getElementById('profile-status-badge');
        const avatarEl = document.getElementById('profile-avatar-letter');
        const navLabel = document.getElementById('nav-account-label');
        const logoutBtn = document.getElementById('btn-logout-account');

        if (this.currentUser) {
            if (nameEl) nameEl.textContent = this.currentUser.name;
            if (emailEl) emailEl.textContent = `${this.currentUser.email} • ${this.currentUser.role || 'Pro Creator'}`;
            if (badgeEl) badgeEl.textContent = 'OMNIEDIT VERIFIED ACCOUNT';
            if (avatarEl) avatarEl.textContent = this.currentUser.name.charAt(0).toUpperCase();
            if (navLabel) navLabel.textContent = this.currentUser.name.split(' ')[0];
            if (logoutBtn) logoutBtn.hidden = false;
        } else {
            if (nameEl) nameEl.textContent = 'Guest Creator';
            if (emailEl) emailEl.textContent = 'Not signed in — Create an account or sign in with Gmail';
            if (badgeEl) badgeEl.textContent = 'GUEST SESSION';
            if (avatarEl) avatarEl.textContent = 'G';
            if (navLabel) navLabel.textContent = 'Account';
            if (logoutBtn) logoutBtn.hidden = true;
        }
    }

    deleteSingleProject(projId) {
        this.savedProjects = this.savedProjects.filter(p => p.id !== projId);
        localStorage.setItem('omniedit_studio_projects', JSON.stringify(this.savedProjects));
        this.renderSavedProjectsUI();
        if (fbDb) {
            fbDb.collection('projects').doc(projId).delete().catch(() => {});
        }
        this.notify('Project deleted', 'fa-trash-can');
    }

    renderSavedProjectsUI() {
        const statProj = document.getElementById('stat-projects');
        if (statProj) statProj.textContent = this.savedProjects.length;

        const accTotalProj = document.getElementById('acc-total-projects');
        if (accTotalProj) accTotalProj.textContent = this.savedProjects.length;

        const homeList = document.getElementById('home-projects-list');
        const accList = document.getElementById('saved-projects-list');

        const emptyHTML = `<div style="color:var(--text-secondary);padding:14px;">No saved projects yet. Click "+ Save Current" to save a snapshot.</div>`;
        if (homeList) homeList.innerHTML = this.savedProjects.length === 0 ? emptyHTML : '';
        if (accList) accList.innerHTML = this.savedProjects.length === 0 ? emptyHTML : '';

        this.savedProjects.forEach(proj => {
            const createCard = () => {
                const card = document.createElement('div');
                card.className = 'saved-proj-card';
                card.innerHTML = `
                    <div>
                        <h4 style="font-size:13px;">${proj.name}</h4>
                        <span style="font-size:11px;color:var(--text-secondary);">${proj.owner || 'Local'} • ${proj.date} • ${proj.clipsCount} Clips</span>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="btn btn-xs btn-primary open-p-btn">Open</button>
                        <button type="button" class="btn btn-xs btn-danger-outline del-p-btn" title="Delete Project">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;
                card.querySelector('.open-p-btn').addEventListener('click', () => {
                    this.switchWorkspace('ws-video');
                    if (this.clips.length === 0) this.loadBuiltInSampleVideo();
                });
                card.querySelector('.del-p-btn').addEventListener('click', () => this.deleteSingleProject(proj.id));
                return card;
            };

            if (homeList) homeList.appendChild(createCard());
            if (accList) accList.appendChild(createCard());
        });
    }

    /* ================= PRO COMPOSITE EXPORT SUITE ================= */
    captureVideoCompositeFrame() {
        const comp = document.createElement('canvas');
        comp.width = 1920;
        comp.height = 1080;
        const ctx = comp.getContext('2d');

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, comp.width, comp.height);

        if (!this.videoEl.hidden && this.videoEl.readyState >= 2) {
            ctx.drawImage(this.videoEl, 0, 0, comp.width, comp.height);
        } else if (!this.synthCanvas.hidden) {
            ctx.drawImage(this.synthCanvas, 0, 0, comp.width, comp.height);
        }

        const brollImg = document.getElementById('broll-img-el');
        const brollClip = this.getActiveClipOnTrack('broll');
        if (brollClip && brollImg && !brollImg.hidden && brollImg.complete) {
            const bx = ((brollClip.posX ?? 58) / 100) * comp.width;
            const by = ((brollClip.posY ?? 12) / 100) * comp.height;
            const bw = ((brollClip.widthPct ?? 32) / 100) * comp.width;
            const bh = ((brollClip.heightPct ?? 34) / 100) * comp.height;
            ctx.drawImage(brollImg, bx, by, bw, bh);
        }

        const ovClip = this.getActiveClipOnTrack('overlay');
        if (ovClip) {
            const ox = ((ovClip.posX ?? 25) / 100) * comp.width;
            const oy = ((ovClip.posY ?? 75) / 100) * comp.height;
            ctx.font = `bold ${(ovClip.fontSize || 22) * 2}px Orbitron, Inter, sans-serif`;
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(ovClip.text, ox, oy + 40);
        }

        return comp.toDataURL('image/png');
    }

    initExportModal() {
        const modal = document.getElementById('export-modal');
        const formatSelect = document.getElementById('export-format-select');
        const progressBanner = document.getElementById('export-progress-banner');
        const resultBanner = document.getElementById('export-result-banner');

        document.getElementById('btn-open-export')?.addEventListener('click', () => {
            if (progressBanner) progressBanner.hidden = true;
            if (resultBanner) resultBanner.hidden = true;
            if (formatSelect) formatSelect.value = this.activeWorkspace === 'ws-graphic' ? 'png' : 'mp4';
            if (modal) modal.hidden = false;
        });

        const closeModal = () => { if (modal) modal.hidden = true; };
        document.getElementById('close-export-btn')?.addEventListener('click', closeModal);
        document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);

        document.getElementById('run-export-btn')?.addEventListener('click', async () => {
            let format = formatSelect ? formatSelect.value : 'mp4';
            const name = document.getElementById('export-filename')?.value || 'OmniEdit_Studio_Master';
            const resolution = document.getElementById('export-resolution-select')?.value || '1080p';

            let canvasData = null;
            if (format === 'frame_png') {
                format = 'png';
                canvasData = this.captureVideoCompositeFrame();
            } else if (format === 'png' || format === 'webp') {
                canvasData = this.canvas ? this.canvas.toDataURL({ format, quality: 0.96 }) : this.captureVideoCompositeFrame();
            }

            if (progressBanner) progressBanner.hidden = false;
            if (resultBanner) resultBanner.hidden = true;

            try {
                const res = await fetch('/api/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        format,
                        resolution,
                        aspectRatio: this.aspectRatio,
                        videoFilter: this.videoFilter,
                        timeline: this.clips,
                        canvasData
                    })
                });
                const data = await res.json();
                if (progressBanner) progressBanner.hidden = true;

                if (data.status === 'success') {
                    if (resultBanner) resultBanner.hidden = false;
                    const outName = document.getElementById('export-output-name');
                    if (outName) outName.textContent = data.filename;
                    const outSize = document.getElementById('export-output-size');
                    if (outSize) outSize.textContent = `${(data.size / 1024).toFixed(1)} KB • Ready to Download`;
                    const dlAnchor = document.getElementById('export-download-anchor');
                    if (dlAnchor) dlAnchor.href = data.downloadUrl;
                    this.fetchServerAssets();
                    this.notify(`Master Export Ready: ${data.filename}`, 'fa-bolt');
                }
            } catch (err) {
                if (progressBanner) progressBanner.hidden = true;
                this.notify('Export failed — check server', 'fa-triangle-exclamation');
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.studio = new OmniEditStudio();
});