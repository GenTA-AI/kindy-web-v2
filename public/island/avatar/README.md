# Island character sheet

`characters.png` is a 16px-grid runtime sheet derived only from
`public/island/tiles/character.png` and `public/island/tiles/props.png`.
It remains subject to the license recorded in `public/island/tiles/LICENSE.md`.

- x=0..191: down, side, and up avatar idle/walk pairs (32x32 each)
- x=192 and x=240: fishing envoy idle pair (48x48 each)
- x=288: proximity speech icon (16x16)

The avatar's original hair and clothing palette is replaced pixel-for-pixel at
runtime. Phaser tint multiplication is intentionally not used.
