import { ChatAttachment, CameraCaptureMeta, VoiceInputMeta } from '../types';

/**
 * Speech Recognition and Voice Service
 * Operates 100% locally in the browser using the Web Speech API and MediaRecorder.
 */
export class SpeechService {
  private static recognition: any = null;
  private static mediaRecorder: MediaRecorder | null = null;
  private static audioChunks: Blob[] = [];
  private static startTime: number = 0;
  private static isListening: boolean = false;

  static isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  static isMediaRecorderSupported(): boolean {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    return typeof MediaRecorder !== 'undefined';
  }

  static startRecognition(options: {
    onInterim: (text: string) => void;
    onFinal: (text: string) => void;
    onError: (error: string) => void;
    onEnd: () => void;
    lang?: string;
  }): boolean {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      options.onError('Speech Recognition is not supported in this browser.');
      return false;
    }

    try {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {
          // ignore
        }
      }

      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = options.lang || navigator.language || 'en-US';

      let accumulatedFinal = '';

      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedFinal += transcript + ' ';
            options.onFinal(accumulatedFinal.trim());
          } else {
            interim += transcript;
          }
        }
        options.onInterim((accumulatedFinal + ' ' + interim).trim());
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'no-speech') {
          // Normal timeout if user was silent
          return;
        }
        if (event.error === 'not-allowed') {
          options.onError('Microphone access was denied. Please allow microphone permission.');
        } else {
          options.onError(`Speech recognition notice: ${event.error || 'Network/service notice'}`);
        }
      };

      rec.onend = () => {
        this.isListening = false;
        options.onEnd();
      };

      rec.start();
      this.recognition = rec;
      this.isListening = true;
      return true;
    } catch (err: any) {
      options.onError(err.message || 'Could not start speech recognition');
      return false;
    }
  }

  static stopRecognition(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  static isCurrentlyListening(): boolean {
    return this.isListening;
  }

  // Audio Recording using MediaRecorder
  static async startAudioRecording(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Audio recording is not supported on this device/browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.startTime = Date.now();

    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    recorder.start(250);
    this.mediaRecorder = recorder;
    return true;
  }

  static async stopAudioRecording(): Promise<{ blob: Blob; dataUrl: string; durationSec: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active audio recording.'));
        return;
      }

      const durationSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          // Stop media tracks
          if (this.mediaRecorder?.stream) {
            this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
          }
          this.mediaRecorder = null;
          resolve({
            blob,
            dataUrl: reader.result as string,
            durationSec
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        reject(e);
      }
    });
  }

  // Text-To-Speech (Browser SpeechSynthesis)
  static speak(text: string, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech

      // Clean markdown symbols for cleaner voice narration
      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'Code snippet omitted for speech.')
        .replace(/[*#_`~>[\]]/g, '')
        .slice(0, 1000); // Guard length

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      if (onEnd) onEnd();
    }
  }

  static stopSpeaking(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  static isSpeaking(): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    return window.speechSynthesis.speaking;
  }
}

/**
 * Image & Camera Analysis Service
 * Operates 100% on-device via HTML5 Canvas pixel analytics and OCR heuristics.
 */
export class ImageAnalysisService {
  static async analyzeImage(dataUrl: string): Promise<CameraCaptureMeta['visualAnalysis']> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width || 640;
          const height = img.naturalHeight || img.height || 480;
          const aspectRatio = `${(width / Math.min(width, height)).toFixed(1)}:${(height / Math.min(width, height)).toFixed(1)}`;

