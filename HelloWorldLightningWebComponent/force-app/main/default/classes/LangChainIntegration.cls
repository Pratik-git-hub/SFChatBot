/**
 * ARIA Chat Agent - LangChain Integration
 * Apex Classes for Salesforce Integration with Backend API
 */

public without sharing class LangChainIntegration {
    
    private static final String API_VERSION = 'v1';
    
    public class MessageResponse {
        public String response;
        public Integer contextDocuments;
        public String messageId;
    }
    
    /**
     * Create a chat session via LangChain API
     */
    public static String createSession(String agentType, String modelId) {
        try {
            ARIA_Configuration__c config = ARIA_Configuration__c.getOrgDefaults();
            
            if (config == null || !config.Enable_LangChain__c) {
                throw new AuraHandledException('LangChain integration is disabled');
            }
            
            HttpRequest req = new HttpRequest();
            String endpoint = config.LangChain_API_Endpoint__c + '/api/' + API_VERSION + '/sessions';
            req.setEndpoint(endpoint);
            req.setMethod('POST');
            req.setHeader('Authorization', 'Bearer ' + getAuthToken());
            req.setHeader('Content-Type', 'application/json');
            
            Map<String, String> body = new Map<String, String>();
            body.put('agentType', agentType);
            body.put('model_id', modelId);
            
            req.setBody(JSON.serialize(body));
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() != 201 && res.getStatusCode() != 200) {
                throw new AuraHandledException('Failed to create session: ' + res.getStatus());
            }
            
            Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            String sessionId = (String) responseData.get('session_id');
            
            saveSessionToSalesforce(sessionId, agentType, modelId);
            
            return sessionId;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating LangChain session: ' + e.getMessage());
        }
    }
    
    /**
     * Send message to LangChain API
     */
    public static MessageResponse sendMessage(String sessionId, String message, String agentType, String modelId) {
        try {
            ARIA_Configuration__c config = ARIA_Configuration__c.getOrgDefaults();
            
            if (config == null) {
                throw new AuraHandledException('LangChain configuration not found');
            }
            
            HttpRequest req = new HttpRequest();
            String endpoint = config.LangChain_API_Endpoint__c + '/api/' + API_VERSION + '/chat/message';
            req.setEndpoint(endpoint);
            req.setMethod('POST');
            req.setHeader('Authorization', 'Bearer ' + getAuthToken());
            req.setHeader('Content-Type', 'application/json');
            
            Map<String, String> body = new Map<String, String>();
            body.put('session_id', sessionId);
            body.put('message', message);
            body.put('agent_type', agentType);
            body.put('model_id', modelId);
            
            req.setBody(JSON.serialize(body));
            req.setTimeout(60000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() != 200) {
                throw new AuraHandledException('LangChain API error: ' + res.getStatus());
            }
            
            Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            
            MessageResponse msgRes = new MessageResponse();
            msgRes.response = (String) responseData.get('response');
            msgRes.contextDocuments = Integer.valueOf(responseData.get('context_documents') ?? 0);
            msgRes.messageId = (String) responseData.get('assistant_message_id');
            
            saveMessageToSalesforce(sessionId, message, msgRes.response);
            
            return msgRes;
        } catch (Exception e) {
            throw new AuraHandledException('Error sending message to LangChain: ' + e.getMessage());
        }
    }
    
    /**
     * Perform vector search
     */
    public static List<Map<String, Object>> vectorSearch(String query, Integer k) {
        try {
            ARIA_Configuration__c config = ARIA_Configuration__c.getOrgDefaults();
            
            if (config == null) {
                throw new AuraHandledException('LangChain configuration not found');
            }
            
            HttpRequest req = new HttpRequest();
            String endpoint = config.LangChain_API_Endpoint__c + '/api/' + API_VERSION + '/vector-search';
            req.setEndpoint(endpoint);
            req.setMethod('POST');
            req.setHeader('Authorization', 'Bearer ' + getAuthToken());
            req.setHeader('Content-Type', 'application/json');
            
            Map<String, Object> body = new Map<String, Object>();
            body.put('query', query);
            body.put('k', k);
            
            req.setBody(JSON.serialize(body));
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() != 200) {
                throw new AuraHandledException('Vector search failed: ' + res.getStatus());
            }
            
            Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Map<String, Object>> results = (List<Map<String, Object>>) responseData.get('results');
            return results != null ? results : new List<Map<String, Object>>();
        } catch (Exception e) {
            throw new AuraHandledException('Error performing vector search: ' + e.getMessage());
        }
    }
    
    /**
     * Get session messages
     */
    public static List<Map<String, Object>> getSessionMessages(String sessionId) {
        try {
            ARIA_Configuration__c config = ARIA_Configuration__c.getOrgDefaults();
            
            if (config == null) {
                throw new AuraHandledException('LangChain configuration not found');
            }
            
            HttpRequest req = new HttpRequest();
            String endpoint = config.LangChain_API_Endpoint__c + '/api/' + API_VERSION + '/sessions/' + sessionId + '/messages';
            req.setEndpoint(endpoint);
            req.setMethod('GET');
            req.setHeader('Authorization', 'Bearer ' + getAuthToken());
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() != 200) {
                throw new AuraHandledException('Failed to fetch messages: ' + res.getStatus());
            }
            
            Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Map<String, Object>> messages = (List<Map<String, Object>>) responseData.get('messages');
            return messages != null ? messages : new List<Map<String, Object>>();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching messages: ' + e.getMessage());
        }
    }
    
    /**
     * Get auth token
     */
    private static String getAuthToken() {
        ARIA_Configuration__c config = ARIA_Configuration__c.getOrgDefaults();
        if (config != null && String.isNotBlank(config.LangChain_API_Key__c)) {
            return config.LangChain_API_Key__c;
        }
        return 'Bearer_Token_Here';
    }
    
    /**
     * Save session to Salesforce
     */
    private static void saveSessionToSalesforce(String sessionId, String agentType, String modelId) {
        try {
            ARIA_Chat_Session__c session = new ARIA_Chat_Session__c();
            session.Session_ID__c = sessionId;
            session.User_ID__c = UserInfo.getUserId();
            session.Agent_Type__c = agentType;
            session.Model_ID__c = modelId;
            session.Status__c = 'Active';
            session.Started_At__c = System.now();
            
            insert session;
        } catch (Exception e) {
            System.debug('Error saving session: ' + e.getMessage());
        }
    }
    
    /**
     * Save message to Salesforce
     */
    private static void saveMessageToSalesforce(String sessionId, String userMessage, String assistantMessage) {
        try {
            List<ARIA_Chat_Session__c> sessions = [
                SELECT Id FROM ARIA_Chat_Session__c 
                WHERE Session_ID__c = :sessionId 
                LIMIT 1
            ];
            
            if (sessions.isEmpty()) {
                return;
            }
            
            ARIA_Chat_Session__c session = sessions[0];
            List<ARIA_Chat_Message__c> messages = new List<ARIA_Chat_Message__c>();
            
            ARIA_Chat_Message__c userMsg = new ARIA_Chat_Message__c();
            userMsg.Session__c = session.Id;
            userMsg.Role__c = 'User';
            userMsg.Content__c = userMessage;
            userMsg.Created_At__c = System.now();
            messages.add(userMsg);
            
            ARIA_Chat_Message__c assistantMsg = new ARIA_Chat_Message__c();
            assistantMsg.Session__c = session.Id;
            assistantMsg.Role__c = 'Assistant';
            assistantMsg.Content__c = assistantMessage;
            assistantMsg.Created_At__c = System.now();
            messages.add(assistantMsg);
            
            insert messages;
            
            Integer messageCount = [SELECT COUNT() FROM ARIA_Chat_Message__c WHERE Session__c = :session.Id];
            session.Total_Messages__c = messageCount;
            update session;
        } catch (Exception e) {
            System.debug('Error saving messages: ' + e.getMessage());
        }
    }
}

/**
 * Aura/LWC Controller for LangChain Integration
 */
