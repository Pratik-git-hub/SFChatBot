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
            { id: 'gpt-4o-mini',   name: 'GPT-4o mini',    desc: 'Fast & efficient for most tasks',   icon: '🟢', color: '#10a37f', tags: ['fast', 'smart']   }
        ]
    }
];

const MODEL_MAP = {};
LLM_GROUPS.forEach(g => g.models.forEach(m => { MODEL_MAP[m.id] = m; }));

// ═══════════════════════════════════════════════════════════════════════════
// LANGCHAIN API ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════
const LANGCHAIN_API_ENDPOINT = 'https://your-api-endpoint.com'; // Update this
const API_VERSION = 'v1';

export default class completeChatAgent extends LightningElement {

    // ── Public API ────────────────────────────────────────
    @api defaultAgents    = 'support';
    @api allowMultiWindow = false;
    @api langchainApiKey  = ''; // Set from Salesforce

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
    @track _isLoading     = false;
    @track _loadingMessage = '';

    // ── Private ───────────────────────────────────────────
    _histories    = {};
    _charCounts   = {};
    _toastTimer   = null;
    _dropdownOpen = false;
    _sessionIds   = {}; // Map window ID to LangChain session ID
    _jwtToken     = null;

    // ── Lifecycle ─────────────────────────────────────────
    connectedCallback() {
        console.log("Initializing ARIA Chat Agent with LangChain Integration13");
        
        // Get JWT token from Salesforce
        this._jwtToken = this._getAuthToken();
        
        const keys = (this.defaultAgents || 'support')
            .split(',').map(s => s.trim()).filter(Boolean);
        
        let firstId = null;
        keys.forEach((k, i) => {
            const id = this._addWindowWithLangChain(k, false);
            if (i === 0) firstId = id;
        });
        
        this._activeId = firstId || this._rawWindows[0]?.id || null;

        // Global click-outside listener
        this._outsideClickHandler = (e) => {
            const wrap = this.refs.addTabWrap;
            if (wrap && !wrap.contains(e.target)) {
                this._closeDropdown();
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler);
        }, 0);
    }

    renderedCallback() {
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
    // LANGCHAIN API INTEGRATION
    // ═══════════════════════════════════════════════════════

    _getAuthToken() {
        // Get JWT token from Salesforce session
        // This should be obtained from your backend or Salesforce
        return sessionStorage.getItem('aria_jwt_token') || this.langchainApiKey;
    }

    async _createSessionWithLangChain(agentType) {
        console.log("Create session via LangChain API");
        try {
            this._isLoading = true;
            this._loadingMessage = `Creating ${agentType} session...`;

            const response = await fetch(
                `${LANGCHAIN_API_ENDPOINT}/api/${API_VERSION}/sessions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this._jwtToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        agentType: agentType,
                        model_id: 'gpt-4o'
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to create session: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Session created:', data);
            
            return data.session_id;
        } catch (error) {
            console.error('Error creating LangChain session:', error);
            this._fireToast('error', `Failed to create session: ${error.message}`);
            return null;
        } finally {
            this._isLoading = false;
        }
    }

    async _sendMessageToLangChain(sessionId, message, agentType, windowId) {
        console.log("Send message to LangChain API with RAG ");
        try {
            this._isLoading = true;
            this._loadingMessage = 'Processing with AI...';

            const response = await fetch(
                `${LANGCHAIN_API_ENDPOINT}/api/${API_VERSION}/chat/message`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this._jwtToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        session_id: sessionId,
                        message: message,
                        agent_type: agentType,
                        model_id: 'gpt-4o'
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('LangChain Response:', data);
            
            return {
                response: data.response,
                contextDocuments: data.context_documents,
                messageId: data.assistant_message_id
            };
        } catch (error) {
            console.error('Error sending message to LangChain:', error);
            this._fireToast('error', `Failed to get response: ${error.message}`);
            return null;
        } finally {
            this._isLoading = false;
        }
    }

    async _performVectorSearch(query, k = 3) {
         console.log("Perform semantic search via LangChain vector store ")
        try {
            const response = await fetch(
                `${LANGCHAIN_API_ENDPOINT}/api/${API_VERSION}/vector-search`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this._jwtToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: query,
                        k: k
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.results;
        } catch (error) {
            console.error('Vector search error:', error);
            return [];
        }
    }

    async _getSessionMessages(sessionId) {
         console.log("Get all messages from LangChain session ")
        try {
            const response = await fetch(
                `${LANGCHAIN_API_ENDPOINT}/api/${API_VERSION}/sessions/${sessionId}/messages`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this._jwtToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.statusText}`);
            }

            const data = await response.json();
            return data.messages || [];
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    async _getAgentMemory(sessionId) {
         console.log("Get conversation memory state ")
        try {
            const response = await fetch(
                `${LANGCHAIN_API_ENDPOINT}/api/${API_VERSION}/agent/memory/${sessionId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this._jwtToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch memory: ${response.statusText}`);
            }

            const data = await response.json();
            return data.memory || [];
        } catch (error) {
            console.error('Error fetching memory:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════
    // WINDOW MANAGEMENT WITH LANGCHAIN
    // ═══════════════════════════════════════════════════════

    async _addWindowWithLangChain(agentKey, setActive = false) {
         console.log("Create window and LangChain session ")
        const cfg = AGENTS[agentKey] || AGENTS.support;
        const windowId = `window_${Date.now()}_${Math.random()}`;
        
        // Create LangChain session
        const sessionId = await this._createSessionWithLangChain(agentKey);
        
        if (!sessionId) {
            this._fireToast('error', 'Failed to create chat session');
            return null;
        }
        
        // Store session ID mapping
        this._sessionIds[windowId] = sessionId;

        // Add window
        this._rawWindows = [...this._rawWindows, {
            id: windowId,
            agentKey,
            isTyping: false,
            unread: 0,
            ...cfg
        }];
        
        this._histories[windowId] = [];
        this._charCounts[windowId] = 0;
        
        if (setActive || !this._activeId) {
            this._activeId = windowId;
        }
        
        return windowId;
    }

    _updateWindow(winId, props) {
        this._rawWindows = this._rawWindows.map(w =>
            w.id === winId ? { ...w, ...props } : w
        );
    }

    // ═══════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════

    get layoutIcon()        { return this._isSplit ? '⊟' : '⊞'; }
    get layoutToggleClass() { return this._isSplit ? 'hdr-btn active' : 'hdr-btn'; }
    get mainAreaClass()     { return this._isSplit ? 'main-area layout-split' : 'main-area'; }
    get allTabsOpen()       { return this._rawWindows.length >= AGENT_KEYS.length; }
    get addTabBtnClass()    { return this.allTabsOpen ? 'btn-add-tab btn-add-tab--disabled' : 'btn-add-tab'; }
    get addTabTitle()       { return this.allTabsOpen ? 'All windows are open' : 'Add a chat window'; }

    get availableAgents() {
        const used = this._rawWindows.map(w => w.agentKey);
        return AGENT_KEYS
            .filter(k => !used.includes(k))
            .map(k => ({
                key: k,
                name: AGENTS[k].name,
                role: AGENTS[k].agentRole,
                dotClass: `di-dot di-dot--${k}`
            }));
    }

    get chatWindows() {
        return this._rawWindows.map(w => this._buildView(w));
    }

    get visibleWindows() {
        if (this._rawWindows.length === 0) return [];
        const all = this._rawWindows.map(w => this._buildView(w));
        if (this._isSplit) return all;
        const active = all.filter(w => w.id === this._activeId);
        return active.length > 0 ? active : [all[0]];
    }

    get showModal()      { return this._showModal; }
    get modalModels()    { return this._modalModels; }
    get modalSubtitle()  { return this._modalSub; }
    get scopeThisClass() { return this._modalScopeAll ? 'scope-btn' : 'scope-btn scope-active'; }
    get scopeAllClass()  { return this._modalScopeAll ? 'scope-btn scope-active' : 'scope-btn'; }
    get showToast()      { return this._showToast; }
    get toastMsg()       { return this._toastMsg; }
    get toastClass()     { return `toast toast-${this._toastType}`; }

    // ═══════════════════════════════════════════════════════
    // BUILD VIEW
    // ═══════════════════════════════════════════════════════

    _buildView(raw) {
        const isActive = raw.id === this._activeId;
        const model = MODEL_MAP[raw.modelId] || { name: raw.modelName || 'GPT-4o', color: raw.accent };
        const hist = this._histories[raw.id] || [];

        const messages = hist.map(m => ({
            id: m.id,
            content: m.content,
            time: m.time,
            isLoading: m.isLoading,
            isUser: m.role === 'user',
            messageClass: `message ${m.role === 'user' ? 'message-user' : 'message-bot'}`,
            bubbleClass: `msg-bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-bot'}`
        }));

        return {
            id: raw.id,
            agentKey: raw.agentKey,
            name: raw.name,
            agentName: raw.agentName,
            agentRole: raw.agentRole,
            agentInitial: raw.agentInitial,
            accent: raw.accent,
            modelId: raw.modelId,
            modelName: model.name,
            modelDotStyle: `background:${model.color};`,
            emptyIcon: raw.emptyIcon,
            emptyTitle: raw.emptyTitle,
            emptySub: raw.emptySub,
            quickPrompts: raw.quickPrompts,
            placeholder: raw.placeholder,
            messages,
            isEmpty: messages.length === 0,
            charCount: this._charCounts[raw.id] || 0,
            isTyping: raw.isTyping || false,
            hasUnread: (raw.unread || 0) > 0,
            unread: raw.unread || 0,
            isCloseable: this._rawWindows.length > 1,
            tabClass: isActive ? 'tab-btn tab-active' : 'tab-btn',
            tabDotClass: `tab-dot tab-dot--${raw.agentKey}`,
            windowClass: isActive ? 'chat-win window-active' : 'chat-win',
            typingClass: raw.isTyping ? 'typing-indicator on' : 'typing-indicator',
            windowStyle: `--win-accent:${raw.accent}; --win-accent-bg:${raw.accent}18; --win-model-color:${model.color};`
        };
    }

    // ═══════════════════════════════════════════════════════
    // DROPDOWN
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
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════

    handleLayoutToggle() {
        this._isSplit = !this._isSplit;
    }

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
        if (this._rawWindows.length <= 1) return;
        
        const closedIdx = this._rawWindows.findIndex(w => w.id === id);
        this._rawWindows = this._rawWindows.filter(w => w.id !== id);
        delete this._histories[id];
        delete this._sessionIds[id];
        
        if (this._activeId === id) {
            const next = this._rawWindows[closedIdx] || this._rawWindows[closedIdx - 1] || this._rawWindows[0];
            this._activeId = next?.id || null;
        }
    }

    async handleAddTabClick(event) {
        event.stopPropagation();
        if (this.allTabsOpen) return;
        this._toggleDropdown();
    }

    async handleAgentPick(event) {
        event.stopPropagation();
        const key = event.currentTarget.dataset.key;
        this._closeDropdown();
        const newId = await this._addWindowWithLangChain(key, true);
        if (newId) {
            this._activeId = newId;
        }
    }

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
        const id = event.currentTarget.dataset.id;
        const prompt = event.currentTarget.dataset.prompt;
        this._sendMessage(id, prompt);
    }

    handleWindowAction(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.id;
        const action = event.currentTarget.dataset.action;
        if (action === 'clear')  this._clearWindow(id);
        if (action === 'export') this._exportWindow(id);
        if (action === 'model')  this._openModal(id);
    }

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
    // MESSAGING WITH LANGCHAIN
    // ═══════════════════════════════════════════════════════

    async _sendMessage(winId, text) {
        if (!text || !text.trim()) return;
        const win = this._rawWindows.find(w => w.id === winId);
        if (!win || win.isTyping) return;

        // Get session ID
        const sessionId = this._sessionIds[winId];
        if (!sessionId) {
            this._fireToast('error', 'Session not initialized');
            return;
        }

        // Add user message locally
        const userMsgId = `msg_${Date.now()}_user`;
        this._histories[winId] = [
            ...(this._histories[winId] || []),
            { 
                id: userMsgId, 
                role: 'user', 
                content: text.trim(), 
                time: this._formatTime(),
                isLoading: false 
            }
        ];

        // Add loading message
        const loadId = `msg_${Date.now()}_load`;
        this._histories[winId] = [
            ...this._histories[winId],
            { 
                id: loadId, 
                role: 'assistant', 
                content: '', 
                time: '', 
                isLoading: true 
            }
        ];

        this._updateWindow(winId, { isTyping: true });
        this._scrollToBottom(winId);

        // Send to LangChain API
        const result = await this._sendMessageToLangChain(
            sessionId,
            text.trim(),
            win.agentKey,
            winId
        );

        if (result) {
            // Update with actual response
            this._histories[winId] = this._histories[winId].map(m =>
                m.id === loadId
                    ? { 
                        id: loadId, 
                        role: 'assistant', 
                        content: result.response, 
                        time: this._formatTime(), 
                        isLoading: false 
                      }
                    : m
            );
        } else {
            // Remove loading message on error
            this._histories[winId] = this._histories[winId].filter(m => m.id !== loadId);
        }

        this._updateWindow(winId, {
            isTyping: false,
            unread: winId !== this._activeId ? (win.unread || 0) + 1 : 0
        });

        this._scrollToBottom(winId);
    }

    _formatTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    _scrollToBottom(winId) {
        setTimeout(() => {
            const el = this.template.querySelector(`[data-msgcontainer="${winId}"]`);
            if (el) el.scrollTop = el.scrollHeight;
        }, 60);
    }

    _clearWindow(winId) {
        this._histories[winId] = [];
        this._rawWindows = [...this._rawWindows];
        this._fireToast('info', 'Chat cleared.');
    }

    _exportWindow(winId) {
        const win = this._rawWindows.find(w => w.id === winId);
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
        const a = document.createElement('a');
        a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
        a.download = `chat-${win?.agentName || 'export'}.txt`;
        a.click();
        this._fireToast('success', 'Chat exported.');
    }

    _openModal(winId) {
        const win = this._rawWindows.find(w => w.id === winId);
        this._modalWinId = winId;
        this._modalScopeAll = false;
        this._modalSelId = win?.modelId || 'gpt-4o';
        this._modalSub = `Window: ${win?.agentName || 'Current'} · ${win?.agentRole || ''}`;
        this._buildModalModels();
        this._showModal = true;
    }

    _buildModalModels() {
        this._modalModels = LLM_GROUPS.map(g => ({
            id: g.id,
            provider: g.provider,
            models: g.models.map(m => ({
                ...m,
                isSelected: m.id === this._modalSelId,
                itemClass: m.id === this._modalSelId ? 'mm-item mm-selected' : 'mm-item',
                iconStyle: `background:${m.color}18; color:${m.color};`,
                tagObjects: m.tags.map(t => ({ id: t, label: t, cls: `mm-tag tag-${t}` }))
            }))
        }));
    }

    _fireToast(type, msg) {
        this._toastType = type;
        this._toastMsg = msg;
        this._showToast = true;
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { this._showToast = false; }, 3000);
    }
}
