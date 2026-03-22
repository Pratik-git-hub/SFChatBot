"""
═══════════════════════════════════════════════════════════════════════════
ARIA Chat Agent - Complete LangChain Integration
Full implementation with LangChain, OpenAI, and Vector Embeddings
═══════════════════════════════════════════════════════════════════════════
"""

import os
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# LangChain imports
from langchain_classic.memory import ConversationBufferMemory
from langchain_classic.chains import LLMChain
from langchain_openai import OpenAIEmbeddings
from langchain_openai import ChatOpenAI
from langchain_core.prompts import  PromptTemplate

print("PROJECT1:", os.getenv("LANGCHAIN_PROJECT_CHATBOT"))
# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════
os.environ['OPENAI_API_KEY']=os.getenv("OPENAI_API_KEY")
## Langsmith Tracking
os.environ["LANGSMITH_API_KEY"]=os.getenv("LANGSMITH_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"]="true"
os.environ["LANGCHAIN_PROJECT"]=os.getenv("LANGCHAIN_PROJECT")

load_dotenv()
import uuid
 
# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════
 
app = Flask(__name__)
CORS(app)
 
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
API_VERSION = 'v1'
 
# In-memory storage for sessions (no database)
SESSIONS = {}  # {session_id: {agent_type, messages, memory, etc}}
MESSAGES = {}  # {session_id: [messages]}
 
# ═══════════════════════════════════════════════════════════════════════════
# LANGCHAIN SETUP
# ═══════════════════════════════════════════════════════════════════════════
 
# Initialize embeddings
try:
    embeddings = OpenAIEmbeddings(
        openai_api_key=OPENAI_API_KEY,
        model='text-embedding-3-small'
    )
except Exception as e:
    print(f"Warning: Could not initialize embeddings: {e}")
    embeddings = None
 
# Define agent configurations
AGENTS = {
    'support': {
        'name': 'Aria',
        'role': 'Customer Support Agent',
        'temperature': 0.7,
        'system_prompt': """You are Aria, a helpful customer support agent. 
Your role is to assist customers with their account, orders, billing, and general support issues.
Be empathetic, clear, and helpful. Provide accurate information when possible.
 
Current conversation:
{history}
 
Customer: {input}
Support Agent:"""
    },
    'sales': {
        'name': 'Orion',
        'role': 'Sales Assistant',
        'temperature': 0.8,
        'system_prompt': """You are Orion, a friendly sales assistant.
Your role is to help customers explore products, understand pricing, and discuss upgrades.
Be enthusiastic, helpful, and focus on understanding customer needs.
 
Current conversation:
{history}
 
Customer: {input}
Sales Assistant:"""
    },
    'technical': {
        'name': 'Nexus',
        'role': 'Technical Specialist',
        'temperature': 0.5,
        'system_prompt': """You are Nexus, a technical specialist.
Your role is to help with API integration, troubleshooting, and technical documentation.
Be precise, clear, and provide step-by-step guidance when needed.
 
Current conversation:
{history}
 
Developer: {input}
Technical Specialist:"""
    }
}
 
# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════
 
def generate_session_id():
    """Generate unique session ID"""
    return str(uuid.uuid4())
 
def get_agent_chain(agent_type, model_id='gpt-4o'):
    """Create LangChain conversation chain for agent"""
    try:
        agent_config = AGENTS.get(agent_type, AGENTS['support'])
        
        # Initialize LLM
        llm = ChatOpenAI(
            model_name=model_id,
            temperature=agent_config['temperature'],
            openai_api_key=OPENAI_API_KEY,
            max_tokens=1000
        )
        
        # Create memory - IMPORTANT: Must use buffer_memory with ConversationChain
        memory = ConversationBufferMemory()
        
        # Create prompt template with proper variable names
        prompt = PromptTemplate(
            input_variables=["history", "input"],
            template=agent_config['system_prompt']
        )
        
        # Create LLM Chain (not ConversationChain to avoid validation issues)
        chain = LLMChain(
            llm=llm,
            memory=memory,
            prompt=prompt,
            verbose=False
        )
        
        return chain
    except Exception as e:
        print(f"Error creating chain: {str(e)}")
        raise Exception(f"Error creating chain: {str(e)}")
 
# ═══════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════
 
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': API_VERSION
    }), 200
 
