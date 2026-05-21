# Dog Smack 🐕

A memory game where you find the dogs among face-down boxes.

## How to Host Locally

### Option 1: Python server (recommended)

```bash
python3 server.py
```

Then open http://localhost:3000 in your browser.

Requires `psutil` (`pip install psutil`). If you'd rather skip that dependency:

### Option 2: Python's built-in server

```bash
python3 -m http.server 3000
```

### Option 3: Just open the file

Open `index.html` directly in your browser (some features may not work without a server).

## How to Play

1. Click **Play!** to briefly reveal all box contents.
2. Memorize where the dogs (🐕) are hiding.
3. After 1 second, all boxes flip back face-down.
4. Click all boxes that contain dogs to win the round.
5. **Don't click empty boxes** — you lose a heart each time.
6. You start with **3 hearts**. Game over when all hearts are gone.

### Scoring

- Each dog found: **10 points**
- Round completion bonus: **5 points per round**
- Streaks multiply your score

### Box Contents

| Icon | Type | Effect |
|------|------|--------|
| 🐕 | Dog | +10 points, progress toward round win |
| 🐱 | Cat | **Instant game over** (unless you have Cat Swatter) |
| 🦴 | Bone | +1 heart |
| 🎁 | Chest | Opens the **Spin to Win** for a random powerup |
| (empty) | Empty | Lose 1 heart |

## Powerups

Powerups are obtained by opening treasure chests (🎁), which trigger a **Spin to Win** wheel.

| Emoji | Name | Effect |
|-------|------|--------|
| 🔍 | Magnifying Glass | Your first mistake each round is free (no heart loss) |
| 🕹️ | Cat Swatter | Cats only cost -3 HP instead of instant death |
| 💣 | Bomb | At the start of each round, 4 random tiles are auto-flipped |
| 💰 | Riches | Immediately doubles your score |
| 🥣 | Kibble | +10 hearts immediately |
| 🧲 | Magnet | At round win, collects all unclicked bones and chests |
| 💀 | Cursed | No more chests spawn for the rest of the game |
| 🔫 | Shotgun | Clicking a dog reveals all adjacent dogs |
| 🖐️ | Big Fingers | Clicking reveals all adjacent tiles; lose HP only if 3+ blanks are revealed |
| 📦 | More Chests! | Spin the wheel again (and again!) |
| 🌫️ | Fog of War | Good items show as ✅, bad items as 💀 until clicked |

## Deploying to GitHub Pages

Push to GitHub, then in your repo: **Settings → Pages** → source: `main` branch, root folder `/`.
