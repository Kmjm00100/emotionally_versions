import React, { useState, useEffect, useCallback } from 'react';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import BottomNav from '../components/BottomNav';
import { API_URL } from '../config';

export default function ProfileEditPage(){
  const { user, token, login } = useAuth();
  const { showToast } = useToast();
  const [username,setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  
  useEffect(()=>{ setUsername(user?.username||''); setAvatar(user?.avatar||'') },[user]);
  
  const onFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    // Validate file size (5MB limit)
    if(selectedFile.size > 5 * 1024 * 1024) {
      showToast('File too large. Please select an image under 5MB.', 'error');
      return;
    }
    
    // Validate file type
    if(!selectedFile.type.startsWith('image/')) {
      showToast('Please select an image file (JPG, PNG, GIF, etc.)', 'error');
      return;
    }
    
    setFile(selectedFile);
    
    // Read file and show crop modal
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result);
      setShowCropModal(true);
    });
    reader.readAsDataURL(selectedFile);
  };
  
  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);
  
  const handleCropDrag = (e) => {
    if (e.type === 'mousemove' && e.buttons !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - 100, rect.width - 200));
    const y = Math.max(0, Math.min(e.clientY - rect.top - 100, rect.height - 200));
    setCrop({ x, y });
  };
  
  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });
  
  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const cropSize = 200;
    canvas.width = cropSize;
    canvas.height = cropSize;
    
    // Calculate actual image dimensions in the container
    const container = document.getElementById('crop-container');
    if (!container) return null;
    
    const containerRect = container.getBoundingClientRect();
    const img = container.querySelector('img');
    const imgRect = img.getBoundingClientRect();
    
    // Calculate scale factor
    const scaleX = image.width / imgRect.width;
    const scaleY = image.height / imgRect.height;
    
    // Get crop position relative to image
    const cropX = (crop.x - (imgRect.left - containerRect.left)) * scaleX;
    const cropY = (crop.y - (imgRect.top - containerRect.top)) * scaleY;
    const cropWidth = cropSize * scaleX;
    const cropHeight = cropSize * scaleY;
    
    ctx.drawImage(
      image,
      Math.max(0, cropX),
      Math.max(0, cropY),
      cropWidth,
      cropHeight,
      0,
      0,
      cropSize,
      cropSize
    );
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };
  
  const handleCropConfirm = async () => {
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) {
        showToast('Failed to crop image', 'error');
        return;
      }
      const croppedFile = new File([croppedBlob], file.name, { type: 'image/jpeg' });
      setFile(croppedFile);
      setShowCropModal(false);
      showToast('Image cropped. Click upload to save.', 'success');
    } catch (e) {
      console.error('Crop error:', e);
      showToast('Failed to crop image', 'error');
    }
  };
  
  const upload = async ()=>{
    if(!token){ showToast('Login to edit profile','error'); return }
    if(!file){ showToast('Select a file','error'); return }
    
    showToast('Uploading avatar...', 'info');
    const fd = new FormData(); 
    fd.append('avatar', file);
    
    try{
      const r = await fetch(`${API_URL}/api/profile/avatar`,{
        method:'POST',
        headers:{'Authorization':`Bearer ${token}`},
        body:fd
      });
      const d = await r.json(); 
      
      if(r.ok){ 
        showToast('Avatar uploaded successfully!','success'); 
        setAvatar(d.avatar); 
        // Update user context with new avatar
        login({ 
          username: user?.username || username, 
          token, 
          hearts: user?.hearts || 5, 
          userId: user?.userId,
          avatar: d.avatar 
        }); 
      } else {
        showToast(d.error || 'Upload failed. Please try again.','error')
      }
    }catch(e){ 
      console.error('Upload error:', e);
      showToast('Network error. Please check your connection and try again.','error') 
    }
  };
  return (
    <div className="app">
      <TopBar />
      <div style={{background:'var(--card)',padding:18,borderRadius:'var(--radius)',border:'1px solid rgba(255,255,255,0.04)'}}>
        <h2 style={{marginTop:0}}>Edit Profile</h2>
        <div className="form">
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder='Display username'/>
          <div style={{marginTop:8}}>
            {avatar && <img src={avatar} alt="avatar" style={{width:80,height:80,borderRadius:12,objectFit:'cover'}} />}
          </div>
          <input type="file" accept="image/*" onChange={onFileChange} />
          <button className="btn" onClick={upload} disabled={!file}>Upload Avatar</button>
        </div>
      </div>
      
      {/* Crop Modal */}
      {showCropModal && (
        <div className="modal-overlay" onClick={() => setShowCropModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()} style={{maxWidth:600}}>
            <h3>Crop Your Profile Picture</h3>
            <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:16}}>Drag the box to select the area you want</p>
            <div 
              id="crop-container"
              style={{position:'relative',width:'100%',height:400,background:'#000',borderRadius:12,overflow:'hidden',cursor:'crosshair'}}
              onMouseMove={handleCropDrag}
              onMouseDown={handleCropDrag}
            >
              <div style={{position:'relative',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <img 
                  src={imageSrc} 
                  alt="Crop preview"
                  style={{
                    transform:`scale(${zoom})`,
                    maxWidth:'100%',
                    maxHeight:'100%',
                    objectFit:'contain',
                    pointerEvents:'none'
                  }}
                />
                <div 
                  style={{
                    position:'absolute',
                    top:crop.y,
                    left:crop.x,
                    width:200,
                    height:200,
                    border:'3px solid var(--accent)',
                    borderRadius:12,
                    pointerEvents:'none',
                    boxShadow:'0 0 0 9999px rgba(0,0,0,0.6)',
                    cursor:'move'
                  }}
                >
                  <div style={{
                    position:'absolute',
                    top:0,
                    left:0,
                    right:0,
                    bottom:0,
                    border:'1px dashed rgba(255,255,255,0.5)'
                  }}/>
                </div>
              </div>
            </div>
            
            <div style={{marginTop:16}}>
              <label style={{display:'block',marginBottom:8,fontSize:14,fontWeight:600}}>
                Zoom: {zoom.toFixed(1)}x
              </label>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.1" 
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{width:'100%',accentColor:'var(--accent)'}}
              />
            </div>
            
            <div className="modal-actions" style={{marginTop:20,display:'flex',gap:12}}>
              <button className="btn secondary" onClick={() => setShowCropModal(false)} style={{flex:1}}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleCropConfirm} style={{flex:1}}>
                ✓ Crop & Continue
              </button>
            </div>
          </div>
        </div>
      )}
      
      <BottomNav />
    </div>
  );
}