@app.route(f'/api/{API_VERSION}/sessions', methods=['POST'])
def create_session():
    """Create a new chat session"""
    try:
        data = request.get_json()
        agent_type = data.get('agentType', 'support')
        model_id = data.get('model_id', 'gpt-4o')
        
        # Validate agent type
        if agent_type not in AGENTS:
            return jsonify({'error': f'Invalid agent type. Must be one of: {list(AGENTS.keys())}'}), 400
        
        # Generate session ID
        session_id = generate_session_id()
        
        try:
            # Create chain for this session
            chain = get_agent_chain(agent_type, model_id)
        except Exception as e:
            return jsonify({'error': f'Failed to create agent chain: {str(e)}'}), 500
        
        # Store session
        SESSIONS[session_id] = {
            'session_id': session_id,
            'agent_type': agent_type,
            'model_id': model_id,
            'chain': chain,
            'created_at': datetime.now().isoformat(),
            'message_count': 0
        }
        
        MESSAGES[session_id] = []
        
        return jsonify({
            'session_id': session_id,
            'agent_type': agent_type,
            'model_id': model_id,
            'created_at': SESSIONS[session_id]['created_at']
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
 
@app.route(f'/api/{API_VERSION}/chat/message', methods=['POST'])
def send_message():
    """Send message to LangChain agent"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        message = data.get('message')
        agent_type = data.get('agent_type', 'support')
        
        # Validate required fields
        if not session_id or not message:
            return jsonify({'error': 'session_id and message are required'}), 400
        
        # Validate session exists
        if session_id not in SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        session = SESSIONS[session_id]
        chain = session['chain']
        
        # Send message to LangChain
        try:
            response = chain.run(input=message)
        except Exception as e:
            print(f"Error running chain: {str(e)}")
            response = f"I'm having trouble processing that. Error: {str(e)}"
        
        # Store messages
        user_msg_id = str(uuid.uuid4())
        assistant_msg_id = str(uuid.uuid4())
        
        MESSAGES[session_id].append({
            'id': user_msg_id,
            'role': 'user',
            'content': message,
            'timestamp': datetime.now().isoformat()
        })
        
        MESSAGES[session_id].append({
            'id': assistant_msg_id,
            'role': 'assistant',
            'content': response,
            'timestamp': datetime.now().isoformat()
        })
        
        # Update message count
        session['message_count'] = len(MESSAGES[session_id])
        
        return jsonify({
            'response': response,
            'context_documents': 0,
            'assistant_message_id': assistant_msg_id,
            'session_id': session_id,
            'message_count': session['message_count']
        }), 200
        
    except Exception as e:
        print(f"Error in send_message: {str(e)}")
        return jsonify({'error': str(e)}), 500
 
@app.route(f'/api/{API_VERSION}/sessions/<session_id>/messages', methods=['GET'])
def get_session_messages(session_id):
    """Get all messages from a session"""
    try:
        if session_id not in SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        messages = MESSAGES.get(session_id, [])
        
        return jsonify({
            'session_id': session_id,
            'messages': messages,
            'total': len(messages)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
 
@app.route(f'/api/{API_VERSION}/rag/query', methods=['POST'])
def rag_query():
    """Execute RAG query (simplified without vector store)"""
    try:
        data = request.get_json()
        query = data.get('query')
        agent_type = data.get('agent_type', 'support')
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Create temporary chain for RAG
        try:
            chain = get_agent_chain(agent_type)
            answer = chain.run(input=query)
        except Exception as e:
            answer = f"Could not process query: {str(e)}"
        
        return jsonify({
            'query': query,
            'answer': answer,
            'documents': [],
            'success': True
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
 
@app.route(f'/api/{API_VERSION}/vector-search', methods=['POST'])
def vector_search():
    """Vector search endpoint (simplified - no vector store)"""
    try:
        data = request.get_json()
        query = data.get('query')
        k = data.get('k', 3)
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Return empty results (no vector store)
        return jsonify({
            'query': query,
            'results': [],
            'count': 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
 
@app.route(f'/api/{API_VERSION}/add-documents', methods=['POST'])
def add_documents():
    """Add documents to knowledge base (simplified)"""
    try:
        data = request.get_json()
        documents = data.get('documents', [])
        
        # Just acknowledge (no actual storage)
        return jsonify({
            'success': True,
            'documents_added': len(documents),
            'message': 'Documents received (not stored - DB disabled)'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
 
@app.route(f'/api/{API_VERSION}/agent/memory/<session_id>', methods=['GET'])
def get_agent_memory(session_id):
    """Get agent conversation memory"""
    try:
        if session_id not in SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        messages = MESSAGES.get(session_id, [])
        
        # Format memory
        memory_list = []
        for msg in messages:
            memory_list.append({
                'role': msg['role'],
                'content': msg['content'],
                'timestamp': msg['timestamp']
            })
        
        return jsonify({
            'session_id': session_id,
            'message_count': len(messages),
            'memory': memory_list
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
 
# ═══════════════════════════════════════════════════════════════════════════
# ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════════════════
 
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404
 
@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500
 
# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
 
if __name__ == '__main__':
    print("Starting ARIA Chat Agent - LangChain Backend (FIXED)")
    print(f"API Version: {API_VERSION}")
    print("Database: DISABLED (in-memory only)")
    print("OpenAI API Key: " + ("Set" if OPENAI_API_KEY != 'sk-your-key-here' else "NOT SET"))
    print("\nAvailable endpoints:")
    print(f"  GET  /health")
    print(f"  POST /api/{API_VERSION}/sessions")
    print(f"  POST /api/{API_VERSION}/chat/message")
    print(f"  GET  /api/{API_VERSION}/sessions/<session_id>/messages")
    print(f"  POST /api/{API_VERSION}/rag/query")
    print(f"  POST /api/{API_VERSION}/vector-search")
    print(f"  POST /api/{API_VERSION}/add-documents")
    print(f"  GET  /api/{API_VERSION}/agent/memory/<session_id>")
    print("\nStarting server on http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
 
