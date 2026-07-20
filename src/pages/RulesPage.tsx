import { BookOpen, Mic, Loader2, MessageCircle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useAlert } from '../hooks/useAlert';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function RulesPage() {
  const { t } = useLanguage();
  const { showAlert, AlertComponent } = useAlert();
  const [question, setQuestion] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Try to use the best available audio format
      let mimeType = 'audio/webm;codecs=opus';
      const supportedMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];

      for (const type of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        setAudioChunks(chunks);

        stream.getTracks().forEach(track => track.stop());

        await handleAudioSubmit(audioBlob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      showAlert(t('rules.chat.errors.micPermission'), { type: 'error' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleAudioSubmit = async (audioBlob: Blob) => {
    setIsTranscribing(true);

    try {
      // Step 1: Transcribe audio to text
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', 'auto'); // Auto-detect French or English

      const transcribeApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`;

      const transcribeResponse = await fetch(transcribeApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const transcribeData = await transcribeResponse.json();
      const transcribedText = transcribeData.text;

      if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error(t('rules.chat.errors.noSpeechDetected'));
      }

      setIsTranscribing(false);
      setIsSubmitting(true);

      // Add user message with transcribed text
      const userMessage: Message = {
        role: 'user',
        content: transcribedText
      };
      setMessages(prev => [...prev, userMessage]);

      // Step 2: Send transcribed text to Mistral chat
      const chatApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tennis-rules-chat`;

      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const chatResponse = await fetch(chatApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: transcribedText,
          conversationHistory
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to get response from AI');
      }

      const chatData = await chatResponse.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: chatData.reply || t('rules.chat.errors.noReplyFallback')
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error submitting audio:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error
          ? `${t('rules.chat.errors.errorPrefix')}${error.message}`
          : t('rules.chat.errors.audioProcessingFailed')
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTranscribing(false);
      setIsSubmitting(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: question
    };

    setMessages(prev => [...prev, userMessage]);
    setIsSubmitting(true);
    const currentQuestion = question;
    setQuestion('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tennis-rules-chat`;

      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentQuestion,
          conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || t('rules.chat.errors.noReplyFallback')
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error submitting question:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: t('rules.chat.errors.genericRetry')
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AlertComponent />
      <div className="min-h-screen bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] relative overflow-x-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1A6FC4]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#C8F135]/5 rounded-full blur-3xl" />
        </div>

        {/* Page Header */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-8 lg:pt-20">
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-5 h-5 text-[#C8F135]" />
            <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
              {t('rules.chat.hero.eyebrow')}
            </span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
            {t('rules.chat.hero.title1')}<br />
            <span className="text-[#C8F135]">{t('rules.chat.hero.title2')}</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
            {t('rules.chat.hero.subtitle')}
          </p>
        </div>

      <div className="max-w-4xl mx-auto px-4 pb-8 relative z-10">
        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 mb-6">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {t('rules.chat.title')}
              </h3>
            </div>
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('rules.chat.placeholder')}
                  className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-white hover:border-white/20 placeholder:text-gray-500"
                  disabled={isSubmitting || isRecording || isTranscribing}
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSubmitting || isTranscribing}
                  className={`px-4 py-3 rounded-full transition-all ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isRecording ? t('rules.chat.micStop') : t('rules.chat.micStart')}
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || isTranscribing || !question.trim() || isRecording}
                className="w-full px-6 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('rules.chat.transcribing')}
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('rules.chat.processing')}
                  </>
                ) : (
                  t('rules.chat.submit')
                )}
              </button>
            </form>

            {messages.length > 0 && (
              <div className="mt-6 space-y-3 max-h-96 overflow-y-auto">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl ${
                      message.role === 'user'
                        ? 'bg-[#C8F135]/10 border border-[#C8F135]/30 ml-8'
                        : 'bg-blue-500/10 border border-blue-400/30 mr-8'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === 'assistant' && (
                        <MessageCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white mb-1">
                          {message.role === 'user' ? t('rules.chat.roleUser') : t('rules.chat.roleAssistant')}
                        </p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {t('rules.reference.title')}
              </h3>
            </div>
            <div className="prose prose-sm max-w-none">
              <div className="mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h4 className="text-lg font-bold text-white">{t('rules.reference.officialTitle')}</h4>
                  <a
                    href="https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#C8F135]/10 border border-[#C8F135]/30 rounded-lg text-sm text-[#C8F135] hover:bg-[#C8F135]/20 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    PDF ITF 2026 (EN)
                  </a>
                </div>
                <p className="text-sm text-gray-400 mt-3 mb-4">
                  {t('rules.reference.intro')}
                </p>

                {/* Table of Contents */}
                <nav className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('rules.reference.tocTitle')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <a href="#section-court" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.court.title')}</a>
                    <a href="#section-comptage" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.comptage.title')}</a>
                    <a href="#section-toss" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.toss.title')}</a>
                    <a href="#section-service" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.service.title')}</a>
                    <a href="#section-echange" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.echange.title')}</a>
                    <a href="#section-perte" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.perte.title')}</a>
                    <a href="#section-tiebreak" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.tiebreak.title')}</a>
                    <a href="#section-erreurs" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.erreurs.title')}</a>
                    <a href="#section-formats" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.formats.title')}</a>
                    <a href="#section-classement" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.classement.title')}</a>
                    <a href="#section-utr" className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5">{t('rules.reference.utr.title')}</a>
                  </div>
                </nav>
              </div>

              <div className="space-y-6">
                <div id="section-court">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.court.title')}</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {t('rules.reference.court.items').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>

                  {/* Court and Net Drawings */}
                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tennis Court Top View */}
                    <div className="lg:col-span-2 bg-[#0a1628] border border-white/10 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-3 text-center font-semibold uppercase tracking-wider">{t('rules.reference.svg.courtTopViewCaption')}</p>
                      <svg viewBox="0 0 500 260" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
                        {/* Court background */}
                        <rect x="30" y="20" width="440" height="220" fill="#1A6FC4" rx="2" />

                        {/* Doubles sidelines */}
                        <rect x="30" y="20" width="440" height="220" fill="none" stroke="white" strokeWidth="2" />

                        {/* Singles sidelines */}
                        <line x1="30" y1="45" x2="470" y2="45" stroke="white" strokeWidth="1.5" />
                        <line x1="30" y1="215" x2="470" y2="215" stroke="white" strokeWidth="1.5" />

                        {/* Center service line */}
                        <line x1="250" y1="45" x2="250" y2="215" stroke="white" strokeWidth="1.5" />

                        {/* Net line */}
                        <line x1="250" y1="20" x2="250" y2="240" stroke="white" strokeWidth="3" strokeDasharray="4 2" />

                        {/* Service lines */}
                        <line x1="120" y1="45" x2="120" y2="215" stroke="white" strokeWidth="1.5" />
                        <line x1="380" y1="45" x2="380" y2="215" stroke="white" strokeWidth="1.5" />

                        {/* Service boxes horizontal center lines */}
                        <line x1="120" y1="130" x2="250" y2="130" stroke="white" strokeWidth="1.5" />
                        <line x1="250" y1="130" x2="380" y2="130" stroke="white" strokeWidth="1.5" />

                        {/* Center marks on baselines */}
                        <line x1="30" y1="126" x2="30" y2="134" stroke="white" strokeWidth="2" />
                        <line x1="470" y1="126" x2="470" y2="134" stroke="white" strokeWidth="2" />

                        {/* Dimension: Full length */}
                        <line x1="30" y1="252" x2="470" y2="252" stroke="#C8F135" strokeWidth="1" markerEnd="url(#arrowEnd)" markerStart="url(#arrowStart)" />
                        <text x="250" y="250" textAnchor="middle" fill="#C8F135" fontSize="10" fontWeight="bold">23.77m</text>

                        {/* Dimension: Singles width */}
                        <line x1="482" y1="45" x2="482" y2="215" stroke="#C8F135" strokeWidth="1" />
                        <line x1="478" y1="45" x2="486" y2="45" stroke="#C8F135" strokeWidth="1" />
                        <line x1="478" y1="215" x2="486" y2="215" stroke="#C8F135" strokeWidth="1" />
                        <text x="495" y="134" textAnchor="middle" fill="#C8F135" fontSize="9" fontWeight="bold" transform="rotate(90, 495, 134)">8.23m</text>

                        {/* Dimension: Doubles width */}
                        <line x1="15" y1="20" x2="15" y2="240" stroke="#C8F135" strokeWidth="1" />
                        <line x1="11" y1="20" x2="19" y2="20" stroke="#C8F135" strokeWidth="1" />
                        <line x1="11" y1="240" x2="19" y2="240" stroke="#C8F135" strokeWidth="1" />
                        <text x="8" y="134" textAnchor="middle" fill="#C8F135" fontSize="9" fontWeight="bold" transform="rotate(-90, 8, 134)">10.97m</text>

                        {/* Dimension: Service box depth */}
                        <line x1="120" y1="10" x2="250" y2="10" stroke="#C8F135" strokeWidth="1" />
                        <line x1="120" y1="6" x2="120" y2="14" stroke="#C8F135" strokeWidth="1" />
                        <line x1="250" y1="6" x2="250" y2="14" stroke="#C8F135" strokeWidth="1" />
                        <text x="185" y="9" textAnchor="middle" fill="#C8F135" fontSize="8" fontWeight="bold">6.40m</text>

                        {/* Net posts indicators */}
                        <circle cx="250" cy="20" r="3" fill="#C8F135" />
                        <circle cx="250" cy="240" r="3" fill="#C8F135" />

                        {/* Labels */}
                        <text x="185" y="90" textAnchor="middle" fill="white" fontSize="8" opacity="0.7">{t('rules.reference.svg.serviceBoxWord1')}</text>
                        <text x="185" y="100" textAnchor="middle" fill="white" fontSize="8" opacity="0.7">{t('rules.reference.svg.serviceBoxWord2')}</text>
                        <text x="315" y="160" textAnchor="middle" fill="white" fontSize="8" opacity="0.7">{t('rules.reference.svg.serviceBoxWord1')}</text>
                        <text x="315" y="170" textAnchor="middle" fill="white" fontSize="8" opacity="0.7">{t('rules.reference.svg.serviceBoxWord2')}</text>
                        <text x="75" y="130" textAnchor="middle" fill="white" fontSize="8" opacity="0.5">{t('rules.reference.svg.baseline')}</text>
                        <text x="425" y="130" textAnchor="middle" fill="white" fontSize="8" opacity="0.5">{t('rules.reference.svg.baseline')}</text>

                        {/* Doubles alley labels (couloirs) */}
                        <text x="250" y="34" textAnchor="middle" fill="white" fontSize="7" opacity="0.5">{t('rules.reference.svg.doublesAlley')}</text>
                        <text x="250" y="232" textAnchor="middle" fill="white" fontSize="7" opacity="0.5">{t('rules.reference.svg.doublesAlley')}</text>
                      </svg>
                    </div>

                    {/* Net Side View */}
                    <div className="bg-[#0a1628] border border-white/10 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-3 text-center font-semibold uppercase tracking-wider">{t('rules.reference.svg.netSideViewCaption')}</p>
                      <svg viewBox="0 0 200 180" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
                        {/* Ground line */}
                        <line x1="10" y1="150" x2="190" y2="150" stroke="#4B5563" strokeWidth="2" />
                        <rect x="10" y="150" width="180" height="8" fill="#1A6FC4" opacity="0.3" />

                        {/* Net posts (doubles) */}
                        <rect x="20" y="60" width="4" height="90" fill="#9CA3AF" />
                        <rect x="176" y="60" width="4" height="90" fill="#9CA3AF" />

                        {/* Post caps */}
                        <rect x="18" y="57" width="8" height="5" fill="#D1D5DB" rx="1" />
                        <rect x="174" y="57" width="8" height="5" fill="#D1D5DB" rx="1" />

                        {/* Singles sticks - 0.914m outside singles court on each side */}
                        <rect x="36" y="60" width="2.5" height="90" fill="#E5E7EB" />
                        <rect x="161.5" y="60" width="2.5" height="90" fill="#E5E7EB" />
                        {/* Singles stick caps (not more than 1 inch above net cord) */}
                        <rect x="35" y="58" width="5" height="3" fill="#F3F4F6" rx="0.5" />
                        <rect x="160.5" y="58" width="5" height="3" fill="#F3F4F6" rx="0.5" />

                        {/* Net mesh */}
                        <rect x="24" y="62" width="152" height="88" fill="none" stroke="white" strokeWidth="1" />
                        {/* Horizontal net lines */}
                        <line x1="24" y1="73" x2="176" y2="73" stroke="white" strokeWidth="0.5" opacity="0.5" />
                        <line x1="24" y1="84" x2="176" y2="84" stroke="white" strokeWidth="0.5" opacity="0.5" />
                        <line x1="24" y1="95" x2="176" y2="95" stroke="white" strokeWidth="0.5" opacity="0.5" />
                        <line x1="24" y1="106" x2="176" y2="106" stroke="white" strokeWidth="0.5" opacity="0.5" />
                        <line x1="24" y1="117" x2="176" y2="117" stroke="white" strokeWidth="0.5" opacity="0.5" />
                        <line x1="24" y1="128" x2="176" y2="128" stroke="white" strokeWidth="0.5" opacity="0.5" />
                        <line x1="24" y1="139" x2="176" y2="139" stroke="white" strokeWidth="0.5" opacity="0.5" />
                        {/* Vertical net lines */}
                        <line x1="43" y1="62" x2="43" y2="150" stroke="white" strokeWidth="0.3" opacity="0.4" />
                        <line x1="62" y1="62" x2="62" y2="150" stroke="white" strokeWidth="0.3" opacity="0.4" />
                        <line x1="81" y1="62" x2="81" y2="150" stroke="white" strokeWidth="0.3" opacity="0.4" />
                        <line x1="100" y1="62" x2="100" y2="150" stroke="white" strokeWidth="0.3" opacity="0.4" />
                        <line x1="119" y1="62" x2="119" y2="150" stroke="white" strokeWidth="0.3" opacity="0.4" />
                        <line x1="138" y1="62" x2="138" y2="150" stroke="white" strokeWidth="0.3" opacity="0.4" />
                        <line x1="157" y1="62" x2="157" y2="150" stroke="white" strokeWidth="0.3" opacity="0.4" />

                        {/* Net tape (white band at top) */}
                        <rect x="24" y="62" width="152" height="4" fill="white" opacity="0.9" />

                        {/* Center strap */}
                        <rect x="98" y="66" width="4" height="84" fill="white" opacity="0.6" />

                        {/* Net sag - center is lower */}
                        <path d="M 24 62 Q 100 70 176 62" fill="none" stroke="white" strokeWidth="1.5" />

                        {/* Dimension: Post height (1.07m) */}
                        <line x1="8" y1="60" x2="8" y2="150" stroke="#C8F135" strokeWidth="1" />
                        <line x1="4" y1="60" x2="12" y2="60" stroke="#C8F135" strokeWidth="1" />
                        <line x1="4" y1="150" x2="12" y2="150" stroke="#C8F135" strokeWidth="1" />
                        <text x="7" y="110" textAnchor="middle" fill="#C8F135" fontSize="8" fontWeight="bold" transform="rotate(-90, 7, 110)">1.07m</text>

                        {/* Dimension: Center height (0.914m) */}
                        <line x1="100" y1="68" x2="100" y2="150" stroke="#C8F135" strokeWidth="0.8" strokeDasharray="2 2" />
                        <text x="100" y="170" textAnchor="middle" fill="#C8F135" fontSize="8" fontWeight="bold">{t('rules.reference.svg.centerHeightLabel')}</text>

                        {/* Dimension: Width */}
                        <line x1="20" y1="160" x2="180" y2="160" stroke="#C8F135" strokeWidth="1" />
                        <line x1="20" y1="156" x2="20" y2="164" stroke="#C8F135" strokeWidth="1" />
                        <line x1="180" y1="156" x2="180" y2="164" stroke="#C8F135" strokeWidth="1" />
                        <text x="100" y="178" textAnchor="middle" fill="#C8F135" fontSize="8" fontWeight="bold">{t('rules.reference.svg.doubleWidthLabel')}</text>

                        {/* Singles sticks label */}
                        <line x1="37" y1="42" x2="37" y2="56" stroke="#C8F135" strokeWidth="0.5" strokeDasharray="1 1" />
                        <line x1="163" y1="42" x2="163" y2="56" stroke="#C8F135" strokeWidth="0.5" strokeDasharray="1 1" />
                        <text x="100" y="40" textAnchor="middle" fill="#C8F135" fontSize="6.5">{t('rules.reference.svg.singlesSticksLabel')}</text>
                      </svg>
                    </div>
                  </div>
                </div>

                <div id="section-comptage">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.comptage.title')}</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {t('rules.reference.comptage.items').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                <div id="section-toss">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.toss.title')}</h5>
                  <p className="text-sm text-gray-300 mb-3">
                    {t('rules.reference.toss.intro')}
                  </p>
                  <p className="text-sm text-gray-300 mb-2">
                    {t('rules.reference.toss.choicesIntro')}
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-2 ml-2">
                    {t('rules.reference.toss.choices').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                  <div className="mt-3 bg-[#C8F135]/5 border border-[#C8F135]/20 rounded-lg p-3">
                    <p className="text-xs text-gray-400">
                      <strong className="text-[#C8F135]">{t('rules.reference.toss.noteLabel')}</strong> {t('rules.reference.toss.note')}
                    </p>
                  </div>
                </div>

                <div id="section-service">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.service.title')}</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {t('rules.reference.service.items').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                <div id="section-echange">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.echange.title')}</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {t('rules.reference.echange.items').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                <div id="section-perte">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.perte.title')}</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {t('rules.reference.perte.items').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                <div id="section-tiebreak">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.tiebreak.title')}</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {t('rules.reference.tiebreak.items').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                <div id="section-erreurs">
                  <h5 className="font-bold text-white mb-2">{t('rules.reference.erreurs.title')}</h5>
                  <p className="text-sm text-gray-300 mb-3">
                    {t('rules.reference.erreurs.intro')}
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
                    {t('rules.reference.erreurs.items').split('\n').map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                <div id="section-formats">
                  <h5 className="font-bold text-white mb-4">{t('rules.reference.formats.title')}</h5>
                  <p className="text-sm text-gray-400 mb-4">
                    {t('rules.reference.formats.intro')}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#C8F135]/10 border-b border-white/10">
                          <th className="px-3 py-3 text-left font-semibold text-white">{t('rules.reference.formats.colFormat')}</th>
                          <th className="px-3 py-3 text-left font-semibold text-white">{t('rules.reference.formats.colStructure')}</th>
                          <th className="px-3 py-3 text-center font-semibold text-white">{t('rules.reference.formats.colTB')}</th>
                          <th className="px-3 py-3 text-center font-semibold text-white">{t('rules.reference.formats.colSuperTB')}</th>
                          <th className="px-3 py-3 text-center font-semibold text-white">{t('rules.reference.formats.colNoAd')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.formats.format1')}</td>
                          <td className="px-3 py-3">{t('rules.reference.formats.structure3sets6jeux')}</td>
                          <td className="px-3 py-3 text-center">6/6</td>
                          <td className="px-3 py-3 text-center text-red-400">{t('common.no')}</td>
                          <td className="px-3 py-3 text-center text-red-400">{t('common.no')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.formats.format2')}</td>
                          <td className="px-3 py-3">{t('rules.reference.formats.structure2sets6jeux')}</td>
                          <td className="px-3 py-3 text-center">6/6</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('rules.reference.formats.yesTenPoints')}</td>
                          <td className="px-3 py-3 text-center text-red-400">{t('common.no')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.formats.format3')}</td>
                          <td className="px-3 py-3">{t('rules.reference.formats.structure2sets4jeux')}</td>
                          <td className="px-3 py-3 text-center">4/4</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('rules.reference.formats.yesTenPoints')}</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('common.yes')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.formats.format4')}</td>
                          <td className="px-3 py-3">{t('rules.reference.formats.structure2sets4jeux')}</td>
                          <td className="px-3 py-3 text-center">6/6</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('rules.reference.formats.yesTenPoints')}</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('common.yes')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.formats.format5')}</td>
                          <td className="px-3 py-3">{t('rules.reference.formats.structure2sets3jeux')}</td>
                          <td className="px-3 py-3 text-center">2/2</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('rules.reference.formats.yesTenPoints')}</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('common.yes')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.formats.format6')}</td>
                          <td className="px-3 py-3">{t('rules.reference.formats.structure2sets4jeux')}</td>
                          <td className="px-3 py-3 text-center">3/3</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('rules.reference.formats.yesTenPoints')}</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('common.yes')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.formats.format7')}</td>
                          <td className="px-3 py-3">{t('rules.reference.formats.structure2sets5jeux')}</td>
                          <td className="px-3 py-3 text-center">4/4</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('rules.reference.formats.yesTenPoints')}</td>
                          <td className="px-3 py-3 text-center text-green-400">{t('common.yes')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-gray-400">
                    <p><strong className="text-gray-300">{t('rules.reference.formats.tbNoteLabel')}</strong> {t('rules.reference.formats.tbNote')}</p>
                    <p><strong className="text-gray-300">{t('rules.reference.formats.superTbNoteLabel')}</strong> {t('rules.reference.formats.superTbNote')}</p>
                    <p><strong className="text-gray-300">{t('rules.reference.formats.noAdNoteLabel')}</strong> {t('rules.reference.formats.noAdNote')}</p>
                  </div>
                  <div className="mt-4 bg-blue-500/10 border border-blue-400/30 rounded-xl p-3">
                    <p className="text-xs text-blue-300">
                      <strong>{t('rules.reference.formats.sourceLabel')}</strong> {t('rules.reference.formats.source')}
                    </p>
                  </div>
                </div>

                <div id="section-classement">
                  <h5 className="font-bold text-white mb-4">{t('rules.reference.classement.title')}</h5>
                  <p className="text-sm text-gray-400 mb-4">
                    {t('rules.reference.classement.intro')}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#C8F135]/10 border-b border-white/10">
                          <th className="px-3 py-3 text-left font-semibold text-white">{t('rules.reference.classement.colSerie')}</th>
                          <th className="px-3 py-3 text-left font-semibold text-white">{t('rules.reference.classement.colEchelons')}</th>
                          <th className="px-3 py-3 text-left font-semibold text-white">{t('rules.reference.classement.colNiveau')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.classement.serie5')}</td>
                          <td className="px-3 py-3">NC, 40/2, 40/1</td>
                          <td className="px-3 py-3 text-gray-400">{t('rules.reference.classement.niveau5')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.classement.serie4')}</td>
                          <td className="px-3 py-3">40, 30/5, 30/4, 30/3, 30/2, 30/1</td>
                          <td className="px-3 py-3 text-gray-400">{t('rules.reference.classement.niveau4')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.classement.serie3')}</td>
                          <td className="px-3 py-3">30, 15/5, 15/4, 15/3, 15/2, 15/1</td>
                          <td className="px-3 py-3 text-gray-400">{t('rules.reference.classement.niveau3')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.classement.serie2')}</td>
                          <td className="px-3 py-3">15, 5/6, 4/6, 3/6, 2/6, 1/6, 0, -2/6, -4/6, -15, -30</td>
                          <td className="px-3 py-3 text-gray-400">{t('rules.reference.classement.niveau2')}</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-[#C8F135]">{t('rules.reference.classement.serie1')}</td>
                          <td className="px-3 py-3">Promotion, 1re série</td>
                          <td className="px-3 py-3 text-gray-400">{t('rules.reference.classement.niveau1')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5">
                    <h6 className="font-semibold text-white text-sm mb-3">{t('rules.reference.classement.pointsTitle')}</h6>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-3 py-2 text-left font-semibold text-white">{t('rules.reference.classement.colAdversaire')}</th>
                            <th className="px-3 py-2 text-right font-semibold text-white">{t('rules.reference.classement.colPoints')}</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          <tr className="border-b border-white/5">
                            <td className="px-3 py-2">{t('rules.reference.classement.opp2plus')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-green-400">+120</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-3 py-2">{t('rules.reference.classement.opp1plus')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-green-400">+90</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-3 py-2">{t('rules.reference.classement.oppEqual')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-400">+60</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-3 py-2">{t('rules.reference.classement.opp1minus')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-yellow-400">+30</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-3 py-2">{t('rules.reference.classement.opp2minus')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-orange-400">+20</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-3 py-2">{t('rules.reference.classement.opp3minus')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-orange-400">+15</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-3 py-2">{t('rules.reference.classement.opp4minus')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-red-400">0</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h6 className="font-semibold text-white text-sm mb-3">{t('rules.reference.classement.promotionTitle')}</h6>
                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                      <li><strong className="text-white">{t('rules.reference.classement.promotion402Label')}</strong> {t('rules.reference.classement.promotion402')}</li>
                      <li><strong className="text-white">{t('rules.reference.classement.promotion401Label')}</strong> {t('rules.reference.classement.promotion401')}</li>
                      <li><strong className="text-white">{t('rules.reference.classement.promotion40Label')}</strong> {t('rules.reference.classement.promotion40')}</li>
                    </ul>
                  </div>

                  <div className="mt-4 bg-blue-500/10 border border-blue-400/30 rounded-xl p-3">
                    <p className="text-xs text-blue-300">
                      <strong>{t('rules.reference.classement.updateLabel')}</strong> {t('rules.reference.classement.update')}
                    </p>
                  </div>
                </div>

                <div id="section-utr">
                  <h5 className="font-bold text-white mb-4">{t('rules.reference.utr.title')}</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#C8F135]/10 border-b border-white/10">
                          <th className="px-4 py-3 text-left font-semibold text-white">{t('rules.reference.utr.colUTR')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-white">{t('rules.reference.utr.colFrance')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-white">{t('rules.reference.utr.colGBR')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-white">{t('rules.reference.utr.colUSA')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">13+</td>
                          <td className="px-4 py-3">1st série Promotion -30 -15 -4/6 -4/6</td>
                          <td className="px-4 py-3">1.1 1.2</td>
                          <td className="px-4 py-3">7.0</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">10+</td>
                          <td className="px-4 py-3">-2/6 0 1/6</td>
                          <td className="px-4 py-3">2.1 2.2</td>
                          <td className="px-4 py-3">6.5 6.0</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">9, 9.5</td>
                          <td className="px-4 py-3">2/6 3/6</td>
                          <td className="px-4 py-3">3.1 3.2</td>
                          <td className="px-4 py-3">5.5</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">8, 8.5</td>
                          <td className="px-4 py-3">4/6 5/6</td>
                          <td className="px-4 py-3">4.1 4.2</td>
                          <td className="px-4 py-3">5.0</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">7, 7.5</td>
                          <td className="px-4 py-3">15/1 15/2</td>
                          <td className="px-4 py-3">5.1 5.2</td>
                          <td className="px-4 py-3">4.5</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">6, 6.5</td>
                          <td className="px-4 py-3">15/3 15/4</td>
                          <td className="px-4 py-3">6.1 6.2</td>
                          <td className="px-4 py-3">4.0</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">5, 5.5</td>
                          <td className="px-4 py-3">15/5 30</td>
                          <td className="px-4 py-3">7.1 7.2</td>
                          <td className="px-4 py-3">3.5</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">4, 4.5</td>
                          <td className="px-4 py-3">30/1 30/2</td>
                          <td className="px-4 py-3">8.1 8.2</td>
                          <td className="px-4 py-3">3.0</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">3, 3.5</td>
                          <td className="px-4 py-3">30/3 30/4</td>
                          <td className="px-4 py-3">9.1 9.2</td>
                          <td className="px-4 py-3">2.5</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">1, 2.5</td>
                          <td className="px-4 py-3">30/5</td>
                          <td className="px-4 py-3">10</td>
                          <td className="px-4 py-3">2.0</td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-[#C8F135]">NR</td>
                          <td className="px-4 py-3">NR</td>
                          <td className="px-4 py-3">NR</td>
                          <td className="px-4 py-3">1.5 1.0</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    {t('rules.reference.utr.footer')}
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4">
                  <p className="text-sm text-blue-300">
                    <strong>{t('rules.reference.finalNoteLabel')}</strong> {t('rules.reference.finalNote')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
