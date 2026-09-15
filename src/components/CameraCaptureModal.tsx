import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { CameraCaptureMeta } from '../types';
import { ImageAnalysisService } from '../services/multimodalService';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (meta: CameraCaptureMeta) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraDimensions, setCameraDimensions] = useState<{ width: number; height: number }>({ width: 640, height: 480 });
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Start Camera Stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setIsStarting(true);
    setCameraError(null);
    setCapturedDataUrl(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser or platform.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => console.warn('Video play error:', e));
            setCameraDimensions({
              width: videoRef.current.videoWidth || 640,
              height: videoRef.current.videoHeight || 480
            });
          }
        };
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was blocked or denied. Please grant camera access or choose an image file below.');
      } else {
        setCameraError(err.message || 'Could not access device camera.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
      setCapturedDataUrl(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleFlipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If front camera, mirror image
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);
    setCameraDimensions({ width: canvas.width, height: canvas.height });
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
    if (!streamRef.current) {
      startCamera(facingMode);
    }
  };

  const handleConfirmCapture = async () => {
    if (!capturedDataUrl) return;
    setIsAnalyzing(true);

    try {
      const visualAnalysis = await ImageAnalysisService.analyzeImage(capturedDataUrl);
      const meta: CameraCaptureMeta = {
        dataUrl: capturedDataUrl,
        width: cameraDimensions.width,
        height: cameraDimensions.height,
        timestamp: Date.now(),
        visualAnalysis
      };
      onCapture(meta);
      onClose();
    } catch (err) {
      console.warn('Error during image analysis:', err);
      onCapture({
        dataUrl: capturedDataUrl,
        width: cameraDimensions.width,
        height: cameraDimensions.height,
        timestamp: Date.now()
      });
      onClose();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setCapturedDataUrl(dataUrl);
      const img = new Image();
      img.onload = () => {
        setCameraDimensions({ width: img.width, height: img.height });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/90 text-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-none">Device Camera</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">100% local processing • Zero cloud upload</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder / Captured Preview Area */}
        <div className="relative flex-1 bg-black min-h-[300px] max-h-[460px] flex items-center justify-center overflow-hidden">
          {capturedDataUrl ? (
            <img
              src={capturedDataUrl}
              alt="Captured frame"
              className="w-full h-full object-contain max-h-[460px]"
            />
          ) : cameraError ? (
            <div className="p-6 text-center max-w-sm">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm text-zinc-200 font-medium mb-1">Camera Unavailable</p>
              <p className="text-xs text-zinc-400 mb-4">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Upload from Device Photo Library</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {isStarting && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Connecting to camera sensor...</span>
                </div>
              )}
            </>
          )}

          {/* Facing Mode Flip Overlay (only in live mode) */}
          {!capturedDataUrl && !cameraError && (
            <button
              onClick={handleFlipCamera}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors border border-white/20"
              title="Flip camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileFallback}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
            title="Upload photo from disk"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Choose Image</span>
          </button>

          {capturedDataUrl ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="px-3 py-2 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors font-medium"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handleConfirmCapture}
                disabled={isAnalyzing}
                className="px-4 py-2 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Image...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Use This Photo</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1">
              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={isStarting || !!cameraError}
                className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/40 active:scale-95 transition-all disabled:opacity-30"
                title="Capture photo"
              >
                <div className="w-10 h-10 rounded-full bg-white"></div>
              </button>
            </div>
          )}

          <div className="w-20 text-right">
            <span className="text-[10px] font-mono text-zinc-500">
              {cameraDimensions.width}x{cameraDimensions.height}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
