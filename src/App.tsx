import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  Upload, 
  Leaf, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCcw, 
  MessageCircle, 
  X, 
  ChevronRight,
  ArrowLeft,
  Loader2,
  Send,
  History,
  Users,
  BookOpen,
  Plus,
  ThumbsUp,
  MessageSquare,
  Calendar,
  LogIn,
  LogOut,
  Trash2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { analyzePlantImage, PlantAnalysis, chatWithDoctor } from "./services/geminiService";
import { 
  auth, 
  db, 
  signIn, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from "./lib/firebase";
import { 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove, 
  increment,
  serverTimestamp
} from "firebase/firestore";
import { COMMON_DISEASES } from "./constants/diseases";

type AppState = "IDLE" | "SCANNING" | "ANALYZING" | "RESULT" | "CHAT" | "HISTORY" | "COMMUNITY" | "LIBRARY" | "LOGS";

interface ScanRecord extends PlantAnalysis {
  id: string;
  userId: string;
  imageUrl: string;
  timestamp: any;
}

interface LogEntry {
  id: string;
  scanId: string;
  userId: string;
  action: string;
  observation: string;
  timestamp: any;
}

interface ForumPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  title: string;
  content: string;
  category: "Question" | "Advice" | "Showcase";
  upvotes: number;
  upvotedBy: string[];
  timestamp: any;
}

