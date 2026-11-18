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

// এখান থেকে পিন আর তোমাদের নাম বদলাতে পারবে
const SECRET_PIN = "8520";
const USER_1 = "Joy";
const USER_2 = "Meher";

const MOODS = ["❤️ Miss you", "😊 Happy", "🎧 Music", "😴 Sleepy", "🥺 Busy"];

export default function CoupleChat() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [currentUser, setCurrentUser] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [partnerMood, setPartnerMood] = useState({});
  const [typingStatus, setTypingStatus] = useState({});

  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const lastTapRef = useRef({ id: null, time: 0 });

  useEffect(() => {
    const savedUser = localStorage.getItem("couple_user");
    if (savedUser) setCurrentUser(savedUser);
  }, []);

  useEffect(() => {
    if (!unlocked) return;

    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    const unsubMood = onSnapshot(doc(db, "status", "moods"), (docSnap) => {
      if (docSnap.exists()) setPartnerMood(docSnap.data());
    });

    const unsubTyping = onSnapshot(doc(db, "status", "typing"), (docSnap) => {
      if (docSnap.exists()) setTypingStatus(docSnap.data());
    });

    return () => {
      unsubMessages();
      unsubMood();
      unsubTyping();
    };
  }, [unlocked]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput === SECRET_PIN) {
      setUnlocked(true);
      setPinError(false);
      setPinInput("");
    } else {
      setPinError(true);
    }
  };

  const selectUser = (name) => {
    setCurrentUser(name);
    localStorage.setItem("couple_user", name);
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

  // মোবাইল ও ডেস্কটপ দুই জায়গাতেই ডাবল-ট্যাপ কাজ করার জন্য
  const handleDoubleTap = async (msg) => {
    const now = Date.now();
    if (lastTapRef.current.id === msg.id && now - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 };
      await updateDoc(doc(db, "messages", msg.id), {
        reaction: msg.reaction ? "" : "❤️",
      });
    } else {
      lastTapRef.current = { id: msg.id, time: now };
    }
  };

  const updateMood = async (mood) => {
    if (!currentUser) return;
    await setDoc(
      doc(db, "status", "moods"),
      { [currentUser]: mood },
      { merge: true }
    );
  };

  const otherUser = currentUser === USER_1 ? USER_2 : USER_1;

  if (!unlocked) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-6 text-white">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-xs space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center"
        >
          <h1 className="text-xl font-semibold">Private Space</h1>
          <p className="text-xs text-neutral-400">ঢুকতে সিক্রেট PIN দাও</p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-rose-500"
          />
          {pinError && <p className="text-xs text-rose-400">ভুল PIN, আবার চেষ্টা করো</p>}
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

  if (!currentUser) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-6 text-white">
        <div className="w-full max-w-xs space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center">
          <h2 className="text-lg font-medium">তুমি কে?</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => selectUser(USER_1)}
              className="rounded-xl border border-neutral-700 bg-neutral-800 py-3 text-sm font-medium hover:border-rose-500"
            >
              {USER_1}
            </button>
            <button
              onClick={() => selectUser(USER_2)}
              className="rounded-xl border border-neutral-700 bg-neutral-800 py-3 text-sm font-medium hover:border-rose-500"
            >
              {USER_2}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">{otherUser}</h1>
          <p className="text-xs text-rose-400">
            {typingStatus[otherUser]
              ? "Typing..."
              : partnerMood[otherUser] || "Online in our space"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              localStorage.removeItem("couple_user");
              setCurrentUser("");
            }}
            className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400"
          >
            Switch
          </button>
          <button
            onClick={() => setUnlocked(false)}
            className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-neutral-900 px-4 py-2">
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => updateMood(m)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              partnerMood[currentUser] === m
                ? "bg-rose-600 text-white"
                : "bg-neutral-900 text-neutral-300"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

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
    </main>
  );
}