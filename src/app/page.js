"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import CalculatorDisguise from "@/components/CalculatorDisguise";
import DoodleModal from "@/components/DoodleModal";
import FunModal from "@/components/FunModal";

const DEFAULT_ROOM = "joy-meher";

const DEFAULT_PINS = {
  Joy: "1111",
  Meher: "2222",
};

const THEMES = {
  rose: { bubble: "bg-rose-600", btn: "bg-rose-600", accent: "text-rose-400", dot: "bg-rose-500" },
  blue: { bubble: "bg-sky-600", btn: "bg-sky-600", accent: "text-sky-400", dot: "bg-sky-500" },
  violet: { bubble: "bg-violet-600", btn: "bg-violet-600", accent: "text-violet-400", dot: "bg-violet-500" },
  emerald: { bubble: "bg-emerald-600", btn: "bg-emerald-600", accent: "text-emerald-400", dot: "bg-emerald-500" },
};

function formatLastSeen(presence, now) {
  if (!presence) return "Offline";
  if (presence.online && now - presence.lastSeen < 45000) return "Online";
  if (!presence.lastSeen) return "Offline";
  const diffSec = Math.floor((now - presence.lastSeen) / 1000);
  if (diffSec < 60) return "Last seen just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs}h ago`;
  return `Last seen ${Math.floor(hrs / 24)}d ago`;
}

