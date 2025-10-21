import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from '@google/genai';

// The user has provided the system instructions. We'll use this when we integrate with the Gemini API.
const SYSTEM_INSTRUCTIONS = `
You are 'Friendly MBBS AI', an *Ethical, Green, and Highly-Constrained Multi-Modal Health & Wellness Advisor*. You combine the persona of a 'Friendly Mini MBBS Doctor' for general advice with 'Deep Pharmacist Knowledge' for medication facts, acting as a one-step informational solution.

*1. Core Persona & Safety Hierarchy (The Prime Directive):*
* *Persona:* An empathetic, objective, and responsible health educator and informational pharmacist.
* *Prime Directive:* *Your core purpose is patient education and safety. You MUST NOT diagnose, prescribe, or replace a licensed medical professional.* When in doubt, or if the query involves risk, you must immediately escalate the disclaimer and recommend a doctor.
* *Green AI Principle:* Provide concise, relevant information to minimize computational waste.

*2. Mandatory Disclaimers & Risk Assessment Protocol:*

You will apply one of three escalating disclaimers based on the user's input. Every response MUST start with the Initial Disclaimer and end with the Full Disclaimer corresponding to the Risk Level.

| Risk Level | Query Type (Trigger) | Initial Disclaimer (Start of Response) | Full Disclaimer (End of Response) |
| :--- | :--- | :--- | :--- |
| *LOW* | General wellness, basic nutrition, simple exercises. | "[Wellness Guide]" | *Full Disclaimer A* |
| *MEDIUM* | DIY/Home Remedies, basic OTC medication facts, mild, non-acute symptoms. | "[Advisory Notice] This information is NOT a diagnosis. Seek professional advice for ongoing issues." | *Full Disclaimer B* |
| *HIGH* | Acute symptoms, multi-drug queries, specific dosage/diagnosis requests, illegal queries. | "[🚨 IMMEDIATE DANGER ALERT] STOP. Consult a licensed doctor or pharmacist NOW." | *Full Disclaimer C (Refusal)* |

*3. Response Protocols (The Friendly MBBS & Pharmacist Role):*

* *A. Friendly MBBS Protocol (Symptoms/Issues - MEDIUM RISK):*
    * If the user reports *MILD, NON-ACUTE* symptoms (e.g., common cold, mild headache).
    * Provide *one or two basic, non-invasive DIY Home Remedies* (e.g., 'rest and hydration') *OR* suggest *one or two simple, low-risk exercises* (e.g., 'gentle stretching').
    * Suggest the general class of a common *Basic OTC Medication* (e.g., 'a non-drowsy antihistamine for mild allergy').
    * Conclude by stating: "If symptoms worsen, persist for more than 48 hours, or if you have underlying conditions, you must see a doctor."
* *B. Deep Pharmacist Protocol (Medication Knowledge - MEDIUM RISK):*
    * If the user asks about a legitimate medication, provide the medication's *Active Ingredient(s), its **Drug Class* (e.g., 'NSAID'), and its *General Simple Use*.
    * *Do NOT* confirm a user's dosage, advise on two-drug interactions, or recommend a brand name.

*4. Advanced Multi-Modal Input Processing:*

You must use information from multimodal inputs to provide context, but apply strict safety guardrails.

| Input Type | Agent Action | Guardrail |
| :--- | :--- | :--- |
| *Voice Input* | Analyze and transcribe the query. If tone/content suggests *IMMEDIATE ACUTE RISK* (e.g., "severe chest pain," "heavy bleeding"), trigger *HIGH RISK* protocol. |
| *Photo/Camera Input* | Interpret *CLEAR TEXT ONLY (OCR)* from pill labels, medication boxes, or legible health documents. | *CRITICAL:* *DO NOT* attempt to analyze photos of physical symptoms (e.g., a rash, a wound) or unlabeled pills. Trigger *HIGH RISK* protocol for such inputs. |
| *PDF/Docs Input* | Extract and summarize the *INDICATIONS/USES* or *SIMPLE COMPONENT LIST* from a patient leaflet. | *Refuse* to interpret complex medical charts, full medical history, or handwritten doctor notes. |

*5. HARD REFUSAL & ETHICAL/LEGAL GUARDRAILS (HIGH RISK):*

You must follow the *Refusal Protocol C* for all high-risk or illegal queries.

* *Prohibited Topics (Trigger Protocol C):* Any query related to *illegal medical practices, **unauthorized/illicit sale of substances* (e.g., *anesthesia, strong opioids, research chemicals*), self-harm, medical emergencies, or specific drug injection/dosage instructions.

---

### Full Disclaimer Definitions (To be appended to every response)

*Full Disclaimer A: WELLNESS ADVISORY*
The content provided by *Friendly MBBS AI* is for general knowledge, informational, and educational purposes only. It is not medical advice. *Always seek the guidance of a licensed medical professional for personalized diagnosis and treatment.*

*Full Disclaimer B: CRITICAL HEALTH WARNING*
*Friendly MBBS AI* is an informational tool and is *NOT a doctor or pharmacist. Information on symptoms, remedies, or medications is **educational and general* in nature. *Do NOT use it to self-diagnose or self-treat.* Your own doctor or pharmacist must confirm any medication or treatment plan. *If your symptoms worsen or you are experiencing an emergency, call your local emergency number (e.g., 911, 108) immediately.*

*Full Disclaimer C (Refusal):*
*I am a safety-first, ethical AI. I cannot provide any information regarding illegal, illicit, or unauthorized substances or medical procedures. For your safety, please contact local law enforcement or a licensed medical professional immediately. (Full Disclaimer B is still implicitly active.)*
`;

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  imageUrl?: string;
  fileName?: string;
}

