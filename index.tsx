import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

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
  sender: 'user' | 'ai';
  text: string;
}

const translations = {
  en: {
    title: 'Friendly MBBS AI',
    creator: 'A Chaithanya Renigunta Creation',
    placeholder: 'Ask me a health-related question...',
    attachTitle: 'Attach file (coming soon)',
    cameraTitle: 'Use camera (coming soon)',
    micTitle: 'Use microphone (coming soon)',
    initialMessage: `[Wellness Guide]\n\nHello! I am Friendly MBBS AI, your health and wellness advisor. How can I assist you today? Please remember, I am an AI and not a real doctor.\n\n*Full Disclaimer A: WELLNESS ADVISORY*\nThe content provided by *Friendly MBBS AI* is for general knowledge, informational, and educational purposes only. It is not medical advice. *Always seek the guidance of a licensed medical professional for personalized diagnosis and treatment.*`
  },
  te: {
    title: 'స్నేహపూర్వక MBBS AI',
    creator: 'చైతన్య రేణిగుంట సృష్టి',
    placeholder: 'ఆరోగ్య సంబంధిత ప్రశ్న అడగండి...',
    attachTitle: 'ఫైల్ జోడించండి (త్వరలో వస్తుంది)',
    cameraTitle: 'కెమెరా వాడండి (త్వరలో వస్తుంది)',
    micTitle: 'మైక్రోఫోన్ వాడండి (త్వరలో వస్తుంది)',
    initialMessage: `[ఆరోగ్య మార్గదర్శి]\n\nనమస్కారం! నేను స్నేహపూర్వక MBBS AI, మీ ఆరోగ్య మరియు శ్రేయస్సు సలహాదారుని. ఈ రోజు నేను మీకు ఎలా సహాయపడగలను? దయచేసి గుర్తుంచుకోండి, నేను ఒక AI ని, నిజమైన వైద్యుడిని కాదు.\n\n*పూర్తి నిరాకరణ A: ఆరోగ్య సలహా*\n*స్నేహపూర్వక MBBS AI* అందించిన కంటెంట్ సాధారణ జ్ఞానం, సమాచారం మరియు విద్యా ప్రయోజనాల కోసం మాత్రమే. ఇది వైద్య సలహా కాదు. *వ్యక్తిగత నిర్ధారణ మరియు చికిత్స కోసం ఎల్లప్పుడూ లైసెన్స్ పొందిన వైద్య నిపుణుడి మార్గదర్శకత్వం తీసుకోండి.*`
  }
};

const getSystemInstructions = (lang: 'en' | 'te') => {
    const langName = lang === 'en' ? 'English' : 'Telugu';
    return `${SYSTEM_INSTRUCTIONS}\n\nYou MUST respond in the language the user has selected. The current language is: ${langName}.`;
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null); // To hold the chat instance

  useEffect(() => {
    setMessages([{
      sender: 'ai',
      text: translations[language].initialMessage
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

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    
    initializeChat();

    try {
      const chat = chatRef.current;
      const responseStream = await chat.sendMessageStream({ message: currentInput });
      
      let aiResponseText = '';
      let firstChunk = true;
      
      for await (const chunk of responseStream) {
        aiResponseText += chunk.text;
        if (firstChunk) {
            setMessages(prev => [...prev, { sender: 'ai', text: aiResponseText }]);
            firstChunk = false;
        } else {
             setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { sender: 'ai', text: aiResponseText };
                return newMessages;
            });
        }
      }

    } catch (error) {
      console.error(error);
      const errorMessage = { sender: 'ai' as const, text: 'Sorry, I encountered an error. Please try again.' };
       setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if(lastMessage.sender === 'ai' && isLoading) {
                newMessages[newMessages.length - 1] = errorMessage;
            } else {
                newMessages.push(errorMessage);
            }
            return newMessages;
      });
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
  
  const currentLang = translations[language];

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
      <div className="chat-window" ref={chatWindowRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
             <pre>{msg.text}</pre>
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
      <div className="input-area">
        <button className="icon-button" disabled={isLoading} title={currentLang.attachTitle}>
            <span className="material-symbols-outlined">attach_file</span>
        </button>
        <button className="icon-button" disabled={isLoading} title={currentLang.cameraTitle}>
            <span className="material-symbols-outlined">photo_camera</span>
        </button>
        <button className="icon-button" disabled={isLoading} title={currentLang.micTitle}>
            <span className="material-symbols-outlined">mic</span>
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={currentLang.placeholder}
          rows={1}
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || input.trim() === ''}>
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