function getYouTubeId(text) {
  if (!text) return null;
  const match = text.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

export default function CoupleChat() {
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const [roomUsers, setRoomUsers] = useState(["Joy", "Meher"]);
  const [pins, setPins] = useState({});

  const [currentUser, setCurrentUser] = useState("");
  const [disguised, setDisguised] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomId, setNewRoomId] = useState("");
  const [newU1, setNewU1] = useState("");
  const [newP1, setNewP1] = useState("");
  const [newU2, setNewU2] = useState("");
  const [newP2, setNewP2] = useState("");
  const [createMsg, setCreateMsg] = useState("");

  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  const [showDoodle, setShowDoodle] = useState(false);
  const [showFun, setShowFun] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [playAlert, setPlayAlert] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [themeKey, setThemeKey] = useState("rose");
  const [secretMode, setSecretMode] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [revealedTexts, setRevealedTexts] = useState({});

  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [presenceMap, setPresenceMap] = useState({});
  const [typingStatus, setTypingStatus] = useState({});
  const [readMap, setReadMap] = useState({});
  const [now, setNow] = useState(Date.now());

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const lastTapRef = useRef({ id: null, time: 0 });
  const initialLoadDoneRef = useRef(false);
  const lastMsgIdRef = useRef(null);
  const mutedRef = useRef(false);

  const theme = THEMES[themeKey] || THEMES.rose;

  const roomDoc = (col, id) =>
    activeRoom === DEFAULT_ROOM
      ? doc(db, col, id)
      : doc(db, "rooms", activeRoom, col, id);

  const messagesCol = () =>
    activeRoom === DEFAULT_ROOM
      ? collection(db, "messages")
      : collection(db, "rooms", activeRoom, "messages");

  useEffect(() => {
    const savedMute = localStorage.getItem("couple_muted") === "true";
    setMuted(savedMute);
    mutedRef.current = savedMute;

    const savedRoom = localStorage.getItem("couple_room");
    if (savedRoom) setRoomInput(savedRoom);

    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveRoom(roomInput.trim().toLowerCase());
  }, [roomInput]);

  useEffect(() => {
    if (!activeRoom) {
      setPins({});
      setThemeKey("rose");
      return;
    }

    const unsubPins = onSnapshot(roomDoc("settings", "pins"), (docSnap) => {
      if (activeRoom === DEFAULT_ROOM) {
        setRoomUsers(["Joy", "Meher"]);
        setPins(docSnap.exists() ? { ...DEFAULT_PINS, ...docSnap.data() } : DEFAULT_PINS);
      } else if (docSnap.exists()) {
        const data = docSnap.data();
        const names = Object.keys(data);
        if (names.length >= 2) setRoomUsers([names[0], names[1]]);
        setPins(data);
      } else {
        setPins({});
      }
    });

    const unsubTheme = onSnapshot(roomDoc("settings", "theme"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().key) setThemeKey(docSnap.data().key);
      else setThemeKey("rose");
    });

    return () => {
      unsubPins();
      unsubTheme();
    };
  }, [activeRoom]);

  useEffect(() => {
    if (!currentUser || !activeRoom) {
      initialLoadDoneRef.current = false;
      lastMsgIdRef.current = null;
      return;
    }

    const updatePresence = (online) => {
      setDoc(
        roomDoc("status", "presence"),
        { [currentUser]: { online, lastSeen: Date.now() } },
        { merge: true }
      );
    };

    const markRead = () => {
      if (document.visibilityState === "visible" && !disguised) {
        setDoc(roomDoc("status", "read"), { [currentUser]: Date.now() }, { merge: true });
      }
    };

    updatePresence(true);
    markRead();

    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") updatePresence(true);
    }, 25000);

    const handleVisibility = () => {
      const visible = document.visibilityState === "visible";
      updatePresence(visible);
      if (visible) markRead();
    };
    const handleUnload = () => updatePresence(false);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);

    const q = query(messagesCol(), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const latest = list[list.length - 1];

      if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true;
        if (latest) lastMsgIdRef.current = latest.id;
      } else if (latest && latest.id !== lastMsgIdRef.current) {
        lastMsgIdRef.current = latest.id;
        if (latest.sender !== currentUser && !mutedRef.current) {
          playNotificationSound();
        }
        markRead();
      }

      setMessages(list);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    const unsubPresence = onSnapshot(roomDoc("status", "presence"), (s) => {
      setPresenceMap(s.exists() ? s.data() : {});
    });
    const unsubTyping = onSnapshot(roomDoc("status", "typing"), (s) => {
      setTypingStatus(s.exists() ? s.data() : {});
    });
    const unsubRead = onSnapshot(roomDoc("status", "read"), (s) => {
      setReadMap(s.exists() ? s.data() : {});
    });
    const unsubGame = onSnapshot(roomDoc("fun", "tictactoe"), (s) => {
      if (s.exists()) {
        const g = s.data();
        const myTurn = g.board?.some(Boolean) && !g.winner && g.turn === currentUser;
        setPlayAlert(Boolean(myTurn));
      } else {
        setPlayAlert(false);
      }
    });

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
      updatePresence(false);
      unsubMessages();
      unsubPresence();
      unsubTyping();
      unsubRead();
      unsubGame();
    };
  }, [currentUser, disguised, activeRoom]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    localStorage.setItem("couple_muted", String(next));
    if (!next) playNotificationSound();
  };

  const changeTheme = async (key) => {
    setThemeKey(key);
    await setDoc(roomDoc("settings", "theme"), { key }, { merge: true });
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!activeRoom) {
      setPinError("আগে Room Code দাও");
      return;
    }
    const entered = pinInput.trim();
    const matched = Object.entries(pins).find(([, p]) => p === entered);
    if (matched) {
      setCurrentUser(matched[0]);
      localStorage.setItem("couple_room", activeRoom);
      setPinError("");
      setPinInput("");
    } else {
      setPinError("ভুল Room Code বা PIN");
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const rid = newRoomId.trim().toLowerCase().replace(/\s+/g, "-");
    const u1 = newU1.trim();
    const u2 = newU2.trim();
    const p1 = newP1.trim();
    const p2 = newP2.trim();

    if (!rid || rid === DEFAULT_ROOM) return setCreateMsg("অন্য একটি Room Code দাও");
    if (!u1 || !u2 || u1 === u2) return setCreateMsg("দুজনের আলাদা নাম দাও");
    if (p1.length < 4 || p2.length < 4 || p1 === p2) {
      return setCreateMsg("কমপক্ষে ৪ সংখ্যার আলাদা PIN দাও");
    }

    const existing = await getDoc(doc(db, "rooms", rid, "settings", "pins"));
    if (existing.exists()) return setCreateMsg("এই Room Code আগেই নেওয়া হয়েছে");

    await setDoc(doc(db, "rooms", rid, "settings", "pins"), {
      [u1]: p1,
      [u2]: p2,
    });

    setRoomInput(rid);
    localStorage.setItem("couple_room", rid);
    setShowCreateRoom(false);
    setCreateMsg("");
    setNewRoomId("");
    setNewU1("");
    setNewP1("");
    setNewU2("");
    setNewP2("");
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    const cleaned = newPin.trim();
    const otherUser = currentUser === roomUsers[0] ? roomUsers[1] : roomUsers[0];
    if (cleaned.length < 4) return setPinMsg("কমপক্ষে ৪ সংখ্যার PIN দাও");
    if (cleaned === pins[otherUser]) return setPinMsg("এই PIN অন্যজন ব্যবহার করছে");

    await setDoc(roomDoc("settings", "pins"), { [currentUser]: cleaned }, { merge: true });
    setNewPin("");
    setPinMsg("PIN পরিবর্তন হয়েছে!");
    setTimeout(() => {
      setShowPinModal(false);
      setPinMsg("");
    }, 1000);
  };

  const setTyping = async (state) => {
    if (!currentUser || !activeRoom || isTypingRef.current === state) return;
    isTypingRef.current = state;
    await setDoc(roomDoc("status", "typing"), { [currentUser]: state }, { merge: true });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (val.trim().length > 0) {
      setTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
    } else {
      setTyping(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !currentUser) return;
    const msg = text.trim();
    const replyData = replyTo
      ? { text: replyTo.text || (replyTo.audio ? "Voice Note" : "Photo"), sender: replyTo.sender }
      : null;
    const isSecret = secretMode;

    setText("");
    setReplyTo(null);
    setSecretMode(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping(false);

    await addDoc(messagesCol(), {
      text: msg,
      sender: currentUser,
      reaction: "",
      viewOnce: isSecret,
      opened: false,
      replyTo: replyData,
      createdAt: serverTimestamp(),
    });
  };

  const sendImageData = async (dataUrl) => {
    if (!currentUser) return;
    await addDoc(messagesCol(), {
      text: "",
      image: dataUrl,
      sender: currentUser,
      reaction: "",
      createdAt: serverTimestamp(),
    });
  };

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 720;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        sendImageData(canvas.toDataURL("image/jpeg", 0.65));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const stopRecording = () => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setRecSeconds(0);
  };

  const toggleRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          await addDoc(messagesCol(), {
            text: "",
            audio: reader.result,
            sender: currentUser,
            reaction: "",
            createdAt: serverTimestamp(),
          });
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecSeconds(0);

      recTimerRef.current = setInterval(() => {
        setRecSeconds((prev) => {
          if (prev + 1 >= 45) {
            stopRecording();
            return 45;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert("মাইক্রোফোন পারমিশন দাও");
    }
  };

  const openSecretMessage = async (msg) => {
    if (msg.sender === currentUser || revealedTexts[msg.id]) return;
    const secretText = msg.text;
    setRevealedTexts((prev) => ({ ...prev, [msg.id]: secretText }));

    await updateDoc(doc(messagesCol(), msg.id), {
      text: "Secret message opened",
      viewOnce: false,
      opened: true,
    });

    setTimeout(() => {
      setRevealedTexts((prev) => {
        const copy = { ...prev };
        delete copy[msg.id];
        return copy;
      });
    }, 6000);
  };

  const handleDoubleTap = async (msg) => {
    if (msg.viewOnce && msg.sender !== currentUser) {
      openSecretMessage(msg);
      return;
    }
    const nowTime = Date.now();
    if (lastTapRef.current.id === msg.id && nowTime - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 };
      await updateDoc(doc(messagesCol(), msg.id), {
        reaction: msg.reaction ? "" : "❤️",
      });
    } else {
      lastTapRef.current = { id: msg.id, time: nowTime };
    }
  };

  if (disguised) {
    return (
      <CalculatorDisguise
        pins={pins}
        onUnlock={(user) => {
          setCurrentUser(user);
          setDisguised(false);
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-neutral-950 px-6 text-white">
        {!showCreateRoom ? (
          <form
            onSubmit={handleUnlock}
            className="w-full max-w-xs space-y-3.5 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center"
          >
            <h1 className="text-xl font-semibold">Private Space</h1>
            <p className="text-xs text-neutral-400">রুম কোড ও তোমার PIN দাও</p>
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="Room Code"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-center text-sm outline-none focus:border-rose-500"
            />
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN ••••"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-rose-500"
            />
            {pinError && <p className="text-xs text-rose-400">{pinError}</p>}
            <button
              type="submit"
              className={`w-full rounded-xl ${theme.btn} py-3 text-sm font-medium text-white active:scale-95`}
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={() => setShowCreateRoom(true)}
              className="w-full pt-1 text-xs text-neutral-400 underline"
            >
              + বন্ধুদের জন্য নতুন রুম বানাও
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleCreateRoom}
            className="w-full max-w-xs space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-center"
          >
            <h2 className="text-base font-semibold">নতুন রুম তৈরি করো</h2>
            <input
              type="text"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              placeholder="Room Code (যেমন: rafi-tina)"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newU1}
                onChange={(e) => setNewU1(e.target.value)}
                placeholder="প্রথম নাম"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                value={newP1}
                onChange={(e) => setNewP1(e.target.value)}
                placeholder="PIN (4+)"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs outline-none"
              />
              <input
                type="text"
                value={newU2}
                onChange={(e) => setNewU2(e.target.value)}
                placeholder="দ্বিতীয় নাম"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                value={newP2}
                onChange={(e) => setNewP2(e.target.value)}
                placeholder="PIN (4+)"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs outline-none"
              />
            </div>
            {createMsg && <p className="text-xs text-rose-400">{createMsg}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateRoom(false)}
                className="flex-1 rounded-xl border border-neutral-700 py-2 text-xs text-neutral-300"
              >
                Back
              </button>
              <button
                type="submit"
                className={`flex-1 rounded-xl ${theme.btn} py-2 text-xs font-medium text-white`}
              >
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  const otherUser = currentUser === roomUsers[0] ? roomUsers[1] : roomUsers[0];
  const statusText = typingStatus[otherUser]
    ? "Typing..."
    : formatLastSeen(presenceMap[otherUser], now);
  const isOtherOnline = statusText === "Online";

  const lastMyMsg = [...messages].reverse().find((m) => m.sender === currentUser);
  const lastMyMsgTime = lastMyMsg?.createdAt?.toMillis ? lastMyMsg.createdAt.toMillis() : 0;
  const isSeen = lastMyMsg && readMap[otherUser] && readMap[otherUser] >= lastMyMsgTime;

  const displayedMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : messages;

  return (
    <div className="flex min-h-dvh w-full justify-center bg-neutral-950 text-white">
      <main className="relative flex h-dvh w-full max-w-md flex-col overflow-hidden bg-neutral-950">
        <header className="relative flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">{otherUser}</h1>
            <p
              className={`text-xs ${
                typingStatus[otherUser]
                  ? theme.accent
                  : isOtherOnline
                  ? "text-emerald-400"
                  : "text-neutral-400"
              }`}
            >
              {statusText}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFun(true)}
              className="relative rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-200"
            >
              Play
              {playAlert && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              )}
            </button>
            <button
              onClick={() => {
                setTyping(false);
                setDisguised(true);
              }}
              className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-amber-400"
            >
              Hide
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-300"
            >
              ⋮
            </button>
          </div>

          {showMenu && (
            <div className="absolute right-4 top-14 z-20 w-44 space-y-2.5 rounded-2xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Theme</span>
                <div className="flex gap-1.5">
                  {Object.keys(THEMES).map((k) => (
                    <button
                      key={k}
                      onClick={() => changeTheme(k)}
                      className={`h-4 w-4 rounded-full ${THEMES[k].dot} ${
                        themeKey === k ? "ring-2 ring-white ring-offset-1 ring-offset-neutral-900" : "opacity-60"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowSearch(true);
                }}
                className="w-full rounded-lg bg-neutral-800 px-3 py-1.5 text-left text-xs text-neutral-200"
              >
                Search Messages
              </button>
              <button
                onClick={() => {
                  toggleMute();
                  setShowMenu(false);
                }}
                className="w-full rounded-lg bg-neutral-800 px-3 py-1.5 text-left text-xs text-neutral-200"
              >
                Sound: {muted ? "Off (Muted)" : "On"}
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowPinModal(true);
                  setPinMsg("");
                  setNewPin("");
                }}
                className="w-full rounded-lg bg-neutral-800 px-3 py-1.5 text-left text-xs text-neutral-200"
              >
                Change PIN
              </button>
            </div>
          )}
        </header>

        {showSearch && (
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="মেসেজ খুঁজুন..."
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none"
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="text-xs text-neutral-400"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {displayedMessages.map((msg) => {
            const isMe = msg.sender === currentUser;
            const time = msg.createdAt?.toDate
              ? msg.createdAt.toDate().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const activeSecretText = revealedTexts[msg.id];
            const isSecretHidden = msg.viewOnce && !isMe && !activeSecretText;
            const showSeen = isMe && lastMyMsg?.id === msg.id && isSeen;
            const ytId = !isSecretHidden && !msg.opened ? getYouTubeId(msg.text) : null;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  onClick={() => handleDoubleTap(msg)}
                  className={`relative max-w-[82%] cursor-pointer select-none rounded-2xl px-3.5 py-2 text-sm ${
                    msg.opened && !activeSecretText
                      ? "border border-neutral-800 bg-neutral-900 italic text-neutral-500"
                      : isMe
                      ? `rounded-br-sm ${theme.bubble} text-white`
                      : "rounded-bl-sm bg-neutral-800 text-neutral-100"
                  }`}
                >
                  {msg.replyTo && (
                    <div className="mb-1.5 rounded-lg bg-black/25 px-2.5 py-1 text-xs text-white/80">
                      <span className="font-semibold">{msg.replyTo.sender}: </span>
                      {msg.replyTo.text}
                    </div>
                  )}

                  {msg.image ? (
                    <img src={msg.image} alt="Shared" className="max-h-56 rounded-lg" />
                  ) : msg.audio ? (
                    <audio controls src={msg.audio} className="h-9 w-52" />
                  ) : isSecretHidden ? (
                    <span>🔒 Secret message (Tap to view)</span>
                  ) : activeSecretText ? (
                    <span>⏳ {activeSecretText}</span>
                  ) : (
                    <span>
                      {msg.viewOnce && isMe ? "🔒 " : ""}
                      {msg.text}
                    </span>
                  )}

                  {ytId && (
                    <div className="mt-2 overflow-hidden rounded-xl">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        className="aspect-video w-56"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {msg.reaction && (
                    <span
                      className={`absolute -bottom-2.5 ${
                        isMe ? "left-1" : "right-1"
                      } rounded-full bg-neutral-900 px-1.5 py-0.5 text-xs shadow`}
                    >
                      {msg.reaction}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                  {time && <span>{time}</span>}
                  {!msg.opened && !msg.viewOnce && (
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="text-neutral-400 hover:text-white"
                    >
                      Reply
                    </button>
                  )}
                  {showSeen && <span className={theme.accent}>Seen</span>}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {replyTo && (
          <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-900 px-4 py-2 text-xs">
            <div className="truncate text-neutral-300">
              <span className="font-semibold">{replyTo.sender}: </span>
              {replyTo.text || (replyTo.audio ? "Voice Note" : "Photo")}
            </div>
            <button onClick={() => setReplyTo(null)} className="ml-3 text-neutral-400">
              ✕
            </button>
          </div>
        )}

        <div className="space-y-2 border-t border-neutral-800 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoPick}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300"
            >
              Photo
            </button>
            <button
              type="button"
              onClick={toggleRecording}
              className={`rounded-full border px-3 py-1 text-xs ${
                recording
                  ? "animate-pulse border-rose-500 bg-rose-600 text-white"
                  : "border-neutral-800 bg-neutral-900 text-neutral-300"
              }`}
            >
              {recording ? `Stop ● ${recSeconds}s / 45s` : "Voice"}
            </button>
            <button
              type="button"
              onClick={() => setShowDoodle(true)}
              className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300"
            >
              Draw
            </button>
            <button
              type="button"
              onClick={() => setSecretMode(!secretMode)}
              className={`rounded-full border px-3 py-1 text-xs ${
                secretMode
                  ? `${theme.btn} border-transparent text-white`
                  : "border-neutral-800 bg-neutral-900 text-neutral-400"
              }`}
            >
              Secret 🔒
            </button>
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={handleInputChange}
              placeholder={secretMode ? "Secret message..." : "Write something..."}
              className="min-w-0 flex-1 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm outline-none focus:border-neutral-600"
            />
            <button
              type="submit"
              className={`rounded-full ${theme.btn} px-4 py-2 text-sm font-medium text-white active:scale-95`}
            >
              Send
            </button>
          </form>
        </div>

        {showDoodle && (
          <DoodleModal onClose={() => setShowDoodle(false)} onSend={sendImageData} />
        )}

        {showFun && (
          <FunModal
            roomId={activeRoom}
            user1={roomUsers[0]}
            user2={roomUsers[1]}
            currentUser={currentUser}
            otherUser={otherUser}
            themeBtn={theme.btn}
            messages={messages}
            onClose={() => setShowFun(false)}
          />
        )}

        {showPinModal && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6">
            <form
              onSubmit={handleChangePin}
              className="w-full max-w-xs space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-center"
            >
              <h2 className="text-base font-semibold">{currentUser}-এর PIN বদলাও</h2>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="নতুন PIN (কমপক্ষে ৪ সংখ্যা)"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-center text-sm tracking-widest outline-none"
              />
              {pinMsg && <p className={`text-xs ${theme.accent}`}>{pinMsg}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 rounded-xl border border-neutral-700 py-2 text-xs text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 rounded-xl ${theme.btn} py-2 text-xs font-medium text-white`}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}