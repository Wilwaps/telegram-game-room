const express = require('express');
const router = express.Router();

// Playlist simple (MVP). En una iteración futura, personalizar por usuario
const DEFAULT_PLAYLIST = [
  {
    id: 'sh1',
    title: 'SoundHelix Song 1',
    artist: 'SoundHelix',
    cover: 'https://picsum.photos/seed/sh1/300/300',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: 'sh2',
    title: 'SoundHelix Song 2',
    artist: 'SoundHelix',
    cover: 'https://picsum.photos/seed/sh2/300/300',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  },
  {
    id: 'sh3',
    title: 'SoundHelix Song 3',
    artist: 'SoundHelix',
    cover: 'https://picsum.photos/seed/sh3/300/300',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
  }
];

router.get('/playlist', (req, res) => {
  try {
    // En el futuro: usar req.query.userId o cabecera de webapp telegram
    res.json({ success: true, items: DEFAULT_PLAYLIST });
  } catch (err) {
    res.status(500).json({ success: false, error: 'playlist_error' });
  }
});

module.exports = router;
