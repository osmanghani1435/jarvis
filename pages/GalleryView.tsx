import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGalleryImages, deleteFromGallery } from '../services/dbService';
import { GalleryItem } from '../types';
import { Trash2, ZoomIn, Image as ImageIcon, Check } from 'lucide-react';
import { getTranslation } from '../services/translations';

interface GalleryViewProps {
  onSelect?: (base64: string) => void;
  isModalMode?: boolean;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ onSelect, isModalMode = false }) => {
  const { userProfile, language } = useAuth();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const t = (key: any) => getTranslation(language, key);

  useEffect(() => {
    loadGallery();
  }, [userProfile]);

  const loadGallery = async () => {
    if (userProfile) {
      setLoading(true);
      const data = await getGalleryImages(userProfile.uid);
      setImages(data);
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!userProfile) return;
    if (window.confirm("Delete this image from gallery?")) {
      await deleteFromGallery(userProfile.uid, id);
      setImages(prev => prev.filter(img => img.id !== id));
    }
  };

  const handleImageClick = (base64: string) => {
     if (onSelect) {
       onSelect(base64);
     } else {
       setSelectedImage(base64);
     }
  };

  return (
    <div className={`w-full h-full ${isModalMode ? 'p-0' : 'max-w-6xl mx-auto p-4'}`}>
      {!isModalMode && (
         <h2 className="text-2xl font-bold text-white tracking-wide mb-6 flex items-center gap-2">
            <ImageIcon className="text-jarvis-accent" /> {t('gallery')}
         </h2>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
           <div className="w-10 h-10 border-4 border-jarvis-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
           {images.map(img => (
             <div 
               key={img.id} 
               className="relative group aspect-square bg-black/20 rounded-xl overflow-hidden border border-jarvis-panel hover:border-jarvis-accent transition cursor-pointer"
               onClick={() => handleImageClick(img.imageBase64)}
             >
               <img src={`data:image/jpeg;base64,${img.imageBase64}`} alt="Gallery Item" className="w-full h-full object-cover" />
               
               <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                   {onSelect ? (
                       <span className="bg-jarvis-accent text-black rounded-full p-2">
                          <Check size={24} />
                       </span>
                   ) : (
                       <ZoomIn className="text-white" size={24} />
                   )}
               </div>

               {!onSelect && (
                 <button 
                   onClick={(e) => handleDelete(e, img.id)}
                   className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-500 z-10"
                 >
                    <Trash2 size={14} />
                 </button>
               )}
               
               <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-gray-300">
                  {new Date(img.timestamp).toLocaleDateString()}
               </div>
             </div>
           ))}
           
           {images.length === 0 && (
             <div className="col-span-full py-10 text-center border border-dashed border-jarvis-panel rounded-xl text-gray-500">
                No images stored in neural archives.
             </div>
           )}
        </div>
      )}
      
      {/* Lightbox for non-select mode */}
      {selectedImage && !isModalMode && (
         <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
            <button 
               onClick={() => setSelectedImage(null)}
               className="absolute top-4 right-4 text-white p-2"
            >
               <ZoomIn className="rotate-45" size={32} />
            </button>
            <img src={`data:image/jpeg;base64,${selectedImage}`} alt="Full View" className="max-w-full max-h-full object-contain" />
         </div>
      )}
    </div>
  );
};
