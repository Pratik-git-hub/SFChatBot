import { LightningElement, track, api } from 'lwc';

const AGENTS = {
    support: {
        id: 'support', name: 'Support', agentName: 'Aria',
        agentRole: 'Customer Support Agent', agentInitial: 'A',
        modelId: 'gpt-4o', modelName: 'GPT-4o', accent: '#3b82f6',
        emptyIcon: '✦', emptyTitle: 'How can I help you today?',
        emptySub: 'Ask about your account, orders, or services.',
        placeholder: 'Describe your issue or ask a question...',
        quickPrompts: [
            { id: 'q1', text: 'Track my order' },
            { id: 'q2', text: 'Update billing info' },
            { id: 'q3', text: 'Request a refund' }
        ]
    },
    sales: {
        id: 'sales', name: 'Sales', agentName: 'Orion',
        agentRole: 'Sales Assistant', agentInitial: 'O',
        modelId: 'gpt-4o', modelName: 'GPT-4o', accent: '#f97316',
        emptyIcon: '◎', emptyTitle: "Let's find the right solution.",
        emptySub: 'Explore products, pricing, and upgrade options.',
        placeholder: 'Ask about products, pricing, or upgrades...',
        quickPrompts: [
            { id: 'q1', text: 'Compare plans' },
            { id: 'q2', text: 'Schedule a demo' },
            { id: 'q3', text: 'Get a custom quote' }
        ]
    },
    technical: {
        id: 'technical', name: 'Technical', agentName: 'Nexus',
        agentRole: 'Technical Specialist', agentInitial: 'N',
        modelId: 'gpt-4o', modelName: 'GPT-4o', accent: '#8b5cf6',
        emptyIcon: '⬡', emptyTitle: 'Technical support at your service.',
        emptySub: 'Integration guides, API docs, and troubleshooting.',
        placeholder: 'Ask a technical question...',
        quickPrompts: [
            { id: 'q1', text: 'API integration help' },
            { id: 'q2', text: 'Troubleshoot an error' },
            { id: 'q3', text: 'View documentation' }
        ]
    }
};

const AGENT_KEYS = ['support', 'sales', 'technical'];