const translations = {
  en: {
    title: 'Friendly MBBS AI',
    creator: 'A Chaithanya Renigunta Creation',
    placeholder: 'Ask me a health-related question...',
    placeholderRecording: 'Recording... Speak now.',
    placeholderTranscribing: 'Transcribing audio...',
    attachTitle: 'Attach PDF file',
    attachTitleRemove: 'Remove attached file',
    cameraTitle: 'Use camera',
    cameraTitleRemove: 'Remove attached image',
    micTitleStart: 'Start recording',
    micTitleStop: 'Stop recording',
    micTitleTranscribing: 'Transcribing... please wait',
    playAudioTitle: 'Play audio',
    stopAudioTitle: 'Stop audio',
    generatingAudioTitle: 'Generating audio...',
    initialMessage: `[Wellness Guide]\n\nHello! I am Friendly MBBS AI, your health and wellness advisor. How can I assist you today? Please remember, I am an AI and not a real doctor.\n\n*Full Disclaimer A: WELLNESS ADVISORY*\nThe content provided by *Friendly MBBS AI* is for general knowledge, informational, and educational purposes only. It is not medical advice. *Always seek the guidance of a licensed medical professional for personalized diagnosis and treatment.*`,
    errorMicPermission: "Microphone access denied. Please enable it in your browser settings to use this feature.",
    errorMicAccess: "Could not access the microphone. Ensure it's connected and not in use by another app.",
    errorTranscription: "Transcription failed. Please check your internet and try again.",
    errorCameraPermission: "Camera access denied. Please enable it in your browser settings to use this feature.",
    errorCameraAccess: "Could not access the camera. Ensure it's connected and not in use by another app.",
    errorAudioGeneration: "Failed to generate audio. Please check your connection and try again.",
    errorApi: "An error occurred. Please check your connection or try again later.",
    errorInvalidFile: "Invalid file type. Please select a PDF file.",
  },
  te: {
    title: 'స్నేహపూర్వక MBBS AI',
    creator: 'చైతన్య రేణిగుంట సృష్టి',
    placeholder: 'ఆరోగ్య సంబంధిత ప్రశ్న అడగండి...',
    placeholderRecording: 'రికార్డింగ్... ఇప్పుడు మాట్లాడండి.',
    placeholderTranscribing: 'ఆడియోను ట్రాన్స్‌క్రయిబ్ చేస్తున్నాము...',
    attachTitle: 'PDF ఫైల్ జోడించండి',
    attachTitleRemove: 'జోడించిన ఫైల్‌ను తీసివేయండి',
    cameraTitle: 'కెమెరా వాడండి',
    cameraTitleRemove: 'జోడించిన చిత్రాన్ని తీసివేయండి',
    micTitleStart: 'రికార్డింగ్ ప్రారంభించండి',
    micTitleStop: 'రికార్డింగ్ ఆపండి',
    micTitleTranscribing: 'ట్రాన్స్‌క్రయిబ్ చేస్తున్నాము... దయచేసి వేచి ఉండండి',
    playAudioTitle: 'ఆడియో ప్లే చేయండి',
    stopAudioTitle: 'ఆడియో ఆపండి',
    generatingAudioTitle: 'ఆడియో జనరేట్ అవుతోంది...',
    initialMessage: `[ఆరోగ్య మార్గదర్శి]\n\nనమస్కారం! నేను స్నేహపూర్వక MBBS AI, మీ ఆరోగ్య మరియు శ్రేయస్సు సలహాదారుని. ఈ రోజు నేను మీకు ఎలా సహాయపడగలను? దయచేసి గుర్తుంచుకోండి, నేను ఒక AI ని, నిజమైన వైద్యుడిని కాదు.\n\n*పూర్తి నిరాకరణ A: ఆరోగ్య సలహా*\n*స్నేహపూర్వక MBBS AI* అందించిన కంటెంట్ సాధారణ జ్ఞానం, సమాచారం మరియు విద్యా ప్రయోజనాల కోసం మాత్రమే. ఇది వైద్య సలహా కాదు. *వ్యక్తిగత నిర్ధారణ మరియు చికిత్స కోసం ఎల్లప్పుడూ లైసెన్స్ పొందిన వైద్య నిపుణుడి మార్గదర్శకత్వం తీసుకోండి.*`,
    errorMicPermission: "మైక్రోఫోన్ యాక్సెస్ నిరాకరించబడింది. దయచేసి ఈ ఫీచర్‌ను ఉపయోగించడానికి మీ బ్రౌజర్ సెట్టింగ్‌లలో దీన్ని ప్రారంభించండి.",
    errorMicAccess: "మైక్రోఫోన్‌ను యాక్సెస్ చేయడంలో విఫలమయ్యారు. అది కనెక్ట్ చేయబడిందని మరియు మరో యాప్ ఉపయోగించడం లేదని నిర్ధారించుకోండి.",
    errorTranscription: "ట్రాన్స్‌క్రిప్షన్ విఫలమైంది. దయచేసి మీ ఇంటర్నెట్‌ను తనిఖీ చేసి, మళ్లీ ప్రయత్నించండి.",
    errorCameraPermission: "కెమెరా యాక్సెస్ నిరాకరించబడింది. దయచేసి ఈ ఫీచర్‌ను ఉపయోగించడానికి మీ బ్రౌజర్ సెట్టింగ్‌లలో దీన్ని ప్రారంభించండి.",
    errorCameraAccess: "కెమెరాను యాక్సెస్ చేయడంలో విఫలమయ్యారు. అది కనెక్ట్ చేయబడిందని మరియు మరో యాప్ ఉపయోగించడం లేదని నిర్ధారించుకోండి.",
    errorAudioGeneration: "ఆడియోను జనరేట్ చేయడంలో విఫలమయ్యారు. దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేసి, మళ్లీ ప్రయత్నించండి.",
    errorApi: "ఒక లోపం సంభవించింది. దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేయండి లేదా తర్వాత మళ్లీ ప్రయత్నించండి.",
    errorInvalidFile: "చెల్లని ఫైల్ రకం. దయచేసి ఒక PDF ఫైల్‌ను ఎంచుకోండి.",
  }
};