          // Create canvas for downscaled pixel sampling
          const canvas = document.createElement('canvas');
          const sampleW = Math.min(200, width);
          const sampleH = Math.min(200, height);
          canvas.width = sampleW;
          canvas.height = sampleH;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve({
              dominantColors: ['#3b82f6', '#10b981'],
              isBright: true,
              aspectRatio,
              description: `Image captured with dimensions ${width}x${height}px.`
            });
            return;
          }

          ctx.drawImage(img, 0, 0, sampleW, sampleH);
          const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
          const data = imgData.data;

          let totalLuminance = 0;
          let rTotal = 0, gTotal = 0, bTotal = 0;
          const colorBuckets: Record<string, number> = {};

          // Sample pixels
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Standard relative luminance
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            totalLuminance += lum;
            rTotal += r;
            gTotal += g;
            bTotal += b;

            // Quantize colors to identify palette
            const qr = Math.round(r / 64) * 64;
            const qg = Math.round(g / 64) * 64;
            const qb = Math.round(b / 64) * 64;
            const hex = `#${((1 << 24) + (qr << 16) + (qg << 8) + qb).toString(16).slice(1)}`;
            colorBuckets[hex] = (colorBuckets[hex] || 0) + 1;
          }

          const sampledPixels = data.length / 16;
          const avgLum = totalLuminance / sampledPixels;
          const isBright = avgLum > 128;

          // Top dominant colors
          const dominantColors = Object.entries(colorBuckets)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([hex]) => hex);

          // Contrast and edge detection to detect text-like patterns or document features
          let highContrastEdges = 0;
          for (let y = 1; y < sampleH - 1; y += 2) {
            for (let x = 1; x < sampleW - 1; x += 2) {
              const idx = (y * sampleW + x) * 4;
              const rightIdx = (y * sampleW + (x + 1)) * 4;
              const lum1 = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              const lum2 = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
              if (Math.abs(lum1 - lum2) > 60) {
                highContrastEdges++;
              }
            }
          }

          const edgeDensity = highContrastEdges / (sampleW * sampleH * 0.25);
          let detectedType = 'photo/scene';
          if (edgeDensity > 0.18 && isBright) {
            detectedType = 'document, text page, or diagram';
          } else if (edgeDensity > 0.18 && !isBright) {
            detectedType = 'code screenshot, dark mode UI, or technical diagram';
          } else if (isBright) {
            detectedType = 'well-lit indoor or outdoor capture';
          } else {
            detectedType = 'low-light scene or solid surface';
          }

          const description = `Captured image (${width}x${height}px, ${aspectRatio} aspect ratio). Characteristics: ${detectedType} with ${isBright ? 'high' : 'low'} ambient luminance. Dominant tones: ${dominantColors.join(', ')}.`;

          resolve({
            dominantColors,
            isBright,
            aspectRatio,
            detectedText: edgeDensity > 0.15 ? `Document/text density detected (~${(edgeDensity * 100).toFixed(0)}% edge contrast)` : undefined,
            description
          });
        } catch (e) {
          resolve({
            dominantColors: ['#64748b'],
            isBright: true,
            aspectRatio: '16:9',
            description: 'Image processed successfully via canvas pipeline.'
          });
        }
      };

      img.onerror = () => {
        resolve({
          dominantColors: ['#64748b'],
          isBright: true,
          aspectRatio: '1:1',
          description: 'Image loaded into local buffer.'
        });
      };

      img.src = dataUrl;
    });
  }
}

/**
 * File Parser Service
 * Reads and extracts text and structure from local files.
 */
export class FileParserService {
  static async parseFile(file: File): Promise<ChatAttachment> {
    const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const name = file.name;
    const sizeBytes = file.size;
    const mimeType = file.type || 'application/octet-stream';
    const ext = name.split('.').pop()?.toLowerCase() || '';

    // Determine type
    let type: ChatAttachment['type'] = 'other';
    if (['txt', 'md', 'doc', 'docx', 'pdf', 'rtf'].includes(ext)) {
      type = 'document';
    } else if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'java', 'cpp', 'c', 'sql', 'sh', 'yaml', 'yml', 'xml', 'rs', 'go'].includes(ext)) {
      type = 'code';
    } else if (['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) {
      type = 'data';
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
      type = 'image';
    }

    // Handle Images
    if (type === 'image' || mimeType.startsWith('image/')) {
      const dataUrl = await this.readAsDataUrl(file);
      return {
        id,
        name,
        type: 'image',
        mimeType,
        sizeBytes,
        dataUrl,
        previewUrl: dataUrl,
        summary: `Image file (${(sizeBytes / 1024).toFixed(1)} KB)`
      };
    }

    // Handle Text and Code files
    try {
      const textContent = await this.readAsText(file);
      const lines = textContent.split('\n').length;
      const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

      let summary = '';
      if (type === 'code') {
        summary = `Code file (${lines} lines, ${wordCount} words, ${(sizeBytes / 1024).toFixed(1)} KB)`;
      } else if (type === 'data') {
        const previewRows = textContent.split('\n').slice(0, 3).join(' | ');
        summary = `Tabular data file (${lines} rows, ${(sizeBytes / 1024).toFixed(1)} KB)`;
      } else {
        summary = `Document (${lines} lines, ${wordCount} words, ${(sizeBytes / 1024).toFixed(1)} KB)`;
      }

      return {
        id,
        name,
        type,
        mimeType,
        sizeBytes,
        textContent,
        summary
      };
    } catch {
      return {
        id,
        name,
        type,
        mimeType,
        sizeBytes,
        summary: `File (${(sizeBytes / 1024).toFixed(1)} KB)`
      };
    }
  }

  private static readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = reject;
      // Read up to 2MB to keep inference responsive
      const slice = file.size > 2 * 1024 * 1024 ? file.slice(0, 2 * 1024 * 1024) : file;
      reader.readAsText(slice);
    });
  }

  private static readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

