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
} from "firebase/firestore";

const USER_1 = "Joy";
const USER_2 = "Meher";

const DEFAULT_PINS = {
  [USER_1]: "1111",
  [USER_2]: "2222",
};

function formatLastSeen(presence, now) {
  if (!presence) return "Offline";
  const isOnline = presence.online && now - presence.lastSeen < 45000;
  if (isOnline) return "Online";

  if (!presence.lastSeen) return "Offline";
  const diffSec = Math.floor((now - presence.lastSeen) / 1000);
  if (diffSec < 60) return "Last seen just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Last seen ${days}d ago`;
}

export default function CoupleChat() {
  const [pins, setPins] = useState(DEFAULT_PINS);
  const [currentUser, setCurrentUser] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [presenceMap, setPresenceMap] = useState({});
  const [typingStatus, setTypingStatus] = useState({});
  const [now, setNow] = useState(Date.now());

  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const lastTapRef = useRef({ id: null, time: 0 });

  // প্রতি ১৫ সেকেন্ডে সময় আপডেট করা যেন Last seen ঠিক থাকে
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Firestore থেকে সেভ করা PIN লোড করা
  useEffect(() => {
    const unsubPins = onSnapshot(doc(db, "settings", "pins"), (docSnap) => {
      if (docSnap.exists()) {
        setPins({ ...DEFAULT_PINS, ...docSnap.data() });
      }
    });
    return () => unsubPins();
  }, []);

  // লগইন হলে মেসেজ, টাইপিং ও Online/Last seen আপডেট রাখা
  useEffect(() => {
    if (!currentUser) return;

    const updatePresence = (online) => {
      setDoc(
        doc(db, "status", "presence"),
        { [currentUser]: { online, lastSeen: Date.now() } },
        { merge: true }
      );
    };

    updatePresence(true);
    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") {
        updatePresence(true);
      }
    }, 25000);

    const handleVisibility = () => {
      updatePresence(document.visibilityState === "visible");
    };
    const handleUnload = () => updatePresence(false);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);

    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    const unsubPresence = onSnapshot(doc(db, "status", "presence"), (docSnap) => {
      if (docSnap.exists()) setPresenceMap(docSnap.data());
    });

    const unsubTyping = onSnapshot(doc(db, "status", "typing"), (docSnap) => {
      if (docSnap.exists()) setTypingStatus(docSnap.data());
    });

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
      updatePresence(false);
      unsubMessages();
      unsubPresence();
      unsubTyping();
    };
  }, [currentUser]);

  const handleUnlock = (e) => {
    e.preventDefault();
    const entered = pinInput.trim();
    if (entered === pins[USER_1]) {
      setCurrentUser(USER_1);
      setPinError("");
      setPinInput("");
    } else if (entered === pins[USER_2]) {
      setCurrentUser(USER_2);
      setPinError("");
      setPinInput("");
    } else {
      setPinError("ভুল PIN, আবার চেষ্টা করো");
    }
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    const cleaned = newPin.trim();
    const otherUser = currentUser === USER_1 ? USER_2 : USER_1;

    if (cleaned.length < 4) {
      setPinMsg("কমপক্ষে ৪ সংখ্যার PIN দাও");
      return;
    }
    if (cleaned === pins[otherUser]) {
      setPinMsg("এই PIN অন্যজন ব্যবহার করছে, অন্য একটা দাও");
      return;
    }

    await setDoc(
      doc(db, "settings", "pins"),
      { [currentUser]: cleaned },
      { merge: true }
    );
    setNewPin("");
    setPinMsg("PIN পরিবর্তন হয়েছে!");
    setTimeout(() => {
      setShowPinModal(false);
      setPinMsg("");
    }, 1000);
  };

  const setTyping = async (state) => {
    if (!currentUser || isTypingRef.current === state) return;
    isTypingRef.current = state;
    await setDoc(doc(db, "status", "typing"), { [currentUser]: state }, { merge: true });
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
    setText("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping(false);

    await addDoc(collection(db, "messages"), {
      text: msg,
      sender: currentUser,
      reaction: "",
      createdAt: serverTimestamp(),
    });
  };

  const handleDoubleTap = async (msg) => {
    const nowTime = Date.now();
    if (lastTapRef.current.id === msg.id && nowTime - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 };
      await updateDoc(doc(db, "messages", msg.id), {
        reaction: msg.reaction ? "" : "❤️",
      });
    } else {
      lastTapRef.current = { id: msg.id, time: nowTime };
    }
  };

  const otherUser = currentUser === USER_1 ? USER_2 : USER_1;
  const statusText = typingStatus[otherUser]
    ? "Typing..."
    : formatLastSeen(presenceMap[otherUser], now);
  const isOtherOnline = statusText === "Online";

  if (!currentUser) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-6 text-white">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-xs space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center"
        >
          <h1 className="text-xl font-semibold">Private Space</h1>
          <p className="text-xs text-neutral-400">ঢুকতে তোমার নিজের PIN দাও</p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-rose-500"
          />
          {pinError && <p className="text-xs text-rose-400">{pinError}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-rose-600 py-3 text-sm font-medium text-white active:scale-95"
          >
            Unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex h-dvh max-w-md flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">{otherUser}</h1>
          <p
            className={`text-xs ${
              typingStatus[otherUser]
                ? "text-rose-400"
                : isOtherOnline
                ? "text-emerald-400"
                : "text-neutral-400"
            }`}
          >
            {statusText}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowPinModal(true);
              setPinMsg("");
              setNewPin("");
            }}
            className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400"
          >
            PIN
          </button>
          <button
            onClick={() => {
              setTyping(false);
              setCurrentUser("");
            }}
            className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => {
          const isMe = msg.sender === currentUser;
          const time = msg.createdAt?.toDate
            ? msg.createdAt.toDate().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div
                onClick={() => handleDoubleTap(msg)}
                className={`relative max-w-[78%] cursor-pointer select-none rounded-2xl px-3.5 py-2 text-sm ${
                  isMe
                    ? "rounded-br-sm bg-rose-600 text-white"
                    : "rounded-bl-sm bg-neutral-800 text-neutral-100"
                }`}
              >
                {msg.text}
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
              {time && (
                <span className="mt-1 text-[10px] text-neutral-500">{time}</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-neutral-800 px-3 py-3"
      >
        <input
          type="text"
          value={text}
          onChange={handleInputChange}
          placeholder="Write something..."
          className="flex-1 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm outline-none focus:border-rose-500"
        />
        <button
          type="submit"
          className="rounded-full bg-rose-600 px-4 py-2.5 text-sm font-medium text-white active:scale-95"
        >
          Send
        </button>
      </form>

      {showPinModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6">
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
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-center text-sm tracking-widest outline-none focus:border-rose-500"
            />
            {pinMsg && <p className="text-xs text-rose-400">{pinMsg}</p>}
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
                className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-medium text-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}