const LLM_GROUPS = [
    {
        provider: 'OpenAI', id: 'openai',
        models: [
            { id: 'gpt-4o',        name: 'GPT-4o',         desc: 'Most capable multimodal model',    icon: '🟢', color: '#10a37f', tags: ['smart', 'vision'] },
            { id: 'gpt-4o-mini',   name: 'GPT-4o mini',    desc: 'Fast & efficient for most tasks',   icon: '🟢', color: '#10a37f', tags: ['fast', 'smart']   },
            { id: 'gpt-4-turbo',   name: 'GPT-4 Turbo',    desc: '128K context, powerful reasoning',  icon: '🟢', color: '#10a37f', tags: ['long', 'smart']   },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo',  desc: 'Fastest OpenAI model, lower cost',  icon: '🟢', color: '#10a37f', tags: ['fast']            }
        ]
    },
    {
        provider: 'Anthropic', id: 'anthropic',
        models: [
            { id: 'claude-opus-4',    name: 'Claude Opus 4',    desc: 'Most intelligent Anthropic model', icon: '🟣', color: '#7c3aed', tags: ['smart', 'long'] },
            { id: 'claude-sonnet-4',  name: 'Claude Sonnet 4',  desc: 'Ideal balance of speed & quality', icon: '🟣', color: '#7c3aed', tags: ['smart', 'fast'] },
            { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', desc: 'Ultra-fast for lightweight tasks',  icon: '🟣', color: '#7c3aed', tags: ['fast']          }
        ]
    },
    {
        provider: 'Google', id: 'google',
        models: [
            { id: 'gemini-2-flash', name: 'Gemini 2.0 Flash', desc: 'Fast multimodal, great accuracy', icon: '🔵', color: '#1a73e8', tags: ['fast', 'vision'] },
            { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro',   desc: '2M token context window',         icon: '🔵', color: '#1a73e8', tags: ['long', 'smart']  }
        ]
    },
    {
        provider: 'Meta', id: 'meta',
        models: [
            { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', desc: 'Open-source, powerful reasoning', icon: '⚫', color: '#374151', tags: ['smart', 'fast'] },
            { id: 'llama-3.1-8b',  name: 'Llama 3.1 8B',  desc: 'Lightweight, locally hostable',   icon: '⚫', color: '#374151', tags: ['fast']         }
        ]
    }
];

const MODEL_MAP = {};
LLM_GROUPS.forEach(g => g.models.forEach(m => { MODEL_MAP[m.id] = m; }));

const DEMO = {
    support: [
        "I'd be happy to help! Could you share your order number or email address?",
        "Your order is in transit and expected within 2–3 business days.",
        "Your refund has been processed and should appear within 5–7 business days.",
        "I've updated your billing info — the new method will be used next cycle."
    ],
    sales: [
        "Great question! Our Professional plan includes unlimited projects and priority support.",
        "I can schedule a demo for you — what timezone are you in?",
        "I can put together a custom quote that could save you up to 30%.",
        "Enterprise adds dedicated account management and custom SLA guarantees."
    ],
    technical: [
        "For REST API auth use OAuth 2.0: POST /oauth/token with your client credentials.",
        "That 403 error means your API key is missing required scopes — enable read:data and write:data.",
        "I'd recommend webhooks over polling — latency under 200ms and ~90% fewer API calls.",
        "Your plan allows 1,000 req/min. Check usage at GET /v1/usage/rate-limits."
    ]
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
let _counter = 0;
const newId   = () => `id_${Date.now()}_${++_counter}`;
const fmtTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export default class ChatBot extends LightningElement {

    // ── Public API ────────────────────────────────────────
    @api defaultAgents    = 'support';
    @api allowMultiWindow = false;

    // ── Tracked state ─────────────────────────────────────
    @track _rawWindows    = [];
    @track _activeId      = null;
    @track _isSplit       = false;
    @track _showModal     = false;
    @track _modalModels   = [];
    @track _modalSelId    = 'gpt-4o';
    @track _modalScopeAll = false;
    @track _modalWinId    = null;
    @track _modalSub      = '';
    @track _showToast     = false;
    @track _toastMsg      = '';
    @track _toastType     = 'info';

    // ── Private ───────────────────────────────────────────
    _histories    = {};
    _charCounts   = {};
    _toastTimer   = null;
    _dropdownOpen = false;  // not tracked — toggled directly on DOM via lwc:ref

    // ── Lifecycle ─────────────────────────────────────────
    connectedCallback() {
        console.log("start of app")
        const keys = (this.defaultAgents || 'support')
            .split(',').map(s => s.trim()).filter(Boolean);
        // Add all windows first (no setActive yet)
        let firstId = null;
        keys.forEach((k, i) => {
            const id = this._addWindow(k, false); // don't setActive inside
            if (i === 0) firstId = id;
        });
        // Then set activeId as a completely separate reactive assignment
        // so LWC registers it as an independent update
        this._activeId = firstId || this._rawWindows[0]?.id || null;

        // Global click-outside listener to close dropdown
        this._outsideClickHandler = (e) => {
            const wrap = this.refs.addTabWrap;
            if (wrap && !wrap.contains(e.target)) {
                this._closeDropdown();
            }
        };
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler);
        }, 0);
    }

    renderedCallback() {
        // Self-heal: if _activeId is null or points to a removed window,
        // snap it to the first available window. Runs after every render.
        if (this._rawWindows.length > 0) {
            const ids = this._rawWindows.map(w => w.id);
            if (!this._activeId || !ids.includes(this._activeId)) {
                this._activeId = this._rawWindows[0].id;
            }
        }
    }

    disconnectedCallback() {
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
        }
    }

    // ═══════════════════════════════════════════════════════
    // GETTERS — Header
    // ═══════════════════════════════════════════════════════
    get layoutIcon()        { return this._isSplit ? '⊟' : '⊞'; }
    get layoutToggleClass() { return this._isSplit ? 'hdr-btn active' : 'hdr-btn'; }
    get mainAreaClass()     { return this._isSplit ? 'main-area layout-split' : 'main-area'; }

    // ═══════════════════════════════════════════════════════
    // GETTERS — Add-tab button
    // ═══════════════════════════════════════════════════════
    get allTabsOpen() {
        return this._rawWindows.length >= AGENT_KEYS.length;
    }

    get addTabBtnClass() {
        return this.allTabsOpen ? 'btn-add-tab btn-add-tab--disabled' : 'btn-add-tab';
    }

    get addTabTitle() {
        return this.allTabsOpen ? 'All windows are open' : 'Add a chat window';
    }

    // Available agents for the dropdown list
    get availableAgents() {
        const used = this._rawWindows.map(w => w.agentKey);
        return AGENT_KEYS
            .filter(k => !used.includes(k))
            .map(k => ({
                key:      k,
                name:     AGENTS[k].name,
                role:     AGENTS[k].agentRole,
                dotClass: `di-dot di-dot--${k}`
            }));
    }

    // ═══════════════════════════════════════════════════════
    // GETTERS — Windows
    // ═══════════════════════════════════════════════════════
    get chatWindows() {
        return this._rawWindows.map(w => this._buildView(w));
    }

    get visibleWindows() {
        if (this._rawWindows.length === 0) return [];
        const all = this._rawWindows.map(w => this._buildView(w));
        if (this._isSplit) return all;
        // Filter to active window; if none matches fall back to first
        const active = all.filter(w => w.id === this._activeId);
        return active.length > 0 ? active : [all[0]];
    }

    // ═══════════════════════════════════════════════════════
    // GETTERS — Modal
    // ═══════════════════════════════════════════════════════
    get showModal()      { return this._showModal; }
    get modalModels()    { return this._modalModels; }
    get modalSubtitle()  { return this._modalSub; }
    get scopeThisClass() { return this._modalScopeAll ? 'scope-btn' : 'scope-btn scope-active'; }
    get scopeAllClass()  { return this._modalScopeAll ? 'scope-btn scope-active' : 'scope-btn'; }

    // ═══════════════════════════════════════════════════════
    // GETTERS — Toast
    // ═══════════════════════════════════════════════════════
    get showToast()  { return this._showToast; }
    get toastMsg()   { return this._toastMsg; }
    get toastClass() { return `toast toast-${this._toastType}`; }

    // ═══════════════════════════════════════════════════════
    // BUILD VIEW — derives all display properties for one window
    // ═══════════════════════════════════════════════════════
    _buildView(raw) {
        const isActive = raw.id === this._activeId;
        const model    = MODEL_MAP[raw.modelId] || { name: raw.modelName || 'GPT-4o', color: raw.accent };
        const hist     = this._histories[raw.id] || [];

        const messages = hist.map(m => ({
            id:           m.id,
            content:      m.content,
            time:         m.time,
            isLoading:    m.isLoading,
            isUser:       m.role === 'user',
            messageClass: `message ${m.role === 'user' ? 'message-user' : 'message-bot'}`,
            bubbleClass:  `msg-bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-bot'}`
        }));

        return {
            id:            raw.id,
            agentKey:      raw.agentKey,
            name:          raw.name,
            agentName:     raw.agentName,
            agentRole:     raw.agentRole,
            agentInitial:  raw.agentInitial,
            accent:        raw.accent,
            modelId:       raw.modelId,
            modelName:     model.name,
            modelDotStyle: `background:${model.color};`,
            emptyIcon:     raw.emptyIcon,
            emptyTitle:    raw.emptyTitle,
            emptySub:      raw.emptySub,
            quickPrompts:  raw.quickPrompts,
            placeholder:   raw.placeholder,
            messages,
            isEmpty:       messages.length === 0,
            charCount:     this._charCounts[raw.id] || 0,
            isTyping:      raw.isTyping || false,
            hasUnread:     (raw.unread || 0) > 0,
            unread:        raw.unread || 0,
            isCloseable:   this._rawWindows.length > 1,
            tabClass:      isActive ? 'tab-btn tab-active' : 'tab-btn',
            tabDotClass:   `tab-dot tab-dot--${raw.agentKey}`,
            windowClass:   isActive ? 'chat-win window-active' : 'chat-win',
            typingClass:   raw.isTyping ? 'typing-indicator on' : 'typing-indicator',
            // One style attribute per window is acceptable — injects CSS variables
            windowStyle:   `--win-accent:${raw.accent}; --win-accent-bg:${raw.accent}18; --win-model-color:${model.color};`
        };
    }

    // ═══════════════════════════════════════════════════════
    // WINDOW MANAGEMENT
    // ═══════════════════════════════════════════════════════
    _addWindow(agentKey, setActive = false) {
        const cfg = AGENTS[agentKey] || AGENTS.support;
        const id  = newId();
        // Step 1: update windows array as its own reactive mutation
        this._rawWindows = [...this._rawWindows, {
            id, agentKey, isTyping: false, unread: 0, ...cfg
        }];
        this._histories[id]  = [];
        this._charCounts[id] = 0;
        // Step 2: update activeId as a separate reactive mutation
        // (splitting into two assignments ensures LWC doesn't coalesce
        //  and drop the _activeId change in the same render batch)
        if (setActive || !this._activeId || this._activeId === 'pending') {
            this._activeId = id;
        }
        return id; // return so callers can re-assert if needed
    }

    _updateWindow(winId, props) {
        this._rawWindows = this._rawWindows.map(w =>
            w.id === winId ? { ...w, ...props } : w
        );
    }

    // ═══════════════════════════════════════════════════════
    // DROPDOWN — direct DOM manipulation via lwc:ref
    // (avoids re-render race that broke the if:true approach)
    // ═══════════════════════════════════════════════════════
    _openDropdown() {
        this._dropdownOpen = true;
        const dd = this.refs.addTabDropdown;
        if (dd) dd.classList.add('open');
    }

    _closeDropdown() {
        this._dropdownOpen = false;
        const dd = this.refs.addTabDropdown;
        if (dd) dd.classList.remove('open');
    }

    _toggleDropdown() {
        if (this._dropdownOpen) {
            this._closeDropdown();
        } else {
            this._openDropdown();
        }
    }

    // ═══════════════════════════════════════════════════════
    // EVENT HANDLERS — Header
    // ═══════════════════════════════════════════════════════
    handleLayoutToggle() {
        this._isSplit = !this._isSplit;
    }

    // ═══════════════════════════════════════════════════════
    // EVENT HANDLERS — Tabs
    // ═══════════════════════════════════════════════════════
    handleTabClick(event) {
        if (event.target.classList.contains('tab-close')) return;
        const id = event.currentTarget.dataset.id;
        this._activeId = id;
        this._updateWindow(id, { unread: 0 });
        this._closeDropdown();
    }

    handleCloseWindow(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.id;
        // Always keep at least one tab open
        if (this._rawWindows.length <= 1) return;
        const closedIdx = this._rawWindows.findIndex(w => w.id === id);
        this._rawWindows = this._rawWindows.filter(w => w.id !== id);
        delete this._histories[id];
        // If the closed tab was active, switch to the nearest remaining tab
        if (this._activeId === id) {
            const next = this._rawWindows[closedIdx] || this._rawWindows[closedIdx - 1] || this._rawWindows[0];
            this._activeId = next?.id || null;
        }
    }

    handleAddTabClick(event) {
        event.stopPropagation(); // prevent immediate close by outside-click listener
        if (this.allTabsOpen) return;
        this._toggleDropdown();
    }

    handleAgentPick(event) {
        event.stopPropagation();
        const key = event.currentTarget.dataset.key;
        this._closeDropdown();
        const newId = this._addWindow(key, true);
        // Explicitly re-assign activeId after the windows array settles.
        // This forces LWC to treat it as a fresh reactive update separate
        // from the _rawWindows mutation, guaranteeing the new tab is selected.
        this._activeId = newId;
    }

    // ═══════════════════════════════════════════════════════
    // EVENT HANDLERS — Input
    // ═══════════════════════════════════════════════════════
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const id = event.target.dataset.id;
            this._sendMessage(id, event.target.value);
            event.target.value = '';
            this._charCounts[id] = 0;
            this._rawWindows = [...this._rawWindows];
        }
    }

    handleInput(event) {
        const id = event.target.dataset.id;
        this._charCounts[id] = (event.target.value || '').length;
        this._rawWindows = [...this._rawWindows];
    }

    handleSend(event) {
        const id = event.currentTarget.dataset.id;
        const ta = this.template.querySelector(`textarea[data-id="${id}"]`);
        if (!ta) return;
        this._sendMessage(id, ta.value);
        ta.value = '';
        this._charCounts[id] = 0;
        this._rawWindows = [...this._rawWindows];
    }

    handleQuickPrompt(event) {
        const id     = event.currentTarget.dataset.id;
        const prompt = event.currentTarget.dataset.prompt;
        this._sendMessage(id, prompt);
    }

    handleWindowAction(event) {
        event.stopPropagation();
        const id     = event.currentTarget.dataset.id;
        const action = event.currentTarget.dataset.action;
        if (action === 'clear')  this._clearWindow(id);
        if (action === 'export') this._exportWindow(id);
        if (action === 'model')  this._openModal(id);
    }

    // ═══════════════════════════════════════════════════════
    // EVENT HANDLERS — Modal
    // ═══════════════════════════════════════════════════════
    handleScopeThis() {
        this._modalScopeAll = false;
        const win = this._rawWindows.find(w => w.id === this._modalWinId);
        this._modalSub = `Window: ${win?.agentName || 'Current'} · ${win?.agentRole || ''}`;
    }

    handleScopeAll() {
        this._modalScopeAll = true;
        this._modalSub = 'Applies to all chat windows';
    }

    handleModalModelSelect(event) {
        this._modalSelId = event.currentTarget.dataset.modelId;
        this._buildModalModels();
    }

    handleModalApply() {
        const model = MODEL_MAP[this._modalSelId];
        if (!model) return;
        if (this._modalScopeAll) {
            this._rawWindows = this._rawWindows.map(w => ({ ...w, modelId: model.id, modelName: model.name }));
            this._fireToast('success', `Model set to ${model.name} for all windows`);
        } else {
            this._updateWindow(this._modalWinId, { modelId: model.id, modelName: model.name });
            const win = this._rawWindows.find(w => w.id === this._modalWinId);
            this._fireToast('success', `${win?.agentName || 'Window'} → ${model.name}`);
        }
        this._showModal = false;
    }

    handleModalClose() {
        this._showModal = false;
    }

    handleModalOverlayClick(event) {
        if (event.target === event.currentTarget) this._showModal = false;
    }

    // ═══════════════════════════════════════════════════════
    // MESSAGING
    // ═══════════════════════════════════════════════════════
    async _sendMessage(winId, text) {
        if (!text || !text.trim()) return;
        const win = this._rawWindows.find(w => w.id === winId);
        if (!win || win.isTyping) return;

        this._histories[winId] = [
            ...(this._histories[winId] || []),
            { id: newId(), role: 'user', content: text.trim(), time: fmtTime(), isLoading: false }
        ];

        const loadId = newId();
        this._histories[winId] = [
            ...this._histories[winId],
            { id: loadId, role: 'assistant', content: '', time: '', isLoading: true }
        ];

        this._updateWindow(winId, { isTyping: true });
        this._scrollToBottom(winId);

        // ── Replace with Apex + LangChain call when ready ──────────────────────
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
        const pool  = DEMO[win.agentKey] || DEMO.support;
        const reply = pool[Math.floor(Math.random() * pool.length)];
        // ───────────────────────────────────────────────────────────────────────

        this._histories[winId] = this._histories[winId].map(m =>
            m.id === loadId
                ? { id: loadId, role: 'assistant', content: reply, time: fmtTime(), isLoading: false }
                : m
        );

        this._updateWindow(winId, {
            isTyping: false,
            unread: winId !== this._activeId ? (win.unread || 0) + 1 : 0
        });

        this._scrollToBottom(winId);
    }

    _scrollToBottom(winId) {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const el = this.template.querySelector(`[data-msgcontainer="${winId}"]`);
            if (el) el.scrollTop = el.scrollHeight;
        }, 60);
    }

    // ═══════════════════════════════════════════════════════
    // WINDOW UTILITIES
    // ═══════════════════════════════════════════════════════
    _clearWindow(winId) {
        this._histories[winId] = [];
        this._rawWindows = [...this._rawWindows];
        this._fireToast('info', 'Chat cleared.');
    }

    _exportWindow(winId) {
        const win   = this._rawWindows.find(w => w.id === winId);
        const model = MODEL_MAP[win?.modelId]?.name || 'AI';
        const lines = [
            `Chat — ${win?.agentName} (${model}) — ${new Date().toLocaleString()}`,
            '─'.repeat(50), ''
        ];
        (this._histories[winId] || [])
            .filter(m => !m.isLoading)
            .forEach(m => {
                lines.push(`[${m.time}] ${m.role === 'user' ? 'You' : win?.agentName}: ${m.content}`);
            });
        const a    = document.createElement('a');
        a.href     = 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
        a.download = `chat-${win?.agentName || 'export'}.txt`;
        a.click();
        this._fireToast('success', 'Chat exported.');
    }

    // ═══════════════════════════════════════════════════════
    // MODAL
    // ═══════════════════════════════════════════════════════
    _openModal(winId) {
        const win           = this._rawWindows.find(w => w.id === winId);
        this._modalWinId    = winId;
        this._modalScopeAll = false;
        this._modalSelId    = win?.modelId || 'gpt-4o';
        this._modalSub      = `Window: ${win?.agentName || 'Current'} · ${win?.agentRole || ''}`;
        this._buildModalModels();
        this._showModal = true;
    }

    _buildModalModels() {
        this._modalModels = LLM_GROUPS.map(g => ({
            id:       g.id,
            provider: g.provider,
            models:   g.models.map(m => ({
                ...m,
                isSelected: m.id === this._modalSelId,
                itemClass:  m.id === this._modalSelId ? 'mm-item mm-selected' : 'mm-item',
                iconStyle:  `background:${m.color}18; color:${m.color};`,
                tagObjects: m.tags.map(t => ({ id: t, label: t, cls: `mm-tag tag-${t}` }))
            }))
        }));
    }

    // ═══════════════════════════════════════════════════════
    // TOAST
    // ═══════════════════════════════════════════════════════
    _fireToast(type, msg) {
        this._toastType = type;
        this._toastMsg  = msg;
        this._showToast = true;
        if (this._toastTimer) clearTimeout(this._toastTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._toastTimer = setTimeout(() => { this._showToast = false; }, 3000);
    }
}