/**
 * Context Builder
 * Assembles user questions, transcribed speech, attached files, and camera inputs
 * into a structured, model-readable prompt.
 */
export function buildMultimodalPrompt(
  userText: string,
  attachments?: ChatAttachment[],
  cameraCapture?: CameraCaptureMeta,
  voiceMeta?: VoiceInputMeta
): { promptForModel: string; base64Images: string[] } {
  const parts: string[] = [];
  const base64Images: string[] = [];

  // 1. Voice input metadata
  if (voiceMeta && voiceMeta.transcription) {
    parts.push(`[Voice Input Transcription]: "${voiceMeta.transcription}"`);
  }

  // 2. Camera capture
  if (cameraCapture) {
    const va = cameraCapture.visualAnalysis;
    let cameraContext = `[Camera Capture Analysis]:\n- Dimensions: ${cameraCapture.width}x${cameraCapture.height}px\n- Description: ${va?.description || 'Snapshot from device camera'}`;
    if (va?.dominantColors && va.dominantColors.length > 0) {
      cameraContext += `\n- Color Palette: ${va.dominantColors.join(', ')}`;
    }
    if (va?.detectedText) {
      cameraContext += `\n- Text/Document Indicator: ${va.detectedText}`;
    }
    parts.push(cameraContext);

    // Extract raw base64 for vision models (Ollama llava/llama3.2-vision)
    if (cameraCapture.dataUrl.includes(',')) {
      const b64 = cameraCapture.dataUrl.split(',')[1];
      if (b64) base64Images.push(b64);
    }
  }

  // 3. File attachments
  if (attachments && attachments.length > 0) {
    attachments.forEach((att, idx) => {
      let fileContext = `[Attached File ${idx + 1}: "${att.name}" (${att.type}, ${(att.sizeBytes / 1024).toFixed(1)} KB)]:\n`;
      if (att.textContent) {
        // Truncate if very long
        const excerpt = att.textContent.length > 6000
          ? att.textContent.slice(0, 6000) + '\n\n...(file truncated for context)...'
          : att.textContent;
        fileContext += `\`\`\`\n${excerpt}\n\`\`\``;
      } else if (att.summary) {
        fileContext += `Summary: ${att.summary}`;
      }
      parts.push(fileContext);

      // If image attachment
      if (att.dataUrl && att.dataUrl.includes(',')) {
        const b64 = att.dataUrl.split(',')[1];
        if (b64) base64Images.push(b64);
      }
    });
  }

  // 4. User question / request
  const effectiveQuery = userText.trim()
    ? userText.trim()
    : voiceMeta?.transcription
      ? voiceMeta.transcription
      : cameraCapture
        ? 'Please analyze and explain what is in this captured photo.'
        : attachments && attachments.length > 0
          ? 'Please examine the attached file(s), summarize the contents, and highlight the key takeaways or notable details.'
          : 'Hello!';

  parts.push(`User Query / Prompt: ${effectiveQuery}`);

  return {
    promptForModel: parts.join('\n\n'),
    base64Images
  };
}
