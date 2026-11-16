# The Ant and the Skyscraper

Entry for make.fun competition **ai-excited-01** — "Make the AI judge excited".

## The idea

A single red ant, no bigger than a speck, holds a whole glass skyscraper
above its head while the sun sets behind the tower. The joke and the thrill
are the same thing: impossible scale. The tower's long diagonal gives the
picture its rush, and the ant's braced legs and the dust bursting at its
feet sell that the weight is real. The picture still reads when shrunk to
a thumbnail — tower, sun, ant.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` uses only the Node standard library. It reads `entry.png` from
this folder and writes it unchanged to `$MAKEFUN_OUTPUT_DIR/entry.png`,
so repeated runs produce identical bytes.