export default function App() {
  const [state, setState] = useState<AppState>("IDLE");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PlantAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "Question" as const });

  const [chatHistory, setChatHistory] = useState<{ role: "user" | "model", parts: { text: string }[] }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        const userRef = doc(db, "users", u.uid);
        setDoc(userRef, {
          uid: u.uid,
          displayName: u.displayName,
          email: u.email,
          photoURL: u.photoURL,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, []);

  // Scans Listener
  useEffect(() => {
    if (!user) {
      setScans([]);
      return;
    }
    // Simplified query to avoid composite index requirement
    const q = query(collection(db, "scans"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScanRecord));
      // Sort in memory
      data.sort((a, b) => {
        const t1 = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp instanceof Date ? a.timestamp.getTime() : 0);
        const t2 = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp instanceof Date ? b.timestamp.getTime() : 0);
        return t2 - t1;
      });
      setScans(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "scans"));
    return () => unsubscribe();
  }, [user]);

  // Chat Listener
  useEffect(() => {
    if (!selectedScan) {
      setChatHistory([]);
      return;
    }
    const q = query(collection(db, "scans", selectedScan.id, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          role: d.role as "user" | "model",
          parts: [{ text: d.text }]
        };
      });
      setChatHistory(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `scans/${selectedScan.id}/messages`));
    return () => unsubscribe();
  }, [selectedScan]);

  // Logs Listener
  useEffect(() => {
    if (!selectedScan) {
      setLogs([]);
      return;
    }
    const q = query(collection(db, "scans", selectedScan.id, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
      setLogs(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `scans/${selectedScan.id}/logs`));
    return () => unsubscribe();
  }, [selectedScan]);

  // Forum Posts Listener
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumPost));
      setPosts(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "posts"));
    return () => unsubscribe();
  }, []);

  // Camera handling removed from here and moved to CameraScanner component

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImage(dataUrl);
        handleAnalysis(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalysis = async (img: string) => {
    setState("ANALYZING");
    setError(null);
    try {
      const result = await analyzePlantImage(img);
      setAnalysis(result);
      
      if (user) {
        try {
          const docRef = await addDoc(collection(db, "scans"), {
            ...result,
            userId: user.uid,
            imageUrl: img,
            timestamp: serverTimestamp()
          });
          setSelectedScan({ id: docRef.id, ...result, userId: user.uid, imageUrl: img, timestamp: new Date() });
        } catch (dbErr) {
          console.error("Failed to save scan:", dbErr);
        }
      }
      
      setState("RESULT");
    } catch (err) {
      setError("Failed to analyze image. Please try again.");
      setState("IDLE");
      console.error(err);
    }
  };

  const handleAddLog = async (action: string, observation: string) => {
    if (!selectedScan || !user) return;
    try {
      await addDoc(collection(db, "scans", selectedScan.id, "logs"), {
        scanId: selectedScan.id,
        userId: user.uid,
        action,
        observation,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `scans/${selectedScan.id}/logs`);
    }
  };

  const handleCreatePost = async () => {
    if (!user || !newPost.title || !newPost.content) return;
    try {
      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: user.displayName || "Anonymous",
        authorPhoto: user.photoURL || "",
        title: newPost.title,
        content: newPost.content,
        category: newPost.category,
        upvotes: 0,
        upvotedBy: [],
        timestamp: serverTimestamp()
      });
      setShowPostModal(false);
      setNewPost({ title: "", content: "", category: "Question" });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "posts");
    }
  };

  const handleUpvote = async (postId: string, currentUpvotes: number, upvotedBy: string[]) => {
    if (!user) return;
    const isUpvoted = upvotedBy.includes(user.uid);
    try {
      await updateDoc(doc(db, "posts", postId), {
        upvotes: increment(isUpvoted ? -1 : 1),
        upvotedBy: isUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMessage = chatInput.trim();
    setChatInput("");
    setIsChatLoading(true);

    const newHistory = [...chatHistory, { role: "user" as const, parts: [{ text: userMessage }] }];
    
    // Save user message to Firestore if scan is selected
    if (selectedScan && user) {
      try {
        await addDoc(collection(db, "scans", selectedScan.id, "messages"), {
          role: "user",
          text: userMessage,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to save user message:", err);
      }
    } else {
      setChatHistory(newHistory);
    }

    try {
      const response = await chatWithDoctor(newHistory, userMessage);
      
      // Save model response to Firestore if scan is selected
      if (selectedScan && user) {
        try {
          await addDoc(collection(db, "scans", selectedScan.id, "messages"), {
            role: "model",
            text: response,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          console.error("Failed to save model response:", err);
        }
      } else {
        setChatHistory([...newHistory, { role: "model" as const, parts: [{ text: response }] }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory([...newHistory, { role: "model" as const, parts: [{ text: "I'm sorry, I'm having trouble connecting right now." }] }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const resetApp = () => {
    setState("IDLE");
    setImage(null);
    setAnalysis(null);
    setSelectedScan(null);
    setError(null);
    setChatHistory([]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl glass rounded-3xl overflow-hidden shadow-2xl relative min-h-[600px] flex flex-col">
        
        {/* Header */}
        <header className="p-6 flex items-center justify-between z-10 border-b border-sage-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-sage-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sage-600/20">
              <Leaf size={24} />
            </div>
            <h1 className="text-2xl serif font-bold tracking-tight">FloraFix</h1>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-sage-200" />
                <button onClick={logout} className="p-2 hover:bg-sage-100 rounded-full text-sage-600 transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button onClick={signIn} className="flex items-center gap-2 bg-sage-100 text-sage-600 px-4 py-2 rounded-xl font-medium hover:bg-sage-200 transition-all">
                <LogIn size={18} />
                Login
              </button>
            )}
          </div>
        </header>

        {/* Navigation removed from here as it's redundant with bottom nav */}

        <main className="flex-1 flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* IDLE STATE */}
            {state === "IDLE" && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              >
                <div className="relative mb-8">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, 5, 0, -5, 0]
                    }}
                    transition={{ duration: 6, repeat: Infinity }}
                    className="w-48 h-48 bg-sage-200 rounded-full flex items-center justify-center"
                  >
                    <Leaf size={80} className="text-sage-600" />
                  </motion.div>
                  <div className="absolute -bottom-2 -right-2 bg-white p-3 rounded-2xl shadow-lg">
                    <Camera size={24} className="text-sage-600" />
                  </div>
                </div>
                
                <h2 className="text-3xl serif font-bold mb-4">Is your plant feeling unwell?</h2>
                <p className="text-sage-800 mb-8 max-w-md">
                  Scan your plant to identify diseases, get care tips, and chat with our expert Plant Doctor.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                  <button 
                    onClick={() => setState("SCANNING")}
                    className="flex-1 bg-sage-600 text-white py-4 px-6 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-sage-800 transition-all shadow-lg hover:shadow-sage-600/20"
                  >
                    <Camera size={20} />
                    Scan Now
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-white text-sage-600 border-2 border-sage-100 py-4 px-6 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:border-sage-200 transition-all"
                  >
                    <Upload size={20} />
                    Upload
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                {error && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 text-red-500 flex items-center gap-2"
                  >
                    <AlertCircle size={16} />
                    {error}
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* SCANNING STATE */}
            {state === "SCANNING" && (
              <CameraScanner 
                onCapture={(dataUrl) => {
                  setImage(dataUrl);
                  handleAnalysis(dataUrl);
                }}
                onClose={() => setState("IDLE")}
                onError={(msg) => {
                  setError(msg);
                  setState("IDLE");
                }}
              />
            )}

            {/* ANALYZING STATE */}
            {state === "ANALYZING" && (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8"
              >
                <div className="relative w-48 h-48 mb-8">
                  {image && (
                    <img 
                      src={image} 
                      alt="Captured" 
                      className="w-full h-full object-cover rounded-3xl opacity-50 grayscale" 
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={48} className="text-sage-600 animate-spin" />
                  </div>
                </div>
                <h2 className="text-2xl serif font-bold mb-2">Analyzing your plant...</h2>
                <p className="text-sage-600 animate-pulse">Our botanists are looking closely.</p>
              </motion.div>
            )}

            {/* RESULT STATE */}
            {state === "RESULT" && analysis && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col overflow-y-auto p-6"
              >
                <div className="flex items-start gap-4 mb-8">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
                    <img src={image!} alt="Plant" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-3xl serif font-bold mb-1">{analysis.plantName}</h2>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                      analysis.isHealthy 
                        ? "bg-green-100 text-green-700" 
                        : "bg-red-100 text-red-700"
                    }`}>
                      {analysis.isHealthy ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {analysis.isHealthy ? "Healthy" : analysis.diseaseName}
                    </div>
                  </div>
                </div>

                {!analysis.isHealthy && (
                  <div className="mb-8 p-4 bg-red-50 rounded-2xl border border-red-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold uppercase tracking-wider text-red-800">Severity</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        analysis.severity === "High" ? "bg-red-200 text-red-900" :
                        analysis.severity === "Moderate" ? "bg-orange-200 text-orange-900" :
                        "bg-yellow-200 text-yellow-900"
                      }`}>
                        {analysis.severity}
                      </span>
                    </div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <AlertCircle size={18} className="text-red-600" />
                      Symptoms
                    </h3>
                    <ul className="list-disc list-inside text-sage-800 space-y-1">
                      {analysis.symptoms?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}

                <div className="space-y-6 mb-8">
                  <section>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                      <CheckCircle2 size={20} className="text-sage-600" />
                      {analysis.isHealthy ? "Care Tips" : "Recommended Treatment"}
                    </h3>
                    <div className="prose prose-sage max-w-none text-sage-800">
                      {analysis.isHealthy ? (
                        <ul className="list-disc list-inside space-y-2">
                          {analysis.careTips?.map((tip, i) => <li key={i}>{tip}</li>)}
                        </ul>
                      ) : (
                        <ReactMarkdown>{analysis.treatment || ""}</ReactMarkdown>
                      )}
                    </div>
                  </section>
                </div>

                <div className="mt-auto pt-6 border-t border-sage-100 flex gap-3">
                  <button 
                    onClick={() => setState("CHAT")}
                    className="flex-1 bg-sage-600 text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-sage-800 transition-all shadow-lg"
                  >
                    <MessageCircle size={20} />
                    Chat with Doctor
                  </button>
                  <button 
                    onClick={() => setState("IDLE")}
                    className="p-4 bg-sage-100 text-sage-600 rounded-2xl hover:bg-sage-200 transition-all"
                  >
                    <RefreshCcw size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* CHAT STATE */}
            {state === "CHAT" && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                <div className="p-4 border-b border-sage-100 flex items-center gap-3">
                  <button 
                    onClick={() => setState("RESULT")}
                    className="p-2 hover:bg-sage-100 rounded-full transition-colors"
                  >
                    <ArrowLeft size={20} className="text-sage-600" />
                  </button>
                  <div>
                    <h3 className="font-bold">Plant Doctor</h3>
                    <p className="text-xs text-sage-600">Online & ready to help</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle size={32} className="text-sage-600" />
                      </div>
                      <p className="text-sage-600 text-sm max-w-[200px] mx-auto">
                        Ask me anything about your {analysis?.plantName}'s health!
                      </p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div 
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] p-3 rounded-2xl ${
                        msg.role === "user" 
                          ? "bg-sage-600 text-white rounded-tr-none" 
                          : "bg-sage-100 text-sage-900 rounded-tl-none"
                      }`}>
                    <div className="prose prose-sm prose-invert">
                      <ReactMarkdown>
                        {msg.parts[0].text}
                      </ReactMarkdown>
                    </div>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-sage-100 p-3 rounded-2xl rounded-tl-none">
                        <Loader2 size={16} className="animate-spin text-sage-600" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-sage-100 flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Ask a question..."
                    className="flex-1 bg-sage-50 border border-sage-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sage-600/20"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="p-2 bg-sage-600 text-white rounded-xl disabled:opacity-50 hover:bg-sage-800 transition-colors"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* HISTORY STATE */}
            {state === "HISTORY" && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col p-6 overflow-y-auto"
              >
                <h2 className="text-2xl serif font-bold mb-6">Your Scan History</h2>
                {!user ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <LogIn size={48} className="text-sage-300 mb-4" />
                    <p className="text-sage-600 mb-4">Login to save and track your plant scans.</p>
                    <button onClick={signIn} className="bg-sage-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg">Login with Google</button>
                  </div>
                ) : scans.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <History size={48} className="text-sage-300 mb-4" />
                    <p className="text-sage-600">No scans yet. Start by scanning a plant!</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {scans.map((scan) => (
                      <button
                        key={scan.id}
                        onClick={() => {
                          setAnalysis(scan);
                          setImage(scan.imageUrl);
                          setSelectedScan(scan);
                          setState("LOGS");
                        }}
                        className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-sage-100 hover:border-sage-300 transition-all text-left shadow-sm"
                      >
                        <img src={scan.imageUrl} alt={scan.plantName} className="w-16 h-16 rounded-xl object-cover" />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{scan.plantName}</h3>
                          <div className="flex items-center gap-2 text-xs text-sage-500">
                            <Calendar size={12} />
                            {scan.timestamp?.toDate ? scan.timestamp.toDate().toLocaleDateString() : (scan.timestamp ? new Date(scan.timestamp).toLocaleDateString() : "N/A")}
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                          scan.isHealthy ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {scan.isHealthy ? "Healthy" : scan.diseaseName}
                        </div>
                        <ChevronRight size={20} className="text-sage-300" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* LOGS STATE (Treatment Tracking) */}
            {state === "LOGS" && selectedScan && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="p-4 border-b border-sage-100 flex items-center gap-3">
                  <button onClick={() => setState("HISTORY")} className="p-2 hover:bg-sage-100 rounded-full">
                    <ArrowLeft size={20} className="text-sage-600" />
                  </button>
                  <h3 className="font-bold">Treatment Logs: {selectedScan.plantName}</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="mb-8 flex gap-4 p-4 bg-sage-50 rounded-2xl border border-sage-100">
                    <img src={selectedScan.imageUrl} className="w-20 h-20 rounded-xl object-cover" />
                    <div className="flex-1">
                      <h4 className="font-bold">{selectedScan.isHealthy ? "Healthy Plant" : selectedScan.diseaseName}</h4>
                      <p className="text-sm text-sage-600 italic">Scanned on {selectedScan.timestamp?.toDate ? selectedScan.timestamp.toDate().toLocaleDateString() : new Date(selectedScan.timestamp).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => setState("CHAT")}
                      className="p-3 bg-sage-600 text-white rounded-xl shadow-md self-center"
                      title="View Chat History"
                    >
                      <MessageCircle size={20} />
                    </button>
                  </div>

                  <div className="mb-8">
                    <h4 className="font-bold mb-4 flex items-center gap-2">
                      <Plus size={18} className="text-sage-600" />
                      Log New Action
                    </h4>
                    <div className="space-y-3">
                      <input id="log-action" type="text" placeholder="Action (e.g., Applied Neem Oil)" className="w-full bg-white border border-sage-200 rounded-xl px-4 py-2" />
                      <textarea id="log-obs" placeholder="Observations..." className="w-full bg-white border border-sage-200 rounded-xl px-4 py-2 h-20" />
                      <button 
                        onClick={() => {
                          const action = (document.getElementById("log-action") as HTMLInputElement).value;
                          const obs = (document.getElementById("log-obs") as HTMLTextAreaElement).value;
                          if (action) {
                            handleAddLog(action, obs);
                            (document.getElementById("log-action") as HTMLInputElement).value = "";
                            (document.getElementById("log-obs") as HTMLTextAreaElement).value = "";
                          }
                        }}
                        className="w-full bg-sage-600 text-white py-3 rounded-xl font-bold"
                      >
                        Save Log Entry
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sage-500 uppercase text-xs tracking-widest">History</h4>
                    {logs.length === 0 ? (
                      <p className="text-center text-sage-400 py-4">No logs yet.</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="p-4 bg-white rounded-2xl border border-sage-100 shadow-sm relative">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sage-800">{log.action}</span>
                            <span className="text-[10px] text-sage-400">{log.timestamp?.toDate().toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-sage-600">{log.observation}</p>
                          <button 
                            onClick={() => deleteDoc(doc(db, "scans", selectedScan.id, "logs", log.id))}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-50 text-red-500 rounded-full border border-red-100 opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* COMMUNITY STATE */}
            {state === "COMMUNITY" && (
              <motion.div 
                key="community"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="p-6 flex items-center justify-between border-b border-sage-100">
                  <h2 className="text-2xl serif font-bold">Community Forum</h2>
                  <button 
                    onClick={() => user ? setShowPostModal(true) : signIn()}
                    className="bg-sage-600 text-white p-2 rounded-xl shadow-lg"
                  >
                    <Plus size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {posts.map((post) => (
                    <div key={post.id} className="bg-white rounded-3xl border border-sage-100 shadow-sm overflow-hidden">
                      <div className="p-4 flex items-center gap-3">
                        <img src={post.authorPhoto} className="w-10 h-10 rounded-full border border-sage-100" />
                        <div>
                          <h4 className="font-bold text-sm">{post.authorName}</h4>
                          <p className="text-[10px] text-sage-400">{post.timestamp?.toDate().toLocaleString()}</p>
                        </div>
                        <span className="ml-auto px-2 py-0.5 bg-sage-50 text-sage-600 rounded text-[10px] font-bold uppercase tracking-wider">
                          {post.category}
                        </span>
                      </div>
                      <div className="px-4 pb-4">
                        <h3 className="text-lg font-bold mb-2">{post.title}</h3>
                        <p className="text-sage-700 text-sm line-clamp-3 mb-4">{post.content}</p>
                        <div className="flex items-center gap-6 pt-4 border-t border-sage-50">
                          <button 
                            onClick={() => handleUpvote(post.id, post.upvotes, post.upvotedBy)}
                            className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                              user && post.upvotedBy.includes(user.uid) ? "text-sage-600" : "text-sage-400 hover:text-sage-600"
                            }`}
                          >
                            <ThumbsUp size={18} />
                            {post.upvotes}
                          </button>
                          <button className="flex items-center gap-2 text-sm font-bold text-sage-400">
                            <MessageSquare size={18} />
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* New Post Modal */}
                <AnimatePresence>
                  {showPostModal && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
                    >
                      <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                      >
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl serif font-bold">New Forum Post</h3>
                          <button onClick={() => setShowPostModal(false)} className="p-2 hover:bg-sage-100 rounded-full">
                            <X size={20} />
                          </button>
                        </div>
                        <div className="space-y-4">
                          <input 
                            type="text" 
                            placeholder="Title" 
                            value={newPost.title}
                            onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                            className="w-full bg-sage-50 border border-sage-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sage-600/20" 
                          />
                          <select 
                            value={newPost.category}
                            onChange={(e) => setNewPost({...newPost, category: e.target.value as any})}
                            className="w-full bg-sage-50 border border-sage-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sage-600/20"
                          >
                            <option value="Question">Question</option>
                            <option value="Advice">Advice</option>
                            <option value="Showcase">Showcase</option>
                          </select>
                          <textarea 
                            placeholder="What's on your mind?" 
                            value={newPost.content}
                            onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                            className="w-full bg-sage-50 border border-sage-100 rounded-xl px-4 py-3 h-40 focus:outline-none focus:ring-2 focus:ring-sage-600/20" 
                          />
                          <button 
                            onClick={handleCreatePost}
                            disabled={!newPost.title || !newPost.content}
                            className="w-full bg-sage-600 text-white py-4 rounded-2xl font-bold shadow-lg disabled:opacity-50"
                          >
                            Post to Community
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* LIBRARY STATE */}
            {state === "LIBRARY" && (
              <motion.div 
                key="library"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col p-6 overflow-y-auto"
              >
                <h2 className="text-2xl serif font-bold mb-6">Common Plant Diseases</h2>
                <div className="space-y-6">
                  {COMMON_DISEASES.map((disease, i) => (
                    <div key={i} className="bg-white rounded-3xl border border-sage-100 p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-sage-800 mb-4 flex items-center gap-2">
                        <AlertCircle size={20} className="text-red-500" />
                        {disease.name}
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-widest text-sage-400 mb-2">Symptoms</h4>
                          <ul className="text-sm text-sage-700 list-disc list-inside space-y-1">
                            {disease.symptoms.map((s, j) => <li key={j}>{s}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-widest text-sage-400 mb-2">Causes</h4>
                          <ul className="text-sm text-sage-700 list-disc list-inside space-y-1">
                            {disease.causes.map((c, j) => <li key={j}>{c}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-sage-50">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-sage-400 mb-2">Recommended Treatment</h4>
                        <ul className="text-sm text-sage-700 list-disc list-inside space-y-1">
                          {disease.treatments.map((t, j) => <li key={j}>{t}</li>)}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="h-20 bg-white border-t border-sage-100 flex items-center justify-around px-4 pb-2">
          <button 
            onClick={() => {
              resetApp();
              setState("SCANNING");
            }}
            className={`flex flex-col items-center gap-1 transition-colors ${
              state === "IDLE" || state === "SCANNING" || state === "ANALYZING" || state === "RESULT" || state === "CHAT"
                ? "text-sage-600" : "text-sage-300"
            }`}
          >
            <Camera size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Scan</span>
          </button>
          <button 
            onClick={() => setState("HISTORY")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              state === "HISTORY" || state === "LOGS" ? "text-sage-600" : "text-sage-300"
            }`}
          >
            <History size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
          </button>
          <button 
            onClick={() => setState("COMMUNITY")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              state === "COMMUNITY" ? "text-sage-600" : "text-sage-300"
            }`}
          >
            <Users size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Community</span>
          </button>
          <button 
            onClick={() => setState("LIBRARY")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              state === "LIBRARY" ? "text-sage-600" : "text-sage-300"
            }`}
          >
            <BookOpen size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Library</span>
          </button>
        </nav>
      </div>

      {/* Decorative background elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            x: [0, 50, 0],
            y: [0, 30, 0],
            rotate: [0, 10, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-96 h-96 bg-sage-200/30 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ 
            x: [0, -50, 0],
            y: [0, -30, 0],
            rotate: [0, -10, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-20 -right-20 w-96 h-96 bg-sage-300/20 rounded-full blur-3xl"
        />
      </div>
    </div>
  );
}

function CameraScanner({ onCapture, onClose, onError }: { 
  onCapture: (dataUrl: string) => void, 
  onClose: () => void,
  onError: (msg: string) => void 
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        onError("Could not access camera. Please try uploading an image.");
        console.error(err);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL("image/jpeg");
        onCapture(dataUrl);
      }
    }
  };

  return (
    <motion.div 
      key="scanning"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-black relative"
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="flex-1 object-cover"
      />
      <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
        <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative">
          <motion.div 
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-0.5 bg-sage-400 shadow-[0_0_15px_rgba(167,199,167,0.8)]"
          />
        </div>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8">
        <button 
          onClick={onClose}
          className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
        >
          <X size={24} />
        </button>
        <button 
          onClick={capturePhoto}
          className="w-20 h-20 bg-white rounded-full p-1 shadow-xl"
        >
          <div className="w-full h-full border-4 border-sage-600 rounded-full" />
        </button>
        <div className="w-12 h-12" /> {/* Spacer */}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}
