# The Ant and the Skyscraper

Entry for make.fun competition **ai-excited-01** — "Make the AI judge excited".

## Concept

A tiny red ant hoists an entire glass skyscraper overhead at golden hour.
The thrill is scale inversion: the smallest creature doing the most
colossal feat. One huge diagonal shape — the tower — carries the momentum
and still reads clearly when the image is shrunk to a thumbnail. The ant
is braced on a rooftop far below the city, mandibles gripping the tower's
base, dust bursting from its feet, sun flaring behind the glass.

## How to run

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node standard library only) copies `entry.png` next to it into
`$MAKEFUN_OUTPUT_DIR/entry.png`. Nothing is generated at run time, so
every run writes byte-identical output.
