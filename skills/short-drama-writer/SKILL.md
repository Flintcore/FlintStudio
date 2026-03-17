# Short Drama Writer Skill

A self-evolving AI agent skill for short drama script creation based on the 100,000+ word knowledge base of AI film and television direction.

## Features

- **Golden Hook Generator**: Creates viral opening hooks for the first 10 seconds
- **Emotion Rollercoaster**: Designs emotional curves for episode retention
- **Checkpoint Payment Optimization**: Strategically places cliffhangers for monetization
- **Multi-genre Support**: Urban power fantasy, sweet romance, time-travel, revenge plots
- **Self-evolving**: Learns from successful short dramas and updates templates

## Installation

```bash
# Install via OpenClaw
openclaw skill install short-drama-writer

# Or copy to skills directory
cp -r short-drama-writer /path/to/openclaw/skills/
```

## Usage

```bash
# Create a new short drama
openclaw run short-drama-writer create \
  --title "龙王赘婿归来" \
  --genre urban-power \
  --episodes 80 \
  --target "revenge,face-slapping,hidden-identity"

# Analyze and optimize existing script
openclaw run short-drama-writer analyze \
  --file script.txt \
  --checkpoints 10,20,30

# Learn from successful case
openclaw run short-drama-writer learn \
  --case "case-study.json" \
  --update-templates
```

## Architecture

```
short-drama-writer/
├── SKILL.md              # This file
├── index.ts              # Main entry point
├── lib/
│   ├── hooks.ts          # Hook generation engine
│   ├── emotion.ts        # Emotional curve designer
│   ├── checkpoints.ts    # Payment point optimizer
│   ├── templates.ts      # Genre templates
│   └── evolution.ts      # Self-learning engine
└── examples/
    └── sample-output.json
```

## Self-Evolution Mechanism

The skill evolves through:

1. **Data Collection**: Analyzes successful short drama metrics
2. **Pattern Recognition**: Identifies successful patterns
3. **Template Update**: Updates internal templates
4. **A/B Testing**: Compares new vs old approaches
5. **Knowledge Base Sync**: Updates with latest trends

## License

MIT
