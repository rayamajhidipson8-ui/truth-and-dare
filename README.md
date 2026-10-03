# ⚡ The Protocol — Synchronized 2-Player Truth or Dare

![The Protocol Emblem](protocol_hero.jpg)

> A low-latency, real-time multiplayer Truth or Dare battleground designed for two players. Featuring synchronized roulette wheel physics, escalating intensity tiers, live custom directives, and an evasive coward penalty button.

---

## ✨ Features

- **🎡 Synchronized Destiny Roulette**: Both players watch the same wheel spin simultaneously with identical landing physics across both devices in real-time.
- **🔮 Unfiltered Trials (3 Tiers)**:
  - **Tier 1 (Warmup & Chill)**: Embarrassing quirks and light-hearted confessions.
  - **Tier 2 (Academic & Overthinker Special)**: Study delusions, caffeine habits, and vocal confessions.
  - **Tier 3 (Chaotic Social Pranks)**: Double-chin wallpapers, phone call pranks, and high-stakes social dares.
- **⚡ Live Custom Directives**: Interrogators can craft custom challenges live, pulsing an active typing radar on their opponent's screen before issuing the challenge.
- **⏱️ 60-Second Execution Countdown**: Synthesized audio ticks and high-tension progress countdown.
- **🏃💨 Evasive Coward Button**: The skip button actively dodges cursor attempts before triggering a compulsory forfeit penalty dare.
- **👋 Interactive Challenger Introduction Page**: Automatic onboarding screen with live host detection, rule showcase, and interactive directive vault preview.
- **🔊 Synthesized Web Audio API Engine**: Pure synthesized browser audio (fanfare, buzzer, roulette ticks, and tension timer) with zero external sound asset dependencies.

---

## 🚀 Quick Start (Local Run)

1. **Clone & Install**:
   ```bash
   git clone https://github.com/rayamajhidipson8-ui/the-protocol.git
   cd the-protocol
   npm install
   ```

2. **Start the Real-Time Server**:
   ```bash
   npm start
   ```

3. **Open the Experience**:
   Navigate to `http://localhost:3000` in your browser.
   - Click **Create Room** to generate a 4-letter room code (e.g., `WOLF`).
   - Copy the shareable invite link (`http://localhost:3000/?room=WOLF`).
   - Open that link on a phone or second browser tab to enter the arena!

---

## 🌐 1-Click Free Cloud Deployment (Host 24/7)

### Option A: Render.com (Recommended)
1. Push this repository to GitHub.
2. Go to [Render.com](https://render.com) and click **New > Web Service**.
3. Select this repository. Render automatically reads `render.yaml`:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Deploy! Your app will be live 24/7 with free SSL and WebSocket support at `https://your-app.onrender.com`.

### Option B: Instant Free Tunnel (localtunnel)
Run this command from your terminal to get an instant public HTTPS/WSS URL without deploying:
```bash
npx localtunnel --port 3000
```
Share the generated URL with anyone in the world to play immediately!

---

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, Vanilla JavaScript (ES6+), Tailwind CSS, Phosphor Icons, Canvas Confetti.
- **Audio**: Web Audio API (Synthesizer Oscillators & Gain Nodes).
- **Backend & Multiplayer**: Node.js, Native `http` server, `ws` (WebSocket Server).
- **State Engine**: Ultra-low latency memory state synchronization.
