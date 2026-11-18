"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, arrayUnion } from "firebase/firestore";

const QUESTIONS = [
  "আজকের দিনের সবচেয়ে সুন্দর মুহূর্ত কোনটা ছিল?",
  "আমার কোন অভ্যাসটা তোমার সবচেয়ে বেশি ভালো লাগে?",
  "আমরা দুজন একসাথে প্রথম কোথায় ঘুরতে গেলে সবচেয়ে মজা হবে?",
  "আমাদের নিয়ে তোমার প্রিয় একটি স্মৃতি কী?",
  "কোন গানটা শুনলেই তোমার আমার কথা মনে পড়ে?",
  "আমার সম্পর্কে এমন একটা কথা বলো যা আগে কখনো বলোনি।",
  "আজ রাতে আমরা একসাথে কোন মুভি বা নাটক দেখতে পারি?",
  "আমার হাসি নাকি আমার কথা—কোনটা আগে মন ভালো করে?",
  "এক শব্দে আমাকে কীভাবে বর্ণনা করবে?",
  "ভবিষ্যতে আমরা দুজন মিলে কোন জিনিসটা অবশ্যই ট্রাই করবো?",
];

const DEFAULT_PROMPTS = {
  Truth: [
    "প্রথম যেদিন আমাকে দেখেছিলে বা কথা বলেছিলে, তখন মনের ভেতর কী ভেবেছিলে?",
    "আমার কোন ছোট্ট কথায় বা কাজে তুমি সবচেয়ে বেশি খুশি হও?",
    "কখনো আমার ওপর রাগ করে লুকিয়ে কেঁদেছো বা মন খারাপ করেছো?",
    "আমার কোন জিনিসটা তোমার একটু পরিবর্তন হলে ভালো হতো মনে হয়?",
    "আমাদের কোন চ্যাট বা ভয়েস নোটটা তুমি বারবার শোনো বা পড়ো?",
    "সত্যি বলো, দিনে কতবার আমার প্রোফাইল বা চ্যাট চেক করো?",
  ],
  Dare: [
    "এখনই চ্যাটে ১০ সেকেন্ডের একটা মিষ্টি ভয়েস নোট পাঠাও!",
    "নিজের হাত দিয়ে স্ক্রিনে Draw করে আমার জন্য একটা কিউট ছবি এঁকে পাঠাও।",
    "তোমার গ্যালারি থেকে একদম রিসেন্ট তোলা একটা ছবি এখনই চ্যাটে দাও।",
    "একটা প্রিয় গানের দুই লাইন গেয়ে ভয়েস মেসেজে পাঠাও!",
    "চ্যাটে Secret 🔒 মোড অন করে আমাকে একটা গোপন কমপ্লিমেন্ট দাও।",
    "আমাকে নিয়ে ২ লাইনের একটা মজার ছড়া বা কবিতা লিখে পাঠাও।",
  ],
  "Would You Rather": [
    "একসাথে বৃষ্টির দিনে চা-কফি নাকি গভীর রাতে লং ড্রাইভ?",
    "সারাজীবন শুধু টেক্সটে কথা বলা নাকি দিনে মাত্র ১০ মিনিট ভিডিও কল?",
    "হঠাৎ সারপ্রাইজ ভিজিট নাকি আগে থেকে প্ল্যান করে বড় ডেট?",
    "একসাথে বসে ভৌতিক মুভি দেখা নাকি রোমান্টিক কমেডি?",
    "সকালে ঘুম ভাঙার সাথে সাথে ভয়েস কল নাকি রাতে ঘুমানোর আগে লম্বা গল্প?",
  ],
};

function checkWinner(b) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, c, d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return b.every(Boolean) ? "Draw" : "";
}

function extractYouTubeId(url) {
  if (!url) return "";
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : "";
}

