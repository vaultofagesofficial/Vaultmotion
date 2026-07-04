const express = require('express');
const router = express.Router();

const TEMPLATES = [
  {
    id: 'cinematic_title',
    name: 'Cinematic Title',
    description: 'Dramatische titel animatie — tekst vliegt in van onderaf met particle effects',
    use_for: 'Hook opening — altijd eerste scène',
    duration_range: '3-5 seconden',
    icon: '🎬'
  },
  {
    id: 'ken_burns',
    name: 'Ken Burns',
    description: 'Langzame zoom op stilstaand beeld met tekst overlay onderaan',
    use_for: 'Context en verhaal scènes',
    duration_range: '5-15 seconden',
    icon: '📸'
  },
  {
    id: 'animated_map',
    name: 'Animated Map',
    description: 'Geanimeerde wereldkaart met pulserende locaties en bewegende pijlen',
    use_for: 'Geografische context',
    duration_range: '5-10 seconden',
    icon: '🗺️'
  },
  {
    id: 'timeline',
    name: 'Timeline',
    description: 'Horizontale tijdlijn — events animeren één voor één in met rode accent lijn',
    use_for: 'Chronologisch verhaal',
    duration_range: '5-10 seconden',
    icon: '📅'
  },
  {
    id: 'stats_counter',
    name: 'Stats Counter',
    description: 'Cijfers tellen op van 0 naar eindwaarde met dramatische typografie',
    use_for: 'Impactvolle feiten en statistieken',
    duration_range: '3-6 seconden',
    icon: '📊'
  },
  {
    id: 'outro_cta',
    name: 'Outro CTA',
    description: 'Call-to-action eindscherm met kanaalinformatie en subscribe animatie',
    use_for: 'Altijd laatste scène',
    duration_range: '5 seconden',
    icon: '🔔'
  }
];

router.get('/', (req, res) => {
  res.json(TEMPLATES);
});

router.get('/:id', (req, res) => {
  const template = TEMPLATES.find(t => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Template niet gevonden' });
  res.json(template);
});

module.exports = router;
