import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, Search, Folder, Loader, Trash2, Eye } from 'lucide-react';
import { extractTextFromImage } from '../services/geminiService';
import { saveDocumentText } from '../services/dbService';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

interface DocItem {
  id: string;
  title: string;
  content: string;
  type: string;
  uploadedAt: any;
}

export const DocumentsView: React.FC = () => {
  const { userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);

  // Load Real Documents from Firestore
  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, `users/${userProfile.uid}/documents`),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DocItem[];
      setDocs(loadedDocs);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    setIsAnalyzing(true);
    
    try {
      // 1. Convert File to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        // 2. Send to AI for Text Extraction
        const extractedText = await extractTextFromImage(base64String, file.type);
        
        // 3. Save TEXT to Firestore (Not the image)
        await saveDocumentText(
          userProfile.uid,
          file.name,
          extractedText,
          'personal' // Default category
        );
        
        setIsAnalyzing(false);
      };
    } catch (err) {
      console.error("Upload failed", err);
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (userProfile && window.confirm("Delete this archive permanently?")) {
      await deleteDoc(doc(db, `users/${userProfile.uid}/documents`, id));
      if (selectedDoc?.id === id) setSelectedDoc(null);
    }
  };

  const filteredDocs = docs.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col md:flex-row gap-6">
      
      {/* Left Panel: List */}
      <div className={`flex-1 flex flex-col ${selectedDoc ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-wide">ARCHIVES</h2>
          <div className="flex gap-2">
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
               <input 
                 type="text" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 placeholder="Search data..."
                 className="bg-jarvis-bgSec border border-jarvis-panel rounded-lg pl-10 pr-4 py-2 text-sm focus:border-jarvis-accent outline-none w-40 md:w-56 text-white"
               />
             </div>
             <button 
               onClick={() => fileInputRef.current?.click()}
               disabled={isAnalyzing}
               className="bg-jarvis-accent text-black px-3 py-2 rounded-lg font-bold hover:shadow-[0_0_10px_#00d4ff] transition disabled:opacity-50 animate-heartbeat-cyan"
             >
               {isAnalyzing ? <Loader size={20} className="animate-spin" /> : <Upload size={20} />}
             </button>
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*,application/pdf"
               onChange={handleFileUpload}
             />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-2 pb-20">
          {filteredDocs.map((doc) => (
            <div 
              key={doc.id} 
              onClick={() => setSelectedDoc(doc)}
              className={`bg-jarvis-bgSec border rounded-xl p-4 transition cursor-pointer hover:border-jarvis-accent/40 ${selectedDoc?.id === doc.id ? 'border-jarvis-accent shadow-[0_0_10px_rgba(0,212,255,0.1)]' : 'border-jarvis-panel'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-jarvis-panel rounded-lg text-jarvis-accent">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-200 text-sm truncate max-w-[150px]">{doc.title}</h4>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {doc.uploadedAt?.toDate ? doc.uploadedAt.toDate().toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                </div>
                <button onClick={(e) => handleDelete(e, doc.id)} className="text-gray-600 hover:text-jarvis-error">
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 font-mono bg-black/20 p-2 rounded">
                {doc.content.substring(0, 100)}...
              </p>
            </div>
          ))}

          {filteredDocs.length === 0 && !isAnalyzing && (
            <div className="text-center py-10 text-jarvis-textSec opacity-50 border border-dashed border-jarvis-panel rounded-xl">
              <Folder size={40} className="mx-auto mb-2 opacity-50" />
              <p>No archives found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Preview */}
      {selectedDoc && (
        <div className="flex-1 bg-jarvis-bgSec border border-jarvis-panel rounded-2xl p-6 h-fit md:h-auto flex flex-col absolute inset-0 md:relative z-20 m-4 md:m-0">
          <div className="flex justify-between items-start mb-6 border-b border-jarvis-panel pb-4">
            <div>
              <h3 className="text-xl font-bold text-jarvis-accent">{selectedDoc.title}</h3>
              <span className="text-xs text-jarvis-textSec uppercase tracking-wider">Analyzed Text Content</span>
            </div>
            <button 
              onClick={() => setSelectedDoc(null)} 
              className="md:hidden text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-black/20 rounded-xl p-4 font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {selectedDoc.content}
          </div>
          
          <div className="mt-4 pt-4 border-t border-jarvis-panel flex justify-between items-center text-xs text-gray-500">
             <span>Storage Efficiency: 100% (Text Only)</span>
             <button onClick={() => setSelectedDoc(null)} className="hidden md:block hover:text-white">
               Close Preview
             </button>
          </div>
        </div>
      )}

    </div>
  );
};