export default function FunModal({
  currentUser,
  otherUser,
  themeBtn,
  messages = [],
  onClose,
}) {
  const [tab, setTab] = useState("question");
  const [previewImg, setPreviewImg] = useState(null);
  const [answers, setAnswers] = useState({});
  const [myAnswer, setMyAnswer] = useState("");
  const [game, setGame] = useState({ board: Array(9).fill(""), turn: "Joy", winner: "" });

  const [currentCard, setCurrentCard] = useState(null);
  const [customPrompts, setCustomPrompts] = useState({
    Truth: [],
    Dare: [],
    "Would You Rather": [],
  });
  const [customType, setCustomType] = useState("Truth");
  const [customText, setCustomText] = useState("");

  const [watchUrl, setWatchUrl] = useState("");
  const [watchState, setWatchState] = useState({ videoId: "", isPlaying: false, by: "" });
  const iframeRef = useRef(null);

  const [touchMap, setTouchMap] = useState({});
  const touchPadRef = useRef(null);
  const isTouchingRef = useRef(false);
  const lastTouchSentRef = useRef(0);
  const wasOtherActiveRef = useRef(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const dayNum = Math.floor(Date.now() / 86400000);
  const todayQuestion = QUESTIONS[dayNum % QUESTIONS.length];

  useEffect(() => {
    const unsubQ = onSnapshot(doc(db, "fun", `daily_${todayKey}`), (s) => {
      if (s.exists()) setAnswers(s.data());
    });
    const unsubG = onSnapshot(doc(db, "fun", "tictactoe"), (s) => {
      if (s.exists()) setGame(s.data());
    });
    const unsubTD = onSnapshot(doc(db, "fun", "truth_dare"), (s) => {
      if (s.exists()) setCurrentCard(s.data());
    });
    const unsubCustom = onSnapshot(doc(db, "fun", "custom_prompts"), (s) => {
      if (s.exists()) {
        setCustomPrompts({
          Truth: s.data().Truth || [],
          Dare: s.data().Dare || [],
          "Would You Rather": s.data()["Would You Rather"] || [],
        });
      }
    });
    const unsubWatch = onSnapshot(doc(db, "fun", "watch_together"), (s) => {
      if (s.exists()) setWatchState(s.data());
    });
    const unsubTouch = onSnapshot(doc(db, "fun", "live_touch"), (s) => {
      if (s.exists()) setTouchMap(s.data());
    });

    return () => {
      unsubQ();
      unsubG();
      unsubTD();
      unsubCustom();
      unsubWatch();
      unsubTouch();
    };
  }, [todayKey]);

  useEffect(() => {
    const otherTouch = touchMap[otherUser];
    const isActive = Boolean(otherTouch?.active && Date.now() - otherTouch.updatedAt < 15000);
    if (isActive && !wasOtherActiveRef.current) {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([80, 70, 120]);
      }
    }
    wasOtherActiveRef.current = isActive;
  }, [touchMap, otherUser]);

  useEffect(() => {
    if (!iframeRef.current || !watchState.videoId) return;
    const func = watchState.isPlaying ? "playVideo" : "pauseVideo";
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: "" }),
      "*"
    );
  }, [watchState.isPlaying, watchState.videoId]);

  const sendTouch = (active, clientX, clientY) => {
    if (!touchPadRef.current) return;
    const rect = touchPadRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    setDoc(
      doc(db, "fun", "live_touch"),
      { [currentUser]: { active, x, y, updatedAt: Date.now() } },
      { merge: true }
    );
  };

  const handleTouchStart = (e) => {
    isTouchingRef.current = true;
    sendTouch(true, e.clientX, e.clientY);
  };

  const handleTouchMove = (e) => {
    if (!isTouchingRef.current) return;
    const now = Date.now();
    if (now - lastTouchSentRef.current < 90) return;
    lastTouchSentRef.current = now;
    sendTouch(true, e.clientX, e.clientY);
  };

  const handleTouchEnd = (e) => {
    if (!isTouchingRef.current) return;
    isTouchingRef.current = false;
    sendTouch(false, e.clientX, e.clientY);
  };

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!myAnswer.trim()) return;
    await setDoc(
      doc(db, "fun", `daily_${todayKey}`),
      { [currentUser]: myAnswer.trim() },
      { merge: true }
    );
    setMyAnswer("");
  };

  const makeMove = async (idx) => {
    if (game.board[idx] || game.winner || game.turn !== currentUser) return;
    const nextBoard = [...game.board];
    nextBoard[idx] = currentUser === "Joy" ? "X" : "O";
    const winner = checkWinner(nextBoard);
    const nextTurn = currentUser === "Joy" ? "Meher" : "Joy";
    await setDoc(doc(db, "fun", "tictactoe"), {
      board: nextBoard,
      turn: nextTurn,
      winner,
    });
  };

  const resetGame = async () => {
    await setDoc(doc(db, "fun", "tictactoe"), {
      board: Array(9).fill(""),
      turn: "Joy",
      winner: "",
    });
  };

  const drawRandomCard = async (type) => {
    const pool = [...DEFAULT_PROMPTS[type], ...(customPrompts[type] || [])];
    const picked = pool[Math.floor(Math.random() * pool.length)];
    await setDoc(doc(db, "fun", "truth_dare"), {
      type,
      text: picked,
      by: currentUser,
    });
  };

  const addCustomPrompt = async (e) => {
    e.preventDefault();
    if (!customText.trim()) return;
    const text = customText.trim();
    setCustomText("");
    await setDoc(
      doc(db, "fun", "custom_prompts"),
      { [customType]: arrayUnion(text) },
      { merge: true }
    );
  };

  const loadVideo = async (e) => {
    e.preventDefault();
    const id = extractYouTubeId(watchUrl.trim());
    if (!id) return;
    setWatchUrl("");
    await setDoc(doc(db, "fun", "watch_together"), {
      videoId: id,
      isPlaying: false,
      by: currentUser,
    });
  };

  const togglePlayTogether = async () => {
    if (!watchState.videoId) return;
    await setDoc(
      doc(db, "fun", "watch_together"),
      { isPlaying: !watchState.isPlaying, by: currentUser },
      { merge: true }
    );
  };

  const bothAnswered = Boolean(answers[currentUser] && answers[otherUser]);
  const myTouch = touchMap[currentUser];
  const otherTouch = touchMap[otherUser];
  const isOtherTouching = Boolean(otherTouch?.active && Date.now() - otherTouch.updatedAt < 15000);
  const bothTouching = Boolean(myTouch?.active && isOtherTouching);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 overflow-x-auto">
            {[
              ["question", "Daily"],
              ["game", "Game"],
              ["td", "Truth/Dare"],
              ["watch", "Watch"],
              ["touch", "Touch"],
              ["gallery", "Gallery"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  setPreviewImg(null);
                }}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  tab === key ? `${themeBtn} text-white` : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-sm text-neutral-400">
            ✕
          </button>
        </div>

        {tab === "question" && (
          <div className="space-y-3">
            <p className="rounded-xl bg-neutral-950 p-3 text-sm font-medium text-neutral-100">
              {todayQuestion}
            </p>
            {!answers[currentUser] ? (
              <form onSubmit={submitAnswer} className="space-y-2">
                <input
                  type="text"
                  value={myAnswer}
                  onChange={(e) => setMyAnswer(e.target.value)}
                  placeholder="তোমার উত্তর লেখো..."
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  className={`w-full rounded-xl ${themeBtn} py-2 text-xs font-medium text-white`}
                >
                  Save Answer
                </button>
              </form>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="rounded-xl bg-neutral-950 p-2.5">
                  <span className="font-semibold text-neutral-400">{currentUser}: </span>
                  {answers[currentUser]}
                </div>
                <div className="rounded-xl bg-neutral-950 p-2.5">
                  <span className="font-semibold text-neutral-400">{otherUser}: </span>
                  {bothAnswered ? (
                    answers[otherUser]
                  ) : (
                    <span className="italic text-neutral-500">
                      🔒 {otherUser} উত্তর দিলেই দেখতে পাবে
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "game" && (
          <div className="space-y-3 text-center">
            <p className="text-xs text-neutral-300">
              {game.winner === "Draw"
                ? "খেলা ড্র হয়েছে!"
                : game.winner
                ? `${game.winner === "X" ? "Joy" : "Meher"} জিতেছে!`
                : game.turn === currentUser
                ? `তোমার চাল (${currentUser === "Joy" ? "X" : "O"})`
                : `${otherUser}-এর চালের জন্য অপেক্ষা...`}
            </p>
            <div className="mx-auto grid w-52 grid-cols-3 gap-2">
              {game.board.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => makeMove(i)}
                  className="flex h-16 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-xl font-bold active:scale-95"
                >
                  {cell}
                </button>
              ))}
            </div>
            <button
              onClick={resetGame}
              className="rounded-xl border border-neutral-700 px-4 py-1.5 text-xs text-neutral-300"
            >
              New Game
            </button>
          </div>
        )}

        {tab === "td" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {["Truth", "Dare", "Would You Rather"].map((type) => (
                <button
                  key={type}
                  onClick={() => drawRandomCard(type)}
                  className="rounded-xl border border-neutral-700 bg-neutral-800 py-2 text-[11px] font-medium text-white active:scale-95"
                >
                  {type === "Would You Rather" ? "Rather?" : type}
                </button>
              ))}
            </div>

            <div className="min-h-24 rounded-xl bg-neutral-950 p-3.5">
              {currentCard ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-semibold uppercase">{currentCard.type}</span>
                    <span>Picked by {currentCard.by}</span>
                  </div>
                  <p className="text-sm text-neutral-100">{currentCard.text}</p>
                </div>
              ) : (
                <p className="text-center text-xs text-neutral-500">
                  উপরের যেকোনো একটা বাটনে ট্যাপ করে র‍্যান্ডম কার্ড তোলো!
                </p>
              )}
            </div>

            <form onSubmit={addCustomPrompt} className="space-y-2 border-t border-neutral-800 pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-neutral-400">নিজেদের প্রশ্ন যোগ করো:</span>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-200 outline-none"
                >
                  <option value="Truth">Truth</option>
                  <option value="Dare">Dare</option>
                  <option value="Would You Rather">Rather?</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="নতুন প্রশ্ন বা Dare লেখো..."
                  className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs outline-none"
                />
                <button
                  type="submit"
                  className={`rounded-xl ${themeBtn} px-3 py-1.5 text-xs font-medium text-white`}
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        )}

        {tab === "watch" && (
          <div className="space-y-3">
            <form onSubmit={loadVideo} className="flex gap-2">
              <input
                type="text"
                value={watchUrl}
                onChange={(e) => setWatchUrl(e.target.value)}
                placeholder="YouTube লিংক পেস্ট করো..."
                className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs outline-none"
              />
              <button
                type="submit"
                className={`rounded-xl ${themeBtn} px-3 py-2 text-xs font-medium text-white`}
              >
                Load
              </button>
            </form>

            {watchState.videoId ? (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border border-neutral-800 bg-black">
                  <iframe
                    ref={iframeRef}
                    src={`https://www.youtube.com/embed/${watchState.videoId}?enablejsapi=1`}
                    className="aspect-video w-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">
                    {watchState.isPlaying ? "Playing" : "Paused"} ({watchState.by})
                  </span>
                  <button
                    onClick={togglePlayTogether}
                    className={`rounded-xl ${themeBtn} px-4 py-1.5 font-medium text-white`}
                  >
                    {watchState.isPlaying ? "Pause Both" : "Play Both"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-neutral-950 p-4 text-center text-xs text-neutral-500">
                যেকোনো YouTube গানের বা ভিডিওর লিংক দিয়ে একসাথে দেখো!
              </p>
            )}
          </div>
        )}

        {tab === "touch" && (
          <div className="space-y-2.5 text-center">
            <p className="text-xs text-neutral-300">
              {bothTouching
                ? "💓 Heartbeat Synced! দুজনেই একসাথে আছো"
                : isOtherTouching
                ? `${otherUser} স্ক্রিনে হাত রেখেছে—তুমিও ছুঁয়ে দেখো!`
                : "নিচের বক্সে আঙুল চেপে ধরে রাখো"}
            </p>
            <div
              ref={touchPadRef}
              onPointerDown={handleTouchStart}
              onPointerMove={handleTouchMove}
              onPointerUp={handleTouchEnd}
              onPointerCancel={handleTouchEnd}
              onPointerLeave={handleTouchEnd}
              className={`relative h-60 w-full touch-none select-none overflow-hidden rounded-2xl border bg-neutral-950 transition-colors ${
                bothTouching ? "border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.35)]" : "border-neutral-800"
              }`}
            >
              {myTouch?.active && (
                <div
                  style={{ left: `${myTouch.x}%`, top: `${myTouch.y}%` }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="h-14 w-14 animate-ping rounded-full bg-sky-400/30" />
                  <div className="absolute inset-2 flex items-center justify-center rounded-full bg-sky-500/80 text-[10px] font-semibold">
                    {currentUser}
                  </div>
                </div>
              )}

              {isOtherTouching && (
                <div
                  style={{ left: `${otherTouch.x}%`, top: `${otherTouch.y}%` }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="h-16 w-16 animate-ping rounded-full bg-rose-500/40" />
                  <div className="absolute inset-2 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold shadow-lg">
                    {otherUser} 💓
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "gallery" && (
          <div className="space-y-2">
            {previewImg ? (
              <div className="space-y-2 text-center">
                <img
                  src={previewImg}
                  alt="Preview"
                  className="max-h-72 w-full rounded-xl bg-black object-contain"
                />
                <button
                  onClick={() => setPreviewImg(null)}
                  className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300"
                >
                  Back to Gallery
                </button>
              </div>
            ) : (
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                {messages.filter((m) => m.image).length === 0 ? (
                  <p className="col-span-2 py-8 text-center text-xs text-neutral-500">
                    এখনো কোনো Photo বা Draw পাঠানো হয়নি
                  </p>
                ) : (
                  [...messages]
                    .filter((m) => m.image)
                    .reverse()
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setPreviewImg(m.image)}
                        className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-1.5 text-left"
                      >
                        <img
                          src={m.image}
                          alt="Memory"
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                        <p className="mt-1 truncate text-[10px] text-neutral-400">
                          By {m.sender}
                        </p>
                      </button>
                    ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}