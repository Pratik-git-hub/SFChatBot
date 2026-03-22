public without sharing class AuraLangChainController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getConfiguration() {
        try {
            ARIA_Configuration__c config = ARIA_Configuration__c.getOrgDefaults();
            
            Map<String, Object> result = new Map<String, Object>();
            
            if (config != null) {
                result.put('apiEndpoint', config.LangChain_API_Endpoint__c);
                result.put('enableLangChain', config.Enable_LangChain__c);
                result.put('defaultAgent', config.Default_Agent__c);
                result.put('maxTokens', config.Max_Tokens__c);
                result.put('temperature', config.Temperature__c);
            } else {
                result.put('apiEndpoint', '');
                result.put('enableLangChain', false);
                result.put('defaultAgent', 'support');
                result.put('maxTokens', 2000);
                result.put('temperature', 0.7);
            }
            
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Error getting configuration: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static String createSession(String agentType) {
        try {
            return LangChainIntegration.createSession(agentType, 'gpt-4o');
        } catch (Exception e) {
            throw new AuraHandledException('Error creating session: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Object> sendMessage(String sessionId, String message, String agentType) {
        try {
            LangChainIntegration.MessageResponse response = 
                LangChainIntegration.sendMessage(sessionId, message, agentType, 'gpt-4o');
            
            Map<String, Object> result = new Map<String, Object>();
            result.put('response', response.response);
            result.put('contextDocuments', response.contextDocuments);
            result.put('messageId', response.messageId);
            
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Error sending message: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> vectorSearch(String query) {
        try {
            return LangChainIntegration.vectorSearch(query, 3);
        } catch (Exception e) {
            throw new AuraHandledException('Error in vector search: ' + e.getMessage());
        }
    }
}