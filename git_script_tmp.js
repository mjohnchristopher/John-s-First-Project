"use strict";

// -------------------------------------------------------------- mock data
// In the real product this comes from text parsed out of the PDF.
// For the mock we sample a skill library with a SEEDED random, so the
// same file always produces the same fake result — handy for demos.
const SKILL_POOL = [
  "JavaScript", "TypeScript", "Python", "React", "Node.js", "SQL",
  "PostgreSQL", "Git", "Docker", "REST APIs", "HTML & CSS",
  "Unit testing", "AWS", "CI/CD", "Accessibility", "Figma",
];

// Circumference of the score ring — 2πr with r = 52 from the SVG.
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

// -------------------------------------------------------------------- dom
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const sampleBtn = document.getElementById("sampleBtn");
const dzError = document.getElementById("dzError");
const fileLine = document.getElementById("fileLine");
const analyzing = document.getElementById("analyzing");
const statusText = document.getElementById("statusText");
const report = document.getElementById("report");
const scoreTier = document.getElementById("scoreTier");
const ringValue = document.getElementById("ringValue");
const scoreNumber = document.getElementById("scoreNumber");
const scoreNote = document.getElementById("scoreNote");
const presentChips = document.getElementById("presentChips");
const missingChips = document.getElementById("missingChips");

// ---------------------------------------------------------------- helpers
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Tiny seeded PRNG (mulberry32). Normal Math.random() gives a different
// result every call; seeding it with the file name makes results repeatable.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleSkills(presentCount, missingCount, rand) {
  const pool = SKILL_POOL.slice();
  // Fisher–Yates shuffle driven by the seeded rand.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    present: pool.slice(0, presentCount),
    missing: pool.slice(presentCount, presentCount + missingCount),
  };
}

function mockAnalyze(fileName) {
  const rand = mulberry32(hashString(fileName));
  const presentCount = 5 + Math.floor(rand() * 7); // 5–11 skills found
  const missingCount = 3 + Math.floor(rand() * 3); // 3–5 gaps
  const { present, missing } = sampleSkills(presentCount, missingCount, rand);
  const score = Math.min(
    100,
    Math.max(0, Math.round(38 + (presentCount / SKILL_POOL.length) * 54 + rand() * 6))
  );
  return { score, present, missing };
}

function isPdf(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
}

function showError(message) {
  dzError.textContent = message;
  dzError.hidden = false;
  dropzone.classList.add("has-error");
}

function clearError() {
  dzError.hidden = true;
  dropzone.classList.remove("has-error");
}

// ------------------------------------------------------------------ flow
const STATUS_STEPS = [
  "Extracting text from PDF…",
  "Matching against skill library…",
  "Scoring & building report…",
];

let statusTimer = null;
let analyzeTimer = null;

function runAnalysis(fileName) {
  clearInterval(statusTimer);
  clearTimeout(analyzeTimer);

  report.hidden = true;
  analyzing.hidden = false;

  let step = 0;
  statusText.textContent = STATUS_STEPS[0];
  statusTimer = setInterval(() => {
    step = (step + 1) % STATUS_STEPS.length;
    statusText.textContent = STATUS_STEPS[step];
  }, 700);

  // Fake "processing" delay, then render the mock report.
  analyzeTimer = setTimeout(() => {
    clearInterval(statusTimer);
    analyzing.hidden = true;
    renderReport(mockAnalyze(fileName));
  }, 1800);
}

function renderReport({ score, present, missing }) {
  const tier = score >= 80 ? "score--good" : score >= 60 ? "score--mid" : "score--low";
  scoreTier.className = `ring-wrap ${tier}`;
  scoreNote.textContent =
    score >= 80
      ? "Strong resume — the essentials are all here."
      : score >= 60
        ? "Solid base — close the gaps below to push it higher."
        : "Needs work — the missing skills are costing you the most.";

  renderChips(presentChips, present, "chip chip-present");
  renderChips(missingChips, missing, "chip chip-missing");

  report.hidden = false;

  // Snap the ring back to zero (without a transition), force a layout,
  // then animate to the score — resetting a display:none element's
  // style otherwise skips the animation entirely.
  ringValue.style.transition = "none";
  ringValue.style.strokeDashoffset = RING_CIRCUMFERENCE;
  void ringValue.getBoundingClientRect(); // flush pending styles
  ringValue.style.transition = "";
  requestAnimationFrame(() => {
    ringValue.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - score / 100)).toFixed(2);
  });

  animateNumber(scoreNumber, score, 900);
  report.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function animateNumber(el, target, duration) {
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = Math.round((1 - Math.pow(1 - t, 3)) * target);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderChips(container, skills, className) {
  container.replaceChildren();
  skills.forEach((skill, i) => {
    const chip = document.createElement("span");
    chip.className = className;
    chip.textContent = skill;
    chip.style.animationDelay = `${i * 60}ms`; // staggered fade-in
    container.appendChild(chip);
  });
}

// ---------------------------------------------------------------- events
function handleFile(file) {
  if (!file) return;
  if (!isPdf(file)) {
    showError("Only PDF files are supported.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showError("That PDF is over 5 MB — try a smaller one.");
    return;
  }
  clearError();
  fileLine.hidden = false;
  fileLine.textContent = `${file.name} · ${formatSize(file.size)}`;
  runAnalysis(file.name);
}

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

// Buttons live inside the clickable dropzone — stop the click there from
// also bubbling up and opening the file dialog twice.
browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

sampleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearError();
  fileLine.hidden = false;
  fileLine.textContent = "sample-resume-jane-doe.pdf · sample";
  runAnalysis("sample-resume-jane-doe.pdf");
});

fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

["dragenter", "dragover"].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragging");
  })
);

["dragleave", "drop"].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragging");
  })
);

dropzone.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));
