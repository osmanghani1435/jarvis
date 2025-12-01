import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  serverTimestamp,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db, isConfigured } from '../firebaseConfig';
import { Task, Message, UserProfile, Conversation, UserSettings, Document, GalleryItem, Reminder } from '../types';

// ==========================================
// 1. USER PROFILE & SETTINGS
// ==========================================

export const createUserProfile = async (user: UserProfile) => {
  if (!isConfigured) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userData: any = {
      uid: user.uid,
      name: user.name,
      email: user.email,
      lastActive: serverTimestamp(),
    };
    
    if (user.country) userData.country = user.country;
    if (user.city) userData.city = user.city;
    if (user.gender) userData.gender = user.gender; 
    if (user.language) userData.language = user.language; 
    if (user.createdAt) userData.createdAt = user.createdAt;

    await setDoc(userRef, userData, { merge: true });

    const primaryChatRef = doc(db, `users/${user.uid}/conversations`, 'primary');
    const primarySnap = await getDoc(primaryChatRef);
    if (!primarySnap.exists()) {
      await setDoc(primaryChatRef, {
        userId: user.uid,
        title: "Primary Protocol",
        isPrimary: true,
        useMemory: true,
        isPinned: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

  } catch (error) {
    console.error("Error creating user profile:", error);
  }
};

export const getUserApiKeys = async (userId: string): Promise<string[]> => {
  if (!isConfigured) return [];
  try {
    const docRef = doc(db, `users/${userId}/settings/config`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as UserSettings;
      return data.apiKeys || [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return [];
  }
};

export const saveUserApiKeys = async (userId: string, apiKeys: string[]) => {
  if (!isConfigured) return;
  try {
    const docRef = doc(db, `users/${userId}/settings/config`);
    await setDoc(docRef, { apiKeys }, { merge: true });
  } catch (error) {
    console.error("Error saving API keys:", error);
  }
};

// ==========================================
// 2. CONVERSATIONS & MESSAGES
// ==========================================

export const getConversations = async (userId: string): Promise<Conversation[]> => {
  if (!isConfigured) return [];
  try {
    const ref = collection(db, `users/${userId}/conversations`);
    // EMERGENCY FIX: Reverted to fetch ALL chats to handle legacy docs (missing isDeleted)
    // and removed .where() clause to bypass Firestore index errors.
    const q = query(ref, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const allConversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Conversation[];

    // CLIENT-SIDE FILTERING
    // Show chats that are NOT marked as deleted (handles true, false, and undefined)
    return allConversations.filter(c => c.isDeleted !== true);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
};

export const getTrashedConversations = async (userId: string): Promise<Conversation[]> => {
  if (!isConfigured) return [];
  try {
    const ref = collection(db, `users/${userId}/conversations`);
    // Filter on client side to avoid complex index requirements for now
    const q = query(ref, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const allConversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Conversation[];

    // CLIENT-SIDE FILTERING for Trash
    return allConversations.filter(c => c.isDeleted === true);
  } catch (error) {
    console.error("Error fetching trash:", error);
    return [];
  }
};

export const createNewConversation = async (
  userId: string, 
  initialTitle: string = "New Session", 
  useMemory: boolean = true,
  isTemporary: boolean = false
): Promise<string> => {
  if (!isConfigured) return 'temp_' + Date.now();
  
  const ref = collection(db, `users/${userId}/conversations`);
  const docRef = await addDoc(ref, {
    userId,
    title: initialTitle,
    isPrimary: false,
    useMemory,
    isTemporary,
    isPinned: false,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const updateConversationTitle = async (userId: string, conversationId: string, newTitle: string) => {
  if (!isConfigured) return;
  const ref = doc(db, `users/${userId}/conversations`, conversationId);
  await updateDoc(ref, { title: newTitle });
};

export const toggleConversationPin = async (userId: string, conversationId: string, currentPinState: boolean) => {
  if (!isConfigured) return;
  const ref = doc(db, `users/${userId}/conversations`, conversationId);
  const updates: any = { isPinned: !currentPinState };
  if (!currentPinState) {
     updates.isTemporary = false;
  }
  await updateDoc(ref, updates);
};

export const saveMessage = async (userId: string, message: Message) => {
  if (!isConfigured) return;
  
  const chatRef = collection(db, `users/${userId}/conversations/${message.conversationId}/messages`);
  
  const payload: any = {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp || serverTimestamp(),
  };

  if (message.attachment) payload.attachment = message.attachment;
  if (message.generatedImage) payload.generatedImage = message.generatedImage;
  if (message.thinkingTime) payload.thinkingTime = message.thinkingTime;
  if (message.groundingMetadata) payload.groundingMetadata = message.groundingMetadata;
  if (message.replyToId) payload.replyToId = message.replyToId;
  if (message.replyToContent) payload.replyToContent = message.replyToContent;
  if (message.isLiveInteraction) payload.isLiveInteraction = message.isLiveInteraction;
  if (message.discussionTopic) payload.discussionTopic = message.discussionTopic;

  await addDoc(chatRef, payload);

  const convoRef = doc(db, `users/${userId}/conversations`, message.conversationId);
  await setDoc(convoRef, { 
    updatedAt: serverTimestamp(),
    isDeleted: false, 
    userId 
  }, { merge: true });
};

export const getConversationHistory = async (userId: string, conversationId: string): Promise<Message[]> => {
  if (!isConfigured) return [];

  try {
    const chatRef = collection(db, `users/${userId}/conversations/${conversationId}/messages`);
    const q = query(chatRef, orderBy('timestamp', 'asc'), limit(100)); 
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as Message));
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
};

export const deleteSingleMessage = async (userId: string, conversationId: string, messageId: string) => {
    if (!isConfigured) return;
    if (!userId || !conversationId || !messageId) {
       console.error("Missing parameters for deleteSingleMessage");
       throw new Error("Missing parameters for message deletion");
    }
    try {
        const msgRef = doc(db, `users/${userId}/conversations/${conversationId}/messages`, messageId);
        await deleteDoc(msgRef);
    } catch (e) {
        console.error("Error deleting specific message", e);
        throw e;
    }
};

// ==========================================
// MEMORY SYNC
// ==========================================

export const syncMemoryToLocal = async (userId: string): Promise<void> => {
  if (!isConfigured) return;
  try {
    const memory = await getConversationHistory(userId, 'primary');
    localStorage.setItem('jarvis_core_memory', JSON.stringify(memory.slice(-20))); 
    
    const insightsRef = collection(db, `users/${userId}/insights`);
    const q = query(insightsRef, orderBy('timestamp', 'desc'), limit(10)); 
    const snap = await getDocs(q);
    const insights = snap.docs.map(d => d.data().content).join('\n');
    localStorage.setItem('jarvis_insights', insights);
  } catch (error) {
    console.error("Memory Sync Failed", error);
  }
};

export const saveInsight = async (userId: string, content: string) => {
    if (!isConfigured) return;
    try {
        const insightsRef = collection(db, `users/${userId}/insights`);
        await addDoc(insightsRef, {
            content,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Failed to save insight", e);
    }
};

export const clearChatHistory = async (userId: string, conversationId: string) => {
  if (!isConfigured) return;

  try {
    const chatRef = collection(db, `users/${userId}/conversations/${conversationId}/messages`);
    const snapshot = await getDocs(chatRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error clearing chat history:", error);
    throw error;
  }
};

// ==========================================
// DELETION LOGIC (TRASH SYSTEM)
// ==========================================

// SOFT DELETE: Marks as deleted but keeps in DB
export const softDeleteConversation = async (userId: string, conversationId: string) => {
  if (!isConfigured) return;
  if (!userId || !conversationId) throw new Error("Invalid ID provided for deletion");
  
  try {
    const ref = doc(db, `users/${userId}/conversations`, conversationId);
    await updateDoc(ref, { 
      isDeleted: true,
      deletedAt: serverTimestamp()
    });
    return true;
  } catch (e) {
    console.error("Soft Delete Failed", e);
    throw e;
  }
};

// RESTORE: Brings back from trash
export const restoreConversation = async (userId: string, conversationId: string) => {
  if (!isConfigured) return;
  if (!userId || !conversationId) throw new Error("Invalid ID provided for restore");

  try {
    const ref = doc(db, `users/${userId}/conversations`, conversationId);
    await updateDoc(ref, { 
      isDeleted: false,
      deletedAt: null
    });
    return true;
  } catch (e) {
    console.error("Restore Failed", e);
    throw e;
  }
};

// HARD DELETE: Permanently removes document and messages
export const deleteConversationPermanently = async (userId: string, conversationId: string) => {
  if (!isConfigured) return;
  if (!userId || !conversationId) throw new Error("Invalid ID provided for permanent deletion");
  
  try {
    // 1. Delete messages (subcollection)
    const chatRef = collection(db, `users/${userId}/conversations/${conversationId}/messages`);
    const snapshot = await getDocs(chatRef);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // 2. Delete parent doc
    const docRef = doc(db, `users/${userId}/conversations`, conversationId);
    await deleteDoc(docRef);

    return true;
  } catch (e) {
    console.error("Permanent Delete Failed", e);
    throw e;
  }
};

// Backwards compatibility alias
export const deleteConversation = softDeleteConversation;

// ==========================================
// 3. TASKS
// ==========================================

export const addTask = async (userId: string, task: Partial<Task>): Promise<Task> => {
  if (!isConfigured) {
    return { id: 'demo', ...task } as Task;
  }

  const tasksRef = collection(db, `users/${userId}/tasks`);
  const docRef = await addDoc(tasksRef, {
    ...task,
    completed: false,
    createdAt: serverTimestamp()
  });
  
  return { id: docRef.id, ...task } as Task;
};

export const getTasks = async (userId: string): Promise<Task[]> => {
  if (!isConfigured) return [];

  try {
    const tasksRef = collection(db, `users/${userId}/tasks`);
    const q = query(tasksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as Task));
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
};

export const getTasksForAI = async (userId: string): Promise<string> => {
  try {
    const tasks = await getTasks(userId);
    const reminders = await getReminders(userId);
    
    let text = "";
    if (tasks.length > 0) {
       text += "TASKS:\n" + tasks.map(t => `- [${t.completed ? 'DONE' : 'PENDING'}] ${t.title} (Priority: ${t.priority}) (ID: ${t.id})`).join('\n') + "\n";
    }
    if (reminders.length > 0) {
       text += "REMINDERS:\n" + reminders.map(r => `- [${r.completed ? 'DONE' : 'ACTIVE'}] ${r.title} at ${r.datetime} (ID: ${r.id})`).join('\n');
    }
    
    return text || "No pending tasks or reminders.";
  } catch (e) {
    return "Could not fetch tasks.";
  }
};

export const toggleTaskComplete = async (userId: string, taskId: string, currentStatus: boolean): Promise<void> => {
  if (!isConfigured) return;
  const taskRef = doc(db, `users/${userId}/tasks`, taskId);
  await updateDoc(taskRef, { completed: !currentStatus });
};

export const deleteTask = async (userId: string, taskId: string): Promise<void> => {
  if (!isConfigured) return;
  const taskRef = doc(db, `users/${userId}/tasks`, taskId);
  await deleteDoc(taskRef);
};

// ==========================================
// 4. REMINDERS (ALARMS)
// ==========================================

export const addReminder = async (userId: string, reminder: Partial<Reminder>): Promise<Reminder> => {
  if (!isConfigured) return { id: 'demo', ...reminder } as Reminder;
  
  const ref = collection(db, `users/${userId}/reminders`);
  const docRef = await addDoc(ref, {
    ...reminder,
    completed: false,
    createdAt: serverTimestamp()
  });
  return { id: docRef.id, ...reminder } as Reminder;
};

export const getReminders = async (userId: string): Promise<Reminder[]> => {
  if (!isConfigured) return [];
  try {
     const ref = collection(db, `users/${userId}/reminders`);
     const q = query(ref, orderBy('datetime', 'asc'));
     const snapshot = await getDocs(q);
     return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
  } catch (e) {
     return [];
  }
};

export const deleteReminder = async (userId: string, reminderId: string): Promise<void> => {
  if (!isConfigured) return;
  const ref = doc(db, `users/${userId}/reminders`, reminderId);
  await deleteDoc(ref);
};

// ==========================================
// 5. DOCUMENTS
// ==========================================

export const saveDocumentText = async (userId: string, title: string, textContent: string, category: string) => {
  if (!isConfigured) return;

  const docsRef = collection(db, `users/${userId}/documents`);
  await addDoc(docsRef, {
    title: title,
    content: textContent,
    type: category,
    uploadedAt: serverTimestamp()
  });
};

export const getAllDocuments = async (userId: string): Promise<string> => {
  if (!isConfigured) return "";
  try {
    const docsRef = collection(db, `users/${userId}/documents`);
    const q = query(docsRef, orderBy('uploadedAt', 'desc'), limit(10)); 
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return "No stored documents found.";

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return `[DOC_ID: ${doc.id}] TITLE: ${data.title}\nCONTENT: ${data.content.substring(0, 1500)}...`; 
    }).join('\n\n');
  } catch (e) {
    console.error("Error getting all docs", e);
    return "";
  }
};

// ==========================================
// 6. GALLERY SYSTEM
// ==========================================

export const addToGallery = async (userId: string, imageBase64: string): Promise<string> => {
  if (!isConfigured) return 'demo';
  try {
    const galleryRef = collection(db, `users/${userId}/gallery`);
    const docRef = await addDoc(galleryRef, {
       userId,
       imageBase64,
       timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding to gallery", e);
    return "";
  }
};

export const getGalleryImages = async (userId: string): Promise<GalleryItem[]> => {
  if (!isConfigured) return [];
  try {
    const galleryRef = collection(db, `users/${userId}/gallery`);
    const q = query(galleryRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        imageBase64: data.imageBase64,
        timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now()
      } as GalleryItem;
    });
  } catch (e) {
    console.error("Error fetching gallery", e);
    return [];
  }
};

export const deleteFromGallery = async (userId: string, imageId: string): Promise<void> => {
   if (!isConfigured) return;
   try {
     const docRef = doc(db, `users/${userId}/gallery`, imageId);
     await deleteDoc(docRef);
   } catch (e) {
     console.error("Error deleting from gallery", e);
   }
};