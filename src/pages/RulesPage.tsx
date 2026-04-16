import { BookOpen, Mic, Loader2, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useAlert } from '../hooks/useAlert';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function RulesPage() {
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
      showAlert('Impossible d\'accéder au microphone. Veuillez vérifier les permissions.', { type: 'error' });
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
        throw new Error('Aucune parole détectée. Veuillez réessayer.');
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
        content: chatData.reply || 'Désolé, je n\'ai pas pu générer une réponse.'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error submitting audio:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error
          ? `Erreur: ${error.message}`
          : 'Désolé, une erreur s\'est produite lors du traitement audio. Veuillez réessayer.'
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
        content: data.reply || 'Désolé, je n\'ai pas pu générer une réponse.'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error submitting question:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Désolé, une erreur s\'est produite. Veuillez réessayer.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AlertComponent />
      <div className="min-h-screen bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1A6FC4]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#C8F135]/5 rounded-full blur-3xl" />
        </div>

        {/* Page Header */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-8 lg:pt-20">
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-5 h-5 text-[#C8F135]" />
            <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
              Tennis Rules
            </span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
            Master the<br />
            <span className="text-[#C8F135]">Rules</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
            Learn and understand official tennis rules with AI-powered assistance
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
                Explication d'une règle
              </h3>
            </div>
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Posez votre question sur les règles du tennis..."
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
                  title={isRecording ? 'Arrêter l\'enregistrement' : 'Enregistrer une question vocale'}
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
                    Transcription en cours...
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  'Soumettre'
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
                          {message.role === 'user' ? 'Vous' : 'Assistant Tennis'}
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
                Règles du Tennis
              </h3>
            </div>
            <div className="prose prose-sm max-w-none">
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-3">Règles Officielles du Tennis (ITF)</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Voici un résumé des règles essentielles du tennis selon la Fédération Internationale de Tennis (ITF).
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h5 className="font-bold text-white mb-2">1. Le Court</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li>Dimensions: 23.77m x 8.23m (simple) ou 10.97m (double)</li>
                    <li>Hauteur du filet: 0.914m au centre, 1.07m aux poteaux</li>
                    <li>Surface: Terre battue, gazon, dur ou synthétique</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-white mb-2">2. Le Comptage des Points</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li><strong>Points:</strong> 0 (zéro), 15, 30, 40, Jeu</li>
                    <li><strong>Égalité:</strong> À 40-40 (deuce), il faut gagner 2 points consécutifs</li>
                    <li><strong>Jeu:</strong> Le premier à 4 points avec 2 points d'écart</li>
                    <li><strong>Set:</strong> Le premier à 6 jeux avec 2 jeux d'écart (ou tie-break à 6-6)</li>
                    <li><strong>Match:</strong> Généralement le meilleur de 3 sets (ou 5 sets en Grand Chelem hommes)</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-white mb-2">3. Le Service</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li>Le serveur doit se tenir derrière la ligne de fond</li>
                    <li>Le service alterne entre côté droit et gauche</li>
                    <li>La balle doit passer au-dessus du filet et atterrir dans le carré de service diagonal</li>
                    <li>Deux tentatives sont autorisées (premier et deuxième service)</li>
                    <li>Une double faute donne le point à l'adversaire</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-white mb-2">4. L'Échange</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li>La balle ne peut rebondir qu'une seule fois avant d'être frappée</li>
                    <li>La balle doit passer au-dessus du filet et retomber dans les limites du court</li>
                    <li>Les joueurs alternent les frappes jusqu'à ce qu'un point soit marqué</li>
                    <li>Un let (balle qui touche le filet au service) permet de rejouer le point</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-white mb-2">5. Perte de Point</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li>La balle rebondit deux fois du même côté</li>
                    <li>La balle sort des limites du court</li>
                    <li>Le joueur touche le filet avec sa raquette ou son corps pendant le jeu</li>
                    <li>La balle touche le joueur ou ses vêtements</li>
                    <li>Le joueur frappe la balle avant qu'elle ait traversé le filet</li>
                    <li>Double faute au service</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-white mb-2">6. Le Tie-Break</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li>Joué à 6 jeux partout (sauf si règles spécifiques du tournoi)</li>
                    <li>Premier à 7 points avec 2 points d'écart</li>
                    <li>Le service alterne tous les 2 points</li>
                    <li>Changement de côté tous les 6 points</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-white mb-2">7. Classement FFT</h5>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li><strong>NC (Non Classé):</strong> Joueur débutant</li>
                    <li><strong>40:</strong> Niveau intermédiaire</li>
                    <li><strong>30/5 - 30/4 - 30/3 - 30/2 - 30/1 - 30:</strong> Niveaux progressifs</li>
                    <li><strong>15/5 - 15/4 - 15/3 - 15/2 - 15/1 - 15:</strong> Joueurs confirmés</li>
                    <li><strong>5/6 - 4/6 - 3/6 - 2/6 - 1/6 - 0:</strong> Joueurs de haut niveau</li>
                    <li><strong>-2/6 - -4/6 - -15:</strong> Joueurs professionnels</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-white mb-4">8. Tableau de Conversion UTR</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#C8F135]/10 border-b border-white/10">
                          <th className="px-4 py-3 text-left font-semibold text-white">UTR</th>
                          <th className="px-4 py-3 text-left font-semibold text-white">France</th>
                          <th className="px-4 py-3 text-left font-semibold text-white">GBR</th>
                          <th className="px-4 py-3 text-left font-semibold text-white">USA</th>
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
                    UTR (Universal Tennis Rating) est un système international d'évaluation du niveau des joueurs de tennis.
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4">
                  <p className="text-sm text-blue-300">
                    <strong>Note:</strong> Ces règles sont un résumé simplifié. Pour les règles officielles complètes,
                    consultez le site de la FFT (Fédération Française de Tennis) ou de l'ITF (International Tennis Federation).
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