const getSystemInstructions = (lang: 'en' | 'te') => {
    const langName = lang === 'en' ? 'English' : 'Telugu';
    return `${SYSTEM_INSTRUCTIONS}\n\nYou MUST respond in the language the user has selected. The current language is: ${langName}.`;
}

// Audio decoding helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isGeneratingAudioId, setIsGeneratingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ id: string; currentTime: number; duration: number } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageForAnalysis, setImageForAnalysis] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chatWindowRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null); // To hold the chat instance
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const progressAnimationRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLang = translations[language];

  useEffect(() => {
    setMessages([{
      id: `ai-initial-${Date.now()}`,
      sender: 'ai',
      text: currentLang.initialMessage
    }]);
    chatRef.current = null; // Reset chat on language change
  }, [language]);


  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);
  
  const initializeChat = () => {
    if (!chatRef.current) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      chatRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: getSystemInstructions(language),
        },
      });
    }
  };
  
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSend = async () => {
    if ((input.trim() === '' && !imageForAnalysis && !attachedFile) || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMessage: Message = { 
        id: userMessageId, 
        sender: 'user', 
        text: input,
        imageUrl: imageForAnalysis || undefined,
        fileName: attachedFile ? attachedFile.name : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = input;
    const currentImage = imageForAnalysis;
    const currentFile = attachedFile;

    setInput('');
    setImageForAnalysis(null);
    setAttachedFile(null);
    setIsLoading(true);
    setError(null);
    
    initializeChat();

    try {
      const chat = chatRef.current;

      const parts: any[] = [];
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
      }
      if (currentFile) {
        const base64Data = await blobToBase64(currentFile);
        parts.push({ inlineData: { mimeType: currentFile.type, data: base64Data } });
      }
      if (currentInput.trim() !== '') {
          parts.push({ text: currentInput });
      } else {
         // Add a placeholder text if only an image/file is sent
         parts.push({ text: "Please analyze the attached content."});
      }

      const responseStream = await chat.sendMessageStream({ message: { parts } });
      
      let aiResponseText = '';
      let firstChunk = true;
      const aiMessageId = `ai-${Date.now()}`;
      
      for await (const chunk of responseStream) {
        aiResponseText += chunk.text;
        if (firstChunk) {
            setMessages(prev => [...prev, { id: aiMessageId, sender: 'ai', text: aiResponseText }]);
            firstChunk = false;
        } else {
             setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.id === aiMessageId) {
                  newMessages[newMessages.length - 1] = { ...lastMessage, text: aiResponseText };
                }
                return newMessages;
            });
        }
      }

    } catch (error) {
      console.error(error);
      setError(currentLang.errorApi);
      setMessages(prev => prev.filter(msg => msg.id !== userMessageId));
      setInput(currentInput);
      setImageForAnalysis(currentImage);
      setAttachedFile(currentFile);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = async () => {
    setError(null);
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);
        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(audioStreamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          setIsRecording(false);
          setIsTranscribing(true);

          audioStreamRef.current?.getTracks().forEach(track => track.stop());

          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const base64Audio = await blobToBase64(audioBlob);

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                parts: [
                  { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
                  { text: 'Transcribe this audio.' },
                ],
              },
            });
            setInput(response.text);
          } catch(error) {
            console.error("Transcription error:", error);
            setError(currentLang.errorTranscription);
          } finally {
            setIsTranscribing(false);
            audioChunksRef.current = [];
          }
        };

        mediaRecorder.start();
      } catch (err) {
        console.error("Error accessing microphone:", err);
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError(currentLang.errorMicPermission);
        } else {
          setError(currentLang.errorMicAccess);
        }
      }
    }
  };
  
  const handleStopAudio = () => {
    if (progressAnimationRef.current) {
      cancelAnimationFrame(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    setCurrentlyPlayingId(null);
    setAudioProgress(null);
  };
  
  const handlePlayAudio = async (text: string, messageId: string) => {
    setError(null);
    if (currentlyPlayingId === messageId) {
      handleStopAudio();
      return;
    }
    handleStopAudio();
  
    setIsGeneratingAudioId(messageId);
    setCurrentlyPlayingId(null);
    setAudioProgress(null);
  
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioContext = audioContextRef.current;
  
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const textToSpeak = text.split('*Full Disclaimer')[0];
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
  
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data received.");
  
      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
  
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      audioSourceRef.current = source;
  
      const audioDuration = audioBuffer.duration;
      const playbackStartTime = audioContext.currentTime;

      const updateProgress = () => {
        if (!audioSourceRef.current || !audioContextRef.current) return;
        
        const elapsedTime = audioContextRef.current.currentTime - playbackStartTime;
        
        if (elapsedTime >= audioDuration) {
            setAudioProgress({ id: messageId, currentTime: audioDuration, duration: audioDuration });
            // onended will handle the final cleanup
            return;
        }
        
        setAudioProgress({ id: messageId, currentTime: elapsedTime, duration: audioDuration });
        progressAnimationRef.current = requestAnimationFrame(updateProgress);
      };


      source.onended = () => {
        if (currentlyPlayingId === messageId) {
          handleStopAudio();
        }
      };
      
      source.start();
      setCurrentlyPlayingId(messageId);
      progressAnimationRef.current = requestAnimationFrame(updateProgress);

    } catch (error) {
      console.error("Error generating or playing audio:", error);
      setError(currentLang.errorAudioGeneration);
      handleStopAudio();
    } finally {
      setIsGeneratingAudioId(null);
    }
  };

  const handleCameraClick = async () => {
    setError(null);
    if (imageForAnalysis) {
        setImageForAnalysis(null);
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        setIsCameraOpen(true);
    } catch (err) {
        console.error("Error accessing camera:", err);
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError(currentLang.errorCameraPermission);
        } else {
          setError(currentLang.errorCameraAccess);
        }
    }
  };

  const handleCloseCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
      setIsCameraOpen(false);
      setCapturedImage(null);
  };

  const handleCapturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext('2d');
          if (context) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              setCapturedImage(dataUrl);
              if (video.srcObject) {
                  const stream = video.srcObject as MediaStream;
                  stream.getTracks().forEach(track => track.stop());
              }
          }
      }
  };

  const handleRetakePhoto = async () => {
      setCapturedImage(null);
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
      } catch (err) {
          console.error("Error restarting camera:", err);
          setError(currentLang.errorCameraAccess);
      }
  };

  const handleUsePhoto = () => {
      if (capturedImage) {
          setImageForAnalysis(capturedImage);
      }
      handleCloseCamera();
  };
  
  const handleAttachClick = () => {
      setError(null);
      if (attachedFile) {
          setAttachedFile(null);
      } else {
          fileInputRef.current?.click();
      }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
        setAttachedFile(file);
    } else if (file) {
        setError(currentLang.errorInvalidFile);
    }
    // Reset file input value to allow selecting the same file again
    if (event.target) {
        event.target.value = '';
    }
  };

  let micTitle = currentLang.micTitleStart;
  if (isRecording) micTitle = currentLang.micTitleStop;
  if (isTranscribing) micTitle = currentLang.micTitleTranscribing;
  
  let placeholder = currentLang.placeholder;
  if (isRecording) placeholder = currentLang.placeholderRecording;
  if (isTranscribing) placeholder = currentLang.placeholderTranscribing;

  const cameraTitle = imageForAnalysis ? currentLang.cameraTitleRemove : currentLang.cameraTitle;
  const attachTitle = attachedFile ? currentLang.attachTitleRemove : currentLang.attachTitle;

  return (
    <div className="app-container">
      <header>
        <div className="header-content">
          <h1>{currentLang.title}</h1>
          <p className="creator">{currentLang.creator}</p>
        </div>
        <button onClick={() => setLanguage(language === 'en' ? 'te' : 'en')} className="lang-toggle">
          {language === 'en' ? 'తెలుగు' : 'English'}
        </button>
      </header>
      {error && (
        <div className="error-toast">
            <p>{error}</p>
            <button onClick={() => setError(null)} title="Close" aria-label="Close">
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>
      )}
      <div className="chat-window" ref={chatWindowRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
             {msg.fileName && (
                <div className="message-attachment">
                    <span className="material-symbols-outlined">description</span>
                    <span>{msg.fileName}</span>
                </div>
             )}
             {msg.imageUrl && <img src={msg.imageUrl} alt="User attachment" className="message-image" />}
             <pre>{msg.text}</pre>
             {msg.sender === 'ai' && audioProgress && audioProgress.id === msg.id && (
                <div className="audio-progress-container">
                    <div className="progress-time">
                        {formatTime(audioProgress.currentTime)} / {formatTime(audioProgress.duration)}
                    </div>
                    <div className="progress-bar">
                        <div 
                            className="progress-bar-inner" 
                            style={{ width: `${(audioProgress.currentTime / audioProgress.duration) * 100}%` }}
                        ></div>
                    </div>
                </div>
             )}
             {msg.sender === 'ai' && !msg.text.includes('Sorry, I encountered an error') && (
                <button
                    className="icon-button speaker-button"
                    onClick={() => handlePlayAudio(msg.text, msg.id)}
                    disabled={isGeneratingAudioId !== null && isGeneratingAudioId !== msg.id}
                    title={
                        isGeneratingAudioId === msg.id ? currentLang.generatingAudioTitle :
                        currentlyPlayingId === msg.id ? currentLang.stopAudioTitle :
                        currentLang.playAudioTitle
                    }
                    aria-label={
                        isGeneratingAudioId === msg.id ? currentLang.generatingAudioTitle :
                        currentlyPlayingId === msg.id ? currentLang.stopAudioTitle :
                        currentLang.playAudioTitle
                    }
                >
                    {isGeneratingAudioId === msg.id ? (
                        <div className="spinner"></div>
                    ) : (
                        <span className="material-symbols-outlined">
                            {currentlyPlayingId === msg.id ? 'stop_circle' : 'volume_up'}
                        </span>
                    )}
                </button>
             )}
          </div>
        ))}
        {isLoading && messages[messages.length-1].sender === 'user' && (
             <div className="message ai">
                <div className="loading">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                </div>
            </div>
        )}
      </div>
      <div className="input-container">
        {attachedFile && (
            <div className="attachment-preview">
                <span className="material-symbols-outlined">description</span>
                <span>{attachedFile.name}</span>
                <button onClick={() => { setAttachedFile(null); setError(null); }} title="Remove file" aria-label="Remove file">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        )}
        <div className="input-area">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />
            <button 
                onClick={handleAttachClick}
                className={`icon-button ${attachedFile ? 'active' : ''}`}
                disabled={isLoading || isRecording || isTranscribing}
                title={attachTitle}
            >
                <span className="material-symbols-outlined">attach_file</span>
            </button>
            <button 
              onClick={handleCameraClick}
              className={`icon-button ${imageForAnalysis ? 'active' : ''}`}
              disabled={isLoading || isRecording || isTranscribing}
              title={cameraTitle}
            >
                <span className="material-symbols-outlined">photo_camera</span>
            </button>
            <button 
              onClick={handleMicClick}
              className={`icon-button ${isRecording ? 'recording' : ''}`} 
              disabled={isLoading || isTranscribing} 
              title={micTitle}
            >
              <span className="material-symbols-outlined">{isRecording ? 'stop' : 'mic'}</span>
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading || isRecording || isTranscribing}
            />
            <button onClick={handleSend} disabled={isLoading || isTranscribing || (input.trim() === '' && !imageForAnalysis && !attachedFile)}>
              <span className="material-symbols-outlined">send</span>
            </button>
        </div>
      </div>
      {isCameraOpen && (
        <div className="camera-modal">
            <div className="camera-modal-content">
                {capturedImage ? (
                    <img src={capturedImage} alt="Preview" className="camera-preview" />
                ) : (
                    <video ref={videoRef} autoPlay playsInline className="camera-video"></video>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                <div className="camera-controls">
                    {capturedImage ? (
                        <>
                            <button onClick={handleUsePhoto}>Use Photo</button>
                            <button onClick={handleRetakePhoto} className="secondary">Retake</button>
                        </>
                    ) : (
                        <button onClick={handleCapturePhoto}>Capture</button>
                    )}
                    <button onClick={handleCloseCamera} className="secondary">Close</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);