

export interface UserProfile {
  uid: string;
  name: string | null;
  email: string | null;
  country?: string;
  city?: string;
  gender?: 'male' | 'female' | 'other';
  language?: 'en' | 'id'; // New field for language preference
  preferences?: Record<string, any>;
  createdAt: number;
}

export interface UserSettings {
  apiKeys: string[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  conversationId: string;
  attachment?: string; // Base64 string for user uploads
  generatedImage?: string; // Base64 string for AI generation
  isAgentic?: boolean; // Whether this response used agentic mode
  isLiveInteraction?: boolean; // Whether this was a voice conversation
  thinkingTime?: number; // How long it took to think
  groundingMetadata?: GroundingChunk[]; // Sources from web search
  replyToId?: string; // ID of the message this is replying to
  replyToContent?: string; // Snippet of the message replying to
  discussionTopic?: string; // If set, this message has a "Discuss Live" option
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  isPrimary?: boolean;
  useMemory?: boolean;
  isPinned?: boolean; // New: Pin chat
  isTemporary?: boolean; // New: Auto-delete on switch
  isDeleted?: boolean; // New: Soft delete flag
  deletedAt?: any; // New: Timestamp when deleted
  createdAt: any;
  updatedAt: any;
  messages?: Message[]; // Optional, sometimes we just fetch metadata
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  completed: boolean;
  createdAt: number;
}

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  datetime: string; // ISO String
  completed: boolean;
  createdAt: number;
}

export interface Document {
  id: string;
  userId: string;
  title: string;
  type: 'study' | 'work' | 'personal' | 'finance' | 'health';
  content: string;
  tags: string[];
  uploadedAt: number;
}

export interface GalleryItem {
  id: string;
  userId: string;
  imageBase64: string; // Base64 string
  timestamp: number;
}

export interface AgentAction {
  type: 'create_task' | 'delete_task' | 'create_reminder' | 'delete_reminder' | 'search_docs' | 'chat' | 'update_prefs' | 'generate_image';
  data?: any;
  responseToUser: string;
  generatedImage?: string;
  groundingMetadata?: GroundingChunk[];
}

export interface AINotification {
  id: string;
  title: string;
  message: string;
  type: 'suggestion' | 'insight';
  importance?: 'high' | 'medium' | 'low';
  generatedContent?: string; // Content found by the monitoring agent
  timestamp: number;
  read?: boolean;
}